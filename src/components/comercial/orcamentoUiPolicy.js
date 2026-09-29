import { sanitizeObservacoesText } from './comercialListHttpUiPolicy.js';

const MICROS = 1_000_000n;

export function decimalToMicros(value) {
  const text = String(value ?? '0').trim();
  if (!/^\d+(\.\d{0,6})?$/.test(text)) throw new Error('Valor decimal inválido.');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * MICROS + BigInt((fraction + '000000').slice(0, 6));
}

export function microsToDecimal(value) {
  const micros = BigInt(value);
  return `${micros / MICROS}.${String(micros % MICROS).padStart(6, '0')}`;
}

export function calculateItem(item) {
  const quantity = decimalToMicros(item.quantidade);
  const unitPrice = decimalToMicros(item.preco_unitario);
  const discount = decimalToMicros(item.desconto || '0');
  const subtotal = (quantity * unitPrice) / MICROS;
  if (quantity <= 0n) throw new Error('A quantidade deve ser maior que zero.');
  if (unitPrice <= 0n) throw new Error('O preço unitário deve ser maior que zero.');
  if (discount > subtotal) throw new Error('O desconto não pode superar o subtotal.');
  return { subtotal: microsToDecimal(subtotal), total: microsToDecimal(subtotal - discount) };
}

const ITEM_LINES_EMPTY_HINT = 'Inclua pelo menos um item com quantidade e preço maiores que zero.';

/**
 * Valida uma linha do formulário (fail-closed) para UX antes de simular/salvar.
 * Simular: quantidade > 0 + produto/unidade/descrição (preço vem do servidor).
 * Salvar: quantidade e preço unitário > 0 + desconto ≤ subtotal.
 * @param {object} item
 * @param {number} [index]
 * @param {{ purpose?: 'save' | 'simular' }} [options]
 * @returns {Array<{ index: number, field: string, message: string }>}
 */
export function collectItemLineIssues(item, index = 0, options = {}) {
  const purpose = options.purpose === 'simular' ? 'simular' : 'save';
  const label = `Item ${index + 1}`;
  /** @type {Array<{ index: number, field: string, message: string }>} */
  const issues = [];

  try {
    const quantity = decimalToMicros(item?.quantidade);
    if (quantity <= 0n) {
      issues.push({ index, field: 'quantidade', message: `${label}: quantidade deve ser maior que zero.` });
    }
  } catch {
    issues.push({ index, field: 'quantidade', message: `${label}: quantidade inválida.` });
  }

  if (purpose === 'simular') {
    if (!String(item?.produto_id || '').trim()) {
      issues.push({ index, field: 'produto_id', message: `${label}: selecione o produto.` });
    }
    if (!String(item?.unidade_id || '').trim()) {
      issues.push({ index, field: 'unidade_id', message: `${label}: unidade inválida.` });
    }
    if (!String(item?.descricao || '').trim()) {
      issues.push({ index, field: 'descricao', message: `${label}: informe a descrição.` });
    }
    if (!String(item?.unidade_sigla || '').trim()) {
      issues.push({ index, field: 'unidade_sigla', message: `${label}: informe a sigla da unidade.` });
    }
    return issues;
  }

  try {
    const unitPrice = decimalToMicros(item?.preco_unitario);
    if (unitPrice <= 0n) {
      issues.push({ index, field: 'preco_unitario', message: `${label}: preço unitário deve ser maior que zero.` });
    }
  } catch {
    issues.push({ index, field: 'preco_unitario', message: `${label}: preço unitário inválido.` });
  }

  if (issues.length === 0) {
    try {
      calculateItem(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'linha inválida');
      issues.push({ index, field: 'desconto', message: `${label}: ${message}` });
    }
  }

  return issues;
}

/**
 * Gate fail-closed de itens do formulário Orçamento/Pedido.
 * @param {unknown} itens
 * @returns {{
 *   ok: boolean,
 *   blockSave: boolean,
 *   blockSimular: boolean,
 *   hint: string | null,
 *   issues: Array<{ index: number, field: string, message: string }>,
 *   simularIssues: Array<{ index: number, field: string, message: string }>,
 *   lineHints: Record<number, string>,
 * }}
 */
export function evaluateItemLinesGate(itens) {
  const list = Array.isArray(itens) ? itens : [];
  if (list.length === 0) {
    const emptyIssue = { index: -1, field: 'itens', message: 'Inclua pelo menos um item.' };
    return {
      ok: false,
      blockSave: true,
      blockSimular: true,
      hint: ITEM_LINES_EMPTY_HINT,
      issues: [emptyIssue],
      simularIssues: [emptyIssue],
      lineHints: {},
    };
  }

  const issues = list.flatMap((item, index) => collectItemLineIssues(item, index, { purpose: 'save' }));
  const simularIssues = list.flatMap((item, index) => collectItemLineIssues(item, index, { purpose: 'simular' }));
  /** @type {Record<number, string>} */
  const lineHints = {};
  for (const issue of issues) {
    if (issue.index < 0 || lineHints[issue.index]) continue;
    lineHints[issue.index] = issue.message;
  }
  for (const issue of simularIssues) {
    if (issue.index < 0 || lineHints[issue.index]) continue;
    lineHints[issue.index] = issue.message;
  }

  return {
    ok: issues.length === 0,
    blockSave: issues.length > 0,
    blockSimular: simularIssues.length > 0,
    hint: issues[0]?.message || simularIssues[0]?.message || null,
    issues,
    simularIssues,
    lineHints,
  };
}

export function calculateTotals(items) {
  return items.reduce((acc, item) => {
    const values = calculateItem(item);
    acc.subtotal += decimalToMicros(values.subtotal);
    acc.desconto += decimalToMicros(item.desconto || '0');
    acc.total += decimalToMicros(values.total);
    return acc;
  }, { subtotal: 0n, desconto: 0n, total: 0n });
}

export function canUseOrcamentoAction(hasPermission, action, status = 'EM_ABERTO') {
  if (!hasPermission('Comercial', 'orcamento', action)) return false;
  return ['editar', 'cancelar'].includes(action) ? status === 'EM_ABERTO' : true;
}

/**
 * Validade vigente: validade_em (date YYYY-MM-DD ou ISO) ainda não passou.
 * Compara o fim do dia civil local da data informada quando só há YYYY-MM-DD
 * (mesmo padrão do payload T12:00:00 — usa meio-dia local).
 */
export function isOrcamentoValidadeExpirada(validadeEm, now = new Date()) {
  if (!validadeEm) return true;
  const text = String(validadeEm).trim();
  if (!text) return true;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00`)
    : new Date(text);
  if (Number.isNaN(parsed.getTime())) return true;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return parsed.getTime() < nowMs;
}

/** Hint curto para formulário / conversão quando validade já expirou. */
export function orcamentoValidadeHint(validadeEm, now = new Date()) {
  if (!validadeEm) return 'Informe a validade da proposta.';
  if (isOrcamentoValidadeExpirada(validadeEm, now)) {
    return 'Validade expirada — altere a data antes de salvar ou converter.';
  }
  return null;
}

/** Hoje civil YYYY-MM-DD (local) para min= do input date. */
export function todayOrcamentoValidadeCalendarDay(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Gate UX fail-closed da validade (obrigatória + não expirada).
 * @param {unknown} validadeEm
 * @param {Date | number} [now]
 * @returns {{
 *   blockSave: boolean,
 *   hint: string | null,
 *   mode: 'required' | 'expired' | 'ready',
 *   minDay: string,
 * }}
 */
export function evaluateOrcamentoValidadeUiGate(validadeEm, now = new Date()) {
  const minDay = todayOrcamentoValidadeCalendarDay(now);
  const text = String(validadeEm ?? '').trim();
  if (!text) {
    return {
      blockSave: true,
      hint: 'Informe a validade da proposta.',
      mode: 'required',
      minDay,
    };
  }
  if (isOrcamentoValidadeExpirada(text, now)) {
    return {
      blockSave: true,
      hint: 'Validade expirada — altere a data antes de salvar ou converter.',
      mode: 'expired',
      minDay,
    };
  }
  return { blockSave: false, hint: null, mode: 'ready', minDay };
}

/**
 * Snapshot gap pós-031 (condição/tabela/promo). Legado sem nenhum campo → null.
 * @param {object | null | undefined} row
 * @param {{ purpose?: 'convert' | 'resumo', entityLabel?: string }} [options]
 */
export function comercialDocumentoSnapshotGapHint(row, options = {}) {
  if (!row) return null;
  const purpose = options.purpose === 'convert' ? 'convert' : 'resumo';
  const label = String(options.entityLabel || (purpose === 'convert' ? 'orçamento' : 'documento')).trim() || 'documento';
  const suffix = purpose === 'convert'
    ? `edite e salve o ${label} antes de converter.`
    : `edite e salve o ${label} antes de gerar o resumo.`;
  const condCodigo = String(row.condicao_pagamento_codigo_snapshot || '').trim();
  const condNome = String(row.condicao_pagamento_nome_snapshot || '').trim();
  const parcelas = row.condicao_pagamento_parcelas_snapshot;
  const hasCondicaoField = Boolean(condCodigo || condNome || Array.isArray(parcelas));
  if (hasCondicaoField && (!condCodigo || !condNome || !Array.isArray(parcelas) || parcelas.length < 1)) {
    return `Snapshots de condição incompletos — ${suffix}`;
  }
  const tabCodigo = String(row.tabela_preco_codigo_snapshot || '').trim();
  const tabNome = String(row.tabela_preco_nome_snapshot || '').trim();
  const tabelaId = String(row.tabela_preco_id || '').trim();
  if ((tabelaId || tabCodigo || tabNome) && (!tabCodigo || !tabNome)) {
    return `Snapshots de tabela de preço incompletos — ${suffix}`;
  }
  if (row.promocao_aplicada === true) {
    const bps = Number(row.promocao_bps);
    if (!Number.isInteger(bps) || bps <= 0 || bps > 10000) {
      return `Snapshot de promoção inconsistente — ${suffix}`;
    }
  }
  return null;
}

/**
 * Hint quando o Orçamento tem snapshots comerciais incompletos (pós-031).
 * Legado sem nenhum campo de snapshot → null (servidor ainda resolve condição ao vivo).
 * Espelha `orcamentoConvertSnapshotGapHint` do backend.
 */
export function orcamentoConvertSnapshotHint(row) {
  return comercialDocumentoSnapshotGapHint(row, { purpose: 'convert', entityLabel: 'orçamento' });
}

/** Form dirty no mesmo orçamento — converter usaria estado servidor desatualizado. */
export const ORCAMENTO_CONVERT_DIRTY_HINT =
  'Há alterações não salvas neste orçamento — salve ou descarte antes de converter.';

/** Simulação dirty no mesmo orçamento — totais/promo podem divergir do persistido. */
export const ORCAMENTO_CONVERT_SIMULAR_DIRTY_HINT =
  'Simulação desatualizada — simule novamente e salve antes de converter (fail-closed).';

/**
 * Gate consolidado do botão Converter Orçamento→Pedido.
 * Motivos: validade + snapshot + dirty + simular dirty (um banner, fail-closed).
 * Dirty/simular só aplicam quando o formulário edita o mesmo id do row.
 *
 * @param {{
 *   row?: object | null,
 *   dirty?: boolean,
 *   simulacaoDirty?: boolean,
 *   editingId?: unknown,
 *   now?: Date | number,
 * }} [input]
 * @returns {{
 *   blockConvert: boolean,
 *   reasons: Array<{ code: string, message: string }>,
 *   bannerText: string | null,
 *   title: string | null,
 *   validade: boolean,
 *   snapshot: boolean,
 *   dirty: boolean,
 *   simularDirty: boolean,
 * }}
 */
export function evaluateOrcamentoConvertUiGate(input = {}) {
  const row = input.row;
  const now = input.now ?? new Date();
  /** @type {Array<{ code: string, message: string }>} */
  const reasons = [];

  if (!row || typeof row !== 'object') {
    reasons.push({ code: 'MISSING', message: 'Orçamento inválido para conversão.' });
  } else {
    if (row.status && String(row.status) !== 'EM_ABERTO') {
      reasons.push({
        code: 'STATUS',
        message: 'Somente orçamentos em aberto podem ser convertidos.',
      });
    }
    const validadeHint = orcamentoValidadeHint(row.validade_em, now);
    if (validadeHint) {
      reasons.push({ code: 'VALIDADE', message: validadeHint });
    }
    const snapshotHint = orcamentoConvertSnapshotHint(row);
    if (snapshotHint) {
      reasons.push({ code: 'SNAPSHOT', message: snapshotHint });
    }
  }

  const rowId = row?.id != null ? String(row.id).trim() : '';
  const editingId = input.editingId != null ? String(input.editingId).trim() : '';
  const formAffectsRow = Boolean(rowId) && Boolean(editingId) && rowId === editingId;
  if (formAffectsRow && Boolean(input.dirty)) {
    reasons.push({ code: 'DIRTY', message: ORCAMENTO_CONVERT_DIRTY_HINT });
  }
  if (formAffectsRow && Boolean(input.simulacaoDirty)) {
    reasons.push({ code: 'SIMULAR_DIRTY', message: ORCAMENTO_CONVERT_SIMULAR_DIRTY_HINT });
  }

  const blockConvert = reasons.length > 0;
  const joined = blockConvert ? reasons.map((item) => item.message).join(' · ') : '';
  return {
    blockConvert,
    reasons,
    bannerText: blockConvert ? `Conversão bloqueada: ${joined}` : null,
    title: blockConvert ? joined : null,
    validade: reasons.some((item) => item.code === 'VALIDADE'),
    snapshot: reasons.some((item) => item.code === 'SNAPSHOT'),
    dirty: reasons.some((item) => item.code === 'DIRTY'),
    simularDirty: reasons.some((item) => item.code === 'SIMULAR_DIRTY'),
  };
}

function formatResumoMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatResumoDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(parsed);
}

function escapeResumoHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resumo texto read-only a partir da entidade carregada + snapshots (sem inventar PDF).
 * @param {object} row
 * @param {{
 *   kind?: 'ORCAMENTO' | 'PEDIDO',
 *   empresaNome?: string,
 *   clienteNome?: string,
 *   statusLabel?: string,
 *   deliverySummaries?: Array<{ kind?: string, title?: string, lines?: string[] }>,
 * }} [options]
 */
export function buildComercialDocumentoResumoTexto(row, options = {}) {
  if (!row?.numero) throw new Error('Documento inválido para resumo texto.');
  const kind = options.kind === 'PEDIDO' ? 'PEDIDO' : 'ORCAMENTO';
  const title = kind === 'PEDIDO' ? 'Pedido' : 'Orçamento';
  const empresaNome = String(options.empresaNome || 'Empresa').trim() || 'Empresa';
  const clienteNome = String(options.clienteNome || 'Cliente').trim() || 'Cliente';
  const statusLabel = String(options.statusLabel
    || (kind === 'PEDIDO'
      ? (row.status || '-')
      : (row.status === 'EM_ABERTO' ? 'Em aberto' : (row.status === 'CANCELADO' ? 'Cancelado' : (row.status || '-'))))).trim();
  const lines = [
    `${empresaNome} — ${title} ${row.numero}`,
    `Status: ${statusLabel}`,
    `Cliente: ${clienteNome}`,
  ];
  if (kind === 'ORCAMENTO') {
    lines.push(`Validade: ${formatResumoDate(row.validade_em)}`);
  } else {
    lines.push(`Operação: ${row.tipo_operacao === 'RETIRADA' ? 'Retirada' : 'Entrega'}`);
    lines.push(`Entrega solicitada: ${formatResumoDate(row.data_entrega_solicitada)}`);
  }
  const condCodigo = String(row.condicao_pagamento_codigo_snapshot || '').trim();
  const condNome = String(row.condicao_pagamento_nome_snapshot || '').trim();
  if (condCodigo || condNome) {
    lines.push(`Condição: ${[condCodigo, condNome].filter(Boolean).join(' — ')}`);
  } else if (row.condicao_pagamento_id) {
    lines.push('Condição: (sem snapshot — legado)');
  }
  const parcelas = Array.isArray(row.condicao_pagamento_parcelas_snapshot)
    ? row.condicao_pagamento_parcelas_snapshot
    : [];
  if (parcelas.length > 0) {
    lines.push('Parcelas (snapshot):');
    for (const parcela of parcelas) {
      const ordem = parcela?.ordem ?? '-';
      const dias = parcela?.dias ?? '-';
      const percentual = parcela?.percentual != null ? String(parcela.percentual) : '-';
      lines.push(`  #${ordem} · ${dias} dias · ${percentual}%`);
    }
  }
  const tabCodigo = String(row.tabela_preco_codigo_snapshot || '').trim();
  const tabNome = String(row.tabela_preco_nome_snapshot || '').trim();
  if (tabCodigo || tabNome) {
    lines.push(`Tabela de preço: ${[tabCodigo, tabNome].filter(Boolean).join(' — ')}`);
  } else if (row.tabela_preco_id) {
    lines.push('Tabela de preço: (sem snapshot — legado)');
  }
  if (row.promocao_aplicada === true) {
    const cupom = String(row.promocao_cupom || '').trim();
    lines.push(`Promoção: ${row.promocao_bps} bps${cupom ? ` · cupom ${cupom}` : ''}`);
  } else if (row.promocao_aplicada === false) {
    lines.push('Promoção: não aplicada');
  }
  const deliveries = Array.isArray(options.deliverySummaries) ? options.deliverySummaries : [];
  if (deliveries.length > 0) {
    lines.push('Endereço de entrega:');
    for (const summary of deliveries) {
      const kindLabel = summary?.kind === 'obra' ? 'Obra' : 'Local';
      lines.push(`  ${kindLabel}: ${String(summary?.title || '').trim() || '-'}`);
      const addressLines = Array.isArray(summary?.lines) ? summary.lines : [];
      for (const addressLine of addressLines) {
        if (String(addressLine || '').trim()) lines.push(`    ${String(addressLine).trim()}`);
      }
    }
  } else if (kind === 'PEDIDO' && (row.cliente_local_id || row.obra_id)) {
    lines.push('Endereço: Local/Obra referenciados — confira o endereço do servidor na edição.');
  }
  lines.push('Itens:');
  const itens = Array.isArray(row.itens) ? row.itens : [];
  if (itens.length === 0) {
    lines.push('  (sem itens)');
  } else {
    itens.forEach((item, index) => {
      const desc = String(item?.descricao || '').trim() || '-';
      const un = String(item?.unidade_sigla || '').trim() || '-';
      const qtd = item?.quantidade != null ? String(item.quantidade) : '-';
      const preco = formatResumoMoney(item?.preco_unitario);
      const descItem = formatResumoMoney(item?.desconto);
      const totalItem = formatResumoMoney(item?.total);
      lines.push(`  ${index + 1}. ${desc} · ${qtd} ${un} · unit ${preco} · desc ${descItem} · ${totalItem}`);
    });
  }
  lines.push(`Subtotal: ${formatResumoMoney(row.subtotal)}`);
  lines.push(`Desconto: ${formatResumoMoney(row.desconto)}`);
  lines.push(`Total: ${formatResumoMoney(row.total)}`);
  const observacoes = String(row.observacoes || '').trim();
  if (observacoes) {
    lines.push('Observações:');
    lines.push(observacoes);
  }
  lines.push('Resumo texto gerado no ERP — conferir no sistema antes de uso externo.');
  return lines.join('\n');
}

/**
 * Estado UI do painel/janela de resumo texto (fail-closed se snapshots pós-031 incompletos).
 * @param {object | null | undefined} row
 * @param {{
 *   kind?: 'ORCAMENTO' | 'PEDIDO',
 *   empresaNome?: string,
 *   clienteNome?: string,
 *   statusLabel?: string,
 *   deliverySummaries?: Array<{ kind?: string, title?: string, lines?: string[] }>,
 *   entityLabel?: string,
 * }} [options]
 */
export function resolveComercialResumoPreviewState(row, options = {}) {
  if (!row || typeof row !== 'object' || !row.numero) {
    return {
      mode: 'invalid',
      text: null,
      hint: 'Documento inválido para resumo texto.',
      canPrint: false,
      canCopy: false,
    };
  }
  const kind = options.kind === 'PEDIDO' ? 'PEDIDO' : 'ORCAMENTO';
  const entityLabel = options.entityLabel || (kind === 'PEDIDO' ? 'pedido' : 'orçamento');
  const gap = comercialDocumentoSnapshotGapHint(row, { purpose: 'resumo', entityLabel });
  if (gap) {
    return {
      mode: 'blocked',
      text: null,
      hint: gap,
      canPrint: false,
      canCopy: false,
    };
  }
  try {
    const text = buildComercialDocumentoResumoTexto(row, { ...options, kind });
    return {
      mode: 'ready',
      text,
      hint: null,
      canPrint: true,
      canCopy: true,
    };
  } catch (error) {
    return {
      mode: 'invalid',
      text: null,
      hint: error?.message || 'Falha ao montar resumo texto.',
      canPrint: false,
      canCopy: false,
    };
  }
}

/**
 * Abre janela de texto puro (não PDF) para impressão/revisão.
 * @param {string} text
 * @param {{ title?: string }} [options]
 * @returns {boolean}
 */
export function openComercialResumoTextoWindow(text, options = {}) {
  const body = String(text || '').trim();
  if (!body) return false;
  const title = String(options.title || 'Resumo comercial').trim() || 'Resumo comercial';
  const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>${escapeResumoHtml(title)}</title>
<style>body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin:1.5rem;white-space:pre-wrap;line-height:1.45;font-size:13px;color:#111}
@media print{@page{margin:1.5cm}}</style></head>
<body><pre>${escapeResumoHtml(body)}</pre></body></html>`);
  printWindow.document.close();
  printWindow.onload = () => setTimeout(() => {
    try { printWindow.print(); } catch { /* janela pode ter sido fechada */ }
  }, 200);
  return true;
}

/** Atalho Orçamento → resumo texto completo (snapshots + itens). */
export function buildOrcamentoResumoTexto(row, options = {}) {
  return buildComercialDocumentoResumoTexto(row, { ...options, kind: 'ORCAMENTO' });
}

export function resolveOrcamentoResumoPreviewState(row, options = {}) {
  return resolveComercialResumoPreviewState(row, { ...options, kind: 'ORCAMENTO', entityLabel: 'orçamento' });
}

export function buildOrcamentoPayload(form, options = {}) {
  if (!form.cliente_empresa_id || !form.condicao_pagamento_id || !form.validade_em) throw new Error('Preencha cliente, condição e validade.');
  if (isOrcamentoValidadeExpirada(form.validade_em, options.now)) {
    throw new Error('Validade expirada — altere a data antes de salvar.');
  }
  if (!Array.isArray(form.itens) || form.itens.length === 0) throw new Error('Inclua pelo menos um item.');
  form.itens.forEach(calculateItem);
  const observacoes = sanitizeObservacoesText(form.observacoes);
  /** @type {Record<string, unknown>} */
  const payload = {
    cliente_empresa_id: form.cliente_empresa_id,
    condicao_pagamento_id: form.condicao_pagamento_id,
    validade_em: new Date(`${form.validade_em}T12:00:00`).toISOString(),
    observacoes: observacoes || undefined,
    itens: form.itens.map((item) => ({
      produto_id: item.produto_id,
      unidade_id: item.unidade_id,
      descricao: String(item.descricao || '').trim(),
      unidade_sigla: String(item.unidade_sigla || '').trim(),
      quantidade: microsToDecimal(decimalToMicros(item.quantidade)),
      preco_unitario: microsToDecimal(decimalToMicros(item.preco_unitario)),
      desconto: microsToDecimal(decimalToMicros(item.desconto || '0')),
    })),
  };
  const promocao = resolvePromocaoPayloadRef(form, options);
  if (promocao) payload.promocao = promocao;
  return payload;
}

/**
 * Refs de promoção a persistir (fail-closed no backend).
 * Preferência: options.promocao da última simulação aplicada; senão form.promocao_*.
 */
export function resolvePromocaoPayloadRef(form, options = {}) {
  const fromOption = options?.promocao;
  if (fromOption && fromOption.aplicada === true && Number.isInteger(Number(fromOption.bps)) && Number(fromOption.bps) > 0) {
    const ref = { bps: Math.trunc(Number(fromOption.bps)) };
    const cupom = String(fromOption.cupom || options.cupom || '').trim();
    if (cupom) ref.cupom = cupom.slice(0, 64);
    return ref;
  }
  if (form?.promocao_aplicada === true && Number.isInteger(Number(form.promocao_bps)) && Number(form.promocao_bps) > 0) {
    const ref = { bps: Math.trunc(Number(form.promocao_bps)) };
    const cupom = String(form.promocao_cupom || '').trim();
    if (cupom) ref.cupom = cupom.slice(0, 64);
    return ref;
  }
  return null;
}

export function buildOrcamentoShareText(orcamento, { empresaNome = 'Empresa', clienteNome = 'Cliente' } = {}) {
  if (!orcamento?.numero) throw new Error('Orçamento inválido para compartilhamento');
  const status = orcamento.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado';
  const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(orcamento.total || 0));
  const validade = orcamento.validade_em ? new Intl.DateTimeFormat('pt-BR').format(new Date(orcamento.validade_em)) : '-';
  return [`${empresaNome} - Orçamento ${orcamento.numero}`, `Cliente: ${clienteNome}`, `Status: ${status}`, `Validade: ${validade}`, `Total: ${total}`, 'O documento completo deve ser conferido no ERP antes do envio.'].join('\n');
}

/**
 * Mapeia documento Orçamento HTTP → formulário de edição (reload pós-save / openEdit).
 * Não inclui snapshots — use collectPersistedCommercialSnapshots na UI.
 * @param {object} row
 */
export function mapOrcamentoRowToForm(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('Orçamento inválido para recarregar o formulário.');
  }
  return {
    cliente_empresa_id: row.cliente_empresa_id || '',
    condicao_pagamento_id: row.condicao_pagamento_id || '',
    validade_em: String(row.validade_em || '').slice(0, 10),
    observacoes: row.observacoes || '',
    itens: Array.isArray(row.itens)
      ? row.itens.map((item) => ({
        produto_id: item.produto_id,
        unidade_id: item.unidade_id,
        descricao: item.descricao,
        unidade_sigla: item.unidade_sigla,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto: item.desconto,
      }))
      : [],
  };
}