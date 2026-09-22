
function mediaFixture(produtoId: string) {
  return {
    storage_key: `groups/${GROUP}/companies/${EMPRESA}/products/${produtoId}/images/${randomUUID()}-synthetic.png`,
    categoria: 'IMAGEM', nome_arquivo: 'synthetic.png', mime_type: 'image/png',
    tamanho_bytes: 8, sha256: 'b'.repeat(64), versao: 1,
  };
}

function verifiedStorage(override: Partial<{ sha256: string; version: number }> = {}) {
  let calls = 0;
  const storage: StoragePort = {
    createSignedUploadUrl: async () => { throw new Error('UNUSED'); },
    confirmUpload: async (request) => {
      calls += 1;
      return {
        storageKey: request.storageKey, fileName: request.fileName, mimeType: request.mimeType,
        sizeBytes: request.sizeBytes, sha256: override.sha256 ?? request.sha256,
        version: override.version ?? 1,
      };
    },
    createSignedDownloadUrl: async () => { throw new Error('UNUSED'); },
  };
  return { storage, calls: () => calls };
}
function reservableStorage(options: { badChecksum?: boolean; failSigning?: boolean } = {}) {
  let signCalls = 0;
  let confirmCalls = 0;
  const storage: StoragePort = {
    createSignedUploadUrl: async () => {
      signCalls += 1;
      if (options.failSigning) throw new Error('SYNTHETIC_SIGN_FAILURE');
      return {
        url: 'https://public.example.test/storage/v1/object/upload/sign/private/synthetic?token=synthetic',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        requiredHeaders: { 'content-type': 'image/png' },
      };
    },
    confirmUpload: async (request) => {
      confirmCalls += 1;
      return {
        storageKey: request.storageKey, fileName: request.fileName, mimeType: request.mimeType,
        sizeBytes: request.sizeBytes, sha256: options.badChecksum ? 'c'.repeat(64) : request.sha256,
        version: 1,
      };
    },
    createSignedDownloadUrl: async () => { throw new Error('UNUSED'); },
  };
  return { storage, signCalls: () => signCalls, confirmCalls: () => confirmCalls };
}

test('DAM reserva e confirma com auditoria sanitizada e confirmacao unica', async () => {
  const fake = reservableStorage();
  const { service, audit, ctx, repo: harnessRepo } = harness(undefined, fake.storage);
  const produto = await service.create(ctx, { descricao: 'Reserva sintetica' });
  const data = mediaFixture(produto.id);
  const signed = await service.reserveMidia(ctx, produto.id, data);
  assert.equal(fake.signCalls(), 1);
  assert.match(signed.url, /synthetic/);
  assert.deepEqual(await service.listMidias(ctx, produto.id), []);
  const pendingLogs = await audit.listByEntity('ProdutoMidia', signed.mediaId);
  assert.equal(pendingLogs[0]?.action, 'create');
  assert.equal(JSON.stringify(pendingLogs).includes(data.storage_key), false);
  assert.equal(JSON.stringify(pendingLogs).includes(signed.url), false);
  await assert.rejects(service.confirmMidia({ ...ctx, actorId: randomUUID() }, produto.id, signed.mediaId, signed.attemptId),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED');
  const otherActor = randomUUID();
  const tenant = new InMemoryTenantGuard(); tenant.link(EMPRESA, GROUP);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: otherActor, groupId: GROUP, permissions: { Cadastros: { produto: ['editar'] } } });
  const authorizedOther = new ProdutoService(
    harnessRepo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac, fake.storage,
  );
  await assert.rejects(authorizedOther.confirmMidia(
    { ...ctx, actorId: otherActor }, produto.id, signed.mediaId, signed.attemptId,
  ), (error: unknown) => (error as { code?: string }).code === 'MEDIA_RESERVATION_NOT_FOUND');
  assert.equal(fake.confirmCalls(), 0);
  const confirmed = await service.confirmMidia(ctx, produto.id, signed.mediaId, signed.attemptId);
  assert.equal(confirmed.status, 'QUARENTENA');
  assert.equal(fake.confirmCalls(), 1);
  assert.equal((await service.listMidias(ctx, produto.id))[0]?.id, signed.mediaId);
  assert.deepEqual((await audit.listByEntity('ProdutoMidia', signed.mediaId)).map((entry) => entry.action), ['create', 'change_status']);
  await assert.rejects(service.confirmMidia(ctx, produto.id, signed.mediaId, signed.attemptId),
    (error: unknown) => (error as { code?: string }).code === 'MEDIA_RESERVATION_NOT_FOUND');
  assert.equal(fake.confirmCalls(), 1);
});

test('DAM reserva bloqueia payload, tenant, RBAC, duplicidade e adapter ausente', async () => {
  const fake = reservableStorage();
  const denied = harness(['visualizar', 'criar'], fake.storage);
  const produto = await denied.service.create(denied.ctx, { descricao: 'Reserva negada' });
  const data = mediaFixture(produto.id);
  await assert.rejects(denied.service.reserveMidia(denied.ctx, produto.id, data),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED');
  const allowed = harness(undefined, fake.storage);
  const own = await allowed.service.create(allowed.ctx, { descricao: 'Reserva valida' });
  const ownData = mediaFixture(own.id);
  await assert.rejects(allowed.service.reserveMidia(allowed.ctx, own.id, { ...ownData, groupId: GROUP }),
    (error: unknown) => (error as { code?: string }).code === 'VALIDATION_ERROR');
  await assert.rejects(allowed.service.reserveMidia({ ...allowed.ctx, empresaId: ACTOR }, own.id, ownData),
    (error: unknown) => (error as { code?: string }).code === 'TENANT_MISMATCH');
  await assert.rejects(allowed.service.reserveMidia(allowed.ctx, own.id, {
    ...ownData, storage_key: ownData.storage_key.replace('/images/', '/videos/'),
  }), (error: unknown) => (error as { code?: string }).code === 'VALIDATION_ERROR');
  const signed = await allowed.service.reserveMidia(allowed.ctx, own.id, ownData);
  await assert.rejects(allowed.service.reserveMidia(allowed.ctx, own.id, ownData),
    (error: unknown) => (error as { code?: string }).code === 'MEDIA_RESERVATION_CONFLICT');
  await assert.rejects(allowed.service.confirmMidia({ ...allowed.ctx, empresaId: ACTOR }, own.id, signed.mediaId, signed.attemptId),
    (error: unknown) => (error as { code?: string }).code === 'TENANT_MISMATCH');
  await assert.rejects(allowed.service.confirmMidia(allowed.ctx, own.id, signed.mediaId, randomUUID()),
    (error: unknown) => (error as { code?: string }).code === 'MEDIA_RESERVATION_NOT_FOUND');
  const unconfigured = harness();
  const noStorage = await unconfigured.service.create(unconfigured.ctx, { descricao: 'Storage nao configurado' });
  await assert.rejects(unconfigured.service.reserveMidia(unconfigured.ctx, noStorage.id, mediaFixture(noStorage.id)),
    (error: unknown) => (error as { code?: string }).code === 'STORAGE_ADAPTER_NOT_CONFIGURED');
  const signingFailure = reservableStorage({ failSigning: true });
  const pending = harness(undefined, signingFailure.storage);
  const pendingProduct = await pending.service.create(pending.ctx, { descricao: 'Assinatura falhou' });
  const pendingData = mediaFixture(pendingProduct.id);
  await assert.rejects(pending.service.reserveMidia(pending.ctx, pendingProduct.id, pendingData), /SYNTHETIC_SIGN_FAILURE/);
  await assert.rejects(pending.service.reserveMidia(pending.ctx, pendingProduct.id, pendingData),
    (error: unknown) => (error as { code?: string }).code === 'MEDIA_RESERVATION_CONFLICT');
  assert.deepEqual(await pending.service.listMidias(pending.ctx, pendingProduct.id), []);
});

test('DAM reserva e confirmacao rollbackam auditoria e verificacao divergente', async () => {
  const fake = reservableStorage();
  const { service, audit, ctx } = harness(undefined, fake.storage);
  const produto = await service.create(ctx, { descricao: 'Rollback reserva' });
  const data = mediaFixture(produto.id);
  const original = audit.append.bind(audit);
  audit.append = async (...args) => {
    if (args[0].entity === 'ProdutoMidia') throw new Error('SYNTHETIC_AUDIT_FAILURE');
    return original(...args);
  };
  await assert.rejects(service.reserveMidia(ctx, produto.id, data), /SYNTHETIC_AUDIT_FAILURE/);
  assert.equal(fake.signCalls(), 0);
  audit.append = original;
  const signed = await service.reserveMidia(ctx, produto.id, data);
  audit.append = async () => { throw new Error('SYNTHETIC_AUDIT_FAILURE'); };
  await assert.rejects(service.confirmMidia(ctx, produto.id, signed.mediaId, signed.attemptId), /SYNTHETIC_AUDIT_FAILURE/);
  audit.append = original;
  const confirmed = await service.confirmMidia(ctx, produto.id, signed.mediaId, signed.attemptId);
  assert.equal(confirmed.status, 'QUARENTENA');
  const bad = reservableStorage({ badChecksum: true });
  const other = harness(undefined, bad.storage);
  const target = await other.service.create(other.ctx, { descricao: 'Checksum divergente' });
  const reserved = await other.service.reserveMidia(other.ctx, target.id, mediaFixture(target.id));
  await assert.rejects(other.service.confirmMidia(other.ctx, target.id, reserved.mediaId, reserved.attemptId),
    (error: unknown) => (error as { code?: string }).code === 'STORAGE_METADATA_MISMATCH');
  assert.deepEqual(await other.service.listMidias(other.ctx, target.id), []);
});

test('DAM Produto confirma Storage, registra quarentena e audita sem chave ou checksum', async () => {
  const fake = verifiedStorage();
  const { service, audit, ctx } = harness(undefined, fake.storage);
  const produto = await service.create(ctx, { descricao: 'Midia sintetica' });
  const data = mediaFixture(produto.id);
  const row = await service.registerMidia(ctx, produto.id, data);
  assert.equal(row.status, 'QUARENTENA');
  assert.equal(row.principal, false);
  assert.equal(fake.calls(), 1);
  assert.deepEqual((await service.listMidias(ctx, produto.id)).map((item) => item.id), [row.id]);
  const logs = await audit.listByEntity('ProdutoMidia', row.id);
  assert.equal(logs[0]?.action, 'create');
  assert.equal(JSON.stringify(logs).includes(data.storage_key), false);
  assert.equal(JSON.stringify(logs).includes(data.sha256), false);
  const inactive = await service.deactivateMidia(ctx, produto.id, row.id);
  assert.equal(inactive.status, 'INATIVO');
  assert.deepEqual(await service.listMidias(ctx, produto.id), []);
  assert.deepEqual((await audit.listByEntity('ProdutoMidia', row.id)).map((entry) => entry.action), ['create', 'soft_delete']);
});

test('DAM Produto nega RBAC, tenant, payload e confirmacao divergente antes de persistir', async () => {
  const fake = verifiedStorage();
  const denied = harness(['visualizar', 'criar'], fake.storage);
  const produto = await denied.service.create(denied.ctx, { descricao: 'Midia negada' });
  const data = mediaFixture(produto.id);
  await assert.rejects(denied.service.registerMidia(denied.ctx, produto.id, data),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED');
  assert.equal(fake.calls(), 0);
  const allowed = harness(undefined, fake.storage);
  const owner = await allowed.service.create(allowed.ctx, { descricao: 'Midia valida' });
  const ownData = mediaFixture(owner.id);
  await assert.rejects(allowed.service.registerMidia(allowed.ctx, owner.id, { ...ownData, groupId: GROUP }),
    (error: unknown) => (error as { code?: string }).code === 'VALIDATION_ERROR');
  await assert.rejects(allowed.service.registerMidia({ ...allowed.ctx, empresaId: ACTOR }, owner.id, ownData),
    (error: unknown) => (error as { code?: string }).code === 'TENANT_MISMATCH');
  await assert.rejects(allowed.service.registerMidia(allowed.ctx, owner.id, {
    ...ownData, storage_key: ownData.storage_key.replace('/images/', '/videos/'),
  }), (error: unknown) => (error as { code?: string }).code === 'VALIDATION_ERROR');
  await assert.rejects(allowed.service.registerMidia(allowed.ctx, owner.id, {
    ...ownData, categoria: 'CAD', storage_key: ownData.storage_key.replace('/images/', '/cad/'),
  }), (error: unknown) => (error as { code?: string }).code === 'MEDIA_CATEGORY_NOT_CONFIGURED');
  await assert.rejects(allowed.service.registerMidia(allowed.ctx, produto.id, data),
    (error: unknown) => (error as { code?: string }).code === 'PRODUTO_NOT_FOUND');
  assert.equal(fake.calls(), 0);
  const mismatch = verifiedStorage({ sha256: 'c'.repeat(64) });
  const mismatched = harness(undefined, mismatch.storage);
  const target = await mismatched.service.create(mismatched.ctx, { descricao: 'Checksum divergente' });
  await assert.rejects(mismatched.service.registerMidia(mismatched.ctx, target.id, mediaFixture(target.id)),
    (error: unknown) => (error as { code?: string }).code === 'STORAGE_METADATA_MISMATCH');
  assert.deepEqual(await mismatched.service.listMidias(mismatched.ctx, target.id), []);
});

test('DAM Produto rollbacka registro e inativacao se auditoria falhar', async () => {
  const fake = verifiedStorage();
  const { service, audit, ctx } = harness(undefined, fake.storage);
  const produto = await service.create(ctx, { descricao: 'Rollback de midia' });
  const original = audit.append.bind(audit);
  audit.append = async (...args) => {
    if (args[0].entity === 'ProdutoMidia') throw new Error('SYNTHETIC_AUDIT_FAILURE');
    return original(...args);
  };
  await assert.rejects(service.registerMidia(ctx, produto.id, mediaFixture(produto.id)), /SYNTHETIC_AUDIT_FAILURE/);
  assert.deepEqual(await service.listMidias(ctx, produto.id), []);
  audit.append = original;
  const row = await service.registerMidia(ctx, produto.id, mediaFixture(produto.id));
  audit.append = async () => { throw new Error('SYNTHETIC_AUDIT_FAILURE'); };
  await assert.rejects(service.deactivateMidia(ctx, produto.id, row.id), /SYNTHETIC_AUDIT_FAILURE/);
  assert.equal((await service.listMidias(ctx, produto.id))[0]?.id, row.id);
});
import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { createHash, randomUUID } from 'node:crypto';
import type { StoragePort } from '../src/services/storagePort.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import {
  produtoEquivalenteCreateSchema,
  produtoEquivalenteUpdateSchema,
  produtoVarianteCreateSchema,
  produtoVarianteUpdateSchema,
} from '../src/repositories/produtoTypes.ts';
import { SupabaseStorageAdapter } from '../src/services/supabaseStorageAdapter.ts';
import { ProdutoService } from '../src/services/produtoService.ts';
import { assertProdutoMediaContract, assertProdutoRelationsContract } from './produto-relacoes-contract.ts';

const GROUP = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';

function harness(actions = ['visualizar', 'criar', 'editar', 'inativar', 'aprovar-conteudo', 'publicar'], storage?: StoragePort) {
  const repo = createInMemoryProdutoRepo();
  const tenant = new InMemoryTenantGuard();
  tenant.link(EMPRESA, GROUP);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ACTOR, groupId: GROUP, permissions: { Cadastros: { produto: actions } } });
  const audit = new InMemoryAuditRepository();
  const service = new ProdutoService(repo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac, storage);
  const ctx = { requestId: 'pim-test', actorId: ACTOR, groupId: GROUP, empresaId: EMPRESA };
  return { repo, audit, service, ctx };
}

test('Produto persiste conteudo PIM, embalagem, minimo e fracionamento no agregado canonico', async () => {
  const { service, ctx } = harness();
  const created = await service.create(ctx, {
    descricao: 'Produto PIM sintetico',
    descricao_tecnica: 'Ficha tecnica controlada',
    descricao_comercial: 'Conteudo comercial aprovado',
    titulo_seo: 'Produto PIM para teste',
    descricao_seo: 'Descricao SEO sintetica sem dados reais.',
    embalagem_tipo: 'FARDO',
    multiplo_venda: 5,
    quantidade_minima_venda: 10,
    permite_fracionamento: true,
  });
  assert.equal(created.descricao_tecnica, 'Ficha tecnica controlada');
  assert.equal(created.descricao_comercial, 'Conteudo comercial aprovado');
  assert.equal(created.multiplo_venda, 5);
  assert.equal(created.quantidade_minima_venda, 10);
  assert.equal(created.permite_fracionamento, true);
  assert.equal(created.workflow_status, 'RASCUNHO');

  const updated = await service.update({ ...ctx, requestId: 'pim-update' }, created.id, {
    descricao_comercial: 'Conteudo comercial revisado',
    multiplo_venda: 2,
    quantidade_minima_venda: 4,
  });
  assert.equal(updated.descricao_comercial, 'Conteudo comercial revisado');
  assert.equal(updated.multiplo_venda, 2);
  assert.equal(updated.quantidade_minima_venda, 4);
});

test('Produto rejeita PIM invalido e workflow_status por mass assignment', async () => {
  const { service, ctx } = harness();
  for (const payload of [
    { descricao: 'Multiplo zero', multiplo_venda: 0 },
    { descricao: 'Minimo negativo', quantidade_minima_venda: -1 },
    { descricao: 'Workflow injetado', workflow_status: 'PUBLICADO' },
  ]) {
    await assert.rejects(
      () => service.create(ctx, payload),
      (error: unknown) => (error as { code?: string }).code === 'VALIDATION_ERROR',
    );
  }
});

test('Workflow Produto exige transicoes e RBAC de aprovacao/publicacao e grava outbox', async () => {
  const { repo, audit, service, ctx } = harness();
  const created = await service.create(ctx, { descricao: 'Workflow sintetico' });
  await assert.rejects(
    () => service.changeWorkflowStatus(ctx, created.id, 'PUBLICADO'),
    (error: unknown) => (error as { code?: string }).code === 'PRODUTO_WORKFLOW_CONFLICT',
  );
  assert.equal((await service.changeWorkflowStatus(ctx, created.id, 'EM_REVISAO')).workflow_status, 'EM_REVISAO');
  assert.equal((await service.changeWorkflowStatus(ctx, created.id, 'APROVADO')).workflow_status, 'APROVADO');
  assert.equal((await service.changeWorkflowStatus(ctx, created.id, 'PUBLICADO')).workflow_status, 'PUBLICADO');
  assert.equal(repo.listPublicationEvents().length, 1);
  const logs = await audit.listByEntity('Produto', created.id);
  assert.ok(logs.some((entry) => entry.action === 'approve'));
  assert.ok(logs.some((entry) => entry.action === 'publish'));

  const denied = harness(['visualizar', 'criar', 'editar']);
  const deniedRow = await denied.service.create(denied.ctx, { descricao: 'RBAC sintetico' });
  await denied.service.changeWorkflowStatus(denied.ctx, deniedRow.id, 'EM_REVISAO');
  await assert.rejects(
    () => denied.service.changeWorkflowStatus(denied.ctx, deniedRow.id, 'APROVADO'),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );
});

test('Falha de auditoria rollbacka publicacao e evento outbox na mesma transacao', async () => {
  const { repo, service, ctx } = harness();
  const created = await service.create(ctx, { descricao: 'Rollback publicacao' });
  await service.changeWorkflowStatus(ctx, created.id, 'EM_REVISAO');
  await service.changeWorkflowStatus(ctx, created.id, 'APROVADO');
  const failingAudit = {
    append: async () => { throw new Error('AUDIT_FAILURE'); },
    listByEntity: async () => [],
  };
  const tenant = new InMemoryTenantGuard();
  tenant.link(EMPRESA, GROUP);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ACTOR, groupId: GROUP, permissions: { Cadastros: { produto: ['publicar'] } } });
  const failingService = new ProdutoService(
    repo,
    failingAudit,
    tenant,
    new InMemoryProdutoRelationGuard(),
    rbac,
  );
  await assert.rejects(
    () => failingService.changeWorkflowStatus({ ...ctx, requestId: 'publish-rollback' }, created.id, 'PUBLICADO'),
    /AUDIT_FAILURE/,
  );
  assert.equal((await repo.getById({ groupId: GROUP, empresaId: EMPRESA }, created.id))?.workflow_status, 'APROVADO');
  assert.equal(repo.listPublicationEvents().length, 0);
});

test('Variantes e equivalentes exigem Produto no tenant e RBAC visualizar', async () => {
  const { service, ctx } = harness();
  const created = await service.create(ctx, { descricao: 'Relacoes sinteticas' });
  assert.deepEqual(await service.listVariants(ctx, created.id), []);
  assert.deepEqual(await service.listEquivalents(ctx, created.id), []);

  const denied = harness(['criar']);
  const deniedRow = await denied.service.create(denied.ctx, { descricao: 'Relacoes sem leitura' });
  await assert.rejects(
    () => denied.service.listVariants(denied.ctx, deniedRow.id),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );
  await assert.rejects(() => service.listEquivalents(ctx, crypto.randomUUID()), /not found/i);
});

test('Variante usa payload estrito e bloqueia mass assignment de tenant e campos internos', () => {
  assert.equal(produtoVarianteCreateSchema.parse({ sku: ' SKU-01 ', atributos: { cor: 'Azul', peso: 2 } }).sku, 'SKU-01');
  for (const payload of [
    { sku: '' },
    { sku: 'SKU', group_id: GROUP },
    { sku: 'SKU', empresa_id: EMPRESA },
    { sku: 'SKU', produto_id: ACTOR },
    { sku: 'SKU', ativo: false },
    { sku: 'SKU', atributos: { valor: Number.POSITIVE_INFINITY } },
  ]) {
    assert.equal(produtoVarianteCreateSchema.safeParse(payload).success, false);
  }
  assert.equal(produtoVarianteUpdateSchema.safeParse({ nome: 'Revisada' }).success, true);
  assert.equal(produtoVarianteUpdateSchema.safeParse({ id: ACTOR }).success, false);
});

test('Variante cria atualiza inativa e audita atomicamente', async () => {
  const { repo, audit, service, ctx } = harness();
  const produto = await service.create(ctx, { descricao: 'Produto com variante' });
  const variante = await service.createVariant(ctx, produto.id, { sku: 'VAR-01', nome: 'Azul', atributos: { cor: 'Azul' } });
  assert.equal(variante.sku, 'VAR-01');
  assert.equal((await service.listVariants(ctx, produto.id)).length, 1);
  const updated = await service.updateVariant(ctx, produto.id, variante.id, { nome: 'Azul revisado' });
  assert.equal(updated.nome, 'Azul revisado');
  const inactive = await service.deactivateVariant(ctx, produto.id, variante.id);
  assert.equal(inactive.ativo, false);
  assert.deepEqual(await service.listVariants(ctx, produto.id), []);
  const logs = await audit.listByEntity('ProdutoVariante', variante.id);
  assert.deepEqual(logs.map((entry) => entry.action), ['create', 'update', 'soft_delete']);

  const failingAudit = { append: async () => { throw new Error('AUDIT_FAILURE'); }, listByEntity: async () => [] };
  const tenant = new InMemoryTenantGuard(); tenant.link(EMPRESA, GROUP);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ACTOR, groupId: GROUP, permissions: { Cadastros: { produto: ['editar'] } } });
  const failing = new ProdutoService(repo, failingAudit, tenant, new InMemoryProdutoRelationGuard(), rbac);
  await assert.rejects(
    () => failing.createVariant({ ...ctx, requestId: 'variant-rollback' }, produto.id, { sku: 'ROLLBACK' }),
    /AUDIT_FAILURE/,
  );
  assert.deepEqual(await service.listVariants(ctx, produto.id), []);
});

test('Variante exige editar e permanece isolada por tenant', async () => {
  const denied = harness(['visualizar', 'criar']);
  const produto = await denied.service.create(denied.ctx, { descricao: 'Sem editar variante' });
  await assert.rejects(
    () => denied.service.createVariant(denied.ctx, produto.id, { sku: 'NEGADA' }),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );
});

test('Equivalente usa payload estrito e bloqueia self relation e mass assignment', async () => {
  assert.equal(produtoEquivalenteCreateSchema.safeParse({
    produto_equivalente_id: ACTOR,
    tipo: 'SUBSTITUTO',
    direcional: true,
    aprovado: false,
  }).success, true);
  for (const payload of [
    { produto_equivalente_id: 'invalido' },
    { produto_equivalente_id: ACTOR, group_id: GROUP },
    { produto_equivalente_id: ACTOR, empresa_id: EMPRESA },
    { produto_equivalente_id: ACTOR, ativo: false },
    { produto_equivalente_id: ACTOR, tipo: 'INVALIDO' },
  ]) {
    assert.equal(produtoEquivalenteCreateSchema.safeParse(payload).success, false);
  }
  assert.equal(produtoEquivalenteUpdateSchema.safeParse({ tipo: 'EQUIVALENTE', aprovado: true }).success, true);
  assert.equal(produtoEquivalenteUpdateSchema.safeParse({ produto_equivalente_id: ACTOR }).success, false);

  const { service, ctx } = harness();
  const produto = await service.create(ctx, { descricao: 'Produto origem equivalente' });
  await assert.rejects(
    () => service.createEquivalent(ctx, produto.id, { produto_equivalente_id: produto.id }),
    (error: unknown) => (error as { code?: string }).code === 'PRODUTO_EQUIVALENTE_SELF',
  );
  await assert.rejects(
    () => service.createEquivalent(ctx, produto.id, { produto_equivalente_id: crypto.randomUUID() }),
    (error: unknown) => (error as { code?: string }).code === 'PRODUTO_EQUIVALENTE_TARGET_NOT_FOUND',
  );
});

test('Equivalente cria atualiza inativa e audita atomicamente', async () => {
  const { repo, audit, service, ctx } = harness();
  const produto = await service.create(ctx, { descricao: 'Produto origem' });
  const target = await service.create(ctx, { descricao: 'Produto substituto' });
  const relation = await service.createEquivalent(ctx, produto.id, {
    produto_equivalente_id: target.id,
    tipo: 'SUBSTITUTO',
    direcional: true,
  });
  assert.equal(relation.produto_equivalente_id, target.id);
  assert.equal((await service.listEquivalents(ctx, produto.id)).length, 1);
  const updated = await service.updateEquivalent(ctx, produto.id, relation.id, { tipo: 'EQUIVALENTE', aprovado: true });
  assert.equal(updated.tipo, 'EQUIVALENTE');
  assert.equal(updated.aprovado, true);
  assert.equal(updated.produto_equivalente_id, target.id);
  const inactive = await service.deactivateEquivalent(ctx, produto.id, relation.id);
  assert.equal(inactive.ativo, false);
  assert.deepEqual(await service.listEquivalents(ctx, produto.id), []);
  const logs = await audit.listByEntity('ProdutoEquivalente', relation.id);
  assert.deepEqual(logs.map((entry) => entry.action), ['create', 'update', 'soft_delete']);

  const failingAudit = { append: async () => { throw new Error('AUDIT_FAILURE'); }, listByEntity: async () => [] };
  const tenant = new InMemoryTenantGuard(); tenant.link(EMPRESA, GROUP);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ACTOR, groupId: GROUP, permissions: { Cadastros: { produto: ['editar'] } } });
  const failing = new ProdutoService(repo, failingAudit, tenant, new InMemoryProdutoRelationGuard(), rbac);
  await assert.rejects(
    () => failing.createEquivalent({ ...ctx, requestId: 'equivalent-rollback' }, produto.id, {
      produto_equivalente_id: target.id,
      tipo: 'SUBSTITUTO',
    }),
    /AUDIT_FAILURE/,
  );
  assert.deepEqual(await service.listEquivalents(ctx, produto.id), []);
});

test('Equivalente exige editar', async () => {
  const denied = harness(['visualizar', 'criar']);
  const produto = await denied.service.create(denied.ctx, { descricao: 'Origem sem editar' });
  const target = await denied.service.create(denied.ctx, { descricao: 'Destino sem editar' });
  await assert.rejects(
    () => denied.service.createEquivalent(denied.ctx, produto.id, { produto_equivalente_id: target.id }),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );
});

test('Contrato compartilhado variantes e equivalentes: in-memory', async () => {
  const { repo, service, ctx } = harness();
  const source = await service.create(ctx, { descricao: 'Contrato origem sintetica' });
  const target = await service.create(ctx, { descricao: 'Contrato destino sintetico' });
  await assertProdutoRelationsContract(repo, { groupId: GROUP, empresaId: EMPRESA }, source.id, target.id, ACTOR);
  await assertProdutoMediaContract(repo, { groupId: GROUP, empresaId: EMPRESA }, source.id, ACTOR);
});

test('TenantGuard bloqueia empresa externa e destino de outra empresa', async () => {
  const { service, ctx } = harness();
  const source = await service.create(ctx, { descricao: 'Origem tenant' });
  const target = await service.create(ctx, { descricao: 'Destino tenant' });
  await assert.rejects(
    () => service.createEquivalent({ ...ctx, empresaId: ACTOR }, source.id, { produto_equivalente_id: target.id }),
    (error: unknown) => (error as { code?: string }).code === 'TENANT_MISMATCH',
  );
  await assert.rejects(
    () => service.createVariant({ ...ctx, empresaId: ACTOR }, source.id, { sku: 'TENANT-NEGADO' }),
    (error: unknown) => (error as { code?: string }).code === 'TENANT_MISMATCH',
  );
});

test('Falha do repository rollbacka mutacao de equivalente em memoria', async () => {
  const { repo, service, ctx } = harness();
  const source = await service.create(ctx, { descricao: 'Rollback origem' });
  const target = await service.create(ctx, { descricao: 'Rollback destino' });
  const original = repo.createEquivalent.bind(repo);
  repo.createEquivalent = async (...args) => {
    await original(...args);
    throw new Error('REPOSITORY_FAILURE');
  };
  await assert.rejects(
    () => service.createEquivalent(ctx, source.id, { produto_equivalente_id: target.id }),
    /REPOSITORY_FAILURE/,
  );
  assert.deepEqual(await service.listEquivalents(ctx, source.id), []);
});

test('DAM Produto confirma objeto no adapter self-hosted com bytes e SHA reais sinteticos', async () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qZkAAAAASUVORK5CYII=', 'base64');
  let reads = 0;
  const storage = new SupabaseStorageAdapter({
    internalUrl: 'https://internal.example.test', publicUrl: 'https://public.example.test',
    serviceRoleKey: 'synthetic-key', privateBucket: 'private', maxBytes: 1024,
    fetchImpl: async (input, init) => {
      reads += 1;
      assert.equal(new URL(String(input)).origin, 'https://internal.example.test');
      assert.equal(init?.redirect, 'error');
      assert.equal(init?.method ?? 'GET', 'GET');
      return new Response(bytes, { headers: { 'content-type': 'image/png' } });
    },
  });
  const { service, audit, ctx } = harness(undefined, storage);
  const produto = await service.create(ctx, { descricao: 'Midia adapter sintetica' });
  const data = {
    ...mediaFixture(produto.id), nome_arquivo: 'synthetic.png',
    tamanho_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const row = await service.registerMidia(ctx, produto.id, data);
  assert.equal(reads, 1);
  assert.equal(row.status, 'QUARENTENA');
  assert.equal((await audit.listByEntity('ProdutoMidia', row.id))[0]?.action, 'create');
});
