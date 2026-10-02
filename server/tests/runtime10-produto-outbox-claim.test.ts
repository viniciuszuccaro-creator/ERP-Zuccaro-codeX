import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import { ProdutoService } from '../src/services/produtoService.ts';
import { buildOutboxLeaseToken, FakeCatalogPublisher } from '../src/services/produtoOutboxClaim.ts';
import { NotImplementedStorage } from '../src/services/storagePort.ts';

const groupId = '11111111-1111-4111-8111-111111111111';
const empresaId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';

function setup(actions = ['visualizar', 'criar', 'editar', 'aprovar-conteudo', 'publicar']) {
  const repo = createInMemoryProdutoRepo();
  const audit = new InMemoryAuditRepository();
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: { Cadastros: { produto: actions } } });
  const service = new ProdutoService(repo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac);
  const ctx = { requestId: randomUUID(), actorId, groupId, empresaId };
  return { repo, audit, service, ctx };
}

test('Outbox claim/lease: claim confirma e falha respeitam token e tenant', async () => {
  const { service, audit, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Produto outbox claim' });
  await service.changeWorkflowStatus(ctx, produto.id, 'EM_REVISAO');
  await service.changeWorkflowStatus(ctx, produto.id, 'APROVADO');
  await service.changeWorkflowStatus(ctx, produto.id, 'PUBLICADO');

  const denied = setup(['visualizar', 'criar', 'editar']);
  await assert.rejects(denied.service.claimPublicationEvents(denied.ctx),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED');

  const claimed = await service.claimPublicationEvents(ctx, { limit: 5, leaseMs: 30_000 });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, 'processing');
  assert.equal(claimed[0].produtoId, produto.id);
  assert.equal(claimed[0].leaseToken, buildOutboxLeaseToken(claimed[0].id, claimed[0].lockedUntil));

  const empty = await service.claimPublicationEvents(ctx, { limit: 5, leaseMs: 30_000 });
  assert.equal(empty.length, 0);

  await assert.rejects(service.confirmPublicationEvent(ctx, claimed[0].id, 'token-invalido'),
    (error: unknown) => (error as { code?: string }).code === 'OUTBOX_EVENT_NOT_FOUND'
      || (error as { code?: string }).code === 'OUTBOX_LEASE_MISMATCH');

  const confirmed = await service.confirmPublicationEvent(ctx, claimed[0].id, claimed[0].leaseToken);
  assert.equal(confirmed.status, 'published');
  assert.ok(confirmed.publishedAt);

  const logs = await audit.listByEntity('IntegrationEvent', claimed[0].id);
  assert.ok(logs.some((row) => row.afterData?.status === 'processing'));
  assert.ok(logs.some((row) => row.afterData?.status === 'published'));
});

test('Outbox claim/lease: fail vai para retry e depois dead_letter', async () => {
  const { service, repo, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Produto outbox fail' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'req-fail-1');
  // force maxAttempts=1 via direct mutate of memory store through claim/fail cycle
  const events = (repo as any).publicationEvents as Array<{ maxAttempts: number }>;
  events[0].maxAttempts = 1;

  const claimed = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  assert.equal(claimed.length, 1);
  const failed = await service.failPublicationEvent(ctx, claimed[0].id, claimed[0].leaseToken, 'canal_timeout');
  assert.equal(failed.status, 'dead_letter');
  assert.ok(failed.deadLetterAt);
});

test('Outbox claim/lease: fail com tentativas restantes agenda retry', async () => {
  const { service, repo, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Produto outbox retry' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'req-retry-1');
  const claimed = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  const failed = await service.failPublicationEvent(ctx, claimed[0].id, claimed[0].leaseToken, 'temporary');
  assert.equal(failed.status, 'retry');
  assert.ok(failed.nextAttemptAt);
  assert.equal(failed.deadLetterAt, null);
});

test('Outbox batch fake publisher confirma sem rede', async () => {
  const publisher = new FakeCatalogPublisher('ok');
  const repo = createInMemoryProdutoRepo();
  const audit = new InMemoryAuditRepository();
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: { Cadastros: { produto: ['visualizar', 'criar', 'editar', 'aprovar-conteudo', 'publicar'] } } });
  const service = new ProdutoService(
    repo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac,
    new NotImplementedStorage(), undefined, publisher,
  );
  const ctx = { requestId: randomUUID(), actorId, groupId, empresaId };
  const produto = await service.create(ctx, { descricao: 'Batch fake ok' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'batch-ok');
  const result = await service.processOutboxBatch(ctx, { limit: 5, leaseMs: 30_000 });
  assert.equal(result.claimed, 1);
  assert.equal(result.results[0].outcome, 'published');
  assert.equal(publisher.delivered.length, 1);
  assert.equal(publisher.delivered[0].produtoId, produto.id);
});
