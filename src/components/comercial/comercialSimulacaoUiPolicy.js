/**
 * Política UI da simulação de venda (Onda 2/3) — Orçamento/Pedido existentes.
 * Preview usa totais do servidor; create/update reaplica promoção no backend
 * via applyPromocaoOnPersist (UI não inventa total persistido).
 */

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
 * Resumo seguro da agenda de parcelas (somente leitura UI).
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
 * Snapshot leve para UI + refs a reenviar no save (migration 030).
 */
export function buildSimulacaoPreviewState(simulation) {
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
    parcelas: formatParcelasSchedule(simulation?.parcelas),
    baseDate: simulation?.base_date || null,
  };
}
