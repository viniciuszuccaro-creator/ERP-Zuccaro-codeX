import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import { ProdutoService } from '../src/services/produtoService.ts';

const groupId = '11111111-1111-4111-8111-111111111111';
const empresaId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';

function setup(actions = ['visualizar', 'criar', 'editar']) {
  const repo = createInMemoryProdutoRepo();
  const audit = new InMemoryAuditRepository();
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: { Cadastros: { produto: actions } } });
  const service = new ProdutoService(repo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac);
  const ctx = { requestId: randomUUID(), actorId, groupId, empresaId };
  return { repo, audit, tenant, service, ctx };
}

test('Produto canal CRUD preserva rascunho, tenant e auditoria', async () => {
  const { service, audit, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Produto de teste' });
  const created = await service.createCanal(ctx, produto.id, { canal: 'site_cpa', sku: 'CANAL-1', nome: 'Nome canal' });
  assert.equal(created.status, 'RASCUNHO');
  assert.equal(created.empresa_id, empresaId);
  assert.equal((await service.listCanais(ctx, produto.id)).length, 1);
  const updated = await service.updateCanal(ctx, produto.id, created.id, { nome: 'Nome atualizado' });
  assert.equal(updated.nome, 'Nome atualizado');
  assert.equal(updated.sku, 'CANAL-1');
  assert.equal((await service.deactivateCanal(ctx, produto.id, created.id)).ativo, false);
  assert.deepEqual(await service.listCanais(ctx, produto.id), []);
  const logs = await audit.listByEntity('ProdutoCanal', created.id);
  assert.deepEqual(logs.map((row) => row.action), ['create', 'update', 'soft_delete']);
  assert.equal(logs[1]?.beforeData?.nome, 'Nome canal');
  assert.equal(logs[1]?.afterData?.nome, 'Nome atualizado');
});

test('Produto canal bloqueia payload interno, SKU duplicado, RBAC e cross-tenant', async () => {
  const { service, ctx, tenant } = setup();
  const produto = await service.create(ctx, { descricao: 'Produto de teste' });
  await assert.rejects(service.createCanal(ctx, produto.id, { canal: 'site_cpa', groupId }),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 400);
  await assert.rejects(service.createCanal(ctx, produto.id, { canal: 'site_cpa', status: 'PUBLICADO' }),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 400);
  await service.createCanal(ctx, produto.id, { canal: 'site_cpa', sku: 'ABC' });
  const second = await service.create(ctx, { descricao: 'Outro produto' });
  await assert.rejects(service.createCanal(ctx, second.id, { canal: 'site_cpa', sku: 'abc' }),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 409);
  const otherEmpresaId = randomUUID();
  tenant.link(otherEmpresaId, groupId);
  await assert.rejects(service.listCanais({ ...ctx, empresaId: otherEmpresaId }, produto.id),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 404);
  const denied = setup(['visualizar', 'criar']);
  const deniedProduct = await denied.service.create(denied.ctx, { descricao: 'RBAC' });
  await assert.rejects(denied.service.createCanal(denied.ctx, deniedProduct.id, { canal: 'site_cpa' }),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 403);
});

test('Produto canal rollbacka registro e update quando auditoria falha', async () => {
  const { repo, service, audit, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Produto de teste' });
  const append = audit.append.bind(audit);
  audit.append = async (...args) => {
    if (args[0].entity === 'ProdutoCanal') throw new Error('AUDIT_FAILURE_SYNTHETIC');
    return append(...args);
  };
  await assert.rejects(service.createCanal(ctx, produto.id, { canal: 'site_cpa', sku: 'ROLLBACK' }), /AUDIT_FAILURE_SYNTHETIC/);
  assert.deepEqual(await repo.listCanais({ groupId, empresaId }, produto.id), []);
  audit.append = append;
  const row = await service.createCanal(ctx, produto.id, { canal: 'site_cpa', sku: 'ROLLBACK' });
  audit.append = async (...args) => {
    if (args[0].entity === 'ProdutoCanal') throw new Error('AUDIT_FAILURE_SYNTHETIC');
    return append(...args);
  };
  await assert.rejects(service.updateCanal(ctx, produto.id, row.id, { nome: 'Nao persiste' }), /AUDIT_FAILURE_SYNTHETIC/);
  assert.equal((await repo.listCanais({ groupId, empresaId }, produto.id))[0]?.nome, null);
  await assert.rejects(service.deactivateCanal(ctx, produto.id, row.id), /AUDIT_FAILURE_SYNTHETIC/);
  assert.equal((await repo.listCanais({ groupId, empresaId }, produto.id))[0]?.ativo, true);
});
