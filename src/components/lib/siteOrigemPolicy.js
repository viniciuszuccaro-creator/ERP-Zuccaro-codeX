/**
 * @typedef {Record<string, unknown> & {
 *   id?: string | number,
 *   produto?: SiteRecord,
 *   produto_id?: unknown,
 *   descricao?: unknown,
 *   codigo?: unknown,
 *   slug?: unknown,
 *   slug_site?: unknown,
 *   nome_catalogo?: unknown,
 *   exibir_no_site?: boolean | string,
 *   exibir_site?: boolean | string,
 *   exibir_no_marketplace?: boolean | string,
 *   exibir_marketplace?: boolean | string,
 *   ativo?: boolean | string | number,
 *   status?: unknown,
 *   situacao?: unknown,
 *   estoque_disponivel?: unknown,
 *   estoque_atual?: unknown,
 *   saldo?: unknown,
 *   estoque_minimo_online?: unknown,
 *   estoque_maximo_online?: unknown,
 *   preco_venda?: unknown,
 *   preco?: unknown,
 *   valor_unitario?: unknown,
 *   _precoResolvido?: unknown,
 *   qty?: unknown,
 *   quantidade?: unknown,
 *   precoUnit?: unknown,
 *   preco_unitario?: unknown,
 *   nome?: unknown,
 *   cliente_nome?: unknown,
 *   email?: unknown,
 *   email_principal?: unknown,
 *   email_nfe?: unknown,
 *   cliente_email?: unknown,
 *   telefone?: unknown,
 *   documento?: unknown,
 *   cpf_cnpj?: unknown,
 *   cnpj?: unknown,
 *   cpf?: unknown,
 *   origem?: unknown,
 *   origem_pedido?: unknown,
 *   canal_origem?: unknown,
 *   origem_canal?: unknown,
 *   numero_pedido?: unknown,
 *   tipo?: unknown,
 *   valor?: unknown,
 *   valor_total?: unknown,
 *   url_boleto_pdf?: unknown,
 *   link_pagamento?: unknown,
 *   pix_copia_cola?: unknown,
 *   pode_ver_no_portal?: boolean,
 *   sequencia_rota?: unknown,
 *   data_previsao?: unknown,
 *   previsao_entrega?: unknown,
 * }} SiteRecord
 * @typedef {Record<string, unknown> & { status?: string, referencia?: string, url?: string | null }} SitePagamento
 * @typedef {{ busca?: unknown, precoMap?: Map<unknown, unknown> | Record<string | number, unknown> | null, catalogos?: SiteRecord[] }} SiteCatalogOptions
 * @typedef {{ empresaId?: unknown, itens?: SiteRecord[], contato?: SiteRecord }} SiteCheckoutOptions
 * @typedef {{ clientes?: SiteRecord[], email?: unknown, documento?: unknown }} SiteClienteMatchOptions
 * @typedef {{ nome?: unknown, email?: unknown, telefone?: unknown, documento?: unknown, valor?: unknown, pedidoId?: unknown, orcamentoId?: unknown, clienteId?: unknown, empresaId?: unknown, groupId?: unknown }} SiteLeadOptions
 * @typedef {{ pedidoId?: unknown, contaId?: unknown, valor?: unknown, gatewayAtivo?: boolean, pagamentoUrl?: unknown, pagamentoReferencia?: unknown, numeroPedido?: unknown }} SitePagamentoOptions
 * @typedef {{ pedido?: SiteRecord, conta?: SiteRecord, pagamento?: SitePagamento | null, entrega?: SiteRecord | null, portalPath?: string }} SitePedidoStatusOptions
 */

/** @param {...unknown} values */
const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const SITE_ORIGEM = 'site';

/** @param {unknown} value */
export const isSiteOrigemValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'site'
    || normalized === 'e-commerce'
    || normalized === 'ecommerce'
    || normalized === 'site base44';
};

/** @param {SiteRecord} record */
export const stampSiteOrigem = (record = {}) => ({
  ...record,
  origem: SITE_ORIGEM,
  origem_pedido: SITE_ORIGEM,
  canal_origem: SITE_ORIGEM,
  origem_canal: SITE_ORIGEM,
});

/** Unifica flags do cadastro Produto e CatalogoWeb. */
/** @param {SiteRecord} record */
export const syncFlagsCatalogoProduto = (record = {}) => {
  const exibirSite = record.exibir_no_site === true || record.exibir_site === true
    || record.exibir_no_site === 'true' || record.exibir_site === 'true';
  const exibirMarketplace = record.exibir_no_marketplace === true || record.exibir_marketplace === true
    || record.exibir_no_marketplace === 'true' || record.exibir_marketplace === 'true';
  return {
    ...record,
    exibir_no_site: Boolean(exibirSite),
    exibir_site: Boolean(exibirSite),
    exibir_no_marketplace: Boolean(exibirMarketplace),
    exibir_marketplace: Boolean(exibirMarketplace),
  };
};

/** @param {SiteRecord} produto */
export const estoqueDisponivelSite = (produto = {}) => {
  const raw = Number(produto.estoque_disponivel ?? produto.estoque_atual ?? produto.saldo ?? 0);
  return Number.isFinite(raw) ? raw : 0;
};

/**
 * @param {SiteRecord} produto
 * @param {Map<unknown, unknown> | Record<string | number, unknown> | null} precoMap
 */
export const resolvePrecoSite = (produto = {}, precoMap = null) => {
  const fromMap = precoMap instanceof Map
    ? Number(precoMap.get(produto.id))
    : Number(precoMap?.[/** @type {string | number} */ (produto.id)]);
  if (Number.isFinite(fromMap) && fromMap > 0) return fromMap;
  const fallback = Number(produto.preco_venda ?? produto.preco ?? produto.valor_unitario ?? 0);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
};

/** @param {SiteRecord} produto */
export const isProdutoAtivoSite = (produto = {}) => {
  const status = String(produto.status || produto.situacao || 'Ativo').toLowerCase();
  if (status.includes('inativ') || status.includes('bloq') || status === 'false') return false;
  if (produto.ativo === false || produto.ativo === 'false' || produto.ativo === 0) return false;
  return true;
};

/**
 * @param {SiteRecord} produto
 * @param {unknown} qty
 */
export const isProdutoDisponivelSite = (produto = {}, qty = 1) => {
  if (!isProdutoAtivoSite(produto)) return false;
  const flags = syncFlagsCatalogoProduto(produto);
  if (!flags.exibir_no_site) return false;
  const estoque = estoqueDisponivelSite(produto);
  const minimo = Number(produto.estoque_minimo_online ?? 0) || 0;
  const maximo = Number(produto.estoque_maximo_online ?? 0) || 0;
  const quantidade = Math.max(1, Number(qty) || 1);
  if (estoque < minimo) return false;
  if (estoque < quantidade) return false;
  if (maximo > 0 && quantidade > maximo) return false;
  const preco = Number(produto._precoResolvido) > 0 ? Number(produto._precoResolvido) : resolvePrecoSite(produto);
  if (preco <= 0) return false;
  return true;
};

/**
 * @param {SiteRecord[]} produtos
 * @param {SiteCatalogOptions} options
 */
export const filtrarProdutosSite = (produtos = [], { busca = '', precoMap = null, catalogos = [] } = {}) => {
  const q = String(busca || '').toLowerCase().trim();
  const catalogByProduto = new Map();
  (Array.isArray(catalogos) ? catalogos : []).forEach((item) => {
    const pid = firstText(item.produto_id);
    if (!pid) return;
    if (item.exibir_site === false || item.ativo === false) return;
    catalogByProduto.set(pid, item);
  });
  return (Array.isArray(produtos) ? produtos : [])
    .map((produto) => {
      const cat = catalogByProduto.get(firstText(produto.id));
      const merged = syncFlagsCatalogoProduto({
        ...produto,
        exibir_no_site: produto.exibir_no_site || cat?.exibir_site || false,
        exibir_site: cat?.exibir_site ?? produto.exibir_site ?? produto.exibir_no_site,
        slug_site: firstText(produto.slug_site, cat?.slug, cat?.nome_catalogo),
      });
      const preco = resolvePrecoSite(merged, precoMap);
      return { ...merged, _precoResolvido: preco };
    })
    .filter((produto) => {
      if (!syncFlagsCatalogoProduto(produto).exibir_no_site) return false;
      if (!isProdutoAtivoSite(produto)) return false;
      if (!q) return true;
      return String(produto.descricao || '').toLowerCase().includes(q)
        || String(produto.codigo || '').toLowerCase().includes(q)
        || String(produto.slug_site || '').toLowerCase().includes(q);
    });
};

/** @param {SiteCheckoutOptions} options */
export const assertSiteCheckout = ({ empresaId, itens = [], contato = {} } = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para operacao do site.');
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error('Carrinho vazio.');
  }
  assertSiteContato(contato);
  itens.forEach((item, index) => {
    const produto = item.produto || item;
    const qty = Number(item.qty || item.quantidade || 1) || 1;
    const preco = Number(item.precoUnit || item.preco_unitario || resolvePrecoSite(produto)) || 0;
    if (preco <= 0) {
      throw new Error(`Item ${index + 1} sem preco valido no site.`);
    }
    if (!isProdutoDisponivelSite({ ...produto, _precoResolvido: preco }, qty)) {
      throw new Error(`Item ${index + 1} indisponivel no estoque online.`);
    }
  });
  return true;
};

/** @param {SiteRecord} contato */
export const assertSiteContato = (contato = {}) => {
  const nome = firstText(contato.nome, contato.cliente_nome);
  const email = firstText(contato.email, contato.cliente_email);
  const documento = digitsOnly(contato.documento || contato.cpf_cnpj || contato.cnpj || contato.cpf);
  if (!nome) throw new Error('Nome obrigatorio para checkout do site.');
  if (!email && !documento) {
    throw new Error('Informe e-mail ou CPF/CNPJ para checkout do site.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('E-mail invalido para checkout do site.');
  }
  return true;
};

/** @param {unknown} value */
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

/** @param {SiteClienteMatchOptions} options */
export const matchClienteSite = ({ clientes = [], email, documento } = {}) => {
  const mail = firstText(email).toLowerCase();
  const doc = digitsOnly(documento);
  if (!mail && !doc) return null;
  return (clientes || []).find((cliente) => {
    const clienteMail = firstText(cliente.email, cliente.email_principal, cliente.email_nfe).toLowerCase();
    const clienteDoc = digitsOnly(cliente.cpf_cnpj || cliente.cnpj || cliente.cpf || cliente.documento);
    return (mail && clienteMail && clienteMail === mail) || (doc && clienteDoc && clienteDoc === doc);
  }) || null;
};

/** @param {SiteLeadOptions} options */
export const buildSiteLeadPayload = ({
  nome,
  email,
  telefone,
  documento,
  valor = 0,
  pedidoId,
  orcamentoId,
  clienteId,
  empresaId,
  groupId,
} = {}) => {
  assertSiteContato({ nome, email, documento });
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para lead do site.');
  }
  return stampSiteOrigem({
    titulo: `Lead site ${firstText(nome, email, pedidoId, orcamentoId, 'visitante')}`,
    descricao: 'Lead gerado pelo site proprio existente.',
    empresa_id: empresaId,
    group_id: groupId || undefined,
    grupo_id: groupId || undefined,
    cliente_id: clienteId || undefined,
    cliente_nome: firstText(nome),
    cliente_email: firstText(email) || undefined,
    cliente_telefone: firstText(telefone) || undefined,
    cliente_cpf_cnpj: firstText(documento) || undefined,
    valor_estimado: Number(valor) || 0,
    etapa: 'Prospecção',
    probabilidade: 30,
    data_abertura: new Date().toISOString().slice(0, 10),
    status: 'Aberto',
    pedido_id: pedidoId || undefined,
    orcamento_site_id: orcamentoId || undefined,
  });
};

/** @param {SitePagamentoOptions} options */
export const buildSitePagamentoPlaceholder = ({
  pedidoId,
  contaId,
  valor = 0,
  gatewayAtivo = false,
  pagamentoUrl = null,
  pagamentoReferencia = null,
  numeroPedido,
} = {}) => {
  const id = firstText(pedidoId, numeroPedido, 'pedido');
  const linkReal = firstText(pagamentoUrl, pagamentoReferencia);
  return {
    status: linkReal ? 'aguardando_gateway' : (gatewayAtivo ? 'aguardando_configuracao_link' : 'pendente_configuracao'),
    mensagem: linkReal
      ? 'Pagamento aguardando confirmacao do gateway.'
      : gatewayAtivo
        ? 'Gateway ativo, mas o link ainda nao foi gerado. Financeiro conclui o pagamento.'
        : 'Gateway nao configurado. Orcamento gravado; financeiro gera o link depois.',
    valor: Number(valor) || 0,
    pedido_id: firstText(pedidoId) || null,
    conta_receber_id: firstText(contaId) || null,
    referencia: `site|${id}|${firstText(contaId) || 'cr'}`,
    url: linkReal || null,
    forma: linkReal ? 'Link de Pagamento' : 'Pendente configuracao',
  };
};

/** @param {SitePedidoStatusOptions} options */
export const buildSitePedidoStatusResumo = ({
  pedido = {},
  conta = {},
  pagamento = null,
  entrega = null,
  portalPath = '/PortalCliente',
} = {}) => {
  const pagamentoInfo = pagamento || buildSitePagamentoPlaceholder({
    pedidoId: pedido.id,
    contaId: conta.id,
    valor: pedido.valor_total || conta.valor,
    gatewayAtivo: Boolean(firstText(conta.url_boleto_pdf, conta.link_pagamento, conta.pix_copia_cola)),
    pagamentoUrl: firstText(conta.url_boleto_pdf, conta.link_pagamento),
    numeroPedido: pedido.numero_pedido,
  });
  const entregaInfo = entrega
    ? {
      id: entrega.id || null,
      status: firstText(entrega.status, 'Pendente'),
      sequencia_rota: entrega.sequencia_rota || null,
      previsao: firstText(entrega.data_previsao, entrega.previsao_entrega) || null,
    }
    : {
      id: null,
      status: 'Aguardando expedicao',
      sequencia_rota: null,
      previsao: null,
    };
  return {
    pedido_id: pedido.id || null,
    numero_pedido: firstText(pedido.numero_pedido, pedido.id),
    status_pedido: firstText(pedido.status, pedido.tipo, 'Orçamento'),
    valor_total: Number(pedido.valor_total || conta.valor || 0) || 0,
    pagamento: pagamentoInfo,
    entrega: entregaInfo,
    portal_url: portalPath,
    pode_ver_no_portal: pedido.pode_ver_no_portal !== false,
    mensagem: `Pedido ${firstText(pedido.numero_pedido, pedido.id)} registrado. Acompanhe no portal.`,
  };
};
/**
 * @param {string} entityName
 * @param {SiteRecord} record
 */
export const applySiteOrigemOnCreate = (entityName, record = {}) => {
  const fromEntity = entityName === 'OrcamentoSite';
  const fromField = isSiteOrigemValue(record.origem)
    || isSiteOrigemValue(record.origem_pedido)
    || isSiteOrigemValue(record.canal_origem)
    || isSiteOrigemValue(record.origem_canal);
  if (!fromEntity && !fromField) return record;
  return stampSiteOrigem(record);
};
