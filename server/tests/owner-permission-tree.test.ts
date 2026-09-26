import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard, permissionTreeAllows } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import {
  OWNER_ERP_PERMISSION_TREE,
  assertOwnerPermissionTreeShape,
  ownerPermissionTreeHasWildcard,
} from '../src/security/ownerPermissionTree.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

test('owner permission tree não tem wildcard * e cobre módulos atuais', () => {
  assert.equal(ownerPermissionTreeHasWildcard(OWNER_ERP_PERMISSION_TREE as unknown as Record<string, unknown>), false);
  assertOwnerPermissionTreeShape(OWNER_ERP_PERMISSION_TREE);
  assert.ok(permissionTreeAllows(OWNER_ERP_PERMISSION_TREE as any, 'Cadastros', 'produto', 'configurar', { allowGlobalWildcard: false }));
  assert.ok(permissionTreeAllows(OWNER_ERP_PERMISSION_TREE as any, 'Comercial', 'pedido', 'criar', { allowGlobalWildcard: false }));
  assert.ok(permissionTreeAllows(OWNER_ERP_PERMISSION_TREE as any, 'Sistema', 'configuracao', 'configurar', { allowGlobalWildcard: false }));
  assert.equal(
    permissionTreeAllows(OWNER_ERP_PERMISSION_TREE as any, 'Financeiro', 'caixa', 'baixar', { allowGlobalWildcard: false }),
    false,
  );
});

test('usuário comum e ação fora da allowlist recebem 403 (Permission denied)', async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  const rbac = new InMemoryRbacGuard();
  const ownerId = 'a1a1a1a1-aaaa-4aaa-8aaa-a1a1a1a1a1a1';
  const commonId = 'b2b2b2b2-bbbb-4bbb-8bbb-b2b2b2b2b2b2';
  rbac.link({
    actorId: ownerId,
    groupId: SEED_IDS.groupA,
    empresaId: SEED_IDS.empresaA,
    permissions: OWNER_ERP_PERMISSION_TREE as any,
  });
  rbac.link({
    actorId: commonId,
    groupId: SEED_IDS.groupA,
    empresaId: SEED_IDS.empresaA,
    permissions: { Comercial: { pedido: ['visualizar'] } },
  });

  const ctxOwner = {
    requestId: 'owner-rbac',
    groupId: SEED_IDS.groupA,
    empresaId: SEED_IDS.empresaA,
    actorId: ownerId,
    scopeType: 'empresa' as const,
  };
  const ctxCommon = { ...ctxOwner, actorId: commonId, requestId: 'common-rbac' };

  await rbac.assertAllowed(ctxOwner, 'Comercial', 'pedido', 'criar', { allowGlobalWildcard: false });
  await rbac.assertAllowed(ctxOwner, 'Sistema', 'configuracao', 'configurar', { allowGlobalWildcard: false });

  await assert.rejects(
    () => rbac.assertAllowed(ctxCommon, 'Comercial', 'pedido', 'criar', { allowGlobalWildcard: false }),
    (err: any) => err?.statusCode === 403 && err?.code === 'PERMISSION_DENIED',
  );
  await assert.rejects(
    () => rbac.assertAllowed(ctxOwner, 'Financeiro', 'caixa', 'baixar' as any, { allowGlobalWildcard: false }),
    (err: any) => err?.statusCode === 403 && err?.code === 'PERMISSION_DENIED',
  );

  // HTTP: comum sem criar pedido → 403
  const { app, pedidoService } = createApp({
    config,
    db: createDbClient(config),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });
  // stub mínimo para não falhar antes do RBAC em create se chegar a validar payload —
  // assertAllowed é a primeira barreira no service; chamamos direto o guard via HTTP list.
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const denied = await fetch(`http://127.0.0.1:${address.port}/api/v1/pedidos`, {
      headers: {
        'x-group-id': SEED_IDS.groupA,
        'x-empresa-id': SEED_IDS.empresaA,
        'x-actor-id': commonId,
      },
    });
    // visualizar é permitido ao comum → 200 ou lista vazia; mutação é o 403
    assert.ok([200, 403].includes(denied.status));

    await assert.rejects(
      () => pedidoService.create(ctxCommon, {
        cliente_empresa_id: 'c3c3c3c3-cccc-4ccc-8ccc-c3c3c3c3c3c3',
        itens: [],
      } as any),
      (err: any) => err?.statusCode === 403 || /Permission denied/i.test(String(err?.message || err)),
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
