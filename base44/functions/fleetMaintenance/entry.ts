import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const reportFleetFailure = (error) => {
  console.error('[fleetMaintenance] Falha em operacao auxiliar', error?.message || String(error));
};

// Haversine distance in kilometers
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchFuelPriceCfg(base44, empresaId, groupId) {
  try {
    const chave = 'combustivel_preco_atual';
    const q = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ chave, ...(groupId ? { group_id: groupId } : {}), ...(empresaId ? { empresa_id: empresaId } : {} ) }, undefined, 1);
    const cfg = q?.[0];
    return cfg?.valor || cfg?.preco || null;
  } catch {
    return null;
  }
}

async function audit(base44, { modulo = 'Expedição', entidade = 'Frota', descricao = '', dados = null, empresa_id = null, group_id = null, tipo_auditoria = 'sistema' }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'Sistema',
      acao: 'Visualização',
      modulo,
      tipo_auditoria,
      entidade,
      descricao,
      dados_novos: dados,
      empresa_id,
      group_id,
      data_hora: new Date().toISOString(),
    });
  } catch (error) { reportFleetFailure(error); }
}

async function processVehicle(base44, v, { empresaId, groupId, fuelPrice }) {
  const empresa_id = v?.empresa_id || empresaId || null;
  const group_id = v?.group_id || groupId || null;

  // 1) Buscar últimas posições (limit 200) e calcular distância
  let distKm = 0;
  try {
    const points = await base44.asServiceRole.entities.PosicaoVeiculo.filter({ veiculo_id: v.id }, '-created_date', 200);
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i + 1];
      const p2 = points[i];
      const lat1 = Number(p1?.latitude || p1?.lat);
      const lon1 = Number(p1?.longitude || p1?.lng || p1?.lon);
      const lat2 = Number(p2?.latitude || p2?.lat);
      const lon2 = Number(p2?.longitude || p2?.lng || p2?.lon);
      if ([lat1, lon1, lat2, lon2].every((x) => Number.isFinite(x))) {
        distKm += haversineKm(lat1, lon1, lat2, lon2);
      }
    }
  } catch (error) { reportFleetFailure(error); }

  // 2) Atualizar km total e métricas simples
  const patch = {};
  const kmTotalAtual = Number(v?.km_total) || 0;
  if (distKm > 0) patch.km_total = Number((kmTotalAtual + distKm).toFixed(2));
  patch.km_ult_exec = Number(distKm.toFixed(2));

  // 3) Custo por km (se houver base)
  try {
    const consumoKmPorLitro = Number(v?.consumo_km_l) || Number(v?.consumo_medio_km_l) || 0;
    const precoCombustivel = fuelPrice || Number(v?.preco_combustivel_atual) || 0;
    if (consumoKmPorLitro > 0 && precoCombustivel > 0) {
      const custoKm = precoCombustivel / consumoKmPorLitro; // R$/km
      patch.custo_km_estimado = Number(custoKm.toFixed(4));
      if (distKm > 0) patch.custo_rodada_estimado = Number((custoKm * distKm).toFixed(2));
    }
  } catch (error) { reportFleetFailure(error); }

  // 4) Checagem de revisão preventiva
  const ultimaRevKm = Number(v?.ultima_revisao_km) || 0;
  const intervKm = Number(v?.manutencao_intervalo_km) || 0;
  const tolerancia = Number(v?.manutencao_tolerancia_km) || 200; // default 200km
  const novoKmTotal = patch.km_total ?? kmTotalAtual;
  const limiteAlert = (ultimaRevKm && intervKm) ? (ultimaRevKm + intervKm - tolerancia) : null;
  let needsReview = false;
  if (limiteAlert && novoKmTotal >= limiteAlert) {
    needsReview = true;
  }

  if (Object.keys(patch).length > 0) {
    try { await base44.asServiceRole.entities.Veiculo.update(v.id, patch); } catch (error) { reportFleetFailure(error); }
  }

  if (needsReview) {
    await audit(base44, {
      entidade: 'Manutenção Veicular',
      descricao: `Veículo ${v?.placa || v?.descricao || v?.id}: revisão preventiva próxima/pendente (km=${novoKmTotal}, limite_alerta=${limiteAlert}).`,
      dados: { veiculo_id: v.id, km_total: novoKmTotal, ultima_revisao_km: ultimaRevKm, manutencao_intervalo_km: intervKm },
      empresa_id,
      group_id,
      tipo_auditoria: 'sistema',
    });
  }

  return { veiculo_id: v.id, distKm, updated_km_total: patch.km_total ?? kmTotalAtual, needsReview };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { if (req.method !== 'GET') payload = await req.json(); } catch { payload = {}; }

    // Escopo multiempresa (herdável)
    const empresaId = payload?.empresa_id || payload?.empresaId || null;
    const groupId = payload?.group_id || payload?.groupId || null;

    // Se vier de automação de entidade (PosicaoVeiculo), focar no veículo relacionado
    let focusVehicleId = payload?.data?.veiculo_id || payload?.veiculo_id || null;
    if (!focusVehicleId && payload?.event?.entity_name === 'PosicaoVeiculo') {
      const posId = payload?.event?.entity_id;
      if (posId) {
        try {
          const pos = await base44.asServiceRole.entities.PosicaoVeiculo.get(posId);
          focusVehicleId = pos?.veiculo_id || null;
        } catch (error) { reportFleetFailure(error); }
      }
    }

    // Obter preço combustível por contexto
    const fuelPrice = await fetchFuelPriceCfg(base44, empresaId, groupId);

    // Seleção de veículos
    let veiculos = [];
    if (focusVehicleId) {
      try {
        const v = await base44.asServiceRole.entities.Veiculo.get(focusVehicleId);
        if (v) veiculos = [v];
      } catch (error) { reportFleetFailure(error); }
    } else {
      const criteria = { ...(groupId ? { group_id: groupId } : {}), ...(empresaId ? { empresa_id: empresaId } : {}) };
      veiculos = await base44.asServiceRole.entities.Veiculo.filter(criteria, '-updated_date', 200);
    }

    const results = [];
    for (const v of veiculos) {
      const r = await processVehicle(base44, v, { empresaId, groupId, fuelPrice });
      results.push(r);
    }

    // Integra: reconciliação de custos (opcional, se existir função)
    try {
      await base44.asServiceRole.functions.invoke('reconcileLogisticaCosts', { empresa_id: empresaId, group_id: groupId });
    } catch (error) { reportFleetFailure(error); }

    return Response.json({ ok: true, processed: results.length, results });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'internal_error' }, { status: 500 });
  }
});
