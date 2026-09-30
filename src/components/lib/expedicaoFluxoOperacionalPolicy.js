/**
 * Fluxo operacional de Expedição/Logística (extraído de expedicaoEntregaPolicy).
 * Selecionar → separar/conferir → romaneio → despachar → registro → pendências.
 * Não substitui asserts canônicos; compõe os existentes.
 */

import {
  assertEntregaOnCreate,
  assertEntregaOnUpdate,
  assertRomaneioOnCreate,
  resolveEntregaClienteCalendarDay,
  todayCalendarDay,
} from './expedicaoEntregaPolicy.js';

/** @param {...unknown} values */
const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

/** @param {unknown} status */
const normalizeEntregaStatus = (status) => String(status || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT = Object.freeze({
  entity: 'Pedido',
  via: 'updateInContext',
  statusAlvo: 'Pronto para Faturar',
  coordenacao: 'codex-pedido-contrato',
  reservado: true,
});

/** @param {unknown} value */
const toQty = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {ExpedicaoRecord} item
 */
export const normalizeSeparacaoItem = (item = {}) => {
  const quantidade_pedida = toQty(item.quantidade_pedida ?? item.quantidade);
  const quantidade_separada = toQty(item.quantidade_separada);
  const unidade = firstText(item.unidade, item.unidade_medida, item.unidade_pedida) || '';
  const unidade_separada = firstText(item.unidade_separada, item.unidade, item.unidade_medida) || unidade;
  const divergencia = quantidade_separada !== quantidade_pedida;
  let status_item = 'aguardando';
  if (quantidade_separada > 0 && !divergencia) status_item = 'ok';
  else if (quantidade_separada > 0 && divergencia) status_item = 'divergente';
  return {
    ...item,
    quantidade_pedida,
    quantidade_separada,
    unidade,
    unidade_separada,
    divergencia,
    status_item,
  };
};

/**
 * Fail-closed de quantidades na separação/conferência.
 * @param {{ itens?: ExpedicaoRecord[] }} options
 */
export const assertSeparacaoQuantidades = ({ itens = [] } = {}) => {
  const list = (Array.isArray(itens) ? itens : []).map(normalizeSeparacaoItem);
  if (list.length === 0) {
    throw new Error('Separacao exige ao menos um item com quantidade.');
  }
  const semQuantidade = list.filter((item) => !(item.quantidade_separada > 0));
  if (semQuantidade.length > 0) {
    throw new Error('Informe quantidade separada maior que zero em todos os itens.');
  }
  const negativos = list.filter((item) => item.quantidade_separada < 0 || item.quantidade_pedida < 0);
  if (negativos.length > 0) {
    throw new Error('Quantidades nao podem ser negativas.');
  }
  const unidadeInvalida = list.filter((item) => {
    if (!item.unidade && !item.unidade_separada) return false;
    if (!item.unidade || !item.unidade_separada) return true;
    return String(item.unidade).toLowerCase() !== String(item.unidade_separada).toLowerCase();
  });
  if (unidadeInvalida.length > 0) {
    throw new Error('Unidade separada diverge da unidade pedida.');
  }
  const divergencias = list.filter((item) => item.divergencia);
  return {
    itens: list,
    divergencias,
    temDivergencia: divergencias.length > 0,
    todosConferidos: divergencias.length === 0,
  };
};

/**
 * Checklist mínimo da conferência antes de concluir.
 * @param {Record<string, unknown>} checklist
 */
export const assertSeparacaoChecklist = (checklist = {}) => {
  const required = [
    'conferiu_quantidade',
    'conferiu_qualidade',
    'conferiu_embalagem',
    'conferiu_etiquetas',
    'conferiu_documentos',
  ];
  const missing = required.filter((key) => checklist[key] !== true);
  if (missing.length > 0) {
    throw new Error('Checklist de conferencia incompleto.');
  }
  return true;
};

/**
 * Dupla confirmação obrigatória em ações sensíveis do fluxo.
 * @param {{ confirmed?: boolean, acao?: string }} options
 */
export const assertConfirmacaoDupla = ({ confirmed = false, acao = 'acao' } = {}) => {
  if (confirmed !== true) {
    throw new Error(`Confirmacao cancelada para ${acao}.`);
  }
  return true;
};

/**
 * Resolve conclusão da separação e o side-effect legado de Pedido (somente descritivo).
 * @param {{
 *   itens?: ExpedicaoRecord[],
 *   checklist?: Record<string, unknown>,
 *   groupId?: unknown,
 *   empresaId?: unknown,
 *   entregaId?: unknown,
 *   pedidoId?: unknown,
 *   confirmed?: boolean,
 * }} options
 */
export const resolveSeparacaoConclusion = ({
  itens = [],
  checklist = {},
  groupId = null,
  empresaId = null,
  entregaId = null,
  pedidoId = null,
  confirmed = false,
} = {}) => {
  if (!firstText(groupId) || !firstText(empresaId)) {
    throw new Error('Contexto multiempresa obrigatorio para concluir separacao.');
  }
  assertConfirmacaoDupla({ confirmed, acao: 'separacao' });
  assertSeparacaoChecklist(checklist);
  const qty = assertSeparacaoQuantidades({ itens });
  const statusSeparacao = qty.temDivergencia ? 'com_divergencia' : 'concluido';
  const nextEntregaStatus = qty.temDivergencia ? null : 'Pronto para Expedir';
  const shouldUpdatePedidoLegado = Boolean(!qty.temDivergencia && firstText(pedidoId));
  const pedidoLegadoPatch = shouldUpdatePedidoLegado
    ? {
      status: SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT.statusAlvo,
      group_id: firstText(groupId),
      grupo_id: firstText(groupId),
      empresa_id: firstText(empresaId),
      _legado_side_effect: SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT,
    }
    : null;

  const separacaoRecord = {
    group_id: firstText(groupId),
    grupo_id: firstText(groupId),
    empresa_id: firstText(empresaId),
    entrega_id: firstText(entregaId) || null,
    pedido_id: firstText(pedidoId) || null,
    tipo: 'conferencia',
    itens: qty.itens,
    status: statusSeparacao,
    tem_divergencia: qty.temDivergencia,
    divergencias_resumo: qty.temDivergencia
      ? `${qty.divergencias.length} item(ns) com divergencia`
      : '',
    checklist,
  };

  return {
    qty,
    statusSeparacao,
    nextEntregaStatus,
    shouldUpdatePedidoLegado,
    pedidoLegadoPatch,
    separacaoRecord,
  };
};

/**
 * Quantidades pendentes após entrega parcial/total (acompanhamento operacional).
 * @param {ExpedicaoRecord} entrega
 */
export const resolveQuantidadesPendentesEntrega = (entrega = {}) => {
  const parcial = entrega.entrega_parcial && typeof entrega.entrega_parcial === 'object'
    ? entrega.entrega_parcial
    : {};
  const quantidadePedida = Number(
    parcial.quantidade_pedida
    || entrega.quantidade_total
    || entrega.volumes
    || 0,
  );
  const st = normalizeEntregaStatus(entrega.status);
  const entregueTotal = st.includes('entregue') && !st.includes('parcial') && !st.includes('frustr');
  const quantidadeEntregue = entregueTotal
    ? (quantidadePedida > 0 ? quantidadePedida : Number(parcial.quantidade_entregue) || 0)
    : Number(parcial.quantidade_entregue) || 0;
  const pedidaSafe = Number.isFinite(quantidadePedida) && quantidadePedida > 0 ? quantidadePedida : 0;
  const entregueSafe = Number.isFinite(quantidadeEntregue) && quantidadeEntregue > 0 ? quantidadeEntregue : 0;
  const pendente = pedidaSafe > 0 ? Math.max(0, pedidaSafe - entregueSafe) : (st.includes('parcial') ? null : 0);
  return {
    quantidade_pedida: pedidaSafe || null,
    quantidade_entregue: entregueSafe,
    quantidade_pendente: pendente,
    parcial: Boolean(st.includes('parcial') || parcial.ativada),
  };
};

/**
 * Persistência multi-etapa: compensação (rollback) ≠ transação atômica única.
 * Despacho de N entregas = N updates; falha no meio exige compensação explícita.
 */
export const PERSISTENCIA_EXPEDICAO = Object.freeze({
  romaneioCreate: 'atomico_policy', // assertRomaneioOnCreate decide create|reuse numa decisão
  entregaCreate: 'atomico_policy',
  despachoPatches: 'compensacao', // applyDespachoPatchesWithRollback
  integracaoRomaneio: 'compensacao', // create Entregas + Romaneio + patches + Pedido legado
  logisticaReversa: 'compensacao', // Entrega + ContaReceber + estoque + notificação (sem TX única)
  registroFinal: 'atomico_policy', // resolveRegistroEntregaFinal + um update
});

/**
 * Seleciona entregas elegíveis para romaneio no contexto da empresa (fail-closed cruzado).
 * @param {ExpedicaoRecord[]} entregas
 * @param {{
 *   empresaId?: unknown,
 *   groupId?: unknown,
 *   selectedIds?: unknown[],
 *   exigirSelecao?: boolean,
 * }} options
 */
export const selectEntregasParaRomaneio = (entregas = [], {
  empresaId = null,
  groupId = null,
  selectedIds = null,
  exigirSelecao = false,
} = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para selecionar entregas do romaneio.');
  }
  const selectedSet = Array.isArray(selectedIds)
    ? new Set(selectedIds.map((id) => String(id)).filter(Boolean))
    : null;

  const foraDoContexto = (Array.isArray(selectedIds) ? selectedIds : [])
    .map((id) => (Array.isArray(entregas) ? entregas : []).find((row) => String(row.id) === String(id)))
    .filter(Boolean)
    .filter((row) => firstText(row.empresa_id) !== firstText(empresaId)
      || (firstText(groupId) && firstText(row.group_id) && firstText(row.group_id) !== firstText(groupId)));

  if (foraDoContexto.length > 0) {
    throw new Error('A entrega selecionada nao pertence ao contexto ativo.');
  }

  const elegiveis = (Array.isArray(entregas) ? entregas : []).filter((row) => {
    if (firstText(row.empresa_id) !== firstText(empresaId)) return false;
    if (firstText(groupId) && firstText(row.group_id) && firstText(row.group_id) !== firstText(groupId)) {
      return false;
    }
    if (firstText(row.romaneio_id)) return false;
    const st = normalizeEntregaStatus(row.status);
    if (!(st.includes('pronto') && st.includes('exped'))) return false;
    if (selectedSet && !selectedSet.has(String(row.id))) return false;
    return true;
  });

  if (exigirSelecao && elegiveis.length === 0) {
    throw new Error('Selecione pelo menos uma entrega elegivel da empresa.');
  }

  return elegiveis;
};

/**
 * Monta payload de romaneio + patches de despacho das entregas.
 * @param {{
 *   entregasSelecionadas?: ExpedicaoRecord[],
 *   empresaId?: unknown,
 *   groupId?: unknown,
 *   motorista?: unknown,
 *   motorista_id?: unknown,
 *   motorista_nome?: unknown,
 *   veiculo?: unknown,
 *   placa?: unknown,
 *   tipo_veiculo?: unknown,
 *   instrucoes_motorista?: unknown,
 *   checklist_saida?: Record<string, unknown>,
 *   confirmed?: boolean,
 *   now?: string,
 *   usuario?: unknown,
 *   usuario_id?: unknown,
 *   romaneiosExistentes?: ExpedicaoRecord[],
 * }} options
 */
export const resolveRomaneioDespacho = ({
  entregasSelecionadas = [],
  empresaId = null,
  groupId = null,
  motorista = null,
  motorista_id = null,
  motorista_nome = null,
  veiculo = null,
  placa = null,
  tipo_veiculo = 'Caminhão',
  instrucoes_motorista = '',
  checklist_saida = {},
  confirmed = false,
  now = new Date().toISOString(),
  usuario = 'Sistema',
  usuario_id = null,
  romaneiosExistentes = [],
  exigirChecklist = true,
} = {}) => {
  if (!firstText(groupId) || !firstText(empresaId)) {
    throw new Error('Contexto multiempresa obrigatorio para gerar romaneio.');
  }
  assertConfirmacaoDupla({ confirmed, acao: 'romaneio' });

  const checklistOk = ['documentos_ok', 'veiculo_ok', 'carga_conferida', 'combustivel_ok']
    .every((key) => checklist_saida[key] === true);
  if (exigirChecklist && !checklistOk) {
    throw new Error('Conclua o checklist de saida antes de gerar o romaneio.');
  }

  const selecionadas = selectEntregasParaRomaneio(entregasSelecionadas, {
    empresaId,
    groupId,
    selectedIds: entregasSelecionadas.map((row) => row.id),
    exigirSelecao: true,
  });

  const romaneioRecord = {
    group_id: firstText(groupId),
    grupo_id: firstText(groupId),
    empresa_id: firstText(empresaId),
    data_romaneio: String(now).split('T')[0],
    data_saida: now,
    motorista_id: firstText(motorista_id) || null,
    motorista: firstText(motorista_nome, motorista),
    veiculo: firstText(veiculo),
    placa: firstText(placa),
    tipo_veiculo: firstText(tipo_veiculo) || 'Caminhão',
    entregas_ids: selecionadas.map((row) => row.id),
    quantidade_entregas: selecionadas.length,
    status: 'Aprovado',
    instrucoes_motorista: firstText(instrucoes_motorista),
    checklist_saida,
  };

  const decision = assertRomaneioOnCreate({ record: romaneioRecord, romaneios: romaneiosExistentes });
  if (decision.reuse) {
    return { reuse: decision.reuse, romaneioRecord: decision.record, despachoPatches: [], action: 'retry' };
  }

  const despachoPatches = selecionadas.map((entrega, idx) => ({
    entregaId: entrega.id,
    patch: {
      group_id: firstText(groupId),
      grupo_id: firstText(groupId),
      empresa_id: firstText(empresaId),
      motorista_id: firstText(motorista_id) || null,
      motorista: firstText(motorista_nome, motorista),
      veiculo: firstText(veiculo),
      placa: firstText(placa),
      sequencia_rota: idx + 1,
      status: 'Saiu para Entrega',
      data_saida: now,
      historico_status: [
        ...(Array.isArray(entrega.historico_status) ? entrega.historico_status : []),
        {
          status: 'Saiu para Entrega',
          data_hora: now,
          usuario: firstText(usuario),
          usuario_id: firstText(usuario_id) || null,
          observacao: 'Despacho via romaneio',
        },
      ],
    },
  }));

  for (const item of despachoPatches) {
    assertEntregaOnUpdate({
      before: selecionadas.find((row) => row.id === item.entregaId) || {},
      patch: item.patch,
    });
  }

  return {
    reuse: null,
    romaneioRecord,
    despachoPatches,
    action: 'criar',
  };
};

/**
 * Registro final: total, parcial ou ocorrência — com prova/motivo e assert.
 * @param {{
 *   before?: ExpedicaoRecord,
 *   modo?: 'total' | 'parcial' | 'ocorrencia',
 *   comprovante?: ExpedicaoRecord,
 *   quantidade_entregue?: unknown,
 *   motivo?: unknown,
 *   groupId?: unknown,
 *   empresaId?: unknown,
 *   confirmed?: boolean,
 *   now?: string,
 *   usuario?: unknown,
 *   usuario_id?: unknown,
 * }} options
 */
export const resolveRegistroEntregaFinal = ({
  before = {},
  modo = 'total',
  comprovante = {},
  quantidade_entregue = null,
  motivo = '',
  groupId = null,
  empresaId = null,
  confirmed = false,
  now = new Date().toISOString(),
  usuario = 'Sistema',
  usuario_id = null,
} = {}) => {
  const gId = firstText(groupId, before.group_id);
  const eId = firstText(empresaId, before.empresa_id);
  if (!gId || !eId) {
    throw new Error('Contexto multiempresa obrigatorio para registrar entrega.');
  }
  assertConfirmacaoDupla({ confirmed, acao: `entrega_${modo}` });

  let status = 'Entregue';
  /** @type {ExpedicaoRecord} */
  let patch = {
    group_id: gId,
    grupo_id: gId,
    empresa_id: eId,
  };

  if (modo === 'ocorrencia') {
    if (!firstText(motivo)) throw new Error('Ocorrencia exige motivo.');
    status = 'Entrega Frustrada';
    patch = {
      ...patch,
      status,
      entrega_frustrada: {
        ...(before.entrega_frustrada || {}),
        motivo: firstText(motivo),
        tentativa_numero: Number(before.entrega_frustrada?.tentativa_numero || 0) + 1,
      },
    };
  } else if (modo === 'parcial') {
    if (!(toQty(quantidade_entregue) > 0)) {
      throw new Error('Quantidade entregue obrigatoria na entrega parcial.');
    }
    status = 'Entrega Parcial';
    const quantidadePedida = toQty(
      before.entrega_parcial?.quantidade_pedida
      || before.quantidade_total
      || before.volumes
      || 0,
    );
    patch = {
      ...patch,
      status,
      data_entrega: now,
      comprovante_entrega: {
        ...(before.comprovante_entrega || {}),
        ...comprovante,
      },
      entrega_parcial: {
        ativada: true,
        quantidade_entregue: toQty(quantidade_entregue),
        ...(quantidadePedida > 0 ? { quantidade_pedida: quantidadePedida } : {}),
      },
    };
  } else {
    status = 'Entregue';
    patch = {
      ...patch,
      status,
      data_entrega: now,
      comprovante_entrega: {
        ...(before.comprovante_entrega || {}),
        ...comprovante,
      },
    };
  }

  patch.historico_status = [
    ...(Array.isArray(before.historico_status) ? before.historico_status : []),
    {
      status,
      data_hora: now,
      usuario: firstText(usuario),
      usuario_id: firstText(usuario_id) || null,
      observacao: modo === 'ocorrencia'
        ? firstText(motivo)
        : `Registro ${modo} da entrega`,
    },
  ];

  const decision = assertEntregaOnUpdate({ before, patch });
  return { ...decision, modo, patch: decision.record };
};

/**
 * Classifica pendência operacional para acompanhamento.
 * @param {ExpedicaoRecord} entrega
 * @param {Date} [now]
 */
export const classifyEntregaPendencia = (entrega = {}, now = new Date()) => {
  const st = normalizeEntregaStatus(entrega.status);
  if (st.includes('entregue') && !st.includes('parcial') && !st.includes('frustr')) {
    return { tipo: null, prioridade: 0 };
  }
  if (st.includes('cancel')) return { tipo: null, prioridade: 0 };

  if (st.includes('frustr') || st.includes('ocorr')) {
    return { tipo: 'ocorrencia', prioridade: 90, label: 'Ocorrencia aberta' };
  }
  if (st.includes('parcial')) {
    return { tipo: 'parcial', prioridade: 80, label: 'Entrega parcial pendente' };
  }
  if (st.includes('diverg')) {
    return { tipo: 'divergencia', prioridade: 85, label: 'Divergencia na separacao' };
  }
  if (st.includes('aguard') || (st.includes('separ') && !st.includes('pronto'))) {
    return { tipo: 'separacao', prioridade: 50, label: 'Aguardando separacao/conferencia' };
  }
  if (st.includes('pronto') && st.includes('exped')) {
    return { tipo: 'romaneio', prioridade: 40, label: 'Pronta para romaneio/despacho' };
  }
  if (st.includes('transito') || st.includes('saiu') || st.includes('rota') || st.includes('chegada')) {
    const day = resolveEntregaClienteCalendarDay(entrega);
    const today = todayCalendarDay(now);
    if (day && day < today) {
      return { tipo: 'atrasada', prioridade: 95, label: 'Em rota com data cliente vencida' };
    }
    return { tipo: 'em_rota', prioridade: 30, label: 'Em rota / aguardando prova' };
  }
  return { tipo: 'outras', prioridade: 10, label: 'Pendencia operacional' };
};

/**
 * Lista pendências do fluxo a partir do conjunto de entregas (empresa/grupo).
 * @param {ExpedicaoRecord[]} entregas
 * @param {{ empresaId?: unknown, groupId?: unknown, now?: Date, tipos?: string[] }} [options]
 */
export const filterEntregasPendencias = (entregas = [], {
  empresaId = null,
  groupId = null,
  now = new Date(),
  tipos = null,
} = {}) => {
  const tipoSet = Array.isArray(tipos) && tipos.length > 0
    ? new Set(tipos.map((t) => String(t)))
    : null;

  return (Array.isArray(entregas) ? entregas : [])
    .filter((row) => {
      if (firstText(empresaId) && firstText(row.empresa_id, row.empresa_responsavel_id) !== firstText(empresaId)) {
        return false;
      }
      if (firstText(groupId) && firstText(row.group_id) && firstText(row.group_id) !== firstText(groupId)) {
        return false;
      }
      return true;
    })
    .map((row) => {
      const pendencia = classifyEntregaPendencia(row, now);
      const quantidades = resolveQuantidadesPendentesEntrega(row);
      return { ...row, pendencia, quantidades };
    })
    .filter((row) => row.pendencia?.tipo)
    .filter((row) => !tipoSet || tipoSet.has(row.pendencia.tipo))
    .sort((a, b) => (b.pendencia.prioridade || 0) - (a.pendencia.prioridade || 0));
};

/**
 * Troca de empresa: revalida seleção e zera IDs fora do novo contexto.
 * @param {{
 *   selectedIds?: unknown[],
 *   entregas?: ExpedicaoRecord[],
 *   empresaIdAnterior?: unknown,
 *   empresaIdNovo?: unknown,
 *   groupId?: unknown,
 * }} options
 */
export const revalidarSelecaoAposTrocaEmpresa = ({
  selectedIds = [],
  entregas = [],
  empresaIdAnterior = null,
  empresaIdNovo = null,
  groupId = null,
} = {}) => {
  if (!firstText(empresaIdNovo)) {
    return { selectedIds: [], removidos: [...selectedIds], motivo: 'empresa_obrigatoria' };
  }
  if (firstText(empresaIdAnterior) === firstText(empresaIdNovo)) {
    return { selectedIds: [...selectedIds], removidos: [], motivo: null };
  }
  const mantidos = [];
  const removidos = [];
  for (const id of selectedIds) {
    const row = (Array.isArray(entregas) ? entregas : []).find((item) => String(item.id) === String(id));
    if (!row) {
      removidos.push(id);
      continue;
    }
    const mesmaEmpresa = firstText(row.empresa_id) === firstText(empresaIdNovo);
    const mesmoGrupo = !firstText(groupId)
      || !firstText(row.group_id)
      || firstText(row.group_id) === firstText(groupId);
    if (mesmaEmpresa && mesmoGrupo) mantidos.push(id);
    else removidos.push(id);
  }
  return { selectedIds: mantidos, removidos, motivo: removidos.length ? 'troca_empresa' : null };
};

/** Status de Pedido elegíveis para iniciar separação/conferência. */
export const PEDIDOS_STATUS_ELEGIVEIS_SEPARACAO = Object.freeze([
  'aprovado',
  'faturado',
  'pronto para faturar',
  'em expedicao',
  'em expedição',
  'aguardando separacao',
  'aguardando separação',
  'em separacao',
  'em separação',
]);

/**
 * @param {unknown} status
 */
const normalizePedidoStatus = (status) => String(status || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

/**
 * Seleciona Pedidos elegíveis para separação no contexto da empresa (fail-closed cruzado).
 * Não altera contratos canônicos de Pedido — apenas filtra registros já carregados.
 * @param {ExpedicaoRecord[]} pedidos
 * @param {{
 *   empresaId?: unknown,
 *   groupId?: unknown,
 *   selectedIds?: unknown[],
 *   soFuturas?: boolean,
 *   now?: Date,
 *   exigirSelecao?: boolean,
 * }} options
 */
export const selectPedidosParaSeparacao = (pedidos = [], {
  empresaId = null,
  groupId = null,
  selectedIds = null,
  soFuturas = false,
  now = new Date(),
  exigirSelecao = false,
} = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para selecionar pedidos da separacao.');
  }
  const selectedSet = Array.isArray(selectedIds)
    ? new Set(selectedIds.map((id) => String(id)).filter(Boolean))
    : null;

  const foraDoContexto = (Array.isArray(selectedIds) ? selectedIds : [])
    .map((id) => (Array.isArray(pedidos) ? pedidos : []).find((row) => String(row.id) === String(id)))
    .filter(Boolean)
    .filter((row) => firstText(row.empresa_id) !== firstText(empresaId)
      || (firstText(groupId) && firstText(row.group_id, row.grupo_id)
        && firstText(row.group_id, row.grupo_id) !== firstText(groupId)));

  if (foraDoContexto.length > 0) {
    throw new Error('O pedido selecionado nao pertence ao contexto ativo.');
  }

  const elegiveis = (Array.isArray(pedidos) ? pedidos : []).filter((row) => {
    if (firstText(row.empresa_id) !== firstText(empresaId)) return false;
    const rowGroup = firstText(row.group_id, row.grupo_id);
    if (firstText(groupId) && rowGroup && rowGroup !== firstText(groupId)) return false;
    const st = normalizePedidoStatus(row.status);
    if (st.includes('cancel') || st.includes('entregue') || st.includes('rejeit')) return false;
    const elegivelStatus = PEDIDOS_STATUS_ELEGIVEIS_SEPARACAO.some((allowed) => {
      const a = normalizePedidoStatus(allowed);
      return st === a || st.includes(a) || a.includes(st);
    });
    if (!elegivelStatus) return false;
    if (soFuturas) {
      const day = resolveEntregaClienteCalendarDay(row);
      if (!day || day < todayCalendarDay(now)) return false;
    }
    if (selectedSet && !selectedSet.has(String(row.id))) return false;
    return true;
  });

  if (exigirSelecao && elegiveis.length === 0) {
    throw new Error('Selecione pelo menos um pedido elegivel da empresa.');
  }
  return elegiveis;
};

/** Status de Pedido elegíveis para montar romaneio (frente logística). */
export const PEDIDOS_STATUS_ELEGIVEIS_ROMANEIO = Object.freeze([
  'faturado',
  'pronto para faturar',
  'em expedicao',
  'em expedição',
  'pronto para expedir',
  'em separacao',
  'em separação',
]);

/**
 * Seleciona Pedidos elegíveis para romaneio no contexto da empresa.
 * @param {ExpedicaoRecord[]} pedidos
 * @param {{
 *   empresaId?: unknown,
 *   groupId?: unknown,
 *   selectedIds?: unknown[],
 *   exigirSelecao?: boolean,
 *   permitirRetirada?: boolean,
 * }} options
 */
export const selectPedidosParaRomaneio = (pedidos = [], {
  empresaId = null,
  groupId = null,
  selectedIds = null,
  exigirSelecao = false,
  permitirRetirada = false,
} = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para selecionar pedidos do romaneio.');
  }
  const selectedSet = Array.isArray(selectedIds)
    ? new Set(selectedIds.map((id) => String(id)).filter(Boolean))
    : null;

  const foraDoContexto = (Array.isArray(selectedIds) ? selectedIds : [])
    .map((id) => (Array.isArray(pedidos) ? pedidos : []).find((row) => String(row.id) === String(id)))
    .filter(Boolean)
    .filter((row) => firstText(row.empresa_id) !== firstText(empresaId)
      || (firstText(groupId) && firstText(row.group_id, row.grupo_id)
        && firstText(row.group_id, row.grupo_id) !== firstText(groupId)));
  if (foraDoContexto.length > 0) {
    throw new Error('O pedido selecionado nao pertence ao contexto ativo.');
  }

  const elegiveis = (Array.isArray(pedidos) ? pedidos : []).filter((row) => {
    if (firstText(row.empresa_id) !== firstText(empresaId)) return false;
    const rowGroup = firstText(row.group_id, row.grupo_id);
    if (firstText(groupId) && rowGroup && rowGroup !== firstText(groupId)) return false;
    if (!permitirRetirada && String(row.tipo_frete || '').toLowerCase().includes('retir')) return false;
    const st = normalizePedidoStatus(row.status);
    if (st.includes('cancel') || st.includes('entregue') || st.includes('rejeit') || st.includes('frustr')) {
      return false;
    }
    const okStatus = PEDIDOS_STATUS_ELEGIVEIS_ROMANEIO.some((allowed) => {
      const a = normalizePedidoStatus(allowed);
      return st === a || st.includes(a) || a.includes(st);
    });
    if (!okStatus) return false;
    if (selectedSet && !selectedSet.has(String(row.id))) return false;
    return true;
  });

  if (exigirSelecao && elegiveis.length === 0) {
    throw new Error('Selecione pelo menos um pedido elegivel da empresa para o romaneio.');
  }
  return elegiveis;
};

/**
 * Monta seed de Entrega a partir de Pedido (sem persistir).
 * @param {ExpedicaoRecord} pedido
 * @param {{ groupId?: unknown, empresaId?: unknown }} options
 */
export const buildEntregaSeedFromPedido = (pedido = {}, { groupId = null, empresaId = null } = {}) => {
  const eId = firstText(empresaId, pedido.empresa_id);
  const gId = firstText(groupId, pedido.group_id, pedido.grupo_id);
  if (!eId || !gId) {
    throw new Error('Contexto multiempresa obrigatorio para gerar entrega a partir do pedido.');
  }
  if (!firstText(pedido.id)) {
    throw new Error('Pedido obrigatorio para gerar entrega.');
  }
  return {
    group_id: gId,
    grupo_id: gId,
    empresa_id: eId,
    pedido_id: firstText(pedido.id),
    numero_pedido: firstText(pedido.numero_pedido),
    cliente_id: pedido.cliente_id || null,
    cliente_nome: firstText(pedido.cliente_nome),
    endereco_entrega_completo: pedido.endereco_entrega_completo || pedido.endereco_entrega_principal || null,
    status: 'Pronto para Expedir',
    peso_total_kg: Number(pedido.peso_total_kg) || 0,
    valor_mercadoria: Number(pedido.valor_total) || 0,
    tipo_frete: pedido.tipo_frete || null,
    data_entrega_solicitada: pedido.data_entrega_solicitada || pedido.data_previsao || null,
    data_previsao: pedido.data_previsao || pedido.data_entrega_solicitada || null,
  };
};

/**
 * Planeja entregas (create/reuse) a partir de Pedidos para ingressar no romaneio canônico.
 * Idempotente via assertEntregaOnCreate / findDuplicate.
 * @param {{
 *   pedidos?: ExpedicaoRecord[],
 *   entregasExistentes?: ExpedicaoRecord[],
 *   empresaId?: unknown,
 *   groupId?: unknown,
 *   selectedIds?: unknown[],
 * }} options
 */
export const planEntregasFromPedidosParaRomaneio = ({
  pedidos = [],
  entregasExistentes = [],
  empresaId = null,
  groupId = null,
  selectedIds = null,
} = {}) => {
  const selecionados = selectPedidosParaRomaneio(pedidos, {
    empresaId,
    groupId,
    selectedIds,
    exigirSelecao: true,
  });
  const creates = [];
  const reuses = [];
  const working = [...(Array.isArray(entregasExistentes) ? entregasExistentes : [])];

  for (const pedido of selecionados) {
    const seed = buildEntregaSeedFromPedido(pedido, { groupId, empresaId });
    const decision = assertEntregaOnCreate({ record: seed, entregas: working });
    if (decision.reuse) {
      reuses.push(decision.reuse);
    } else {
      creates.push(decision.record);
      // evita duplicar no mesmo lote in-memory
      working.push({ ...decision.record, id: `pending-${pedido.id}` });
    }
  }

  return {
    pedidos: selecionados,
    creates,
    reuses,
    action: creates.length === 0 && reuses.length > 0 ? 'retry' : 'criar',
  };
};

/**
 * Side-effect legado descritivo: Pedido → Em Trânsito após romaneio (IntegracaoRomaneio).
 * Contrato canônico permanece com Codex — não muta Pedido aqui.
 */
export const INTEGRACAO_ROMANEIO_PEDIDO_LEGADO_SIDE_EFFECT = Object.freeze({
  entity: 'Pedido',
  via: 'updateInContext',
  statusAlvo: 'Em Trânsito',
  coordenacao: 'codex-pedido-contrato',
  reservado: true,
});

/**
 * Patch descritivo de Pedido após romaneio bem-sucedido (legado).
 * @param {{ pedidoId?: unknown, groupId?: unknown, empresaId?: unknown, romaneioId?: unknown }} options
 */
export const resolvePedidoLegadoAposRomaneio = ({
  pedidoId = null,
  groupId = null,
  empresaId = null,
  romaneioId = null,
} = {}) => {
  if (!firstText(pedidoId) || !firstText(groupId) || !firstText(empresaId)) {
    return null;
  }
  return {
    status: INTEGRACAO_ROMANEIO_PEDIDO_LEGADO_SIDE_EFFECT.statusAlvo,
    group_id: firstText(groupId),
    grupo_id: firstText(groupId),
    empresa_id: firstText(empresaId),
    _legado_side_effect: {
      ...INTEGRACAO_ROMANEIO_PEDIDO_LEGADO_SIDE_EFFECT,
      romaneio_id: firstText(romaneioId) || null,
    },
  };
};

/**
 * Aplica patches de despacho com rollback se a persistência falhar no meio.
 * @param {{
 *   despachoPatches?: Array<{ entregaId: unknown, patch: ExpedicaoRecord }>,
 *   entregasById?: Map<string, ExpedicaoRecord>,
 *   failAtIndex?: number | null,
 * }} options
 */
export const applyDespachoPatchesWithRollback = ({
  despachoPatches = [],
  entregasById = new Map(),
  failAtIndex = null,
} = {}) => {
  const snapshots = [];
  try {
    for (let idx = 0; idx < despachoPatches.length; idx += 1) {
      const item = despachoPatches[idx];
      const id = String(item.entregaId || '');
      if (!id || !entregasById.has(id)) {
        throw new Error('Entrega ausente para despacho.');
      }
      if (failAtIndex !== null && failAtIndex !== undefined && Number(failAtIndex) === idx) {
        throw new Error('Falha de persistencia no despacho.');
      }
      const before = { ...entregasById.get(id) };
      snapshots.push(before);
      assertEntregaOnUpdate({ before, patch: item.patch || {} });
      entregasById.set(id, { ...before, ...(item.patch || {}) });
    }
    return {
      ok: true,
      appliedIds: snapshots.map((row) => row.id),
      rolledBackIds: [],
    };
  } catch (error) {
    for (let i = snapshots.length - 1; i >= 0; i -= 1) {
      const snap = snapshots[i];
      entregasById.set(String(snap.id), snap);
    }
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
      appliedIds: [],
      rolledBackIds: snapshots.map((row) => row.id),
    };
  }
};
