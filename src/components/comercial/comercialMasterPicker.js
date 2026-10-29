import { isCanonicalComercialId } from './centralCliente360Navigation.js';

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

export function filterClienteEmpresaOptions(links, clientesById, query, selectedId) {
  const q = normalizeMasterQuery(query);
  return (links || []).filter((link) => {
    if (link?.ativo === false || link?.habilitado_operacao === false || link?.bloqueado === true) return false;
    if (!q || link.id === selectedId) return true;
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

/** Resolve only scoped canonical pages; never joins a local master to a guessed link. */
export function resolveComercialMasterPages(pages, scope) {
  const invalid = () => { throw new Error('COMERCIAL_MASTERS_INVALID'); };
  const rows = (page, paginated = true) => {
    if (!page || !Array.isArray(page.data) || page.data.length > 200) return invalid();
    if (paginated && (!Number.isSafeInteger(page.meta?.total) || page.meta.total < 0
      || !Number.isSafeInteger(page.meta?.limit) || page.meta.limit < 1 || page.meta.limit > 200
      || page.meta?.offset !== 0 || typeof page.meta?.hasMore !== 'boolean')) return invalid();
    for (const row of page.data) {
      if (!row || !isCanonicalComercialId(row.id) || row.ativo === false
        || (row.group_id && row.group_id !== scope.groupId)) return invalid();
    }
    return page.data;
  };
  const clientes = rows(pages?.clientes), produtos = rows(pages?.produtos);
  const condicoes = rows(pages?.condicoes), unidades = rows(pages?.unidades, false), tabelas = rows(pages?.tabelas);
  const clientesEmpresa = clientes.map(cliente => {
    const link = cliente.empresa_operacao;
    if (!link || !isCanonicalComercialId(link.id) || link.cliente_id !== cliente.id
      || link.group_id !== scope.groupId || link.empresa_id !== scope.empresaId
      || link.ativo !== true || link.situacao_comercial !== 'ATIVO' || link.habilitado_operacao !== true
      || link.bloqueado !== false || link.elegivel_operacao !== true) return invalid();
    return link;
  });
  if (new Set(clientesEmpresa.map(link => link.id)).size !== clientesEmpresa.length
    || new Set(clientes.map(cliente => cliente.id)).size !== clientes.length) return invalid();
  // These controls have no reference-catalog pagination: do not silently imply completeness.
  if (pages.condicoes.meta.hasMore || pages.tabelas.meta.hasMore || unidades.length === 200) {
    throw new Error('COMERCIAL_REFERENCE_PAGINATION_REQUIRED');
  }
  return { clientesEmpresa, clientes, condicoes, produtos, unidades, tabelas,
    clientesHasMore: pages.clientes.meta.hasMore, produtosHasMore: pages.produtos.meta.hasMore };
}

/**
 * Resolve vínculo selecionado a partir só da página /clientes (lookup leve).
 * Usado na hidratação de labels — não exige produtos/condições/unidades/tabelas.
 */
export function resolveComercialSelectedClienteLinks(clientesPage, scope, clienteEmpresaId) {
  const unavailable = () => { throw new Error('COMERCIAL_SELECTED_CLIENTE_UNAVAILABLE'); };
  if (!isCanonicalComercialId(clienteEmpresaId) || !clientesPage || !Array.isArray(clientesPage.data)
    || clientesPage.meta?.total !== 1 || clientesPage.meta?.limit !== 1 || clientesPage.meta?.offset !== 0
    || clientesPage.meta?.hasMore !== false || clientesPage.data.length !== 1) {
    return unavailable();
  }
  const cliente = clientesPage.data[0];
  if (!cliente || !isCanonicalComercialId(cliente.id) || cliente.ativo === false
    || (cliente.group_id && cliente.group_id !== scope.groupId)) {
    return unavailable();
  }
  const link = cliente.empresa_operacao;
  if (!link || !isCanonicalComercialId(link.id) || link.id !== clienteEmpresaId
    || link.cliente_id !== cliente.id || link.group_id !== scope.groupId || link.empresa_id !== scope.empresaId
    || link.ativo !== true || link.situacao_comercial !== 'ATIVO' || link.habilitado_operacao !== true
    || link.bloqueado !== false || link.elegivel_operacao !== true) {
    return unavailable();
  }
  return { clientes: [cliente], clientesEmpresa: [link] };
}

/** Resolve a selected relationship independently of the current search page. */
export function resolveComercialSelectedCliente(pages, scope, clienteEmpresaId) {
  // Prefer lightweight path when only the clientes page is present (resolveClienteEmpresa).
  if (pages && pages.clientes && pages.produtos === undefined) {
    return resolveComercialSelectedClienteLinks(pages.clientes, scope, clienteEmpresaId);
  }
  const result = resolveComercialMasterPages(pages, scope);
  if (!isCanonicalComercialId(clienteEmpresaId) || pages.clientes.meta.total !== 1
    || pages.clientes.meta.limit !== 1 || pages.clientes.meta.hasMore
    || result.clientes.length !== 1 || result.clientesEmpresa[0]?.id !== clienteEmpresaId) {
    throw new Error('COMERCIAL_SELECTED_CLIENTE_UNAVAILABLE');
  }
  return result;
}

export function mergeComercialSelectedCliente(masters, selection) {
  if (!selection) return masters;
  const link = selection.clientesEmpresa?.[0];
  const cliente = selection.clientes?.[0];
  // Página/seleção vazia ou parcial não pode empurrar undefined no catálogo de labels.
  if (!link?.id || !cliente?.id) return masters;
  return {
    ...masters,
    clientes: [...masters.clientes.filter(row => row.id !== cliente.id), cliente],
    clientesEmpresa: [...masters.clientesEmpresa.filter(row => row.id !== link.id), link],
  };
}

/**
 * Une catálogos de cliente/vínculo sem descartar entradas já resolvidas
 * (página de busca temporária ≠ catálogo de labels da listagem/PDF/share).
 * Preserva demais campos do masters (condicoes/produtos/…) — só troca cliente catalogs.
 *
 * @template {{ clientes?: any[], clientesEmpresa?: any[] }} T
 * @param {T} [base]
 * @param {{ clientes?: any[], clientesEmpresa?: any[] }} [patch]
 * @returns {T & { clientes: any[], clientesEmpresa: any[] }}
 */
export function unionComercialClienteCatalog(base = /** @type {T} */ ({}), patch = {}) {
  const clientes = [...(base.clientes || [])];
  const links = [...(base.clientesEmpresa || [])];
  for (const cliente of patch.clientes || []) {
    if (!cliente?.id) continue;
    const idx = clientes.findIndex((row) => row.id === cliente.id);
    if (idx >= 0) clientes[idx] = cliente;
    else clientes.push(cliente);
  }
  for (const link of patch.clientesEmpresa || []) {
    if (!link?.id) continue;
    const idx = links.findIndex((row) => row.id === link.id);
    if (idx >= 0) links[idx] = link;
    else links.push(link);
  }
  return /** @type {T & { clientes: any[], clientesEmpresa: any[] }} */ ({
    ...base,
    clientes,
    clientesEmpresa: links,
  });
}

/** Lacunas remanescentes do contrato Orçamento (após 039 tabela_preco_id). */
export const ORCAMENTO_PERSISTENCE_GAPS = Object.freeze({
  preco_unitario_ui: 'UI pode divergir do gravado — servidor sobrescreve snapshot',
  unidade_alternativa: 'somente unidade principal do produto; sem conversão',
});

/** Scoped Local/Obra options from the existing Central 360; partial blocks are not empty catalogs. */
export function resolveComercialAuxiliaryView(view, scope, clienteId, clienteEmpresaId) {
  const invalid = () => { throw new Error('COMERCIAL_AUXILIARY_INVALID'); };
  const body = view?.data ?? view;
  if (!isCanonicalComercialId(clienteId) || !isCanonicalComercialId(clienteEmpresaId)
    || body?.identity?.id !== clienteId || body.meta?.groupId !== scope.groupId
    || body.meta?.empresaId !== scope.empresaId || body.meta?.clienteId !== clienteId
    || body.meta?.clienteEmpresaId !== clienteEmpresaId
    || body.empresaLink?.id !== clienteEmpresaId || body.empresaLink?.cliente_id !== clienteId
    || body.empresaLink?.empresa_id !== scope.empresaId || body.empresaLink?.ativo !== true
    || body.empresaLink?.elegivel_operacao !== true) return invalid();
  const rows = name => {
    const block = body.blocks?.[name];
    if (block?.status !== 'ok') throw new Error('COMERCIAL_AUXILIARY_UNAVAILABLE');
    const meta = block.meta;
    if (!Array.isArray(block.data) || block.data.length > 200
      || !Number.isSafeInteger(meta?.total) || meta.total < block.data.length
      || !Number.isSafeInteger(meta?.limit) || meta.limit < 1 || meta.limit > 200
      || meta.offset !== 0 || typeof meta.hasMore !== 'boolean') return invalid();
    if (meta.hasMore) throw new Error('COMERCIAL_REFERENCE_PAGINATION_REQUIRED');
    if (meta.total !== block.data.length) return invalid();
    for (const row of block.data) {
      if (!row || !isCanonicalComercialId(row.id) || row.cliente_id !== clienteId || row.ativo !== true) return invalid();
    }
    if (new Set(block.data.map(row => row.id)).size !== block.data.length) return invalid();
    return block.data;
  };
  return { locais: rows('locais'), obras: rows('obras') };
}
