import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_PORTAL_BOLETOS_OPERATION,
  SITE_CPA_PORTAL_DOCUMENT_OPERATION,
  SITE_CPA_PORTAL_NFE_OPERATION,
  SITE_CPA_PORTAL_ORDER_GET_OPERATION,
  SITE_CPA_PORTAL_ORDERS_OPERATION,
  SITE_CPA_PORTAL_PAYMENTS_OPERATION,
  SITE_CPA_PORTAL_RECEIVABLES_OPERATION,
  SiteCpaPortalError,
  portalCapabilities,
  resolveSiteCpaPortalOperation,
} from '../base44/functions/_lib/security/siteCpaPortal/entry.ts';
import { normalizePortalInput } from '../base44/functions/_lib/security/siteCpaPortal/contract.ts';
import {
  buildSiteCpaSignatureInput,
  handleSiteCpaGatewayRequest,
  hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const now = Date.parse('2026-09-13T15:00:00.000Z');
const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
  razao_social: 'Cliente CPA', cnpj: '11222333000181', ...overrides,
});
const link = (role = 'ADMIN_EMPRESA', overrides = {}) => ({
  id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
  dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role },
  ...overrides,
});
const order = (overrides = {}) => ({
  id: 'order-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  numero_pedido: 'PED-100', status: 'Em Producao', origem_pedido: 'SITE_CPA',
  data_pedido: '2026-09-10', valor_total: 150, pode_ver_no_portal: true, obra_id: 'obra-1',
  itens_revenda: [{ produto_id: 'prod-1', sku: 'SKU-1', nome_produto: 'Vergalhao', quantidade: 2,
    unidade: 'UN', preco_unitario: 75, valor_total: 150, custo: 20, margem: 55 }],
  observacoes_internas: 'nao expor', custo_total: 40, margem: 110, ...overrides,
});
const nfe = (overrides = {}) => ({
  id: 'nfe-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  pedido_id: 'order-1', numero: '1234', serie: '1', chave_acesso: '1'.repeat(44),
  data_emissao: '2026-09-11', valor_total: 150, status: 'Autorizada', obra_id: 'obra-1',
  xml_file_uri: 'private/fiscal/nfe-1.xml', danfe_file_uri: 'private/fiscal/nfe-1.pdf',
  xml_url: 'https://public.example/never-return.xml', notas_internas: 'nao expor', ...overrides,
});
const receivable = (overrides = {}) => ({
  id: 'rec-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  pedido_id: 'order-1', numero_documento: 'DUP-1', parcela: '1/1', data_vencimento: '2026-09-20',
  valor: 150, valor_recebido: 0, status: 'Pendente', visivel_no_portal: true,
  forma_cobranca: 'Boleto', boleto_linha_digitavel: '34191.79001',
  boleto_file_uri: 'private/financeiro/rec-1.pdf', dados_bancarios: 'nao expor', ...overrides,
});
const paymentEvent = (overrides = {}) => ({
  id: 'event-payment-1', origem: 'SITE_CPA_PAYMENT', operacao: 'sitePagamentoAttempt',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', response_payload: { attempt: {
    paymentAttemptId: 'PAY-1', externalUserId: 'site-user-1', erpCustomerId: 'customer-1',
    erpOrderId: 'order-1', method: 'PIX', amount: 150, paidAmount: 50,
    status: 'PARTIALLY_PAID', reconciliationStatus: 'PARTIAL', createdAt: '2026-09-12',
    provider: 'ASAAS', externalProviderId: 'secret-provider-id', providerPayload: { token: 'secret' },
  } }, ...overrides,
});

const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);
const createState = ({
  role = 'ADMIN_EMPRESA', allowedWorkIds = [], customers = [customer()], orders = [order()],
  notes = [nfe()], receivables = [receivable()], events = [paymentEvent()], failEntity = null,
  signer = true,
} = {}) => {
  const audits = [];
  const signed = [];
  const links = [link(role, { dados_propostos: {
    source: 'SITE_CPA', externalUserId: 'site-user-1', role, allowedWorkIds,
  } })];
  const records = {
    Cliente: customers, SolicitacaoAprovacao: links, Pedido: orders, NotaFiscal: notes,
    ContaReceber: receivables, IntegracaoEvento: events,
    Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa' }],
  };
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (filter = {}) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((record) => matches(record, filter));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name}-${rows.length + 1}`, created_date: new Date(now).toISOString(), ...record };
      rows.push(created);
      return created;
    },
    update: async (id, patch) => {
      const found = rows.find((record) => record.id === id);
      if (!found) throw new Error(`${name} missing`);
      Object.assign(found, patch);
      return found;
    },
  }]));
  entities.AuditLog = { create: async (record) => {
    if (failEntity === 'AuditLog') throw new Error('audit unavailable');
    audits.push(record);
    return record;
  } };
  const Core = signer ? { CreateFileSignedUrl: async ({ file_uri, expires_in }) => {
    signed.push({ file_uri, expires_in });
    return { signed_url: `https://signed.example/document?expires=${expires_in}` };
  } } : {};
  return { base44: { asServiceRole: { entities, integrations: { Core } } }, audits, signed };
};

const input = (overrides = {}) => ({
  externalUserId: 'site-user-1', erpCustomerId: 'customer-1', ...overrides,
});
const call = (state, operation, data = {}) => resolveSiteCpaPortalOperation({
  base44: state.base44, payload: { data: input(data) }, scope,
  request: { operation, correlationId: `corr-${operation}` }, now,
});
const rejects = (promise, code, status) => assert.rejects(promise, (error) => (
  error instanceof SiteCpaPortalError && error.code === code && error.status === status
));

test('entrada limita paginacao, datas e rejeita caminho ou URL do Site', () => {
  assert.equal(normalizePortalInput({ data: input({ page: 2, pageSize: 100 }) }).page, 2);
  assert.throws(() => normalizePortalInput({ data: input({ pageSize: 101 }) }), /site_cpa_portal_page_invalid/);
  assert.throws(() => normalizePortalInput({ data: input({ dataInicial: '2025-01-01', dataFinal: '2026-09-13' }) }), /date_range/);
  assert.throws(() => normalizePortalInput({ data: input({ url: 'https://evil.example' }) }), /input_forbidden/);
});

test('lista e detalhe de Pedido retornam somente contrato publico paginado', async () => {
  const state = createState();
  const list = await call(state, SITE_CPA_PORTAL_ORDERS_OPERATION, { pageSize: 1, obraId: 'obra-1' });
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].status, 'IN_PRODUCTION');
  const detail = await call(state, SITE_CPA_PORTAL_ORDER_GET_OPERATION, { erpOrderId: 'order-1' });
  assert.equal(detail.order.items[0].erpProductId, 'prod-1');
  for (const field of ['custo_total', 'margem', 'comissao', 'observacoes_internas']) {
    assert.equal(Object.prototype.hasOwnProperty.call(detail.order, field), false);
  }
  assert.equal(Object.prototype.hasOwnProperty.call(detail.order.items[0], 'custo'), false);
});

test('Pedido invisivel, de outro cliente ou tenant falha fechado', async () => {
  await rejects(call(createState({ orders: [order({ pode_ver_no_portal: false })] }),
    SITE_CPA_PORTAL_ORDER_GET_OPERATION, { erpOrderId: 'order-1' }), 'site_cpa_portal_scope_forbidden', 403);
  await rejects(call(createState({ orders: [order({ cliente_id: 'customer-2' })] }),
    SITE_CPA_PORTAL_ORDER_GET_OPERATION, { erpOrderId: 'order-1' }), 'site_cpa_portal_scope_forbidden', 403);
  await rejects(call(createState({ orders: [order({ empresa_id: '3z' })] }),
    SITE_CPA_PORTAL_ORDER_GET_OPERATION, { erpOrderId: 'order-1' }), 'site_cpa_portal_order_not_found', 404);
});

test('restricao de obra vale em filtros e no recurso carregado', async () => {
  const state = createState({ allowedWorkIds: ['obra-2'] });
  await rejects(call(state, SITE_CPA_PORTAL_ORDERS_OPERATION, { obraId: 'obra-1' }), 'site_cpa_portal_work_forbidden', 403);
  await rejects(call(state, SITE_CPA_PORTAL_ORDER_GET_OPERATION, { erpOrderId: 'order-1' }), 'site_cpa_portal_work_forbidden', 403);
});

test('NF-e ativa ou cancelada preserva status, chave mascarada e disponibilidade real', async () => {
  const state = createState({ notes: [nfe(), nfe({ id: 'nfe-2', numero: '1235', status: 'Cancelada' })] });
  const result = await call(state, SITE_CPA_PORTAL_NFE_OPERATION, { pageSize: 10 });
  assert.deepEqual(result.items.map((item) => item.status), ['AUTHORIZED', 'CANCELLED']);
  assert.equal(result.items[0].accessKeyMasked, '1111...1111');
  assert.deepEqual(result.items[0].documentsAvailable, { danfe: true, xml: true });
  assert.equal(JSON.stringify(result).includes('public.example'), false);
  assert.equal(JSON.stringify(result).includes('private/fiscal'), false);
});

test('NF-e de outro cliente, empresa ou Grupo nao pode ser localizada', async () => {
  for (const changed of [{ cliente_id: 'customer-2' }, { empresa_id: '3z' }, { group_id: 'outro' }]) {
    await rejects(call(createState({ notes: [nfe(changed)] }), SITE_CPA_PORTAL_NFE_OPERATION, { nfeId: 'nfe-1' }),
      'site_cpa_portal_nfe_not_found', 404);
  }
});

test('duplicatas mapeiam aberta, parcial, paga, vencida e cancelada sem dados bancarios', async () => {
  const state = createState({ receivables: [
    receivable(),
    receivable({ id: 'rec-2', valor_recebido: 50 }),
    receivable({ id: 'rec-3', valor_recebido: 150, status: 'Recebido' }),
    receivable({ id: 'rec-4', data_vencimento: '2026-09-01' }),
    receivable({ id: 'rec-5', status: 'Cancelado' }),
  ] });
  const result = await call(state, SITE_CPA_PORTAL_RECEIVABLES_OPERATION, { pageSize: 10 });
  assert.deepEqual(result.items.map((item) => item.status), ['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']);
  assert.equal(JSON.stringify(result).includes('dados_bancarios'), false);
});

test('boletos mostram somente cobranca real existente e nao geram segunda via simulada', async () => {
  const state = createState({ receivables: [receivable(), receivable({ id: 'rec-pix', forma_cobranca: 'PIX', boleto_linha_digitavel: null, boleto_file_uri: null, id_cobranca_externa: null })] });
  const result = await call(state, SITE_CPA_PORTAL_BOLETOS_OPERATION, { pageSize: 10 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].barcode, '34191.79001');
  assert.equal(result.items[0].documentAvailable, true);
});

test('matriz RBAC bloqueia financeiro para COMPRADOR e CONSULTA', async () => {
  for (const role of ['COMPRADOR', 'CONSULTA']) {
    const state = createState({ role });
    assert.equal((await call(state, SITE_CPA_PORTAL_ORDERS_OPERATION)).items.length, 1);
    assert.equal((await call(state, SITE_CPA_PORTAL_NFE_OPERATION)).items.length, 1);
    await rejects(call(state, SITE_CPA_PORTAL_RECEIVABLES_OPERATION), 'site_cpa_portal_forbidden', 403);
    await rejects(call(state, SITE_CPA_PORTAL_PAYMENTS_OPERATION), 'site_cpa_portal_forbidden', 403);
  }
});

test('FINANCEIRO consulta pagamentos oficiais sem metadados do provider', async () => {
  const result = await call(createState({ role: 'FINANCEIRO' }), SITE_CPA_PORTAL_PAYMENTS_OPERATION);
  assert.equal(result.items[0].status, 'PARTIALLY_PAID');
  assert.equal(result.items[0].paidAmount, 50);
  const serialized = JSON.stringify(result).toLowerCase();
  for (const field of ['providerpayload', 'externalproviderid', 'token', 'secret-provider-id']) assert.equal(serialized.includes(field), false);
});

test('pagamento de outro usuario ou cliente nao aparece', async () => {
  const otherUser = createState({ events: [paymentEvent({ response_payload: { attempt: {
    ...paymentEvent().response_payload.attempt, externalUserId: 'other-user',
  } } })] });
  assert.equal((await call(otherUser, SITE_CPA_PORTAL_PAYMENTS_OPERATION)).items.length, 0);
  await rejects(call(otherUser, SITE_CPA_PORTAL_PAYMENTS_OPERATION, { paymentAttemptId: 'PAY-1' }),
    'site_cpa_portal_payment_not_found', 404);
});

test('download assina URI privada por 300 segundos e nao retorna caminho interno', async () => {
  const state = createState();
  const result = await call(state, SITE_CPA_PORTAL_DOCUMENT_OPERATION, { resourceId: 'nfe-1', documentType: 'XML' });
  assert.deepEqual(state.signed, [{ file_uri: 'private/fiscal/nfe-1.xml', expires_in: 300 }]);
  assert.equal(result.document.contentType, 'application/xml');
  assert.equal(result.document.expiresIn, 300);
  assert.equal(JSON.stringify(result).includes('private/fiscal'), false);
  assert.equal(state.audits.at(-1).descricao, 'sitePortalDocumento allowed');
});

test('download bloqueia ownership, URL publica, path traversal e storage ausente', async () => {
  await rejects(call(createState({ notes: [nfe({ cliente_id: 'customer-2' })] }), SITE_CPA_PORTAL_DOCUMENT_OPERATION,
    { resourceId: 'nfe-1', documentType: 'DANFE' }), 'site_cpa_portal_download_forbidden', 403);
  await rejects(call(createState({ notes: [nfe({ xml_file_uri: '', xml_url: 'https://public.example/file.xml' })] }),
    SITE_CPA_PORTAL_DOCUMENT_OPERATION, { resourceId: 'nfe-1', documentType: 'XML' }), 'site_cpa_portal_document_unavailable', 503);
  await rejects(call(createState({ notes: [nfe({ xml_file_uri: '../secret.xml' })] }),
    SITE_CPA_PORTAL_DOCUMENT_OPERATION, { resourceId: 'nfe-1', documentType: 'XML' }), 'site_cpa_portal_document_unavailable', 503);
  await rejects(call(createState({ signer: false }), SITE_CPA_PORTAL_DOCUMENT_OPERATION,
    { resourceId: 'nfe-1', documentType: 'XML' }), 'site_cpa_portal_document_unavailable', 503);
});

test('dependencia e auditoria indisponiveis falham sem sucesso falso', async () => {
  await rejects(call(createState({ failEntity: 'Pedido' }), SITE_CPA_PORTAL_ORDERS_OPERATION), 'site_cpa_portal_unavailable', 503);
  await rejects(call(createState({ failEntity: 'AuditLog' }), SITE_CPA_PORTAL_ORDERS_OPERATION), 'site_cpa_audit_unavailable', 503);
});

test('capabilities refletem portal completo, parcial e bloqueado', async () => {
  assert.deepEqual(await portalCapabilities({ base44: createState().base44, scope }), {
    PORTAL: 'ready', PORTAL_FINANCIAL: 'ready', PORTAL_FISCAL: 'ready', PORTAL_DOCUMENT: 'ready',
  });
  const partial = createState({ signer: false });
  assert.equal((await portalCapabilities({ base44: partial.base44, scope })).PORTAL, 'degraded');
  assert.equal((await portalCapabilities({ base44: partial.base44, scope })).PORTAL_DOCUMENT, 'blocked');
});

test('sitePortalPedidos atravessa autenticacao, ledger e gateway v1', async () => {
  const state = createState();
  const payload = {
    version: '1', operation: SITE_CPA_PORTAL_ORDERS_OPERATION,
    data: input({ page: 1, pageSize: 10 }),
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date(now).toISOString();
  const nonce = 'nonce-portal-1234567890';
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({ timestamp, nonce, rawBody }));
  const response = await handleSiteCpaGatewayRequest({
    req: { headers: new Headers({
      authorization: 'Bearer service-token',
      'content-type': 'application/json',
      'x-origin': 'SITE_CPA',
      'x-correlation-id': 'corr-portal-orders',
      'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': nonce,
      'x-site-cpa-signature': signature,
      'idempotency-key': 'idem-portal-orders',
    }) },
    base44: state.base44,
    payload,
    rawBody,
    env: (name) => ({
      SITE_CPA_SERVICE_TOKEN: 'service-token',
      SITE_CPA_HMAC_SECRET: 'hmac-secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa',
      SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco',
    })[name] || '',
    now,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.items[0].erpOrderId, 'order-1');
  assert.equal(state.audits.some((audit) => audit.descricao === 'sitePortalPedidos allowed'), true);
});
