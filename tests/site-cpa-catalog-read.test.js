import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SiteCpaCatalogError,
  normalizeCatalogFilters,
  resolveSiteCpaCatalog,
} from '../base44/functions/_lib/security/siteCpaCatalogRead/entry.ts';
import {
  buildSiteCpaSignatureInput,
  handleSiteCpaGatewayRequest,
  hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const request = { correlationId: 'corr-catalog', operation: 'siteCatalogoList' };
const now = Date.parse('2026-09-13T12:00:00.000Z');

const product = (overrides = {}) => ({
  id: 'prod-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  codigo: 'ACO-10',
  descricao: 'Vergalhao CA-50 10 mm',
  grupo_produto_id: 'cat-aco',
  grupo_produto_nome: 'Acos',
  marca_nome: 'Marca CPA',
  status: 'Ativo',
  unidade_medida_id: 'unit-kg',
  unidade_medida: 'KG',
  exibir_no_site: true,
  preco_venda: 12.5,
  estoque_atual: 100,
  estoque_reservado: 15,
  estoque_minimo_online: 10,
  quantidade_minima_venda: 2,
  multiplo_venda: 2,
  eh_bitola: true,
  bitola_diametro_mm: 10,
  peso_teorico_kg_m: 0.617,
  comprimento_barra_padrao_m: 12,
  tipo_aco: 'CA-50',
  produto_pai_id: 'prod-parent',
  codigo_variante: '10MM',
  foto_produto_url: 'https://cdn.example/prod-1.jpg',
  updated_date: '2026-09-13T11:00:00.000Z',
  custo_medio: 7,
  margem_minima_percentual: 10,
  observacoes: 'interna',
  fornecedor_id: 'forn-1',
  ...overrides,
});

const category = (overrides = {}) => ({
  id: 'cat-aco',
  group_id: 'grupo-cpa',
  nome_grupo: 'Acos',
  ativo: true,
  ordem_exibicao: 1,
  updated_date: '2026-09-12T10:00:00.000Z',
  ...overrides,
});

const approvedLink = {
  id: 'link-1',
  tipo_solicitacao: 'vinculo_site_cpa_cliente',
  entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  status: 'aprovado',
  dados_propostos: {
    source: 'SITE_CPA',
    externalUserId: 'site-user-1',
    role: 'COMPRADOR',
  },
};

const createState = ({
  products = [product()],
  catalogs = [],
  categories = [category()],
  units = [{ id: 'unit-kg', group_id: 'grupo-cpa', sigla: 'KG', ativo: true }],
  customers = [{
    id: 'customer-1',
    group_id: 'grupo-cpa',
    empresa_id: 'cpa-aco',
    status: 'Ativo',
    condicao_comercial: { tabela_preco_id: 'table-1' },
  }],
  links = [approvedLink],
  tables = [{
    id: 'table-1',
    group_id: 'grupo-cpa',
    empresa_id: 'cpa-aco',
    nome: 'Tabela Cliente',
    ativo: true,
  }],
  priceItems = [{
    id: 'price-1',
    tabela_preco_id: 'table-1',
    produto_id: 'prod-1',
    preco: 11.75,
    ativo: true,
    updated_date: '2026-09-13T10:00:00.000Z',
  }],
  failEntity = null,
} = {}) => {
  const audits = [];
  const data = {
    Produto: products,
    CatalogoWeb: catalogs,
    GrupoProduto: categories,
    UnidadeMedida: units,
    Cliente: customers,
    SolicitacaoAprovacao: links,
    TabelaPreco: tables,
    TabelaPrecoItem: priceItems,
  };
  const matches = (actual, expected) => {
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.map(String).includes(String(actual));
    }
    if (expected && typeof expected === 'object' && '$gte' in expected) {
      return actual >= expected.$gte;
    }
    return actual === expected;
  };
  const entities = Object.fromEntries(Object.entries(data).map(([name, rows]) => [
    name,
    {
      filter: async (filter) => {
        if (failEntity === name) throw new Error(`${name} unavailable`);
        return rows.filter((row) => Object.entries(filter).every(([key, value]) => matches(row[key], value)));
      },
    },
  ]));
  entities.AuditLog = {
    create: async (record) => {
      if (failEntity === 'AuditLog') throw new Error('audit unavailable');
      audits.push(record);
      return record;
    },
  };
  return { base44: { asServiceRole: { entities } }, audits };
};

const list = (state, data = {}) => resolveSiteCpaCatalog({
  base44: state.base44,
  payload: { data },
  scope,
  request,
  now,
});

const rejectsCode = async (promise, code, status) => {
  await assert.rejects(promise, (error) => (
    error instanceof SiteCpaCatalogError
    && error.code === code
    && error.status === status
  ));
};

test('filtros exigem paginacao limitada e delta valido', () => {
  assert.deepEqual(normalizeCatalogFilters({ data: {} }).pageSize, 50);
  assert.equal(normalizeCatalogFilters({ data: { updatedSince: '2026-09-01T00:00:00Z' } }).active, null);
  assert.throws(
    () => normalizeCatalogFilters({ data: { page: 0 } }),
    (error) => error.code === 'site_cpa_catalog_page_invalid',
  );
  assert.throws(
    () => normalizeCatalogFilters({ data: { pageSize: 101 } }),
    (error) => error.code === 'site_cpa_catalog_page_invalid',
  );
  assert.throws(
    () => normalizeCatalogFilters({ data: { updatedSince: 'invalido' } }),
    (error) => error.code === 'site_cpa_catalog_updated_since_invalid',
  );
  assert.throws(
    () => normalizeCatalogFilters({ data: { active: 'qualquer' } }),
    (error) => error.code === 'site_cpa_catalog_filter_invalid',
  );
  assert.throws(
    () => normalizeCatalogFilters({ data: { productIds: 'prod-1' } }),
    (error) => error.code === 'site_cpa_catalog_filter_invalid',
  );
});

test('produto ativo retorna contrato oficial, specs, unidade, variante e estoque minimizado', async () => {
  const state = createState();
  const result = await list(state);
  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.equal(item.erpProductId, 'prod-1');
  assert.equal(item.sku, 'ACO-10');
  assert.equal(item.categoryName, 'Acos');
  assert.equal(item.commercialUnit, 'KG');
  assert.equal(item.specifications.bitola, 10);
  assert.equal(item.specifications.material, 'CA-50');
  assert.equal(item.variant.parentProductId, 'prod-parent');
  assert.equal(item.price, 12.5);
  assert.equal(item.priceSource, 'ERP_STANDARD');
  assert.equal(item.availability, 'IN_STOCK');
  assert.equal(item.sellable, true);
  assert.equal(item.minQty, 2);
  assert.equal(item.saleMultiple, 2);
  assert.equal(Object.hasOwn(item, 'onHand'), false);
  assert.equal(Object.hasOwn(item, 'available'), false);
});

test('resposta nao expoe custo, margem, fornecedor ou notas internas', async () => {
  const result = await list(createState());
  const keys = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, nested]) => {
      keys.push(key.toLowerCase());
      visit(nested);
    });
  };
  visit(result);
  for (const forbidden of ['custo_medio', 'custo', 'margem', 'markup', 'fornecedor_id', 'observacoes', 'dados_bancarios']) {
    assert.equal(keys.includes(forbidden), false);
  }
});

test('produto inativo ou categoria inativa nao e vendavel e aparece no delta', async () => {
  const state = createState({
    products: [product({ status: 'Inativo', updated_date: '2026-09-13T11:30:00.000Z' })],
  });
  assert.equal((await list(state)).items.length, 0);
  const delta = await list(state, { updatedSince: '2026-09-13T11:00:00.000Z' });
  assert.equal(delta.items[0].active, false);
  assert.equal(delta.items[0].sellable, false);

  const categoryState = createState({
    categories: [category({ ativo: false, updated_date: '2026-09-13T11:45:00.000Z' })],
  });
  const categoryDelta = await list(categoryState, { updatedSince: '2026-09-13T11:30:00.000Z' });
  assert.equal(categoryDelta.items[0].active, false);
  assert.equal(categoryDelta.categories[0].active, false);
});

test('produto sem preco ou estoque verificavel fica visivel mas exige orcamento', async () => {
  const state = createState({
    products: [product({ preco_venda: 0, estoque_atual: null, estoque_disponivel: null })],
  });
  const item = (await list(state)).items[0];
  assert.equal(item.price, null);
  assert.equal(item.availability, 'UNKNOWN');
  assert.equal(item.sellable, false);
  assert.equal(item.quoteRequired, true);
});

test('estoque reservado e baixo estoque afetam sellable sem expor quantidade', async () => {
  const low = (await list(createState({
    products: [product({ estoque_atual: 20, estoque_reservado: 12, estoque_minimo_online: 10 })],
  }))).items[0];
  assert.equal(low.availability, 'LOW_STOCK');
  assert.equal(low.sellable, true);
  const out = (await list(createState({
    products: [product({ estoque_atual: 10, estoque_reservado: 10 })],
  }))).items[0];
  assert.equal(out.availability, 'OUT_OF_STOCK');
  assert.equal(out.sellable, false);
});

test('preco empresarial exige cliente vinculado e tabela do mesmo escopo', async () => {
  const state = createState();
  const result = await list(state, {
    erpCustomerId: 'customer-1',
    externalUserId: 'site-user-1',
  });
  assert.equal(result.items[0].price, 11.75);
  assert.equal(result.items[0].priceSource, 'CUSTOMER_PRICE_TABLE');
  assert.equal(result.items[0].priceTableId, 'table-1');

  await rejectsCode(list(createState({ links: [] }), {
    erpCustomerId: 'customer-1',
    externalUserId: 'site-user-1',
  }), 'site_cpa_customer_context_invalid', 403);

  await rejectsCode(list(createState({
    tables: [{
      id: 'table-1',
      group_id: 'grupo-cpa',
      empresa_id: '3z',
      nome: 'Tabela 3Z',
      ativo: true,
    }],
  }), {
    erpCustomerId: 'customer-1',
    externalUserId: 'site-user-1',
  }), 'site_cpa_catalog_scope_forbidden', 403);
});

test('cliente aprovado sem tabela especifica usa somente o preco padrao oficial', async () => {
  const state = createState({
    customers: [{
      id: 'customer-1',
      group_id: 'grupo-cpa',
      empresa_id: 'cpa-aco',
      status: 'Ativo',
      condicao_comercial: {},
    }],
  });
  const result = await list(state, {
    erpCustomerId: 'customer-1',
    externalUserId: 'site-user-1',
  });
  assert.equal(result.items[0].price, 12.5);
  assert.equal(result.items[0].priceSource, 'ERP_STANDARD');
  assert.equal(result.items[0].priceTableId, null);
});

test('falha da tabela nao usa preco padrao como se fosse preco do cliente', async () => {
  const state = createState({ failEntity: 'TabelaPrecoItem' });
  const result = await list(state, {
    erpCustomerId: 'customer-1',
    externalUserId: 'site-user-1',
  });
  assert.equal(result.items[0].price, null);
  assert.equal(result.items[0].priceSource, 'UNAVAILABLE');
  assert.equal(result.items[0].priceStale, true);
  assert.equal(result.items[0].sellable, false);
  assert.equal(state.audits.at(-1).dados_novos.outcome, 'partial_price_unavailable');
});

test('escopo elimina produtos de outra Empresa ou Grupo e respeita produto compartilhado', async () => {
  const state = createState({
    products: [
      product(),
      product({ id: 'prod-3z', empresa_id: '3z', codigo: '3Z-1' }),
      product({ id: 'prod-other', group_id: 'outro-grupo', codigo: 'OUT-1' }),
      product({
        id: 'prod-shared',
        empresa_id: null,
        empresas_compartilhadas_ids: ['cpa-aco'],
        codigo: 'SHARED-1',
      }),
      product({
        id: 'prod-not-shared',
        empresa_id: null,
        empresas_compartilhadas_ids: ['3z'],
        codigo: 'SHARED-3Z',
      }),
    ],
  });
  const result = await list(state);
  assert.deepEqual(result.items.map((item) => item.erpProductId).sort(), ['prod-1', 'prod-shared']);
});

test('paginacao, filtros SKU/categoria/produto e delta sao deterministas', async () => {
  const products = [
    product({ id: 'p1', codigo: 'SKU-1', updated_date: '2026-09-13T11:03:00.000Z' }),
    product({ id: 'p2', codigo: 'SKU-2', updated_date: '2026-09-13T11:02:00.000Z' }),
    product({ id: 'p3', codigo: 'SKU-3', updated_date: '2026-09-13T11:01:00.000Z' }),
  ];
  const state = createState({ products });
  const page = await list(state, { page: 2, pageSize: 1 });
  assert.equal(page.items[0].erpProductId, 'p2');
  assert.equal(page.pagination.hasMore, true);
  assert.equal((await list(state, { sku: 'SKU-3' })).items[0].erpProductId, 'p3');
  assert.equal((await list(state, { productIds: ['p1'] })).items[0].erpProductId, 'p1');
  assert.equal((await list(state, { categoryId: 'cat-aco' })).items.length, 3);
  assert.equal((await list(state, { updatedSince: '2026-09-13T11:02:30.000Z' })).items.length, 1);
});

test('falha de catalogo ou auditoria encerra operacao de forma segura', async () => {
  await rejectsCode(list(createState({ failEntity: 'Produto' })), 'site_cpa_catalog_unavailable', 503);
  await rejectsCode(list(createState({ failEntity: 'AuditLog' })), 'site_cpa_audit_unavailable', 503);
});

test('siteCatalogoList atravessa gateway autenticado e ledger persistente', async () => {
  const state = createState();
  const eventRows = [];
  Object.assign(state.base44.asServiceRole.entities, {
    Empresa: { filter: async () => [{ id: 'cpa-aco', group_id: 'grupo-cpa' }] },
    IntegracaoEvento: {
      filter: async () => [],
      create: async (record) => {
        const created = { id: 'event-catalog', created_date: '2026-09-13T12:00:00.000Z', ...record };
        eventRows.push(created);
        return created;
      },
      update: async (id, patch) => {
        const row = eventRows.find((item) => item.id === id);
        Object.assign(row, patch);
        return row;
      },
    },
  });
  const body = { version: '1', operation: 'siteCatalogoList', data: { page: 1, pageSize: 10 } };
  const rawBody = JSON.stringify(body);
  const timestampValue = '2026-09-13T12:00:00.000Z';
  const nonce = 'nonce-catalog-1234567890';
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({
    timestamp: timestampValue,
    nonce,
    rawBody,
  }));
  const response = await handleSiteCpaGatewayRequest({
    req: {
      headers: new Headers({
        authorization: 'Bearer service-token',
        'content-type': 'application/json',
        'x-origin': 'SITE_CPA',
        'x-correlation-id': 'corr-catalog-gateway',
        'x-site-cpa-timestamp': timestampValue,
        'x-site-cpa-nonce': nonce,
        'x-site-cpa-signature': signature,
        'idempotency-key': 'idem-catalog-gateway',
      }),
    },
    base44: state.base44,
    payload: body,
    rawBody,
    env: (name) => ({
      SITE_CPA_SERVICE_TOKEN: 'service-token',
      SITE_CPA_HMAC_SECRET: 'hmac-secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa',
      SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco,3z',
    })[name] || '',
    now,
  });
  const responseBody = await response.json();
  assert.equal(response.status, 200);
  assert.equal(responseBody.data.items[0].erpProductId, 'prod-1');
  assert.equal(eventRows[0].status, 'concluido');
});
