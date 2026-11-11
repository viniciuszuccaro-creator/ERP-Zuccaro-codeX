const MICROS = 1_000_000n;

export function sameOrcamentoScope(opened, rendered, active) {
  return Boolean(opened?.groupId && opened?.empresaId && opened?.actorId
    && (!opened.token || active?.token === opened.token)
    && [rendered, active].every((scope) => scope
      && scope.groupId === opened.groupId
      && scope.empresaId === opened.empresaId
      && scope.actorId === opened.actorId));
}

/** Trava síncrona: um clique repetido não envia uma segunda mutação. */
export function createOrcamentoActionGate() {
  let pending = null;
  let sequence = 0;
  return {
    begin(opened, rendered, active) {
      if (pending || !sameOrcamentoScope(opened, rendered, active)) return null;
      pending = { id: ++sequence, scope: opened };
      return pending;
    },
    isCurrent(ticket, rendered, active) {
      return pending === ticket && sameOrcamentoScope(ticket?.scope, rendered, active);
    },
    end(ticket) {
      if (pending !== ticket) return false;
      pending = null;
      return true;
    },
    invalidate() { pending = null; },
  };
}

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

export function buildOrcamentoPayload(form) {
  if (!form.cliente_empresa_id || !form.condicao_pagamento_id || !form.validade_em) throw new Error('Preencha cliente, condição e validade.');
  if (!Array.isArray(form.itens) || form.itens.length === 0) throw new Error('Inclua pelo menos um item.');
  form.itens.forEach(calculateItem);
  const tabelaId = String(form.tabela_preco_id || '').trim();
  return {
    cliente_empresa_id: form.cliente_empresa_id,
    condicao_pagamento_id: form.condicao_pagamento_id,
    ...(tabelaId ? { tabela_preco_id: tabelaId } : {}),
    validade_em: new Date(`${form.validade_em}T12:00:00`).toISOString(),
    observacoes: String(form.observacoes || '').trim() || undefined,
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
}

export function buildOrcamentoShareText(orcamento, { empresaNome = 'Empresa', clienteNome = 'Cliente' } = {}) {
  if (!orcamento?.numero) throw new Error('Orçamento inválido para compartilhamento');
  const status = orcamento.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado';
  const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(orcamento.total || 0));
  const validade = orcamento.validade_em ? new Intl.DateTimeFormat('pt-BR').format(new Date(orcamento.validade_em)) : '-';
  return [`${empresaNome} - Orçamento ${orcamento.numero}`, `Cliente: ${clienteNome}`, `Status: ${status}`, `Validade: ${validade}`, `Total: ${total}`, 'O documento completo deve ser conferido no ERP antes do envio.'].join('\n');
}

/** Rascunho de criação a partir de um orçamento existente (sem id/número/status). */
export function mapOrcamentoRowToCreateDraft(row, { clearValidade = true } = {}) {
  if (!row?.cliente_empresa_id) throw new Error('Orçamento sem cliente para duplicar.');
  const itens = Array.isArray(row.itens) ? row.itens : [];
  return {
    cliente_empresa_id: row.cliente_empresa_id,
    condicao_pagamento_id: row.condicao_pagamento_id || '',
    tabela_preco_id: row.tabela_preco_id || '',
    validade_em: clearValidade ? '' : String(row.validade_em || '').slice(0, 10),
    observacoes: row.observacoes || '',
    itens: itens.length
      ? itens.map((item) => ({
        produto_id: item.produto_id || '',
        unidade_id: item.unidade_id || '',
        descricao: item.descricao || '',
        unidade_sigla: item.unidade_sigla || '',
        quantidade: String(item.quantidade ?? '1'),
        preco_unitario: String(item.preco_unitario ?? '0'),
        desconto: String(item.desconto ?? '0'),
      }))
      : [{ produto_id: '', unidade_id: '', descricao: '', unidade_sigla: '', quantidade: '1', preco_unitario: '0', desconto: '0' }],
  };
}

/**
 * Revalida itens contra mestres atuais (produto/unidade/condição).
 * Não inventa preço: se o produto existir, atualiza descrição/unidade; preço fica para revisão humana.
 */
export function revalidateOrcamentoDraftAgainstMasters(draft, masters = {}) {
  const produtos = Array.isArray(masters.produtos) ? masters.produtos : [];
  const unidades = Array.isArray(masters.unidades) ? masters.unidades : [];
  const condicoes = Array.isArray(masters.condicoes) ? masters.condicoes : [];
  const missingProducts = [];
  const missingUnits = [];
  let condicaoOk = true;
  if (draft.condicao_pagamento_id) {
    condicaoOk = condicoes.some((c) => c.id === draft.condicao_pagamento_id);
  }
  const itens = (Array.isArray(draft.itens) ? draft.itens : []).map((item) => {
    const produto = produtos.find((p) => p.id === item.produto_id);
    if (item.produto_id && !produto) missingProducts.push(item.produto_id);
    const unidadeId = produto?.unidade_medida_id || item.unidade_id || '';
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (unidadeId && !unidade) missingUnits.push(unidadeId);
    if (!produto) return { ...item };
    return {
      ...item,
      unidade_id: unidadeId,
      descricao: produto.descricao || produto.nome || item.descricao || '',
      unidade_sigla: unidade?.sigla || item.unidade_sigla || '',
    };
  });
  return {
    draft: { ...draft, itens },
    warnings: {
      condicaoAusente: Boolean(draft.condicao_pagamento_id) && !condicaoOk,
      produtosAusentes: [...new Set(missingProducts)],
      unidadesAusentes: [...new Set(missingUnits)],
    },
  };
}
