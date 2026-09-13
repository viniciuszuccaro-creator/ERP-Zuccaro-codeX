import {
  SiteCpaCustomerError,
  customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
} from '../siteCpaCustomerResolve/entry.ts';

export const SITE_CPA_CATALOG_LIST_OPERATION = 'siteCatalogoList';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_SCAN = 5000;
const CACHE_TTL_SECONDS = 60;
const SPEC_FIELDS = {
  bitola: ['bitola_diametro_mm', 'bitola'],
  espessura: ['espessura_mm', 'espessura'],
  largura: ['largura_cm', 'largura'],
  altura: ['altura_cm', 'altura'],
  comprimento: ['comprimento_cm', 'comprimento_barra_padrao_m', 'comprimento'],
  peso: ['peso_liquido_kg', 'peso_teorico_kg_m', 'peso'],
  diametro: ['diametro_mm', 'bitola_diametro_mm', 'diametro'],
  medida: ['medida'],
  acabamento: ['acabamento'],
  material: ['material', 'tipo_aco'],
  marca: ['marca_nome', 'marca'],
};

const text = (value) => String(value ?? '').trim();
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const isInactive = (record) => {
  const status = text(record?.status || record?.situacao || 'Ativo').toLowerCase();
  return record?.ativo === false || status.includes('inativ') || status.includes('bloq') || status.includes('cancel');
};
const updatedAt = (record) => record?.updated_date || record?.updatedAt || record?.created_date || null;
const timestamp = (record) => {
  const parsed = Date.parse(updatedAt(record) || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export class SiteCpaCatalogError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaCatalogError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const normalizeCatalogFilters = (payload = {}) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const filters = data?.filters && typeof data.filters === 'object' ? data.filters : data;
  const page = Number(filters?.page ?? 1);
  const pageSize = Number(filters?.pageSize ?? DEFAULT_PAGE_SIZE);
  if (!Number.isInteger(page) || page < 1 || page > Math.ceil(MAX_SCAN / DEFAULT_PAGE_SIZE)) {
    throw new SiteCpaCatalogError(400, 'site_cpa_catalog_page_invalid');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE || ((page - 1) * pageSize) >= MAX_SCAN) {
    throw new SiteCpaCatalogError(400, 'site_cpa_catalog_page_invalid');
  }
  const updatedSince = text(filters?.updatedSince);
  if (updatedSince && !Number.isFinite(Date.parse(updatedSince))) {
    throw new SiteCpaCatalogError(400, 'site_cpa_catalog_updated_since_invalid');
  }
  const activeRaw = filters?.active;
  if (
    activeRaw !== undefined
    && activeRaw !== null
    && activeRaw !== ''
    && ![true, false, 'true', 'false', 'all'].includes(activeRaw)
  ) {
    throw new SiteCpaCatalogError(400, 'site_cpa_catalog_filter_invalid');
  }
  const active = activeRaw === undefined || activeRaw === null || activeRaw === ''
    ? (updatedSince ? null : true)
    : activeRaw === true || activeRaw === 'true'
      ? true
      : activeRaw === false || activeRaw === 'false'
        ? false
        : null;
  if (filters?.productIds !== undefined && !Array.isArray(filters.productIds)) {
    throw new SiteCpaCatalogError(400, 'site_cpa_catalog_filter_invalid');
  }
  if (Array.isArray(filters?.productIds) && filters.productIds.length > MAX_PAGE_SIZE) {
    throw new SiteCpaCatalogError(400, 'site_cpa_catalog_filter_invalid');
  }
  const productIds = Array.isArray(filters?.productIds)
    ? [...new Set(filters.productIds.map(text).filter(Boolean))]
    : [];
  const categoryId = text(filters?.categoryId);
  const sku = text(filters?.sku);
  if (categoryId.length > 160 || sku.length > 160) {
    throw new SiteCpaCatalogError(400, 'site_cpa_catalog_filter_invalid');
  }
  return {
    page,
    pageSize,
    active,
    updatedSince: updatedSince || null,
    categoryId: categoryId || null,
    sku: sku || null,
    productIds,
    erpCustomerId: text(data?.erpCustomerId) || null,
    externalUserId: text(data?.externalUserId || data?.siteUserId) || null,
  };
};

const loadScoped = async (base44, entityName, scope, limit = MAX_SCAN) => {
  const rows = await base44.asServiceRole.entities[entityName].filter({
    group_id: scope.groupId,
  }, '-updated_date', limit);
  return (Array.isArray(rows) ? rows : []).filter((row) => customerBelongsToScope(row, scope));
};

const isCatalogPublished = (product, catalog) => {
  const productFlag = product?.exibir_no_site === true || product?.exibir_site === true
    || product?.exibir_no_site === 'true' || product?.exibir_site === 'true';
  const catalogFlag = catalog && !isInactive(catalog)
    && catalog.exibir_site !== false && catalog.exibir_no_site !== false;
  return Boolean(productFlag || catalogFlag);
};

const resolveSpecifications = (product) => Object.fromEntries(
  Object.entries(SPEC_FIELDS).flatMap(([name, fields]) => {
    const value = fields.map((field) => product?.[field]).find((item) => (
      item !== null && item !== undefined && item !== ''
    ));
    return value === undefined ? [] : [[name, value]];
  }),
);

const resolveAvailability = (product) => {
  const onHand = numberOrNull(product?.estoque_atual);
  const reserved = numberOrNull(product?.estoque_reservado ?? product?.quantidade_reservada);
  const explicit = numberOrNull(product?.estoque_disponivel);
  const available = explicit ?? (onHand === null ? null : onHand - (reserved || 0));
  const lowThreshold = numberOrNull(product?.estoque_minimo_online ?? product?.estoque_minimo);
  if (available === null) return { status: 'UNKNOWN', canSell: false };
  if (available <= 0) {
    const orderable = product?.permite_encomenda === true || product?.sob_encomenda === true;
    return { status: orderable ? 'AVAILABLE_TO_ORDER' : 'OUT_OF_STOCK', canSell: orderable };
  }
  if (lowThreshold !== null && lowThreshold > 0 && available <= lowThreshold) {
    return { status: 'LOW_STOCK', canSell: true };
  }
  return { status: 'IN_STOCK', canSell: true };
};

const tableBelongsToScope = (table, scope) => {
  const empresaId = text(table?.empresa_id || table?.empresa_dona_id);
  if (empresaId) return customerBelongsToScope(table, scope);
  return text(table?.group_id || table?.grupo_id) === text(scope.groupId)
    && table?.compartilhar_grupo === true;
};

const isTableCurrent = (table, now) => {
  if (!table || isInactive(table)) return false;
  const start = Date.parse(table.data_inicio || '');
  const end = Date.parse(table.data_fim || '');
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end < now) return false;
  return true;
};

const loadCustomerPriceContext = async ({ base44, scope, filters, now }) => {
  if (!filters.erpCustomerId && !filters.externalUserId) return null;
  if (!filters.erpCustomerId || !filters.externalUserId) {
    throw new SiteCpaCatalogError(403, 'site_cpa_customer_context_invalid');
  }
  let context;
  try {
    context = await resolveApprovedSiteCustomerContext({
      base44,
      scope,
      erpCustomerId: filters.erpCustomerId,
      externalUserId: filters.externalUserId,
    });
  } catch (error) {
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaCatalogError(403, 'site_cpa_customer_context_invalid');
    }
    throw new SiteCpaCatalogError(503, 'site_cpa_catalog_unavailable');
  }
  const tableId = text(context.customer?.condicao_comercial?.tabela_preco_id);
  if (!tableId) {
    return {
      ...context,
      table: null,
      prices: new Map(),
      pricingUnavailable: false,
      useStandardPrice: true,
    };
  }
  let tables;
  try {
    tables = await base44.asServiceRole.entities.TabelaPreco.filter({
      id: tableId,
      group_id: scope.groupId,
    }, undefined, 2);
  } catch {
    return { ...context, table: null, prices: new Map(), pricingUnavailable: true };
  }
  const table = (Array.isArray(tables) ? tables : []).find((item) => tableBelongsToScope(item, scope));
  if (!table) throw new SiteCpaCatalogError(403, 'site_cpa_catalog_scope_forbidden');
  if (!isTableCurrent(table, now)) {
    return { ...context, table, prices: new Map(), pricingUnavailable: true };
  }
  try {
    const items = await base44.asServiceRole.entities.TabelaPrecoItem.filter({
      tabela_preco_id: table.id,
    }, '-updated_date', MAX_SCAN);
    const prices = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const itemGroupId = text(item?.group_id || item?.grupo_id);
      const itemEmpresaId = text(item?.empresa_id);
      const inheritsScope = !itemGroupId && !itemEmpresaId;
      if (!inheritsScope && !customerBelongsToScope(item, scope)) return;
      const price = numberOrNull(item.preco ?? item.valor_unitario ?? item.preco_unitario);
      if (price !== null && price > 0 && item?.ativo !== false) {
        prices.set(text(item.produto_id), { value: price, updatedAt: updatedAt(item) });
      }
    });
    return { ...context, table, prices, pricingUnavailable: false };
  } catch {
    return { ...context, table, prices: new Map(), pricingUnavailable: true };
  }
};

const resolvePrice = (product, priceContext) => {
  if (priceContext?.useStandardPrice) {
    const value = numberOrNull(product?.preco_venda ?? product?.preco);
    return {
      value: value !== null && value > 0 ? value : null,
      source: value !== null && value > 0 ? 'ERP_STANDARD' : 'UNAVAILABLE',
      tableId: null,
      tableName: null,
      stale: false,
      lastUpdatedAt: updatedAt(product),
    };
  }
  if (priceContext) {
    const item = priceContext.prices.get(text(product.id));
    if (!item || priceContext.pricingUnavailable) {
      return {
        value: null,
        source: 'UNAVAILABLE',
        tableId: priceContext.table?.id || null,
        tableName: text(priceContext.table?.nome) || null,
        stale: true,
        lastUpdatedAt: item?.updatedAt || updatedAt(priceContext.table),
      };
    }
    return {
      value: item.value,
      source: 'CUSTOMER_PRICE_TABLE',
      tableId: priceContext.table.id,
      tableName: text(priceContext.table.nome) || null,
      stale: false,
      lastUpdatedAt: item.updatedAt || updatedAt(priceContext.table),
    };
  }
  const value = numberOrNull(product?.preco_venda ?? product?.preco);
  return {
    value: value !== null && value > 0 ? value : null,
    source: value !== null && value > 0 ? 'ERP_STANDARD' : 'UNAVAILABLE',
    tableId: null,
    tableName: null,
    stale: false,
    lastUpdatedAt: updatedAt(product),
  };
};

const auditCatalog = async ({ base44, scope, request, filters, resultCount, outcome, durationMs, success }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? 'Consulta' : 'Bloqueio',
      modulo: 'Integracoes',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: 'Produto',
      descricao: `siteCatalogoList ${outcome}`,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      dados_novos: {
        operation: SITE_CPA_CATALOG_LIST_OPERATION,
        correlation_id: request?.correlationId || null,
        page: filters?.page || null,
        page_size: filters?.pageSize || null,
        result_count: resultCount,
        customer_pricing: Boolean(filters?.erpCustomerId),
        duration_ms: durationMs,
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaCatalogError(503, 'site_cpa_audit_unavailable');
  }
};

export const resolveSiteCpaCatalog = async ({
  base44,
  payload = {},
  scope,
  request,
  now = Date.now(),
} = {}) => {
  const startedAt = Date.now();
  const filters = normalizeCatalogFilters(payload);
  let products;
  let catalogs;
  let categories;
  let units;
  try {
    [products, catalogs, categories, units] = await Promise.all([
      loadScoped(base44, 'Produto', scope),
      loadScoped(base44, 'CatalogoWeb', scope),
      loadScoped(base44, 'GrupoProduto', scope, 1000),
      loadScoped(base44, 'UnidadeMedida', scope, 1000),
    ]);
  } catch {
    throw new SiteCpaCatalogError(503, 'site_cpa_catalog_unavailable');
  }

  const priceContext = await loadCustomerPriceContext({ base44, scope, filters, now });
  const catalogByProduct = new Map();
  catalogs.forEach((catalog) => {
    const productId = text(catalog.produto_id);
    if (productId && !catalogByProduct.has(productId)) catalogByProduct.set(productId, catalog);
  });
  const categoryById = new Map(categories.map((category) => [text(category.id), category]));
  const unitById = new Map(units.map((unit) => [text(unit.id), unit]));
  const changedSince = filters.updatedSince ? Date.parse(filters.updatedSince) : null;

  const projected = products
    .filter((product) => {
      if (filters.productIds.length && !filters.productIds.includes(text(product.id))) return false;
      if (filters.sku && text(product.codigo || product.sku) !== filters.sku) return false;
      if (filters.categoryId && text(product.grupo_produto_id || product.categoria_id) !== filters.categoryId) return false;
      const catalog = catalogByProduct.get(text(product.id));
      const wasCatalogued = Boolean(catalog)
        || product.exibir_no_site === true || product.exibir_site === true
        || product.exibir_no_site === 'true' || product.exibir_site === 'true';
      if (!wasCatalogued) return false;
      if (changedSince !== null) {
        const category = categoryById.get(text(product.grupo_produto_id || product.categoria_id));
        if (Math.max(timestamp(product), timestamp(catalog), timestamp(category)) < changedSince) return false;
      }
      return true;
    })
    .map((product) => {
      const catalog = catalogByProduct.get(text(product.id));
      const category = categoryById.get(text(product.grupo_produto_id || product.categoria_id)) || null;
      const unitRecord = unitById.get(text(product.unidade_medida_id || product.unidade_id)) || null;
      const productActive = !isInactive(product);
      const categoryActive = !category || !isInactive(category);
      const published = isCatalogPublished(product, catalog);
      const active = productActive && categoryActive && published;
      const price = resolvePrice(product, priceContext);
      const availability = resolveAvailability(product);
      const commercialUnit = text(
        product.unidade_venda
        || product.unidade_principal
        || unitRecord?.sigla
        || product.unidade_medida,
      ).toUpperCase() || null;
      const minQty = numberOrNull(
        product.quantidade_minima_venda ?? product.minimo_venda ?? product.estoque_minimo_online,
      );
      const saleMultiple = numberOrNull(product.multiplo_venda ?? product.multiplo_comercial);
      const quoteRequired = !active || price.value === null || !availability.canSell || !commercialUnit;
      const imageUrl = text(product.foto_produto_url || catalog?.foto_url);
      return {
        erpProductId: product.id,
        sku: text(product.sku || product.codigo) || null,
        code: text(product.codigo || product.sku) || null,
        name: text(product.nome || product.descricao) || null,
        description: text(product.descricao) || null,
        categoryId: category?.id || text(product.grupo_produto_id || product.categoria_id) || null,
        categoryName: text(category?.nome_grupo || category?.nome || product.grupo_produto_nome || product.grupo) || null,
        brand: text(product.marca_nome || product.marca) || null,
        status: text(product.status || product.situacao || 'Ativo'),
        active,
        commercialUnit,
        specifications: resolveSpecifications(product),
        erpSpecCode: text(product.codigo_especificacao || product.spec_code) || null,
        variant: {
          parentProductId: text(product.produto_pai_id || product.parent_product_id) || null,
          variantCode: text(product.codigo_variante || product.variant_code) || null,
        },
        price: price.value,
        priceSource: price.source,
        priceTableId: price.tableId,
        priceTableName: price.tableName,
        priceStale: price.stale,
        priceLastUpdatedAt: price.lastUpdatedAt,
        availability: availability.status,
        sellable: active && !quoteRequired,
        quoteRequired,
        minQty: minQty !== null && minQty > 0 ? minQty : null,
        saleMultiple: saleMultiple !== null && saleMultiple > 0 ? saleMultiple : null,
        weightKg: numberOrNull(product.peso_liquido_kg),
        conversionFactor: numberOrNull(product.fator_conversao),
        conversionUnit: text(product.unidade_conversao) || null,
        imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
        source: 'ERP',
        updatedAt: updatedAt(product),
        stale: false,
        ttlSeconds: CACHE_TTL_SECONDS,
      };
    })
    .filter((product) => filters.active === null || product.active === filters.active)
    .sort((left, right) => (
      timestamp({ updated_date: right.updatedAt }) - timestamp({ updated_date: left.updatedAt })
      || text(left.erpProductId).localeCompare(text(right.erpProductId))
    ));

  const offset = (filters.page - 1) * filters.pageSize;
  const items = projected.slice(offset, offset + filters.pageSize);
  const categoryIds = new Set(items.map((item) => text(item.categoryId)).filter(Boolean));
  const responseCategories = categories
    .filter((category) => categoryIds.has(text(category.id)))
    .map((category) => ({
      erpCategoryId: category.id,
      name: text(category.nome_grupo || category.nome) || null,
      parentCategoryId: text(category.grupo_pai_id || category.parent_id) || null,
      active: !isInactive(category),
      order: numberOrNull(category.ordem || category.ordem_exibicao),
      source: 'ERP',
      updatedAt: updatedAt(category),
    }));
  const snapshotAt = new Date(now).toISOString();
  const lastUpdatedAt = items.map((item) => item.updatedAt).filter(Boolean).sort().at(-1) || null;
  const result = {
    items,
    categories: responseCategories,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      resultCount: items.length,
      hasMore: offset + items.length < projected.length,
    },
    sync: {
      catalogVersion: [scope.groupId, scope.empresaId, lastUpdatedAt || 'empty', projected.length].join(':'),
      snapshotAt,
      updatedSince: filters.updatedSince,
      lastUpdatedAt,
      source: 'ERP',
      stale: false,
      ttlSeconds: CACHE_TTL_SECONDS,
      scanTruncated: products.length >= MAX_SCAN,
    },
  };
  await auditCatalog({
    base44,
    scope,
    request,
    filters,
    resultCount: items.length,
    outcome: priceContext?.pricingUnavailable ? 'partial_price_unavailable' : 'catalog_list',
    durationMs: Math.max(0, Date.now() - startedAt),
    success: true,
  });
  return result;
};
