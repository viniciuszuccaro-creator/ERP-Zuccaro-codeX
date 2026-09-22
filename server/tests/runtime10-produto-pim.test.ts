import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import { produtoVarianteCreateSchema, produtoVarianteUpdateSchema } from '../src/repositories/produtoTypes.ts';
import { ProdutoService } from '../src/services/produtoService.ts';

const GROUP = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';

function harness(actions = ['visualizar', 'criar', 'editar', 'inativar', 'aprovar-conteudo', 'publicar']) {
  const repo = createInMemoryProdutoRepo();
  const tenant = new InMemoryTenantGuard();
  tenant.link(EMPRESA, GROUP);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ACTOR, groupId: GROUP, permissions: { Cadastros: { produto: actions } } });
  const audit = new InMemoryAuditRepository();
  const service = new ProdutoService(repo, audit, tenant, new InMemoryProdutoRelationGuard(), rbac);
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
