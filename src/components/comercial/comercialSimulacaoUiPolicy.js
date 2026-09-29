/**
 * Política UI da simulação de venda (Onda 2/3) — Orçamento/Pedido existentes.
 * Preview usa totais do servidor; create/update reaplica promoção no backend
 * via applyPromocaoOnPersist (UI não inventa total persistido).
 */

import { buildPersistedCondicaoSnapshotFromRow } from './comercialCondicaoHttpUiPolicy.js';
import { buildPersistedTabelaSnapshotFromRow } from './comercialTabelaPrecoHttpUiPolicy.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_RE = /^\d+(\.\d{1,6})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeMoney(value, fieldLabel = 'valor') {
  const raw = String(value ?? '0').trim();
  if (!MONEY_RE.test(raw)) throw new Error(`${fieldLabel} inválido.`);
  const [whole, fraction = ''] = raw.split('.');
  return `${whole}.${`${fraction}000000`.slice(0, 6)}`;
}

/**
 * Fail-closed: precisa visualizar orçamento OU pedido no Comercial (espelha RBAC do backend).
 */
export function canSimularVenda(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Comercial', 'orcamento', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Monta body estrito para simular-venda. Tenant nunca vai no payload.
 * @param {object} form
 * @param {{ baseDate?: string, promocaoBps?: number|string|null, cupom?: string|null }} [options]
 */
export function buildSimularVendaPayload(form, options = {}) {
  if (!form?.cliente_empresa_id || !UUID_RE.test(form.cliente_empresa_id)) {
    throw new Error('Selecione um cliente válido para simular.');
  }
  if (!Array.isArray(form.itens) || form.itens.length === 0) {
    throw new Error('Inclua pelo menos um item para simular.');
  }

  const itens = form.itens.map((item, index) => {
    if (!item?.produto_id || !UUID_RE.test(item.produto_id)) {
      throw new Error(`Item ${index + 1}: produto inválido.`);
    }
    if (!item?.unidade_id || !UUID_RE.test(item.unidade_id)) {
      throw new Error(`Item ${index + 1}: unidade inválida.`);
    }
    const descricao = String(item.descricao || '').trim();
    const unidade_sigla = String(item.unidade_sigla || '').trim();
    if (!descricao) throw new Error(`Item ${index + 1}: informe a descrição.`);
    if (!unidade_sigla) throw new Error(`Item ${index + 1}: informe a sigla da unidade.`);
    const quantidade = normalizeMoney(item.quantidade, `Item ${index + 1}: quantidade`);
    if (Number(quantidade) <= 0) throw new Error(`Item ${index + 1}: quantidade deve ser maior que zero.`);
    const row = {
      produto_id: item.produto_id,
      unidade_id: item.unidade_id,
      descricao,
      unidade_sigla,
      quantidade,
    };
    if (item.desconto != null && String(item.desconto).trim() !== '') {
      row.desconto = normalizeMoney(item.desconto, `Item ${index + 1}: desconto`);
    }
    return row;
  });

  /** @type {Record<string, unknown>} */
  const payload = {
    cliente_empresa_id: form.cliente_empresa_id,
    itens,
  };

  if (form.condicao_pagamento_id) {
    if (!UUID_RE.test(form.condicao_pagamento_id)) {
      throw new Error('Condição de pagamento inválida.');
    }
    payload.condicao_pagamento_id = form.condicao_pagamento_id;
  }

  const baseDate = options.baseDate != null && String(options.baseDate).trim() !== ''
    ? String(options.baseDate).trim()
    : undefined;
  if (baseDate) {
    if (!DATE_RE.test(baseDate)) throw new Error('Data base da simulação inválida.');
    payload.base_date = baseDate;
  }

  const bpsRaw = options.promocaoBps;
  const hasPromo = bpsRaw != null && String(bpsRaw).trim() !== '';
  if (hasPromo) {
    const bps = Number(bpsRaw);
    if (!Number.isInteger(bps) || bps <= 0 || bps > 10000) {
      throw new Error('Promoção em basis points deve ser inteiro positivo (máx. 10000).');
    }
    /** @type {{ bps: number, cupom?: string }} */
    const promocao = { bps };
    const cupom = String(options.cupom ?? '').trim();
    if (cupom) promocao.cupom = cupom.slice(0, 64);
    payload.promocao = promocao;
  }

  return payload;
}

/**
 * Garante que a resposta HTTP pertence ao Grupo/Empresa ativos (fail-closed cruzado).
 */
export function assertSimulacaoNoContexto(simulation, scope) {
  if (!simulation || typeof simulation !== 'object') {
    throw new Error('Simulação inválida.');
  }
  if (!scope?.groupId || !scope?.empresaId) {
    throw new Error('Contexto de grupo/empresa obrigatório.');
  }
  if (simulation.group_id !== scope.groupId || simulation.empresa_id !== scope.empresaId) {
    throw new Error('Simulação fora do contexto da empresa ativa.');
  }
  return simulation;
}

/**
 * Fail-closed: se o usuário pediu promoção, a resposta deve confirmar aplicação.
 */
export function assertPromocaoAplicadaOuFalhar(simulation, requestedPromocao) {
  if (!requestedPromocao) return simulation;
  if (!simulation?.promocao || simulation.promocao.aplicada !== true) {
    throw new Error('Promoção não aplicada pelo servidor (fail-closed).');
  }
  return simulation;
}

/**
 * Aplica preço/desconto/condição resolvidos no formulário existente (sem campos novos persistidos).
 * Preserva campos locais (validade, tipo_operacao, requer_producao, etc.).
 * Totais do cabeçalho NÃO são gravados no form — o backend recalcula no create/update.
 */
export function applySimulacaoToForm(form, simulation) {
  if (!form || !simulation) throw new Error('Formulário ou simulação ausente.');
  if (!simulation.condicao?.id || !UUID_RE.test(simulation.condicao.id)) {
    throw new Error('Condição resolvida indisponível na simulação.');
  }
  if (!Array.isArray(simulation.itens) || simulation.itens.length === 0) {
    throw new Error('Simulação sem itens precificados.');
  }
  if (simulation.itens.length !== form.itens.length) {
    throw new Error('Quantidade de itens da simulação diverge do formulário.');
  }

  const itens = form.itens.map((item, index) => {
    const priced = simulation.itens[index];
    if (!priced || priced.produto_id !== item.produto_id || priced.unidade_id !== item.unidade_id) {
      throw new Error(`Item ${index + 1}: divergência produto/unidade na simulação.`);
    }
    return {
      ...item,
      descricao: priced.descricao || item.descricao,
      unidade_sigla: priced.unidade_sigla || item.unidade_sigla,
      quantidade: normalizeMoney(priced.quantidade, `Item ${index + 1}: quantidade`),
      preco_unitario: normalizeMoney(priced.preco_unitario, `Item ${index + 1}: preço`),
      desconto: normalizeMoney(priced.desconto ?? '0', `Item ${index + 1}: desconto`),
    };
  });

  return {
    ...form,
    condicao_pagamento_id: simulation.condicao.id,
    itens,
  };
}

/**
 * Antes do save: se houver última simulação no mesmo contexto, aplica no form.
 * Evita gravar preços/descontos inventados localmente quando o usuário já simulou.
 */
export function mergeSimulacaoBeforeSave(form, lastSimulation, scope) {
  if (!lastSimulation) return form;
  const simulation = assertSimulacaoNoContexto(lastSimulation, scope);
  return applySimulacaoToForm(form, simulation);
}

/**
 * Totais exibidos: prioriza preview do servidor; senão rascunho local (não persistido).
 */
export function resolveDisplayTotals(simulacaoPreview, localTotals) {
  if (simulacaoPreview?.subtotal != null && simulacaoPreview?.desconto != null && simulacaoPreview?.total != null) {
    return {
      subtotal: String(simulacaoPreview.subtotal),
      desconto: String(simulacaoPreview.desconto),
      total: String(simulacaoPreview.total),
      source: 'server',
    };
  }
  if (localTotals?.subtotal != null && localTotals?.desconto != null && localTotals?.total != null) {
    return {
      subtotal: String(localTotals.subtotal),
      desconto: String(localTotals.desconto),
      total: String(localTotals.total),
      source: 'local-draft',
    };
  }
  return { subtotal: '0', desconto: '0', total: '0', source: 'empty' };
}

/**
 * Fail-closed: resposta de simular-venda deve trazer agenda completa do servidor
 * (espelha comercialParcelaSchedulePolicy — ordem/dias/%/valor/vencimento).
 * @param {object} simulation
 * @returns {Array<{ ordem: number, dias: number, percentual: string, valor: string, vencimento: string }>}
 */
export function assertParcelaScheduleFromSimulacao(simulation) {
  if (!simulation || typeof simulation !== 'object') {
    throw new Error('Simulação sem agenda de parcelas do servidor (fail-closed).');
  }
  const rows = simulation.parcelas;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Agenda de parcelas ausente na simulação (fail-closed).');
  }
  return rows.map((row, index) => {
    const ordem = Number(row?.ordem);
    const dias = Number(row?.dias);
    const percentual = String(row?.percentual ?? '').trim();
    const valor = String(row?.valor ?? '').trim();
    const vencimento = String(row?.vencimento ?? '').trim();
    if (!Number.isInteger(ordem) || ordem <= 0) {
      throw new Error(`Parcela ${index + 1}: ordem inválida na agenda do servidor.`);
    }
    if (!Number.isInteger(dias) || dias < 0) {
      throw new Error(`Parcela ${index + 1}: dias inválidos na agenda do servidor.`);
    }
    if (!MONEY_RE.test(percentual) || Number(percentual) <= 0) {
      throw new Error(`Parcela ${index + 1}: percentual inválido na agenda do servidor.`);
    }
    if (!MONEY_RE.test(valor)) {
      throw new Error(`Parcela ${index + 1}: valor inválido na agenda do servidor.`);
    }
    if (!DATE_RE.test(vencimento)) {
      throw new Error(`Parcela ${index + 1}: vencimento inválido na agenda do servidor.`);
    }
    return { ordem, dias, percentual, valor, vencimento };
  });
}

/**
 * Resumo seguro da agenda de parcelas (somente leitura UI).
 * Preferir assertParcelaScheduleFromSimulacao antes de exibir após simular-venda.
 * @returns {Array<{ ordem: number, dias: number, percentual: string, valor: string, vencimento: string, label: string }>}
 */
export function formatParcelasSchedule(parcelas) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) return [];
  return parcelas.map((row) => {
    const ordem = Number(row?.ordem) || 0;
    const dias = Number(row?.dias) || 0;
    const percentual = String(row?.percentual ?? '');
    const valor = String(row?.valor ?? '');
    const vencimento = String(row?.vencimento ?? '');
    return {
      ordem,
      dias,
      percentual,
      valor,
      vencimento,
      label: `${ordem}ª · ${dias}d · ${percentual}% · vence ${vencimento || '-'}`,
    };
  });
}

/**
 * Template read-only da condição resolvida (só #/dias/% — sem valor/vencimento).
 * Agenda completa com valores vem exclusivamente de simular-venda.
 * @param {{ parcelas?: Array<{ ordem?: number, dias?: number, percentual?: string }> } | null | undefined} condicaoSnapshot
 */
export function buildCondicaoParcelaTemplatePreview(condicaoSnapshot) {
  const rows = Array.isArray(condicaoSnapshot?.parcelas) ? condicaoSnapshot.parcelas : [];
  if (rows.length === 0) {
    return { mode: 'none', parcelas: [], hint: null };
  }
  const parcelas = rows.map((row) => ({
    ordem: Number(row?.ordem) || 0,
    dias: Number(row?.dias) || 0,
    percentual: String(row?.percentual ?? ''),
  }));
  return {
    mode: 'template',
    parcelas,
    hint: 'Template da condição (#/dias/%). Valores e vencimentos só após Simular venda (servidor).',
  };
}

/**
 * Estado UI da agenda: prioriza schedule do servidor (simular); senão template da condição.
 * Fail-closed: se houve simulação sem parcelas válidas → mode missing.
 * @param {{
 *   simulacaoPreview?: { parcelas?: unknown[] } | null,
 *   condicaoSnapshot?: { parcelas?: unknown[] } | null,
 *   simulationAsserted?: boolean,
 * }} input
 */
export function resolveParcelaScheduleUiState(input = {}) {
  const previewParcelas = Array.isArray(input.simulacaoPreview?.parcelas)
    ? input.simulacaoPreview.parcelas
    : null;
  if (previewParcelas) {
    if (previewParcelas.length === 0) {
      return {
        mode: 'missing',
        parcelas: [],
        hint: 'Agenda de parcelas ausente na simulação — recarregue com Simular venda (fail-closed).',
      };
    }
    return {
      mode: 'server',
      parcelas: previewParcelas,
      hint: 'Agenda read-only do servidor (simular-venda / comercialParcelaSchedulePolicy).',
    };
  }
  return buildCondicaoParcelaTemplatePreview(input.condicaoSnapshot);
}

/**
 * Snapshot leve para UI + refs a reenviar no save (migration 030).
 * Fail-closed: exige agenda de parcelas completa do servidor.
 */
export function buildSimulacaoPreviewState(simulation) {
  const parcelasAsserted = assertParcelaScheduleFromSimulacao(simulation);
  return {
    condicaoId: simulation?.condicao?.id || null,
    condicaoCodigo: simulation?.condicao?.codigo || null,
    condicaoNome: simulation?.condicao?.nome || null,
    subtotal: simulation?.subtotal || null,
    desconto: simulation?.desconto || null,
    total: simulation?.total || null,
    descontoBps: simulation?.desconto_bps ?? null,
    aprovacaoDescontoExigida: Boolean(simulation?.aprovacao_desconto_exigida),
    promocao: simulation?.promocao?.aplicada === true
      ? { aplicada: true, bps: simulation.promocao.promocaoBps, cupom: simulation.promocao.cupom || null }
      : null,
    parcelas: formatParcelasSchedule(parcelasAsserted),
    baseDate: simulation?.base_date || null,
  };
}

/**
 * Preview de promoção a partir do documento Orçamento/Pedido já gravado (reload após save).
 * Espelha campos persistidos pela migration 030 — sem inventar bps.
 * @param {object | null | undefined} row
 * @returns {{ aplicada: boolean, bps: number | null, cupom: string | null, fonte: string, persistido: boolean } | null}
 */
export function buildPersistedPromocaoSnapshotFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.promocao_aplicada !== true) {
    if (row.promocao_aplicada === false) {
      return {
        aplicada: false,
        bps: null,
        cupom: null,
        fonte: 'persistido',
        persistido: true,
      };
    }
    return null;
  }
  const bps = Number(row.promocao_bps);
  if (!Number.isInteger(bps) || bps <= 0 || bps > 10000) return null;
  const cupom = String(row.promocao_cupom || '').trim();
  return {
    aplicada: true,
    bps,
    cupom: cupom ? cupom.slice(0, 64) : null,
    fonte: 'persistido',
    persistido: true,
  };
}

/**
 * Coleta snapshots comerciais persistidos do documento salvo (condição + tabela + promoção).
 * Usado no reload pós-save para provar round-trip na UI sem reabrir o seletor.
 * @param {object | null | undefined} row
 * @param {{
 *   buildCondicao?: (row: object) => object | null,
 *   buildTabela?: (row: object) => object | null,
 * }} [builders] — injetáveis nos testes; default = políticas HTTP existentes
 */
export function collectPersistedCommercialSnapshots(row, builders = {}) {
  if (!row || typeof row !== 'object') {
    return { condicao: null, tabela: null, promocao: null };
  }
  const buildCondicao = builders.buildCondicao || buildPersistedCondicaoSnapshotFromRow;
  const buildTabela = builders.buildTabela || buildPersistedTabelaSnapshotFromRow;
  return {
    condicao: buildCondicao(row) || null,
    tabela: buildTabela(row) || null,
    promocao: buildPersistedPromocaoSnapshotFromRow(row),
  };
}

/**
 * Campos de input de promoção a partir do snapshot persistido (reload).
 * @param {{ aplicada?: boolean, bps?: number | null, cupom?: string | null } | null | undefined} snapshot
 */
export function promoInputsFromPersistedSnapshot(snapshot) {
  if (!snapshot || snapshot.aplicada !== true || !Number.isInteger(Number(snapshot.bps))) {
    return { promoBps: '', promoCupom: '' };
  }
  return {
    promoBps: String(Math.trunc(Number(snapshot.bps))),
    promoCupom: snapshot.cupom ? String(snapshot.cupom).slice(0, 64) : '',
  };
}
