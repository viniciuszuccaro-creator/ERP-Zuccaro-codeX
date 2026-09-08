const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const ROTEIRIZACAO_ENTITIES = ['Rota', 'RoteirizacaoInteligente'];

export const isRoteirizacaoEntity = (entityName) => ROTEIRIZACAO_ENTITIES.includes(entityName);

export const prioridadeScore = (value) => {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('urg') || raw.includes('alta') || raw === '1' || raw === 'alta') return 3;
  if (raw.includes('media') || raw.includes('média') || raw === '2') return 2;
  if (raw.includes('baixa') || raw === '3') return 1;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return 0;
};

export const resolveCoordenadas = (record = {}) => {
  const endereco = record.endereco_entrega_completo || record.endereco || {};
  const latitude = Number(
    record.latitude
    ?? endereco.latitude
    ?? record.lat
    ?? endereco.lat,
  );
  const longitude = Number(
    record.longitude
    ?? endereco.longitude
    ?? record.lng
    ?? endereco.lng
    ?? endereco.lon,
  );
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};

export const distanciaKm = (p1 = {}, p2 = {}) => {
  const R = 6371;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((p1.latitude * Math.PI) / 180)
    * Math.cos((p2.latitude * Math.PI) / 180)
    * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const pesoEntregaKg = (entrega = {}) => Number(entrega.peso_total_kg || entrega.peso_kg || entrega.peso || 0) || 0;

export const volumeEntregaM3 = (entrega = {}) => Number(
  entrega.volume_total_m3 || entrega.volume_m3 || entrega.volume || 0,
) || 0;

export const capacidadeVeiculo = (veiculo = {}) => ({
  kg: Number(veiculo.capacidade_kg || veiculo.capacidade || 0) || 0,
  m3: Number(veiculo.capacidade_m3 || veiculo.volume_m3 || 0) || 0,
});

export const assertCapacidadeRota = ({ entregas = [], veiculo = {} } = {}) => {
  const caps = capacidadeVeiculo(veiculo);
  const peso = (Array.isArray(entregas) ? entregas : []).reduce((sum, item) => sum + pesoEntregaKg(item), 0);
  const volume = (Array.isArray(entregas) ? entregas : []).reduce((sum, item) => sum + volumeEntregaM3(item), 0);
  const alertas = [];
  if (caps.kg > 0 && peso > caps.kg) {
    alertas.push(`Peso ${peso.toFixed(2)} kg excede capacidade ${caps.kg.toFixed(2)} kg.`);
  }
  if (caps.m3 > 0 && volume > caps.m3) {
    alertas.push(`Volume ${volume.toFixed(2)} m³ excede capacidade ${caps.m3.toFixed(2)} m³.`);
  }
  return { ok: alertas.length === 0, peso, volume, capacidade: caps, alertas };
};

export const janelaInicioMinutos = (entrega = {}) => {
  const raw = firstText(entrega.janela_entrega_inicio, entrega.janela_inicio, entrega.horario_inicio);
  if (!raw) return null;
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
};

export const sortedEntregaIdsKey = (entregasOrIds = []) => {
  const ids = (Array.isArray(entregasOrIds) ? entregasOrIds : [])
    .map((item) => (typeof item === 'string' || typeof item === 'number'
      ? String(item)
      : firstText(item?.id, item?.entrega_id)))
    .filter(Boolean)
    .sort();
  return ids.join(',');
};

export const rotaIdempotencyKey = (record = {}) => {
  const explicit = firstText(record.idempotency_key);
  if (explicit) return explicit;
  const empresaId = firstText(record.empresa_id);
  const data = firstText(record.data_rota);
  const entregas = sortedEntregaIdsKey(
    record.entregas_ids
    || record.pontos_entrega
    || record.entregas_vinculadas,
  );
  if (!empresaId || !data || !entregas) return '';
  return ['rota', empresaId, data, entregas].join('|');
};

export const findDuplicateRota = (record = {}, rotas = []) => {
  const key = rotaIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(rotas) ? rotas : []).find((item) => {
    const status = String(item.status || '').toLowerCase();
    if (status.includes('cancel')) return false;
    return rotaIdempotencyKey(item) === key;
  }) || null;
};

export const otimizarRotaAvancada = ({
  origem = {},
  entregas = [],
  veiculo = {},
  parametros = {},
} = {}) => {
  const origemCoords = resolveCoordenadas(origem) || {
    latitude: Number(origem.latitude),
    longitude: Number(origem.longitude),
  };
  if (!Number.isFinite(origemCoords.latitude) || !Number.isFinite(origemCoords.longitude)) {
    throw new Error('Origem da rota sem coordenadas.');
  }

  const comCoords = [];
  const semCoords = [];
  for (const entrega of (Array.isArray(entregas) ? entregas : [])) {
    const coords = resolveCoordenadas(entrega);
    if (!coords) {
      semCoords.push(entrega);
      continue;
    }
    comCoords.push({ ...entrega, ...coords });
  }

  if (!comCoords.length) {
    throw new Error('Entregas sem coordenadas GPS.');
  }

  const priorizar = parametros.priorizar_urgencia !== false;
  const ordenados = [...comCoords].sort((a, b) => {
    if (priorizar) {
      const diff = prioridadeScore(b.prioridade) - prioridadeScore(a.prioridade);
      if (diff !== 0) return diff;
    }
    if (parametros.considerar_janela_horario !== false) {
      const ja = janelaInicioMinutos(a);
      const jb = janelaInicioMinutos(b);
      if (ja != null && jb != null && ja !== jb) return ja - jb;
      if (ja != null && jb == null) return -1;
      if (ja == null && jb != null) return 1;
    }
    return 0;
  });

  // Processa por faixa de prioridade e, dentro da faixa, usa Nearest Neighbor.
  const faixas = [];
  if (priorizar) {
    for (const ponto of ordenados) {
      const score = prioridadeScore(ponto.prioridade);
      const atualFaixa = faixas[faixas.length - 1];
      if (!atualFaixa || atualFaixa.score !== score) faixas.push({ score, pontos: [ponto] });
      else atualFaixa.pontos.push(ponto);
    }
  } else {
    faixas.push({ score: 0, pontos: ordenados });
  }

  const rota = [];
  let atual = origemCoords;
  for (const faixa of faixas) {
    const restantes = [...faixa.pontos];
    while (restantes.length) {
      let melhorIdx = 0;
      let melhorDist = Infinity;
      restantes.forEach((ponto, idx) => {
        const dist = distanciaKm(atual, ponto);
        if (dist < melhorDist) {
          melhorDist = dist;
          melhorIdx = idx;
        }
      });
      const escolhido = restantes.splice(melhorIdx, 1)[0];
      const distReal = distanciaKm(atual, escolhido);
      rota.push({
        ...escolhido,
        sequencia: rota.length + 1,
        ordem_sequencia: rota.length + 1,
        distancia_anterior_km: distReal,
        latitude: escolhido.latitude,
        longitude: escolhido.longitude,
        peso_kg: pesoEntregaKg(escolhido),
        volume_m3: volumeEntregaM3(escolhido),
        prioridade: escolhido.prioridade,
        janela_entrega_inicio: escolhido.janela_entrega_inicio || escolhido.janela_inicio,
        janela_entrega_fim: escolhido.janela_entrega_fim || escolhido.janela_fim,
      });
      atual = escolhido;
    }
  }

  const distanciaTotal = rota.reduce((sum, p) => sum + (p.distancia_anterior_km || 0), 0);
  const velocidade = Number(parametros.velocidade_media_kmh) || 40;
  const tempoParada = Number(parametros.tempo_medio_entrega_minutos) || 15;
  const tempoEstimado = ((distanciaTotal / velocidade) * 60) + (rota.length * tempoParada);
  const capacidade = assertCapacidadeRota({ entregas: rota, veiculo });
  const alertas = [...capacidade.alertas];
  if (semCoords.length) {
    alertas.push(`${semCoords.length} entrega(s) sem coordenadas foram ignoradas.`);
  }
  if (Number(parametros.distancia_maxima_km) > 0 && distanciaTotal > Number(parametros.distancia_maxima_km)) {
    alertas.push(`Distancia ${distanciaTotal.toFixed(1)} km excede maxima ${parametros.distancia_maxima_km} km.`);
  }

  return {
    pontos: rota,
    distancia_total_km: distanciaTotal,
    tempo_estimado_minutos: Math.round(tempoEstimado),
    algoritmo: 'Nearest Neighbor + prioridade/janela',
    data_calculo: new Date().toISOString(),
    capacidade,
    alertas,
    ignoradas_sem_coordenadas: semCoords.map((item) => item.id).filter(Boolean),
  };
};

export const reordenarPontosRota = (pontos = [], fromIndex, toIndex) => {
  const list = [...(Array.isArray(pontos) ? pontos : [])];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return list;
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  return list.map((ponto, idx) => ({
    ...ponto,
    sequencia: idx + 1,
    ordem_sequencia: idx + 1,
  }));
};

export const buildRotaRecord = ({
  otimizacao,
  motorista,
  veiculo,
  empresaId,
  groupId,
  dataRota,
  usuario,
} = {}) => {
  const pontos = Array.isArray(otimizacao?.pontos) ? otimizacao.pontos : [];
  const entregasIds = pontos.map((p) => firstText(p.id, p.entrega_id)).filter(Boolean);
  return {
    empresa_id: empresaId,
    group_id: groupId,
    grupo_id: groupId,
    nome_rota: `Rota ${dataRota || new Date().toLocaleDateString('pt-BR')} - ${firstText(motorista?.nome_completo, motorista?.nome, motorista?.full_name, 'Motorista')}`,
    data_rota: firstText(dataRota) || new Date().toISOString().slice(0, 10),
    motorista_id: firstText(motorista?.id),
    motorista: firstText(motorista?.nome_completo, motorista?.nome, motorista?.full_name),
    veiculo_id: firstText(veiculo?.id),
    veiculo: firstText(veiculo?.descricao, veiculo?.modelo, veiculo?.placa),
    placa: firstText(veiculo?.placa),
    entregas_ids: entregasIds,
    pontos_entrega: pontos.map((p) => ({
      sequencia: p.sequencia || p.ordem_sequencia,
      entrega_id: firstText(p.id, p.entrega_id),
      cliente_nome: p.cliente_nome,
      endereco_completo: firstText(
        p.endereco_completo,
        [
          p.endereco_entrega_completo?.logradouro,
          p.endereco_entrega_completo?.numero,
          p.endereco_entrega_completo?.cidade,
        ].filter(Boolean).join(', '),
      ),
      latitude: p.latitude,
      longitude: p.longitude,
      peso_kg: pesoEntregaKg(p),
      volume_m3: volumeEntregaM3(p),
      prioridade: p.prioridade,
      janela_entrega_inicio: p.janela_entrega_inicio,
      janela_entrega_fim: p.janela_entrega_fim,
      status: 'Pendente',
      tempo_estimado_parada_minutos: 15,
    })),
    distancia_total_km: Number(otimizacao?.distancia_total_km) || 0,
    tempo_total_previsto_minutos: Number(otimizacao?.tempo_estimado_minutos) || 0,
    peso_total_kg: pontos.reduce((sum, p) => sum + pesoEntregaKg(p), 0),
    volume_total_m3: pontos.reduce((sum, p) => sum + volumeEntregaM3(p), 0),
    otimizada: true,
    algoritmo_usado: firstText(otimizacao?.algoritmo, 'Nearest Neighbor + prioridade/janela'),
    status: 'Planejada',
    progresso_percentual: 0,
    entregas_concluidas: 0,
    entregas_frustradas: 0,
    criado_por: firstText(usuario),
    idempotency_key: undefined,
  };
};

export const assertRotaOnCreate = ({ record = {}, rotas = [], veiculo = null, bloquearCapacidade = false } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para rota.');
  }
  if (!firstText(record.motorista_id, record.motorista, record.motorista_nome)) {
    throw new Error('Motorista obrigatorio para rota.');
  }
  if (!firstText(record.veiculo_id, record.veiculo, record.placa)) {
    throw new Error('Veiculo obrigatorio para rota.');
  }
  const pontos = Array.isArray(record.pontos_entrega) ? record.pontos_entrega : [];
  const entregasIds = Array.isArray(record.entregas_ids) && record.entregas_ids.length
    ? record.entregas_ids
    : pontos.map((p) => firstText(p.entrega_id, p.id)).filter(Boolean);
  if (!entregasIds.length) {
    throw new Error('Selecione pelo menos uma entrega para a rota.');
  }

  const stamped = {
    ...record,
    data_rota: firstText(record.data_rota) || new Date().toISOString().slice(0, 10),
    entregas_ids: entregasIds,
    pontos_entrega: pontos.length
      ? pontos.map((p, idx) => ({
        ...p,
        sequencia: p.sequencia || p.ordem_sequencia || idx + 1,
        ordem_sequencia: p.ordem_sequencia || p.sequencia || idx + 1,
        entrega_id: firstText(p.entrega_id, p.id),
      }))
      : entregasIds.map((id, idx) => ({ entrega_id: id, sequencia: idx + 1, ordem_sequencia: idx + 1 })),
    status: firstText(record.status) || 'Planejada',
  };
  stamped.idempotency_key = rotaIdempotencyKey(stamped) || undefined;

  if (veiculo) {
    const capacidade = assertCapacidadeRota({
      entregas: stamped.pontos_entrega,
      veiculo,
    });
    stamped.peso_total_kg = capacidade.peso;
    stamped.volume_total_m3 = capacidade.volume;
    stamped.alertas_capacidade = capacidade.alertas;
    if (bloquearCapacidade && !capacidade.ok) {
      throw new Error(capacidade.alertas[0] || 'Capacidade do veiculo excedida.');
    }
  }

  const reuse = findDuplicateRota(stamped, rotas);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};

export const assertRoteirizacaoInteligenteOnCreate = ({ record = {}, rotas = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para roteirizacao inteligente.');
  }
  if (!firstText(record.group_id, record.grupo_id)) {
    throw new Error('Grupo obrigatorio para roteirizacao inteligente.');
  }
  if (!firstText(record.motorista_id, record.motorista, record.motorista_nome)) {
    throw new Error('Motorista obrigatorio para roteirizacao inteligente.');
  }
  if (!firstText(record.veiculo_id, record.veiculo, record.veiculo_placa, record.placa)) {
    throw new Error('Veiculo obrigatorio para roteirizacao inteligente.');
  }
  const vinculados = Array.isArray(record.entregas_vinculadas) ? record.entregas_vinculadas : [];
  if (!vinculados.length && !sortedEntregaIdsKey(record.entregas_ids)) {
    throw new Error('Selecione entregas para roteirizacao inteligente.');
  }
  const stamped = {
    ...record,
    group_id: firstText(record.group_id, record.grupo_id),
    grupo_id: firstText(record.grupo_id, record.group_id),
    data_rota: firstText(record.data_rota) || new Date().toISOString().slice(0, 10),
    entregas_ids: Array.isArray(record.entregas_ids) && record.entregas_ids.length
      ? record.entregas_ids
      : vinculados.map((item) => firstText(item.entrega_id, item.id)).filter(Boolean),
    status: firstText(record.status) || 'Planejada',
  };
  stamped.entregas_vinculadas = (Array.isArray(stamped.entregas_vinculadas) ? stamped.entregas_vinculadas : [])
    .map((item, idx) => ({
      ...item,
      entrega_id: firstText(item.entrega_id, item.id),
      ordem_sequencia: item.ordem_sequencia || item.sequencia || idx + 1,
      sequencia: item.sequencia || item.ordem_sequencia || idx + 1,
    }));
  stamped.idempotency_key = rotaIdempotencyKey({
    ...stamped,
    pontos_entrega: stamped.entregas_ids.map((id) => ({ entrega_id: id })),
  }) || undefined;
  const reuse = findDuplicateRota(stamped, rotas);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};

export const stampEntregaAtribuicaoRota = ({
  entrega = {},
  rota = {},
  motorista = {},
  veiculo = {},
  sequencia,
} = {}) => {
  const entregaId = firstText(entrega.id, entrega.entrega_id);
  if (!entregaId) throw new Error('Entrega obrigatoria para atribuicao de rota.');
  const seq = Number(sequencia || entrega.sequencia_rota || entrega.ordem_sequencia) || 1;
  return {
    group_id: firstText(rota.group_id, entrega.group_id, rota.grupo_id),
    grupo_id: firstText(rota.grupo_id, rota.group_id, entrega.grupo_id, entrega.group_id),
    empresa_id: firstText(rota.empresa_id, entrega.empresa_id),
    rota_id: firstText(rota.id, rota.rota_id),
    roteirizacao_id: firstText(rota.id),
    motorista_id: firstText(rota.motorista_id, motorista.id, entrega.motorista_id),
    motorista: firstText(
      rota.motorista_nome,
      motorista.nome_completo,
      motorista.nome,
      motorista.full_name,
      entrega.motorista,
    ),
    veiculo: firstText(
      rota.veiculo_placa,
      veiculo.descricao,
      veiculo.modelo,
      veiculo.placa,
      entrega.veiculo,
    ),
    placa: firstText(rota.veiculo_placa, veiculo.placa, entrega.placa),
    sequencia_rota: seq,
    status: firstText(entrega.status) || 'Pronto para Expedir',
  };
};

export const applyRoteirizacaoCreate = (entityName, record = {}, stores = {}) => {
  if (entityName === 'Rota') {
    return assertRotaOnCreate({
      record,
      rotas: stores.rotas,
      veiculo: stores.veiculo,
      bloquearCapacidade: stores.bloquearCapacidade,
    });
  }
  if (entityName === 'RoteirizacaoInteligente') {
    return assertRoteirizacaoInteligenteOnCreate({
      record,
      rotas: stores.roteirizacoes || stores.rotas,
    });
  }
  return { reuse: null, record };
};
