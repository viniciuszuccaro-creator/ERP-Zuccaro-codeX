const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const SITE_ORIGEM = 'site';

export const isSiteOrigemValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'site'
    || normalized === 'e-commerce'
    || normalized === 'ecommerce'
    || normalized === 'site base44';
};

export const stampSiteOrigem = (record = {}) => ({
  ...record,
  origem: SITE_ORIGEM,
  origem_pedido: SITE_ORIGEM,
  canal_origem: SITE_ORIGEM,
  origem_canal: SITE_ORIGEM,
});

/** Unifica flags do cadastro Produto e CatalogoWeb. */
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

export const estoqueDisponivelSite = (produto = {}) => {
  const raw = Number(produto.estoque_disponivel ?? produto.estoque_atual ?? produto.saldo ?? 0);
  return Number.isFinite(raw) ? raw : 0;
};

export const resolvePrecoSite = (produto = {}, precoMap = null) => {
  const fromMap = precoMap instanceof Map
    ? Number(precoMap.get(produto.id))
    : Number(precoMap?.[produto.id]);
  if (Number.isFinite(fromMap) && fromMap > 0) return fromMap;
  const fallback = Number(produto.preco_venda ?? produto.preco ?? produto.valor_unitario ?? 0);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
};

export const isProdutoAtivoSite = (produto = {}) => {
  const status = String(produto.status || produto.situacao || 'Ativo').toLowerCase();
  if (status.includes('inativ') || status.includes('bloq') || status === 'false') return false;
  if (produto.ativo === false || produto.ativo === 'false' || produto.ativo === 0) return false;
  return true;
};

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

export const assertSiteCheckout = ({ empresaId, itens = [] } = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para operacao do site.');
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error('Carrinho vazio.');
  }
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

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

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

export const buildSiteLeadPayload = ({
  nome,
  email,
  telefone,
  documento,
  valor = 0,
  pedidoId,
  orcamentoId,
  clienteId,
} = {}) => stampSiteOrigem({
  titulo: `Lead site ${firstText(nome, email, pedidoId, orcamentoId, 'visitante')}`,
  descricao: 'Lead gerado pelo site proprio existente.',
  cliente_id: clienteId || undefined,
  cliente_nome: firstText(nome, 'Visitante'),
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

export const buildSitePagamentoPlaceholder = ({
  pedidoId,
  contaId,
  valor = 0,
  gatewayAtivo = false,
  numeroPedido,
} = {}) => {
  const id = firstText(pedidoId, numeroPedido, 'pedido');
  return {
    status: gatewayAtivo ? 'aguardando_gateway' : 'pendente_configuracao',
    mensagem: gatewayAtivo
      ? 'Pagamento sera liberado pelo gateway da filial.'
      : 'Gateway nao configurado. Orcamento gravado; financeiro gera o link depois.',
    valor: Number(valor) || 0,
    pedido_id: firstText(pedidoId) || null,
    conta_receber_id: firstText(contaId) || null,
    referencia: `site|${id}|${firstText(contaId) || 'cr'}`,
    forma: gatewayAtivo ? 'Link de Pagamento' : 'Pendente configuracao',
  };
};

export const buildSitePedidoStatusResumo = ({
  pedido = {},
  conta = {},
  pagamento = null,
  portalPath = '/PortalCliente',
} = {}) => {
  const pagamentoInfo = pagamento || buildSitePagamentoPlaceholder({
    pedidoId: pedido.id,
    contaId: conta.id,
    valor: pedido.valor_total || conta.valor,
    gatewayAtivo: firstText(conta.status_integracao) === 'gerado',
    numeroPedido: pedido.numero_pedido,
  });
  return {
    pedido_id: pedido.id || null,
    numero_pedido: firstText(pedido.numero_pedido, pedido.id),
    status_pedido: firstText(pedido.status, pedido.tipo, 'Orçamento'),
    valor_total: Number(pedido.valor_total || conta.valor || 0) || 0,
    pagamento: pagamentoInfo,
    portal_url: portalPath,
    pode_ver_no_portal: pedido.pode_ver_no_portal !== false,
    mensagem: `Pedido ${firstText(pedido.numero_pedido, pedido.id)} registrado. Acompanhe no portal.`,
  };
};

export const applySiteOrigemOnCreate = (entityName, record = {}) => {
  const fromEntity = entityName === 'OrcamentoSite';
  const fromField = isSiteOrigemValue(record.origem)
    || isSiteOrigemValue(record.origem_pedido)
    || isSiteOrigemValue(record.canal_origem)
    || isSiteOrigemValue(record.origem_canal);
  if (!fromEntity && !fromField) return record;
  return stampSiteOrigem(record);
};
