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
  if (discount > subtotal) throw new Error('O desconto não pode superar o subtotal.');
  return { subtotal: microsToDecimal(subtotal), total: microsToDecimal(subtotal - discount) };
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

/**
 * Hint quando o Orçamento tem snapshots comerciais incompletos (pós-031).
 * Legado sem nenhum campo de snapshot → null (servidor ainda resolve condição ao vivo).
 * Espelha `orcamentoConvertSnapshotGapHint` do backend.
 */
export function orcamentoConvertSnapshotHint(row) {
  if (!row) return null;
  const condCodigo = String(row.condicao_pagamento_codigo_snapshot || '').trim();
  const condNome = String(row.condicao_pagamento_nome_snapshot || '').trim();
  const parcelas = row.condicao_pagamento_parcelas_snapshot;
  const hasCondicaoField = Boolean(condCodigo || condNome || Array.isArray(parcelas));
  if (hasCondicaoField && (!condCodigo || !condNome || !Array.isArray(parcelas) || parcelas.length < 1)) {
    return 'Snapshots de condição incompletos — edite e salve o orçamento antes de converter.';
  }
  const tabCodigo = String(row.tabela_preco_codigo_snapshot || '').trim();
  const tabNome = String(row.tabela_preco_nome_snapshot || '').trim();
  const tabelaId = String(row.tabela_preco_id || '').trim();
  if ((tabelaId || tabCodigo || tabNome) && (!tabCodigo || !tabNome)) {
    return 'Snapshots de tabela de preço incompletos — edite e salve o orçamento antes de converter.';
  }
  if (row.promocao_aplicada === true) {
    const bps = Number(row.promocao_bps);
    if (!Number.isInteger(bps) || bps <= 0 || bps > 10000) {
      return 'Snapshot de promoção inconsistente — edite e salve o orçamento antes de converter.';
    }
  }
  return null;
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