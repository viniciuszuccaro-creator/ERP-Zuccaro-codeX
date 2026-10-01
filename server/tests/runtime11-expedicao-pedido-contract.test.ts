import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import type { Pedido } from '../src/repositories/pedidoTypes.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherEmpresaId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const pedidoId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const productId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const clientId = '11111111-1111-4111-8111-111111111111';

function fixture(status: Pedido['status'] = 'PRONTO_ENTREGA') {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  tenant.link(otherEmpresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: { Expedicao: { entrega: ['criar', 'visualizar', 'cancelar', 'expedir'] } } });
  const pedido = {
    id: pedidoId, group_id: groupId, empresa_id: empresaId, numero: '00000042',
    ativo: status !== 'CANCELADO', status, tipo_operacao: 'ENTREGA',
    cliente_empresa_id: clientId, cliente_local_id: null,
    data_entrega_solicitada: '2027-04-01T12:00:00.000Z',
    itens: [{ produto_id: productId, descricao: 'Produto do Pedido', unidade_sigla: 'UN', quantidade: '10.000000' }],
  } as Pedido;
  const scopes: string[] = [];
  const runtime = createApp({ config, db: createDbClient(config), useMemory: true,
    tenantGuard: tenant, rbacGuard: rbac,
    expedicaoPedidoReader: {
      async getForExpedicao(scope, id) {
        scopes.push(`${scope.groupId}:${scope.empresaId}`);
        return scope.groupId === groupId && scope.empresaId === empresaId && id === pedidoId ? pedido : null;
      },
    },
  });
  return { ...runtime, scopes };
}

const payload = {
  pedido_id: pedidoId, pedido_numero: '00000042', cliente_empresa_id: clientId,
  tipo_frete: 'ENTREGA', data_entrega_solicitada: '2027-04-01T12:00:00.000Z',
  itens: [{ produto_id: productId, descricao: 'Descricao nao confiavel', unidade_sigla: 'UN', quantidade_pedida: '10' }],
};

async function post(runtime: ReturnType<typeof fixture>, body: unknown, empresa = empresaId) {
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/entregas`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-group-id': groupId,
        'x-empresa-id': empresa, 'x-actor-id': actorId }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function patch(runtime: ReturnType<typeof fixture>, id: string, body: unknown) {
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/entregas/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'x-group-id': groupId,
        'x-empresa-id': empresaId, 'x-actor-id': actorId }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('Entrega vinculada usa snapshot e quantidades do Pedido no mesmo tenant; retry nao duplica', async () => {
  const runtime = fixture();
  const first = await post(runtime, { ...payload, idempotency_key: 'linked-1' });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.pedido_numero, '00000042');
  assert.equal(first.body.data.cliente_id, clientId);
  assert.equal(first.body.data.itens[0].descricao, 'Produto do Pedido');
  assert.equal(first.body.data.itens[0].quantidade_pedida, 10);
  const retry = await post(runtime, { ...payload, idempotency_key: 'linked-1' });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.data.id, first.body.data.id);
  const audits = await runtime.auditRepo.listByEntity('Entrega', first.body.data.id);
  assert.equal(audits.filter((entry) => entry.action === 'create').length, 1);
  assert.ok(runtime.scopes.every((scope) => scope === `${groupId}:${empresaId}`));
});

test('chave idempotente de Entrega manual nao pode ser reutilizada por outro Pedido', async () => {
  const runtime = fixture();
  const manual = await post(runtime, { itens: payload.itens, idempotency_key: 'same-key' });
  assert.equal(manual.status, 201);
  const linked = await post(runtime, { ...payload, idempotency_key: 'same-key' });
  assert.equal(linked.status, 409);
  assert.equal(linked.body.error.code, 'ENTREGA_IDEMPOTENCY_CONFLICT');
});

test('Pedido ausente no tenant e estado nao expedivel bloqueiam criacao', async () => {
  const runtime = fixture();
  const cross = await post(runtime, payload, otherEmpresaId);
  assert.equal(cross.status, 404);
  assert.equal(cross.body.error.code, 'PEDIDO_NOT_FOUND');
  const pending = await post(fixture('EM_ABERTO'), payload);
  assert.equal(pending.status, 409);
  assert.equal(pending.body.error.code, 'PEDIDO_NAO_EXPEDIVEL');
  const cancelled = await post(fixture('CANCELADO'), payload);
  assert.equal(cancelled.status, 409);
});

test('quantidade, cliente e snapshot forjados bloqueiam Entrega', async () => {
  const runtime = fixture();
  const wrongQty = await post(runtime, { ...payload, itens: [{ ...payload.itens[0], quantidade_pedida: '11' }] });
  assert.equal(wrongQty.status, 409);
  assert.equal(wrongQty.body.error.code, 'ENTREGA_PEDIDO_ITENS_DIVERGENTES');
  const preDelivered = await post(runtime, { ...payload, itens: [{ ...payload.itens[0], quantidade_entregue: '1' }] });
  assert.equal(preDelivered.status, 409);
  const wrongClient = await post(runtime, { ...payload, cliente_empresa_id: otherEmpresaId });
  assert.equal(wrongClient.status, 409);
  assert.equal(wrongClient.body.error.code, 'ENTREGA_PEDIDO_SNAPSHOT_DIVERGENTE');
  const wrongNumber = await post(runtime, { ...payload, pedido_numero: '00000043' });
  assert.equal(wrongNumber.status, 409);
});

test('cancelamento e despacho direto de Entrega vinculada aguardam compensacao canonica', async () => {
  const runtime = fixture();
  const created = await post(runtime, payload);
  assert.equal(created.status, 201);
  const cancelled = await patch(runtime, created.body.data.id, { status: 'Cancelada', motivo: 'Cancelamento' });
  assert.equal(cancelled.status, 409);
  assert.equal(cancelled.body.error.code, 'PEDIDO_ESTOQUE_COMPENSACAO_PENDENTE');
  const pending = await runtime.expedicaoService.getEntrega({ groupId, empresaId, actorId }, created.body.data.id);
  assert.equal(pending.status_code, 'AGUARDANDO_SEPARACAO');
});
