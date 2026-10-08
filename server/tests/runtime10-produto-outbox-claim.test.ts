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

function setup(actions = ['visualizar', 'criar', 'editar', 'aprovar-conteudo', 'publicar'], publisher?: FakeCatalogPublisher) {
  const repo = createInMemoryProdutoRepo();
  const audit = new InMemoryAuditRepository();
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: { Cadastros: { produto: actions } } });
  const service = new ProdutoService(repo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac, new NotImplementedStorage(), undefined, publisher);
  const ctx = { requestId: randomUUID(), actorId, groupId, empresaId };
  return { repo, audit, tenant, rbac, service, ctx };
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
  assert.equal(result.metrics.published, 1);
  assert.equal(result.metrics.retry, 0);
  assert.equal(result.metrics.dead_letter, 0);
  assert.ok(result.metrics.durationMs >= 0);
  assert.equal(publisher.delivered.length, 1);
  assert.equal(publisher.delivered[0].produtoId, produto.id);
});

test('Outbox batch fake publisher falha agenda retry sem rede', async () => {
  const publisher = new FakeCatalogPublisher('fail');
  const repo = createInMemoryProdutoRepo();
  const audit = new InMemoryAuditRepository();
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: { Cadastros: { produto: ['visualizar', 'criar', 'editar', 'publicar'] } } });
  const service = new ProdutoService(
    repo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac,
    new NotImplementedStorage(), undefined, publisher,
  );
  const ctx = { requestId: randomUUID(), actorId, groupId, empresaId };
  const produto = await service.create(ctx, { descricao: 'Batch fake fail' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'batch-fail');
  const result = await service.processOutboxBatch(ctx, { limit: 5, leaseMs: 30_000 });
  assert.equal(result.claimed, 1);
  assert.equal(result.results[0].outcome, 'retry');
  assert.equal(result.metrics.retry, 1);
  assert.equal(result.metrics.published, 0);
  assert.equal(result.results[0].error, 'FAKE_PUBLISHER_FAILURE');
  assert.equal(publisher.delivered.length, 0);
});

test('Outbox claim concorrente: segundo claim nao pega o mesmo evento', async () => {
  const { service, repo, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Concorrencia claim' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'claim-once');
  const first = await service.claimPublicationEvents(ctx, { limit: 10, leaseMs: 60_000 });
  assert.equal(first.length, 1);
  const second = await service.claimPublicationEvents(ctx, { limit: 10, leaseMs: 60_000 });
  assert.equal(second.length, 0);
});

test('Outbox claim concorrente: Promise.all nao duplica o mesmo evento', async () => {
  const { service, repo, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Concorrencia Promise.all' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'claim-race');
  const [a, b] = await Promise.all([
    service.claimPublicationEvents(ctx, { limit: 10, leaseMs: 60_000 }),
    service.claimPublicationEvents(ctx, { limit: 10, leaseMs: 60_000 }),
  ]);
  const won = a.length === 1 ? a : b;
  const lost = a.length === 1 ? b : a;
  assert.equal(won.length, 1);
  assert.equal(lost.length, 0);
  assert.equal(won[0].produtoId, produto.id);
});

test('Outbox claim recupera lease expirado do mesmo evento', async () => {
  const { service, repo, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Lease expirado' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'lease-expired');
  const first = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 60_000 });
  assert.equal(first.length, 1);
  const events = (repo as any).publicationEvents as Array<{ id: string; lockedUntil: string | null; status: string }>;
  const row = events.find((event) => event.id === first[0].id);
  assert.ok(row);
  row!.lockedUntil = new Date(Date.now() - 1000).toISOString();
  row!.status = 'processing';
  const reclaimed = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  assert.equal(reclaimed.length, 1);
  assert.equal(reclaimed[0].id, first[0].id);
  assert.notEqual(reclaimed[0].leaseToken, first[0].leaseToken);
  await assert.rejects(service.confirmPublicationEvent(ctx, first[0].id, first[0].leaseToken),
    (error: unknown) => (error as { code?: string }).code === 'OUTBOX_EVENT_NOT_FOUND'
      || (error as { code?: string }).code === 'OUTBOX_LEASE_MISMATCH');
  const confirmed = await service.confirmPublicationEvent(ctx, reclaimed[0].id, reclaimed[0].leaseToken);
  assert.equal(confirmed.status, 'published');
});

test('Outbox dead-letter: reprocess exige RBAC proprio e volta a pending claimavel', async () => {
  const { service, repo, audit, ctx } = setup(['visualizar', 'criar', 'editar', 'publicar', 'reprocessar']);
  const produto = await service.create(ctx, { descricao: 'Dead letter reprocess' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'req-reprocess-1');
  const events = (repo as any).publicationEvents as Array<{ maxAttempts: number; schemaVersion: number }>;
  events[0].maxAttempts = 1;
  const schemaVersion = events[0].schemaVersion;

  const claimed = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  const failed = await service.failPublicationEvent(ctx, claimed[0].id, claimed[0].leaseToken, 'permanent');
  assert.equal(failed.status, 'dead_letter');

  const onlyPublish = setup(['visualizar', 'criar', 'editar', 'publicar']);
  await assert.rejects(
    onlyPublish.service.reprocessPublicationEvent(onlyPublish.ctx, claimed[0].id, 'sem_permissao'),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );

  const missingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await assert.rejects(
    service.reprocessPublicationEvent(ctx, missingId, 'missing'),
    (error: unknown) => (error as { code?: string }).code === 'OUTBOX_EVENT_NOT_FOUND',
  );

  const reprocessed = await service.reprocessPublicationEvent(ctx, claimed[0].id, 'operator_retry');
  assert.equal(reprocessed.id, claimed[0].id);
  assert.equal(reprocessed.status, 'pending');
  assert.equal(reprocessed.attempts, 0);
  assert.equal(reprocessed.schemaVersion, schemaVersion);
  assert.equal(reprocessed.produtoId, produto.id);

  const logs = await audit.listByEntity('IntegrationEvent', claimed[0].id);
  assert.ok(logs.some((row) => row.afterData?.status === 'pending' && row.afterData?.reason === 'operator_retry'));

  const reclaimable = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  assert.equal(reclaimable.length, 1);
  assert.equal(reclaimable[0].id, claimed[0].id);
});

test('Outbox confirm: recibo idempotente quando ja published', async () => {
  const { service, audit, ctx } = setup();
  const produto = await service.create(ctx, { descricao: 'Confirm idempotente' });
  await service.changeWorkflowStatus(ctx, produto.id, 'EM_REVISAO');
  await service.changeWorkflowStatus(ctx, produto.id, 'APROVADO');
  await service.changeWorkflowStatus(ctx, produto.id, 'PUBLICADO');
  const claimed = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  const first = await service.confirmPublicationEvent(ctx, claimed[0].id, claimed[0].leaseToken);
  assert.equal(first.status, 'published');
  assert.equal(first.receipt, 'confirmed');
  const second = await service.confirmPublicationEvent(ctx, claimed[0].id, 'token-atrasado-qualquer');
  assert.equal(second.status, 'published');
  assert.equal(second.receipt, 'already_published');
  assert.equal(second.id, first.id);
  assert.equal(second.publishedAt, first.publishedAt);
  const logs = await audit.listByEntity('IntegrationEvent', claimed[0].id);
  assert.equal(logs.filter((row) => row.afterData?.status === 'published').length, 1);
});

test('Outbox fake publisher: segundo publish do mesmo eventId nao duplica recibo', async () => {
  const publisher = new FakeCatalogPublisher('ok');
  const produtoId = randomUUID();
  const event = {
    id: randomUUID(), produtoId, requestId: randomUUID(), status: 'processing' as const,
    attempts: 1, maxAttempts: 10, lockedUntil: new Date().toISOString(), leaseToken: 't',
    schemaVersion: 1, payload: { produtoId, schemaVersion: 1, descricao: 'proj' },
  };
  assert.deepEqual(await publisher.publish(event), { ok: true });
  assert.deepEqual(await publisher.publish(event), { ok: true });
  assert.equal(publisher.delivered.length, 1);
  assert.equal(publisher.delivered[0].projection.produtoId, produtoId);
  assert.equal(publisher.delivered[0].projection.descricao, 'proj');
});

test('Outbox projecao: allowlist no emit e rejeita custo/margem no publisher fake', async () => {
  const { service, repo, ctx } = setup();
  const produto = await service.create(ctx, {
    descricao: 'Projecao allowlist',
    descricao_comercial: 'Texto canal',
    multiplo_venda: 2,
    permite_fracionamento: true,
    embalagem_tipo: 'barra',
  });
  await service.changeWorkflowStatus(ctx, produto.id, 'EM_REVISAO');
  await service.changeWorkflowStatus(ctx, produto.id, 'APROVADO');
  await service.changeWorkflowStatus(ctx, produto.id, 'PUBLICADO');

  const events = (repo as { publicationEvents: Array<{ payload: Record<string, unknown> }> }).publicationEvents;
  const payload = events[0].payload;
  assert.equal(payload.produtoId, produto.id);
  assert.equal(payload.descricao, 'Projecao allowlist');
  assert.equal(payload.descricaoComercial, 'Texto canal');
  assert.equal(payload.multiploVenda, 2);
  assert.equal(payload.permiteFracionamento, true);
  assert.equal(payload.embalagemTipo, 'barra');
  assert.equal(payload.workflowStatus, 'PUBLICADO');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.custo, undefined);
  assert.equal(payload.margem, undefined);
  assert.equal(payload.ncm, undefined);
  assert.equal(payload.groupId, undefined);
  assert.equal(payload.fotoProdutoUrl, undefined);

  const publisher = new FakeCatalogPublisher('ok');
  const claimed = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  const ok = await publisher.publish(claimed[0]);
  assert.equal(ok.ok, true);
  assert.equal(publisher.delivered[0].projection.descricaoComercial, 'Texto canal');

  const poisoned = {
    ...claimed[0],
    id: randomUUID(),
    payload: { ...claimed[0].payload, custo: 10, margem: 5 },
  };
  const rejected = await publisher.publish(poisoned);
  assert.equal(rejected.ok, false);
  assert.match(String((rejected as { error?: string }).error), /CATALOG_PROJECTION_FORBIDDEN/);
});

test('Outbox list: dead_letter read-only exige visualizar e isola tenant', async () => {
  const { service, repo, ctx } = setup(['visualizar', 'criar', 'editar', 'publicar', 'descartar']);
  const produto = await service.create(ctx, { descricao: 'List dead letter' });
  await repo.appendPublicationEvent({ groupId, empresaId }, produto, 'req-list-1');
  const events = (repo as any).publicationEvents as Array<{ maxAttempts: number }>;
  events[0].maxAttempts = 1;
  const claimed = await service.claimPublicationEvents(ctx, { limit: 1, leaseMs: 30_000 });
  await service.failPublicationEvent(ctx, claimed[0].id, claimed[0].leaseToken, 'list_dead');

  const denied = setup([]);
  await assert.rejects(denied.service.listPublicationEvents(denied.ctx, { status: 'dead_letter' }),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED');

  const page = await service.listPublicationEvents(ctx, { status: 'dead_letter', limit: 10, offset: 0 });
  assert.equal(page.total, 1);
  assert.equal(page.rows.length, 1);
  assert.equal(page.rows[0].id, claimed[0].id);
  assert.equal(page.rows[0].status, 'dead_letter');
  assert.equal(page.rows[0].errorMessage, 'list_dead');
  assert.equal((page.rows[0] as { payload?: unknown }).payload, undefined);

  await assert.rejects(service.listPublicationEvents(ctx, { status: 'invalid' as any }),
    (error: unknown) => (error as { code?: string }).code === 'VALIDATION_ERROR');

  const metrics = await service.getOutboxMetrics(ctx);
  assert.equal(metrics.byStatus.dead_letter, 1);
  assert.ok(metrics.total >= 1);

  const scoped = await service.listPublicationEvents(ctx, {
    status: 'dead_letter', produtoId: produto.id, limit: 10, offset: 0,
  });
  assert.equal(scoped.total, 1);
  assert.equal(scoped.rows[0].produtoId, produto.id);
  const otherProduto = randomUUID();
  const emptyScoped = await service.listPublicationEvents(ctx, {
    status: 'dead_letter', produtoId: otherProduto, limit: 10, offset: 0,
  });
  assert.equal(emptyScoped.total, 0);
  const scopedMetrics = await service.getOutboxMetrics(ctx, { produtoId: produto.id });
  assert.equal(scopedMetrics.byStatus.dead_letter, 1);
  assert.equal(scopedMetrics.produtoId, produto.id);

  const onlyReprocess = setup(['visualizar', 'criar', 'editar', 'publicar', 'reprocessar']);
  await assert.rejects(
    onlyReprocess.service.discardPublicationEvent(onlyReprocess.ctx, claimed[0].id, 'nope'),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );
  const discarded = await service.discardPublicationEvent(ctx, claimed[0].id, 'operator_discard');
  assert.equal(discarded.status, 'cancelled');
  assert.equal(discarded.id, claimed[0].id);
  const afterDiscard = await service.listPublicationEvents(ctx, { status: 'dead_letter', produtoId: produto.id });
  assert.equal(afterDiscard.total, 0);
  const cancelled = await service.listPublicationEvents(ctx, { status: 'cancelled', produtoId: produto.id });
  assert.equal(cancelled.total, 1);
});

test('Outbox consumer: external sem canal/credenciais nunca simula sucesso', async () => {
  const {
    createCatalogPublisher,
    resolveOutboxConsumerConfig,
  } = await import('../src/services/produtoOutboxConsumer.ts');
  assert.equal(resolveOutboxConsumerConfig({}).mode, 'disabled');
  assert.equal(resolveOutboxConsumerConfig({ ERP_OUTBOX_CONSUMER_MODE: 'fake' }).mode, 'disabled');
  assert.equal(resolveOutboxConsumerConfig({ ERP_OUTBOX_CONSUMER_MODE: 'fake', ERP_OUTBOX_FAKE_ALLOWED: 'true', NODE_ENV: 'test' }).mode, 'fake');
  assert.equal(resolveOutboxConsumerConfig({ ERP_OUTBOX_CONSUMER_MODE: 'fake', ERP_OUTBOX_FAKE_ALLOWED: 'true', NODE_ENV: 'production' }).mode, 'disabled');
  assert.equal(resolveOutboxConsumerConfig({ ERP_OUTBOX_CONSUMER_MODE: 'weird' }).mode, 'disabled');
  const disabled = createCatalogPublisher({ mode: 'disabled' });
  assert.deepEqual(await disabled.publish({} as never), { ok: false, error: 'OUTBOX_CONSUMER_DISABLED' });
  const noChannel = createCatalogPublisher({ mode: 'external' });
  assert.deepEqual(await noChannel.publish({} as never), { ok: false, error: 'CATALOG_CHANNEL_NOT_CONFIGURED' });
  const noCreds = createCatalogPublisher({ mode: 'external', externalChannelId: 'site', externalCredentialsPresent: false });
  assert.deepEqual(await noCreds.publish({} as never), { ok: false, error: 'CATALOG_CHANNEL_CREDENTIALS_MISSING' });
  const blocked = createCatalogPublisher({ mode: 'external', externalChannelId: 'site', externalCredentialsPresent: true });
  assert.deepEqual(await blocked.publish({} as never), { ok: false, error: 'CATALOG_EXTERNAL_PUBLISHER_BLOCKED' });
});

test('Outbox consumer: lote fake idempotente e external agenda retry sem sucesso falso', async () => {
  const { createCatalogPublisher, runProdutoOutboxConsumer } = await import('../src/services/produtoOutboxConsumer.ts');
  const { service, ctx } = setup(undefined, new FakeCatalogPublisher('ok'));
  const produto = await service.create(ctx, { descricao: 'Consumer batch' });
  await service.changeWorkflowStatus(ctx, produto.id, 'EM_REVISAO');
  await service.changeWorkflowStatus(ctx, produto.id, 'APROVADO');
  await service.changeWorkflowStatus(ctx, produto.id, 'PUBLICADO');
  const fake = await service.processOutboxBatch(ctx, { limit: 5, leaseMs: 30_000 });
  assert.equal(fake.metrics.published, 1);
  assert.equal(fake.metrics.retry, 0);

  const again = setup();
  const produto2 = await again.service.create(again.ctx, { descricao: 'Consumer external block' });
  await again.service.changeWorkflowStatus(again.ctx, produto2.id, 'EM_REVISAO');
  await again.service.changeWorkflowStatus(again.ctx, produto2.id, 'APROVADO');
  await again.service.changeWorkflowStatus(again.ctx, produto2.id, 'PUBLICADO');
  const external = await runProdutoOutboxConsumer({
    repo: again.repo,
    audit: again.audit,
    tenantGuard: again.tenant,
    rbacGuard: again.rbac,
    publisher: createCatalogPublisher({
      mode: 'external', externalChannelId: 'portal', externalCredentialsPresent: true,
    }),
  }, again.ctx, { limit: 5, leaseMs: 30_000 });
  assert.equal(external.metrics.published, 0);
  assert.equal(external.metrics.retry, 1);
  assert.match(String(external.results[0]?.error), /CATALOG_EXTERNAL_PUBLISHER_BLOCKED/);
});
