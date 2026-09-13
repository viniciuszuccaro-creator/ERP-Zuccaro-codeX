import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SITE_CPA_NEGOTIATION_GET_OPERATION,
  SITE_CPA_NEGOTIATION_RESPOND_OPERATION,
  SITE_CPA_QUOTE_CREATE_OPERATION,
  SITE_CPA_QUOTE_GET_OPERATION,
  SiteCpaQuoteError,
  normalizeNegotiationResponseInput,
  normalizeQuoteCreateInput,
  resolveSiteCpaQuoteOperation,
} from '../base44/functions/_lib/security/siteCpaQuoteNegotiation/entry.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const now = Date.parse('2026-09-13T12:00:00.000Z');
const request = (operation) => ({ correlationId: 'corr-quote', operation });

const product = (overrides = {}) => ({
  id: 'prod-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', codigo: 'ACO-10',
  descricao: 'Vergalhao CA-50 10 mm', grupo_produto_id: 'cat-aco', status: 'Ativo',
  unidade_medida_id: 'unit-kg', unidade_medida: 'KG', codigo_especificacao: 'SPEC-10',
  exibir_no_site: true, estoque_atual: 100, estoque_reservado: 10,
  quantidade_minima_venda: 2, multiplo_venda: 2, custo_medio: 7, margem_minima_percentual: 10,
  fornecedor_id: 'supplier-1', observacoes: 'nao expor', updated_date: '2026-09-13T11:00:00.000Z',
  ...overrides,
});

const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
  razao_social: 'Cliente CPA Ltda', vendedor_responsavel_id: 'seller-1',
  endereco_principal: { id: 'addr-main', tipo: 'ENTREGA', logradouro: 'Rua A', numero: '10', ativo: true },
  locais_entrega: [{ id: 'work-1', tipo: 'OBRA', obra: true, logradouro: 'Obra B', numero: '20', ativo: true }],
  condicao_comercial: {
    tabela_preco_id: 'table-1', forma_pagamento_padrao_id: 'payment-1',
    forma_pagamento_padrao_nome: 'Boleto 30 dias', limite_credito: 10000, limite_credito_utilizado: 100,
  },
  ...overrides,
});

const approvedLink = (overrides = {}) => ({
  id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
  dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role: 'COMPRADOR' },
  ...overrides,
});

const quoteInput = (overrides = {}) => ({
  externalQuoteId: 'quote-1001', externalUserId: 'site-user-1', erpCustomerId: 'customer-1',
  source: 'CART',
  items: [{ erpProductId: 'prod-1', quantity: 2, erpSpecCode: 'SPEC-10', commercialUnit: 'KG' }],
  deliveryMode: 'PICKUP', requestedDeliveryDate: '2026-09-20',
  purchaseOrderReference: 'OC-1', notes: 'Favor avaliar',
  ...overrides,
});

const matches = (actual, expected) => {
  if (expected && typeof expected === 'object' && '$in' in expected) {
    return expected.$in.map(String).includes(String(actual));
  }
  return actual === expected;
};

const createState = ({
  products = [product()], customers = [customer()], links = [approvedLink()],
  tables = [{ id: 'table-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', nome: 'Tabela B2B', ativo: true }],
  priceItems = [{ id: 'price-1', tabela_preco_id: 'table-1', produto_id: 'prod-1', preco: 10, ativo: true }],
  sellers = [{ id: 'seller-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', nome_completo: 'Vendedor CPA', ativo: true }],
  orders = [], failEntity = null,
} = {}) => {
  const audits = [];
  const approvalRequests = links;
  const data = {
    Produto: products,
    CatalogoWeb: [],
    GrupoProduto: [{ id: 'cat-aco', group_id: 'grupo-cpa', nome_grupo: 'Acos', ativo: true }],
    UnidadeMedida: [{ id: 'unit-kg', group_id: 'grupo-cpa', sigla: 'KG', ativo: true }],
    Cliente: customers,
    SolicitacaoAprovacao: approvalRequests,
    TabelaPreco: tables,
    TabelaPrecoItem: priceItems,
    FormaPagamento: [{ id: 'payment-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', descricao: 'Boleto 30 dias', ativo: true }],
    Colaborador: sellers,
    Projeto: [{ id: 'project-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', ativo: true }],
    CentroCusto: [{ id: 'cost-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', ativo: true }],
    Oportunidade: [],
    Pedido: orders,
  };
  const entities = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, {
    filter: async (filter) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((row) => Object.entries(filter).every(([key, value]) => matches(row[key], value)));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name.toLowerCase()}-${rows.length + 1}`, created_date: '2026-09-13T12:00:00.000Z', ...record };
      rows.push(created);
      return created;
    },
    update: async (id, patch) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const row = rows.find((item) => item.id === id);
      if (!row) throw new Error(`${name} not found`);
      Object.assign(row, patch, { updated_date: '2026-09-13T12:01:00.000Z' });
      return row;
    },
  }]));
  entities.AuditLog = { create: async (record) => {
    if (failEntity === 'AuditLog') throw new Error('audit unavailable');
    audits.push(record);
    return record;
  } };
  return { base44: { asServiceRole: { entities } }, audits, orders, approvalRequests };
};

const operate = (state, operation, data) => resolveSiteCpaQuoteOperation({
  base44: state.base44, payload: { data }, scope, request: request(operation), now,
});

const createQuote = (state, data = quoteInput()) => operate(state, SITE_CPA_QUOTE_CREATE_OPERATION, data);

const rejectsCode = async (promise, code, status) => assert.rejects(promise, (error) => (
  error instanceof SiteCpaQuoteError && error.code === code && error.status === status
));

const lookup = (overrides = {}) => ({
  erpQuoteId: 'pedido-1', externalUserId: 'site-user-1', erpCustomerId: 'customer-1', ...overrides,
});

test('normaliza fontes, limites, customizados e textos sem aceitar desconto do Site', () => {
  const normalized = normalizeQuoteCreateInput(quoteInput({
    customItems: [{ description: '<b>Peca especial</b>', quantity: 1, commercialUnit: 'UN' }],
    discount: 99,
  }));
  assert.equal(normalized.source, 'CART');
  assert.equal(normalized.customItems[0].description, 'bPeca especial/b');
  assert.equal('discount' in normalized, false);
  assert.throws(() => normalizeQuoteCreateInput(quoteInput({ source: 'SITE_FREE_TEXT' })));
  assert.throws(() => normalizeQuoteCreateInput(quoteInput({ items: [], customItems: [] })));
});

test('cria Orçamento real, proposta v1 imutável e sem reserva de estoque', async () => {
  const state = createState();
  const result = await createQuote(state);
  assert.equal(result.erpQuoteId, 'pedido-1');
  assert.equal(result.proposalVersion, 1);
  assert.equal(result.status, 'CUSTOMER_REVIEW');
  assert.equal(result.totals.total, 20);
  assert.equal(state.orders[0].tipo, 'Orçamento');
  assert.equal(state.orders[0].origem_pedido, 'SITE_CPA');
  assert.equal(state.orders[0].reserva_estoque_ao_criar, false);
  assert.equal(state.orders[0].proposta_historico.length, 1);
  assert.equal(state.orders[0].pagamento_confirmado, false);
  const opportunities = await state.base44.asServiceRole.entities.Oportunidade.filter({ orcamento_id: 'pedido-1' });
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].etapa, 'Proposta');
});

test('idempotência de externalQuoteId retorna o mesmo orçamento e conflito de payload falha', async () => {
  const state = createState();
  const first = await createQuote(state);
  const replay = await createQuote(state);
  assert.equal(replay.erpQuoteId, first.erpQuoteId);
  assert.equal(replay.replayed, true);
  await rejectsCode(createQuote(state, quoteInput({ notes: 'outro payload' })), 'site_cpa_quote_idempotency_conflict', 409);
  assert.equal(state.orders.length, 1);
  assert.equal((await state.base44.asServiceRole.entities.Oportunidade.filter({ orcamento_id: 'pedido-1' })).length, 1);
});

test('item de catálogo valida escopo, atividade, spec, unidade, mínimo e múltiplo', async () => {
  await rejectsCode(createQuote(createState({ products: [product({ empresa_id: '3z' })] })), 'site_cpa_quote_item_invalid', 422);
  await rejectsCode(createQuote(createState(), quoteInput({
    items: [{ ...quoteInput().items[0], erpSpecCode: 'SPEC-FALSA' }],
  })), 'site_cpa_quote_item_invalid', 422);
  await rejectsCode(createQuote(createState(), quoteInput({
    items: [{ ...quoteInput().items[0], quantity: 3 }],
  })), 'site_cpa_quote_item_invalid', 422);
});

test('item customizado não recebe produto falso e exige revisão do vendedor', async () => {
  const state = createState();
  const result = await createQuote(state, quoteInput({
    items: [], customItems: [{ customItemRef: 'custom-1', description: 'Armação especial', quantity: 1, commercialUnit: 'UN' }],
  }));
  assert.equal(result.status, 'UNDER_REVIEW');
  assert.equal(result.items[0].erpProductId, null);
  assert.equal(result.items[0].unitPrice, null);
  assert.equal(state.orders[0].itens_revenda[0].status_site, 'SELLER_REVIEW_REQUIRED');
});

test('entrega valida endereço e mantém frete pendente sem preço fictício', async () => {
  const result = await createQuote(createState(), quoteInput({ deliveryMode: 'DELIVERY', addressId: 'addr-main' }));
  assert.equal(result.freightStatus, 'PENDING');
  assert.equal(result.totals.freight, null);
  assert.equal(result.status, 'UNDER_REVIEW');
  await rejectsCode(createQuote(createState(), quoteInput({
    deliveryMode: 'DELIVERY', addressId: 'addr-other', externalQuoteId: 'quote-2',
  })), 'site_cpa_quote_address_invalid', 403);
});

test('cliente precisa de vínculo comprador, mesmo Grupo e Empresa', async () => {
  await rejectsCode(createQuote(createState({ links: [] })), 'site_cpa_quote_customer_invalid', 403);
  await rejectsCode(createQuote(createState({
    links: [approvedLink({ dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role: 'CONSULTA' } })],
  })), 'site_cpa_quote_customer_invalid', 403);
  await rejectsCode(createQuote(createState({ customers: [customer({ empresa_id: '3z' })] })), 'site_cpa_quote_customer_invalid', 403);
});

test('Get e NegociacaoGet aplicam ownership e expõem timeline segura', async () => {
  const state = createState();
  await createQuote(state);
  const quote = await operate(state, SITE_CPA_QUOTE_GET_OPERATION, lookup());
  const negotiation = await operate(state, SITE_CPA_NEGOTIATION_GET_OPERATION, lookup());
  assert.equal('timeline' in quote, false);
  assert.equal(negotiation.timeline[0].type, 'QUOTE_CREATED');
  await rejectsCode(operate(state, SITE_CPA_QUOTE_GET_OPERATION, lookup({ externalUserId: 'attacker' })), 'site_cpa_quote_customer_invalid', 403);
});

test('pedido de melhor preço cria Solicitação de Aprovação e não sobrescreve proposta', async () => {
  const state = createState();
  await createQuote(state);
  const before = JSON.stringify(state.orders[0].proposta_historico);
  const result = await operate(state, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, {
    ...lookup(), action: 'REQUEST_BETTER_PRICE', expectedProposalVersion: 1,
    externalResponseId: 'response-1', message: 'Pode melhorar?',
  });
  assert.equal(result.status, 'CHANGE_REQUESTED');
  assert.equal(state.approvalRequests.some((item) => item.tipo_solicitacao === 'revisao_orcamento_site'), true);
  assert.equal(JSON.stringify(state.orders[0].proposta_historico), before);
});

test('resposta repetida é idempotente e versão divergente retorna conflito', async () => {
  const state = createState();
  await createQuote(state);
  const response = { ...lookup(), action: 'REQUEST_CHANGE', expectedProposalVersion: 1, externalResponseId: 'response-1' };
  await operate(state, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, response);
  const replay = await operate(state, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, response);
  assert.equal(replay.replayed, true);
  assert.equal(state.orders[0].negociacao_timeline.length, 2);
  await rejectsCode(operate(state, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, {
    ...response, externalResponseId: 'response-2', expectedProposalVersion: 2,
  }), 'site_cpa_negotiation_version_conflict', 409);
});

test('aceite revalida via sitePedidoCreate, converte uma vez e não confirma pagamento', async () => {
  const state = createState();
  await createQuote(state);
  const result = await operate(state, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, {
    ...lookup(), action: 'ACCEPT', expectedProposalVersion: 1, externalResponseId: 'accept-1',
  });
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.order.status, 'Aguardando Aprovação');
  assert.equal(result.order.paymentStatus, 'PENDING');
  assert.equal(state.orders.filter((item) => item.tipo === 'Pedido').length, 1);
  assert.equal(state.orders.find((item) => item.tipo === 'Pedido').pagamento_confirmado, false);
});

test('aceite bloqueia proposta stale, customizada, com frete pendente ou preço alterado', async () => {
  const expired = createState();
  await createQuote(expired);
  expired.orders[0].data_validade = '2026-09-12';
  await rejectsCode(operate(expired, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, {
    ...lookup(), action: 'ACCEPT', expectedProposalVersion: 1, externalResponseId: 'accept-expired',
  }), 'site_cpa_quote_expired', 410);

  const delivery = createState();
  await createQuote(delivery, quoteInput({ deliveryMode: 'DELIVERY', addressId: 'addr-main' }));
  await rejectsCode(operate(delivery, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, {
    ...lookup(), action: 'ACCEPT', expectedProposalVersion: 1, externalResponseId: 'accept-delivery',
  }), 'site_cpa_quote_not_acceptable', 422);

  const changed = createState();
  await createQuote(changed);
  changed.base44.asServiceRole.entities.TabelaPrecoItem.filter = async () => [{
    id: 'price-new', tabela_preco_id: 'table-1', produto_id: 'prod-1', preco: 11, ativo: true,
  }];
  await rejectsCode(operate(changed, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, {
    ...lookup(), action: 'ACCEPT', expectedProposalVersion: 1, externalResponseId: 'accept-changed',
  }), 'site_cpa_quote_proposal_stale', 409);
});

test('rejeição encerra a negociação sem criar Pedido', async () => {
  const state = createState();
  await createQuote(state);
  const result = await operate(state, SITE_CPA_NEGOTIATION_RESPOND_OPERATION, {
    ...lookup(), action: 'REJECT', expectedProposalVersion: 1, externalResponseId: 'reject-1', message: 'Não aprovado',
  });
  assert.equal(result.status, 'REJECTED');
  assert.equal(state.orders.filter((item) => item.tipo === 'Pedido').length, 0);
});

test('ARMACAO preserva referência técnica sem criar produção', async () => {
  const state = createState();
  await createQuote(state, quoteInput({ source: 'ARMACAO', armacaoPackageId: 'arm-1', armacaoRevision: 'R2' }));
  assert.equal(state.orders[0].site_armacao_package_id, 'arm-1');
  assert.equal(state.orders[0].site_armacao_revision, 'R2');
  assert.equal('ordem_producao_id' in state.orders[0], false);
});

test('falha de dependência e auditoria falham fechadas', async () => {
  await rejectsCode(createQuote(createState({ failEntity: 'Produto' })), 'site_cpa_quote_catalog_unavailable', 503);
  await rejectsCode(createQuote(createState({ failEntity: 'AuditLog' })), 'site_cpa_audit_unavailable', 503);
});

test('respostas não expõem custo, margem, fornecedor, crédito ou notas internas', async () => {
  const result = await createQuote(createState());
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ['custo_medio', 'margem_minima', 'fornecedor_id', 'limite_credito', 'observacoes_internas', 'service-token']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('gateway registra as quatro operações e mantém compatibilidade dos contratos anteriores', async () => {
  const source = await readFile(new URL('../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts', import.meta.url), 'utf8');
  for (const operation of [
    'SITE_CPA_QUOTE_CREATE_OPERATION', 'SITE_CPA_QUOTE_GET_OPERATION',
    'SITE_CPA_NEGOTIATION_GET_OPERATION', 'SITE_CPA_NEGOTIATION_RESPOND_OPERATION',
  ]) assert.match(source, new RegExp(operation));
  assert.match(source, /QUOTE_CREATE: 'ready'/);
  assert.match(source, /NEGOTIATION: 'ready'/);
  assert.match(source, /CUSTOMER_RESOLVE: 'ready'/);
  assert.match(source, /CATALOG_READ: 'ready'/);
  assert.match(source, /ORDER_CREATE: 'ready'/);
});
