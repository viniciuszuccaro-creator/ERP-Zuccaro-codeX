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

export function buildOrcamentoPayload(form) {
  if (!form.cliente_empresa_id || !form.condicao_pagamento_id || !form.validade_em) throw new Error('Preencha cliente, condição e validade.');
  if (!Array.isArray(form.itens) || form.itens.length === 0) throw new Error('Inclua pelo menos um item.');
  form.itens.forEach(calculateItem);
  return {
    cliente_empresa_id: form.cliente_empresa_id,
    condicao_pagamento_id: form.condicao_pagamento_id,
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