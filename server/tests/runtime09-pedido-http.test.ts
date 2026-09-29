import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherEmpresaId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const deniedActorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const clienteEmpresaId = '11111111-1111-4111-8111-111111111111';
const clienteId = '12111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const pedidoPayload = {
  cliente_empresa_id: clienteEmpresaId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'ENTREGA',
  data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  observacoes: 'Pedido sintetico',
  itens: [{ produto_id: produtoId, unidade_id: unidadeId, descricao: 'Produto sintetico', unidade_sigla: 'UN', quantidade: '2', preco_unitario: '10', desconto: '0', requer_producao: true }],
};
const orcamentoPayload = {
  cliente_empresa_id: clienteEmpresaId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-02-10T00:00:00.000Z',
  itens: [{ produto_id: produtoId, unidade_id: unidadeId, descricao: 'Produto sintetico', unidade_sigla: 'UN', quantidade: '2', preco_unitario: '10', desconto: '0' }],
};

function fixture() {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  tenant.link(otherEmpresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  const permissions = { Comercial: { pedido: ['visualizar', 'criar', 'aprovar', 'editar', 'cancelar', 'converter-pedido', 'alterar-status'], orcamento: ['visualizar', 'criar', 'aprovar', 'editar', 'cancelar'] } };
  rbac.link({ actorId, groupId, permissions });
  rbac.link({ actorId: deniedActorId, groupId, permissions: { Comercial: { pedido: [] } } });
  const runtime = createApp({ config, db: createDbClient(config), useMemory: true, tenantGuard: tenant, rbacGuard: rbac });
  const pedidoRefs = runtime.pedidoService as unknown as Record<string, unknown>;
  const orcamentoRefs = runtime.orcamentoService as unknown as Record<string, unknown>;
  const clientes = { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) };
  const produtos = { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) };
  const unidades = { getById: async () => ({ id: unidadeId, ativo: true }) };
  const condicoes = { get: async () => ({ id: condicaoId, codigo: 'COND-28', nome: '28 dias', ativo: true, parcelas: [{ id: 'p1', ordem: 1, dias: 28, percentual: '100.000000', ativo: true }] }) };
  const prices = { resolveSalePrice: async () => ({ preco: '10.000000', tabela_preco_id: '99999999-9999-4999-8999-999999999999', tabela_preco_codigo: 'TAB-99', tabela_preco_nome: 'Tabela HTTP' }) };
  Object.assign(pedidoRefs, { clientes, produtos, unidades, condicoes, locais: { get: async () => null }, obras: { get: async () => null }, tabelas: { get: async () => ({ id: '99999999-9999-4999-8999-999999999999', codigo: 'TAB-99', nome: 'Tabela HTTP', ativo: true }) }, prices });
  Object.assign(orcamentoRefs, { clientes, produtos, unidades, condicoes, prices });
  return runtime;
}
function headers(overrides: Record<string, string> = {}) { return { 'content-type': 'application/json', 'x-group-id': groupId, 'x-empresa-id': empresaId, 'x-actor-id': actorId, ...overrides }; }
async function request(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init); return { status: response.status, body: await response.json() as any }; }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('HTTP Pedido executa ciclo tenant-scoped com historico e auditoria', async () => {
  const runtime = fixture();
  const created = await request(runtime.app, '/api/v1/pedidos', { method: 'POST', headers: headers(), body: JSON.stringify(pedidoPayload) });
  assert.equal(created.status, 201); assert.equal(created.body.data.total, '20.000000'); const id = created.body.data.id;
  const listed = await request(runtime.app, '/api/v1/pedidos?limit=1&offset=0&status=EM_ABERTO', { headers: headers() });
  assert.equal(listed.status, 200); assert.deepEqual(listed.body.meta, { limit: 1, offset: 0, total: 1, hasMore: false });
  assert.equal((await request(runtime.app, `/api/v1/pedidos/${id}`, { headers: headers() })).status, 200);
  const updated = await request(runtime.app, `/api/v1/pedidos/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ ...pedidoPayload, itens: [{ ...pedidoPayload.itens[0], quantidade: '3' }] }) });
  assert.equal(updated.status, 200); assert.equal(updated.body.data.numero, created.body.data.numero); assert.equal(updated.body.data.total, '30.000000');
  for (const status of ['EM_PRODUCAO', 'PRONTO_ENTREGA', 'FINALIZADO']) assert.equal((await request(runtime.app, `/api/v1/pedidos/${id}/status`, { method: 'POST', headers: headers(), body: JSON.stringify({ status }) })).status, 200);
  const history = await request(runtime.app, `/api/v1/pedidos/${id}/historico`, { headers: headers() });
  assert.deepEqual(history.body.data.map((row: { status_novo: string }) => row.status_novo), ['EM_ABERTO', 'EM_PRODUCAO', 'PRONTO_ENTREGA', 'FINALIZADO']);
  assert.deepEqual((await runtime.auditRepo.listByEntity('Pedido', id)).map((entry) => entry.action), ['create', 'update', 'change_status', 'change_status', 'change_status']);
});

test('HTTP Pedido cancela sem exclusao e bloqueia repeticao', async () => {
  const runtime = fixture(); const created = await request(runtime.app, '/api/v1/pedidos', { method: 'POST', headers: headers(), body: JSON.stringify(pedidoPayload) }); const id = created.body.data.id;
  const cancelled = await request(runtime.app, `/api/v1/pedidos/${id}/cancelar`, { method: 'POST', headers: headers(), body: JSON.stringify({ motivo: 'Pedido cancelado em teste' }) });
  assert.equal(cancelled.status, 200); assert.equal(cancelled.body.data.status, 'CANCELADO'); assert.equal(cancelled.body.data.itens.length, 1);
  assert.equal(cancelled.body.data.ativo, false);
  const audit = await runtime.auditRepo.listByEntity('Pedido', id);
  assert.deepEqual(audit.map((entry) => entry.action), ['create', 'change_status']);
  assert.equal((audit[1].beforeData as { status: string }).status, 'EM_ABERTO');
  assert.equal((audit[1].afterData as { status: string }).status, 'CANCELADO');
  assert.equal((await request(runtime.app, `/api/v1/pedidos/${id}/cancelar`, { method: 'POST', headers: headers(), body: JSON.stringify({ motivo: 'Pedido cancelado em teste' }) })).status, 409);
  assert.equal((await request(runtime.app, `/api/v1/pedidos/${id}/cancelar`, { method: 'POST', headers: headers({ 'x-actor-id': deniedActorId }), body: JSON.stringify({ motivo: 'Pedido cancelado em teste' }) })).status, 403);
  assert.equal((await request(runtime.app, `/api/v1/pedidos/${id}/cancelar`, { method: 'POST', headers: headers({ 'x-empresa-id': otherEmpresaId }), body: JSON.stringify({ motivo: 'Pedido cancelado em teste' }) })).status, 404);
  const updateBlocked = await request(runtime.app, `/api/v1/pedidos/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ ...pedidoPayload, itens: [{ ...pedidoPayload.itens[0], quantidade: '9' }] }),
  });
  assert.equal(updateBlocked.status, 409);
  assert.equal(updateBlocked.body.error.code, 'PEDIDO_STATE_CONFLICT');
});

test('HTTP converte Orcamento em Pedido uma unica vez', async () => {
  const runtime = fixture(); const quote = await request(runtime.app, '/api/v1/orcamentos', { method: 'POST', headers: headers(), body: JSON.stringify(orcamentoPayload) });
  const path = `/api/v1/orcamentos/${quote.body.data.id}/converter-pedido`; const conversion = { tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-03-10T00:00:00.000Z' };
  const first = await request(runtime.app, path, { method: 'POST', headers: headers(), body: JSON.stringify(conversion) });
  assert.equal(first.status, 201); assert.equal(first.body.data.orcamento_id, quote.body.data.id); assert.equal(first.body.data.total, quote.body.data.total);
  const duplicate = await request(runtime.app, path, { method: 'POST', headers: headers(), body: JSON.stringify(conversion) });
  assert.equal(duplicate.status, 409); assert.equal(duplicate.body.error.code, 'ORCAMENTO_ALREADY_CONVERTED');
});

test('HTTP Pedido aplica RBAC fail-closed e isolamento entre empresas', async () => {
  const runtime = fixture();
  assert.equal((await request(runtime.app, '/api/v1/pedidos', { headers: headers({ 'x-actor-id': deniedActorId }) })).status, 403);
  const created = await request(runtime.app, '/api/v1/pedidos', { method: 'POST', headers: headers(), body: JSON.stringify(pedidoPayload) });
  const cross = await request(runtime.app, `/api/v1/pedidos/${created.body.data.id}`, { headers: headers({ 'x-empresa-id': otherEmpresaId }) });
  assert.equal(cross.status, 404); assert.equal(cross.body.error.code, 'PEDIDO_NOT_FOUND');
  const meta = await request(runtime.app, '/api/v1/meta'); assert.equal(meta.body.pedido.backendHttp, true); assert.equal(meta.body.pedido.frontendHttp, true);
  assert.equal(meta.body.pedido.cancelByState, true);
  assert.equal(meta.body.pedido.listFailClosed, true);
  assert.equal(meta.body.pedido.listSearchFilterFailClosed, true);
  assert.equal(meta.body.pedido.tenantCacheFailClosed, true);
  assert.equal(meta.body.pedido.updateBlockedWhenCancelled, true);
  assert.equal(meta.body.pedido.descontoAlcadaUiFailClosed, true);
  assert.equal(meta.body.pedido.margemAlcadaUiFailClosed, true);
  assert.equal(meta.body.pedido.saveIdempotency, true);
  assert.equal(meta.body.pedido.mastersPickerFailClosed, true);
  assert.equal(meta.body.pedido.parcelaSchedulePreviewFailClosed, true);
  assert.equal(meta.body.pedido.deliveryAddressSummaryFailClosed, true);
  assert.equal(meta.body.pedido.entregaAddressRequiredFailClosed, true);
  assert.equal(meta.body.pedido.dataEntregaClienteFailClosed, true);
  assert.equal(meta.body.pedido.simulacaoDirtyFailClosed, true);
  assert.equal(meta.body.pedido.textoResumoPreviewFailClosed, true);
  assert.equal(meta.body.orcamento?.textoResumoPreviewFailClosed, true);
  assert.equal(meta.body.pedido.listMultiSelectStubFailClosed, true);
  assert.equal(meta.body.orcamento?.listMultiSelectStubFailClosed, true);
  assert.equal(meta.body.orcamento?.convertDisabledReasonsBannerFailClosed, true);
  assert.equal(meta.body.orcamento?.observacoesMaxLengthUiFailClosed, true);
  assert.equal(meta.body.orcamento?.listPageCsvExportFailClosed, true);
  assert.equal(meta.body.pedido.observacoesMaxLengthUiFailClosed, true);
  assert.equal(meta.body.pedido.listPageCsvExportFailClosed, true);
  assert.equal(meta.body.pedido.cancelMotivoUiFailClosed, true);
  assert.match(String(meta.body.note || ''), /Pedido backend HTTP is active/);
  assert.match(String(meta.body.note || ''), /Pedido Entrega vs Retirada fail-closed/);
  assert.match(String(meta.body.note || ''), /data_entrega_solicitada fail-closed/);
  assert.match(String(meta.body.note || ''), /Pedido cancel fail-closed/);
  assert.match(String(meta.body.note || ''), /listagem Orçamento\/Pedido HTTP fail-closed/);
  assert.match(String(meta.body.note || ''), /queryKey groupId\+empresaId\+filters/);
  assert.match(String(meta.body.note || ''), /busca vazia ≠ erro HTTP/);
  assert.match(String(meta.body.note || ''), /troca de tenant limpa form\/list cache comercial fail-closed/);
  assert.match(String(meta.body.note || ''), /UI alçada de desconto fail-closed/);
  assert.match(String(meta.body.note || ''), /pickers mestres Cliente\/Condição\/Produto\/Tabela fail-closed/);
  assert.match(String(meta.body.note || ''), /agenda de parcelas read-only/);
  assert.match(String(meta.body.note || ''), /Converter disabled reasons consolidados|evaluateOrcamentoConvertUiGate/);
  assert.match(String(meta.body.note || ''), /simular-venda dirty-state fail-closed/);
  assert.match(String(meta.body.note || ''), /resumo texto read-only Orçamento\/Pedido/);
  assert.match(String(meta.body.note || ''), /multi-select stub fail-closed/);
});
