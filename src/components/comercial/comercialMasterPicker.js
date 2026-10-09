/**
 * Helpers de seleção de mestres no fluxo canônico Cliente → Orçamento → Pedido.
 * Extraído para evitar duplicar filtro/label por código nas abas HTTP.
 */

export function normalizeMasterQuery(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function masterMatchesQuery(row, query, fields = []) {
  const q = normalizeMasterQuery(query);
  if (!q) return true;
  return fields.some((field) => normalizeMasterQuery(row?.[field]).includes(q));
}

export function formatMasterCodigoLabel(codigo, nome) {
  const code = String(codigo || '').trim();
  const name = String(nome || '').trim();
  if (code && name) return `${code} — ${name}`;
  return name || code || '';
}

export function clienteEmpresaPickerLabel(link, cliente) {
  const nome = cliente?.razao_social || cliente?.nome_fantasia || cliente?.nome || '';
  const codigo = link?.codigo || cliente?.codigo || '';
  return formatMasterCodigoLabel(codigo, nome) || link?.id || '';
}

export function produtoPickerLabel(produto) {
  return formatMasterCodigoLabel(produto?.codigo, produto?.descricao || produto?.nome) || produto?.id || '';
}

export function filterClienteEmpresaOptions(links, clientesById, query) {
  const q = normalizeMasterQuery(query);
  return (links || []).filter((link) => {
    if (link?.ativo === false || link?.habilitado_operacao === false || link?.bloqueado === true) return false;
    if (!q) return true;
    const cliente = clientesById?.get?.(link.cliente_id) || {};
    return masterMatchesQuery(
      { codigo: link.codigo, clienteCodigo: cliente.codigo, razao: cliente.razao_social, fantasia: cliente.nome_fantasia, nome: cliente.nome },
      q,
      ['codigo', 'clienteCodigo', 'razao', 'fantasia', 'nome'],
    );
  });
}

export function filterProdutoOptions(produtos, query) {
  return (produtos || []).filter((produto) => {
    if (produto?.ativo === false) return false;
    return masterMatchesQuery(produto, query, ['codigo', 'descricao', 'nome', 'sku']);
  });
}

/** Campos do contrato Comercial 360 ainda sem coluna/persistência no Orçamento. */
export const ORCAMENTO_PERSISTENCE_GAPS = Object.freeze({
  tabela_preco_id: 'schema orcamentos sem coluna; preço via resolveSalePrice (ClienteEmpresa→tabela)',
  preco_unitario_ui: 'UI pode divergir do gravado — servidor sobrescreve snapshot',
  unidade_alternativa: 'somente unidade principal do produto; sem conversão',
});
