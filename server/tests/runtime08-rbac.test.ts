import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const permissions = ['visualizar', 'criar', 'editar', 'inativar', 'restaurar', 'vincular-empresa', 'gerenciar-parcelas', 'definir-padrao'];

function headers(actorId?: string, empresaId = SEED_IDS.empresaA) {
  return {
    'x-group-id': SEED_IDS.groupA,
    'x-empresa-id': empresaId,
    ...(actorId ? { 'x-actor-id': actorId } : {}),
  };
}

async function request(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    return { status: response.status, body: await response.json() as unknown };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('R08 RBAC permite list/get somente para actor e tenant autorizados', async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaB, SEED_IDS.groupB);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: SEED_IDS.runtimeActorA, groupId: SEED_IDS.groupA, permissions: { Cadastros: { condicao_pagamento: permissions } } });
  rbac.link({ actorId: SEED_IDS.runtimeActorB, groupId: SEED_IDS.groupB, permissions: { Cadastros: { condicao_pagamento: permissions } } });
  rbac.link({ actorId: 'c4c4c4c4-cccc-4ccc-8ccc-c4c4c4c4c4c4', groupId: SEED_IDS.groupA, permissions: { Cadastros: { condicao_pagamento: [] } } });
  const instance = createApp({ config, db: createDbClient(config), useMemory: true, tenantGuard: tenant, rbacGuard: rbac });
  const created = await instance.condicaoPagamentoService.create({ requestId: 'r08-rbac', groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA, actorId: SEED_IDS.runtimeActorA, scopeType: 'empresa' }, { nome: 'R08 RBAC', parcelas: [{ ordem: 1, dias: 0, percentual: 100 }] });

  assert.equal((await request(instance.app, '/api/v1/condicoes-pagamento', { headers: headers(SEED_IDS.runtimeActorA) })).status, 200);
  assert.equal((await request(instance.app, `/api/v1/condicoes-pagamento/${created.id}`, { headers: headers(SEED_IDS.runtimeActorA) })).status, 200);
  assert.equal((await request(instance.app, '/api/v1/condicoes-pagamento', { headers: headers() })).status, 403);
  assert.equal((await request(instance.app, '/api/v1/condicoes-pagamento', { headers: headers('c4c4c4c4-cccc-4ccc-8ccc-c4c4c4c4c4c4') })).status, 403);
  assert.equal((await request(instance.app, '/api/v1/condicoes-pagamento', { headers: headers(SEED_IDS.runtimeActorB) })).status, 403);
  assert.equal((await request(instance.app, '/api/v1/condicoes-pagamento', { headers: headers(SEED_IDS.runtimeActorA, SEED_IDS.empresaB) })).status, 409);
});

test('R08 mutações exigem chaves granulares sem wildcard', async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: SEED_IDS.runtimeActorA, groupId: SEED_IDS.groupA, permissions: { Cadastros: { condicao_pagamento: ['visualizar'] } } });
  const { condicaoPagamentoService } = createApp({ config, db: createDbClient(config), useMemory: true, tenantGuard: tenant, rbacGuard: rbac });
  const ctx = { requestId: 'r08-rbac-mutation', groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA, actorId: SEED_IDS.runtimeActorA, scopeType: 'empresa' as const };
  await assert.rejects(() => condicaoPagamentoService.create(ctx, { nome: 'NEGADO', parcelas: [{ ordem: 1, dias: 0, percentual: 100 }] }), /Permission denied/);
  for (const action of ['criar', 'editar', 'inativar', 'restaurar', 'vincular-empresa', 'gerenciar-parcelas', 'definir-padrao'] as const) {
    await assert.rejects(() => rbac.assertAllowed(ctx, 'Cadastros', 'condicao_pagamento', action), /Permission denied/);
  }
});
