import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { InMemoryRbacGuard, type RbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { listMigrationFiles } from '../src/db/migrate.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import {
  PRODUTO_FORBIDDEN_OPERATIONAL_FIELDS,
  PRODUTO_TIPOS_CANONICOS,
  isProdutoTipoCanonico,
  normalizeProdutoTipoItem,
  produtoCreateSchema,
  produtoUpdateSchema,
  type ProdutoTipoCanonico,
} from '../src/repositories/produtoTypes.ts';
import { ProdutoService } from '../src/services/produtoService.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const MARCA_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const MARCA_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const UNID_A = 'cccccccc-1111-4111-8111-cccccccccccc';
const UNID_B = 'dddddddd-2222-4222-8222-dddddddddddd';
const GRUPO_A = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee';
const GRUPO_B = 'ffffffff-2222-4222-8222-ffffffffffff';
const SETOR_A = '99999999-1111-4111-8111-999999999999';
const SETOR_B = '88888888-2222-4222-8222-888888888888';
const ACTOR_A = '77777777-1111-4111-8111-777777777777';
const ACTOR_B = '66666666-2222-4222-8222-666666666666';

function allowAllRbac(): RbacGuard {
  return { assertAllowed: async () => undefined };
}

function linkedRbac() {
  const guard = new InMemoryRbacGuard();
  const permissions = { Cadastros: { produto: ['visualizar', 'criar', 'editar', 'inativar'] } };
  guard.link({ actorId: ACTOR_A, groupId: GROUP_A, permissions });
  guard.link({ actorId: ACTOR_B, groupId: GROUP_B, permissions });
  return guard;
}
function linkedGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(EMPRESA_A, GROUP_A);
  guard.link(EMPRESA_B, GROUP_B);
  return guard;
}

function linkedRelations() {
  const g = new InMemoryProdutoRelationGuard();
  g.linkMarca(MARCA_A, GROUP_A);
  g.linkMarca(MARCA_B, GROUP_B);
  g.linkUnidade(UNID_A, GROUP_A);
  g.linkUnidade(UNID_B, GROUP_B);
  g.linkGrupo(GRUPO_A, GROUP_A);
  g.linkGrupo(GRUPO_B, GROUP_B);
  g.linkSetor(SETOR_A, GROUP_A);
  g.linkSetor(SETOR_B, GROUP_B);
  return g;
}

function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    PORT: '3080',
    CORS_ORIGINS: 'http://localhost:5173',
    REQUIRE_DATABASE: 'false',
  });
}

test('runtime-03 migrations 007/008 exist after 001-006', () => {
  const files = listMigrationFiles();
  assert.ok(files.includes('007_produtos_master_data.sql'));
  assert.ok(files.includes('008_produtos_fk_tenant.sql'));
  assert.ok(files.indexOf('007_produtos_master_data.sql') > files.indexOf('006_produtos_base.sql'));
});

test('Produto normaliza aliases PIM conhecidos sem reclassificar legado desconhecido', () => {
  assert.equal(normalizeProdutoTipoItem('revenda'), PRODUTO_TIPOS_CANONICOS.REVENDA);
  assert.equal(normalizeProdutoTipoItem('materia_prima'), PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA);
  assert.equal(normalizeProdutoTipoItem('matéria-prima produção'), PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA);
  assert.equal(normalizeProdutoTipoItem('producao_aco'), 'producao_aco');
  assert.equal(normalizeProdutoTipoItem('fabricado'), PRODUTO_TIPOS_CANONICOS.FABRICADO);
  assert.equal(normalizeProdutoTipoItem('Linha Legada Especial'), 'Linha Legada Especial');
  assert.equal(normalizeProdutoTipoItem('consumo_interno'), PRODUTO_TIPOS_CANONICOS.CONSUMO_INTERNO);
  assert.equal(isProdutoTipoCanonico('consumo-interno'), true);
  assert.equal(isProdutoTipoCanonico('Linha Legada Especial'), false);

  assert.equal(
    produtoCreateSchema.parse({ descricao: 'Produto sintético', tipo_item: 'servico' }).tipo_item,
    PRODUTO_TIPOS_CANONICOS.SERVICO,
  );
  assert.equal(
    produtoUpdateSchema.parse({ tipo_item: 'produto-acabado' }).tipo_item,
    PRODUTO_TIPOS_CANONICOS.FABRICADO,
  );
  assert.equal(
    produtoCreateSchema.parse({ descricao: 'Produto padrão' }).tipo_item,
    PRODUTO_TIPOS_CANONICOS.REVENDA,
  );
});

test('Produto valida e normaliza atributos PIM universais existentes', () => {
  const parsed = produtoCreateSchema.parse({
    descricao: 'Produto PIM sintético',
    unidades_secundarias: ['KG', 'kg', ' PÇ ', 'MT', 'mt'],
    fatores_conversao: { kg_por_peca: 12.5, metros_por_peca: 6 },
    peso_liquido_kg: 12.5,
    peso_bruto_kg: 13,
    altura_cm: 10,
    largura_cm: 20,
    comprimento_cm: 600,
    volume_m3: 0.12,
  });

  assert.deepEqual(parsed.unidades_secundarias, ['KG', 'PÇ', 'MT']);
  assert.deepEqual(parsed.fatores_conversao, { kg_por_peca: 12.5, metros_por_peca: 6 });
  assert.equal(parsed.peso_liquido_kg, 12.5);

  for (const payload of [
    { descricao: 'Peso inválido', peso_liquido_kg: -1 },
    { descricao: 'Dimensão inválida', altura_cm: -1 },
    { descricao: 'Volume inválido', volume_m3: -1 },
    { descricao: 'Fator zero', fatores_conversao: { kg_por_peca: 0 } },
    { descricao: 'Fator NaN', fatores_conversao: { kg_por_peca: Number.NaN } },
    { descricao: 'Fator inválido', fatores_conversao: { kg_por_peca: -1 } },
    { descricao: 'Fator infinito', fatores_conversao: { kg_por_peca: Number.POSITIVE_INFINITY } },
    { descricao: 'Fator não numérico', fatores_conversao: { kg_por_peca: '12' } },
    { descricao: 'Unidade vazia', unidades_secundarias: ['KG', ' '] },
  ]) {
    assert.equal(produtoCreateSchema.safeParse(payload).success, false);
  }
});
test('Produto RBAC falha fechado e classificação bloqueia novos valores desconhecidos', async () => {
  const canonicalValue: ProdutoTipoCanonico = PRODUTO_TIPOS_CANONICOS.REVENDA;
  assert.equal(canonicalValue, 'Revenda');

  const ctx = {
    requestId: 'produto-rbac',
    actorId: ACTOR_A,
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
  };
  const denied = new ProdutoService(
    createInMemoryProdutoRepo(),
    new InMemoryAuditRepository(),
    linkedGuard(),
    linkedRelations(),
    new InMemoryRbacGuard(),
  );
  await assert.rejects(
    () => denied.list(ctx),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );

  const readOnlyRbac = new InMemoryRbacGuard();
  readOnlyRbac.link({
    actorId: ACTOR_A,
    groupId: GROUP_A,
    permissions: { Cadastros: { produto: ['visualizar'] } },
  });
  const readOnly = new ProdutoService(
    createInMemoryProdutoRepo(),
    new InMemoryAuditRepository(),
    linkedGuard(),
    linkedRelations(),
    readOnlyRbac,
  );
  assert.deepEqual((await readOnly.list(ctx)).data, []);
  await assert.rejects(
    () => readOnly.create(ctx, { descricao: 'Produto negado' }),
    (error: unknown) => (error as { code?: string }).code === 'PERMISSION_DENIED',
  );

  const allowed = new ProdutoService(
    createInMemoryProdutoRepo(),
    new InMemoryAuditRepository(),
    linkedGuard(),
    linkedRelations(),
    linkedRbac(),
  );
  const consumo = await allowed.create(ctx, {
    descricao: 'Produto consumo interno',
    tipo_item: 'consumo_interno',
  });
  assert.equal(consumo.tipo_item, PRODUTO_TIPOS_CANONICOS.CONSUMO_INTERNO);
  await assert.rejects(
    () => allowed.create(ctx, { descricao: 'Produto inválido', tipo_item: 'Classificação inventada' }),
    (error: unknown) => (error as { code?: string }).code === 'PRODUTO_TIPO_INVALIDO',
  );
});

test('Produto preserva tipo legado existente sem permitir troca para outro desconhecido', async () => {
  const repo = createInMemoryProdutoRepo();
  const legacy = await repo.create(
    { groupId: GROUP_A, empresaId: EMPRESA_A },
    { descricao: 'Produto legado', tipo_item: 'Linha Legada Especial' },
  );
  const service = new ProdutoService(
    repo,
    new InMemoryAuditRepository(),
    linkedGuard(),
    linkedRelations(),
    linkedRbac(),
  );
  const ctx = {
    requestId: 'produto-legado',
    actorId: ACTOR_A,
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
  };

  const preserved = await service.update(ctx, legacy.id, {
    descricao: 'Produto legado revisado',
    tipo_item: 'Linha Legada Especial',
  });
  assert.equal(preserved.tipo_item, 'Linha Legada Especial');
  await assert.rejects(
    () => service.update(ctx, legacy.id, { tipo_item: 'Outro tipo desconhecido' }),
    (error: unknown) => (error as { code?: string }).code === 'PRODUTO_TIPO_INVALIDO',
  );
});
test('Produto rollbacka create update e inativacao quando auditoria falha', async () => {
  const repo = createInMemoryProdutoRepo();
  const failingAudit = {
    append: async () => { throw new Error('AUDIT_FAILURE'); },
    listByEntity: async () => [],
  };
  const service = new ProdutoService(
    repo,
    failingAudit,
    linkedGuard(),
    linkedRelations(),
    allowAllRbac(),
  );
  const ctx = {
    requestId: 'produto-tx-audit',
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
  };

  await assert.rejects(
    () => service.create(ctx, { descricao: 'CREATE ROLLBACK', codigo: 'TX-CREATE' }),
    /AUDIT_FAILURE/,
  );
  assert.equal((await repo.listPage({ groupId: GROUP_A, empresaId: EMPRESA_A })).total, 0);

  const original = await repo.create(
    { groupId: GROUP_A, empresaId: EMPRESA_A },
    { descricao: 'ORIGINAL', codigo: 'TX-EXISTENTE' },
  );
  await assert.rejects(
    () => service.update(ctx, original.id, { descricao: 'NAO PERSISTE' }),
    /AUDIT_FAILURE/,
  );
  assert.equal((await repo.getById({ groupId: GROUP_A, empresaId: EMPRESA_A }, original.id))?.descricao, 'ORIGINAL');

  await assert.rejects(
    () => service.softDelete(ctx, original.id),
    /AUDIT_FAILURE/,
  );
  assert.equal((await repo.getById({ groupId: GROUP_A, empresaId: EMPRESA_A }, original.id))?.ativo, true);
});

test('Produto repassa o mesmo executor para mutacao e auditoria', async () => {
  const executor = { query: async () => ({ rows: [], rowCount: 0 }) };
  const repo = createInMemoryProdutoRepo();
  let repositoryExecutor: unknown;
  let auditExecutor: unknown;
  repo.withTransaction = async (fn) => fn(executor);
  const originalCreate = repo.create.bind(repo);
  repo.create = async (scope, data, received) => {
    repositoryExecutor = received;
    return originalCreate(scope, data, received);
  };
  const audit = {
    append: async (_entry: unknown, received?: unknown) => { auditExecutor = received; },
    listByEntity: async () => [],
  };
  const service = new ProdutoService(repo, audit, linkedGuard(), linkedRelations(), allowAllRbac());
  await service.create({ requestId: 'tx-executor', groupId: GROUP_A, empresaId: EMPRESA_A }, { descricao: 'EXECUTOR' });
  assert.equal(repositoryExecutor, executor);
  assert.equal(auditExecutor, executor);
});

  const audit = new InMemoryAuditRepository();
test('AUDIT: Produto descricao before/after + soft delete', async () => {
  const service = new ProdutoService(
    createInMemoryProdutoRepo(),
    audit,
    linkedGuard(),
    linkedRelations(),
    allowAllRbac(),
  );
  const ctx = {
    requestId: 'p-audit-1',
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    actorEmail: 'produto@example.com',
  };

  const created = await service.create(ctx, {
    descricao: 'PRODUTO API TESTE',
    codigo: 'DEV-P-001',
    tipo_item: 'Revenda',
  });
  const updated = await service.update(ctx, created.id, {
    descricao: 'PRODUTO API TESTE ALTERADO',
  });
  assert.equal(updated.descricao, 'PRODUTO API TESTE ALTERADO');

  const deleted = await service.softDelete({ ...ctx, requestId: 'p-audit-soft' }, created.id);
  assert.equal(deleted.ativo, false);

  const logs = await audit.listByEntity('Produto', created.id);
  const createLog = logs.find((l) => l.action === 'create');
  const updateLog = logs.find((l) => l.action === 'update');
  const softLog = logs.find((l) => l.action === 'soft_delete');

  assert.equal(createLog?.beforeData, undefined);
  assert.equal((createLog?.afterData as { descricao: string }).descricao, 'PRODUTO API TESTE');
  assert.equal((updateLog?.beforeData as { descricao: string }).descricao, 'PRODUTO API TESTE');
  assert.equal((updateLog?.afterData as { descricao: string }).descricao, 'PRODUTO API TESTE ALTERADO');
  assert.equal((softLog?.beforeData as { ativo: boolean }).ativo, true);
  assert.equal((softLog?.afterData as { ativo: boolean }).ativo, false);
  assert.equal((softLog?.beforeData as { descricao: string }).descricao, 'PRODUTO API TESTE ALTERADO');
  assert.equal((softLog?.afterData as { descricao: string }).descricao, 'PRODUTO API TESTE ALTERADO');
  assert.ok(logs.every((l) => l.requestId?.startsWith('p-audit')));
  assert.ok(logs.every((l) => l.actorEmail === 'produto@example.com'));
});

test('cross-tenant FK blocked for marca/unidade/grupo/setor', async () => {
  const service = new ProdutoService(
    createInMemoryProdutoRepo(),
    new InMemoryAuditRepository(),
    linkedGuard(),
    linkedRelations(),
    allowAllRbac(),
  );
  const ctx = { requestId: 'fk', groupId: GROUP_A, empresaId: EMPRESA_A };

  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', marca_id: MARCA_B }),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, 'TENANT_FK_MISMATCH');
      return true;
    },
  );
  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', unidade_medida_id: UNID_B }),
    (err: unknown) => ((err as { code?: string }).code === 'TENANT_FK_MISMATCH'),
  );
  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', grupo_produto_id: GRUPO_B }),
    (err: unknown) => ((err as { code?: string }).code === 'TENANT_FK_MISMATCH'),
  );
  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', setor_atividade_id: SETOR_B }),
    (err: unknown) => ((err as { code?: string }).code === 'TENANT_FK_MISMATCH'),
  );

  const ok = await service.create(ctx, {
    descricao: 'Produto FK OK',
    marca_id: MARCA_A,
    unidade_medida_id: UNID_A,
    grupo_produto_id: GRUPO_A,
    setor_atividade_id: SETOR_A,
  });
  assert.equal(ok.marca_id, MARCA_A);
});

test('Produto rejects operational fields and same-group codigo conflict', async () => {
  const service = new ProdutoService(
    createInMemoryProdutoRepo(),
    new InMemoryAuditRepository(),
    linkedGuard(),
    linkedRelations(),
    allowAllRbac(),
  );
  const ctx = { requestId: 'op', groupId: GROUP_A, empresaId: EMPRESA_A };

  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', estoque_atual: 10 } as never),
    (err: unknown) => ((err as { code?: string }).code === 'OPERATIONAL_FIELD_FORBIDDEN'),
  );
  await assert.rejects(
    () => service.create(ctx, { descricao: 'X', preco_venda: 1 } as never),
    (err: unknown) => ((err as { code?: string }).code === 'OPERATIONAL_FIELD_FORBIDDEN'),
  );
  assert.ok(PRODUTO_FORBIDDEN_OPERATIONAL_FIELDS.includes('custo_medio'));

  await service.create(ctx, { descricao: 'A', codigo: 'DUP-1' });
  await assert.rejects(
    () => service.create(ctx, { descricao: 'B', codigo: 'DUP-1' }),
    (err: unknown) => ((err as { code?: string }).code === 'CONFLICT'),
  );

  // mesmo codigo em outro tenant permitido
  const other = await service.create(
    { requestId: 'op-b', groupId: GROUP_B, empresaId: EMPRESA_B },
    { descricao: 'B other', codigo: 'DUP-1' },
  );
  assert.equal(other.codigo, 'DUP-1');
});

test('API Produto pagination + tenant isolation + search no leak', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
    produtoRelationGuard: linkedRelations(),
    rbacGuard: linkedRbac(),
  });

  for (let i = 0; i < 3; i += 1) {
    await fetchOk(app, '/api/v1/produtos', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-group-id': GROUP_A,
        'x-empresa-id': EMPRESA_A,
      },
      body: JSON.stringify({
        descricao: `PRODUTO DEV SINTETICO A ${i}`,
        codigo: `SYN-A-${i}`,
      }),
    });
  }
  await fetchOk(app, '/api/v1/produtos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_B,
      'x-empresa-id': EMPRESA_B,
    },
    body: JSON.stringify({
      descricao: 'PRODUTO DEV SINTETICO B',
      codigo: 'SYN-B-0',
    }),
  });

  const page1 = await fetchOk(app, '/api/v1/produtos?limit=2&offset=0', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(page1.data.length, 2);
  assert.equal(page1.meta.limit, 2);
  assert.equal(page1.meta.offset, 0);
  assert.equal(page1.meta.total, 3);
  assert.equal(page1.meta.hasMore, true);

  const page2 = await fetchOk(app, '/api/v1/produtos?limit=2&offset=2', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(page2.data.length, 1);
  assert.equal(page2.meta.hasMore, false);

  const searchB = await fetchOk(app, '/api/v1/produtos?search=SINTETICO%20B', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(searchB.data.length, 0);
  assert.equal(searchB.meta.total, 0);

  const listB = await fetchOk(app, '/api/v1/produtos', {
    headers: { 'x-group-id': GROUP_B },
  });
  assert.equal(listB.data.length, 1);
  assert.equal(listB.data[0].codigo, 'SYN-B-0');

  const meta = await fetchOk(app, '/api/v1/meta');
  assert.ok(
    ['ERP-RUNTIME-03', 'ERP-RUNTIME-04', 'ERP-RUNTIME-05', 'ERP-RUNTIME-06A', 'ERP-RUNTIME-06B', 'ERP-RUNTIME-07B', 'ERP-RUNTIME-08B']
      .includes(meta.runtime),
  );
  assert.equal(meta.produto.frontendHttp, false);
  assert.ok(meta.preparedEntities.includes('Produto'));
  assert.ok(!meta.httpPilotEntities.includes('Produto'));
});

test('API Produto cross-tenant empresa and FK via HTTP', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
    produtoRelationGuard: linkedRelations(),
    rbacGuard: linkedRbac(),
  });

  const crossEmpresa = await fetchStatus(app, '/api/v1/produtos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
    },
    body: JSON.stringify({
      descricao: 'Cross empresa',
      empresa_id: EMPRESA_B,
    }),
  });
  assert.equal(crossEmpresa.statusCode, 409);
  assert.equal(crossEmpresa.body.error.code, 'TENANT_MISMATCH');

  const crossFk = await fetchStatus(app, '/api/v1/produtos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
    },
    body: JSON.stringify({
      descricao: 'Cross FK marca',
      marca_id: MARCA_B,
    }),
  });
  assert.equal(crossFk.statusCode, 409);
  assert.equal(crossFk.body.error.code, 'TENANT_FK_MISMATCH');
});

test('soft-deleted produto excluded from default list/search/count (defeito VPS)', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
    produtoRelationGuard: linkedRelations(),
    rbacGuard: linkedRbac(),
  });
  const headersA = {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-empresa-id': EMPRESA_A,
  };

  const keep = await fetchOk(app, '/api/v1/produtos', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ descricao: 'Ativo permanece', codigo: 'PROD-KEEP' }),
  });
  const doomed = await fetchOk(app, '/api/v1/produtos', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ descricao: 'Para soft delete', codigo: 'PROD-API-TESTE' }),
  });

  // Aparece antes do soft delete
  const beforeList = await fetchOk(app, '/api/v1/produtos?limit=10&offset=0', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.ok(beforeList.data.some((p: { codigo: string }) => p.codigo === 'PROD-API-TESTE'));
  assert.ok(beforeList.data.some((p: { codigo: string }) => p.codigo === 'PROD-KEEP'));

  const deleted = await fetchOk(app, `/api/v1/produtos/${doomed.data.id}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(deleted.data.ativo, false);

  // LIST padrao (sem ?ativo=) NAO deve retornar soft-deleted
  const afterList = await fetchOk(app, '/api/v1/produtos?limit=10&offset=0', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(afterList.data.some((p: { id: string }) => p.id === doomed.data.id), false);
  assert.ok(afterList.data.some((p: { id: string }) => p.id === keep.data.id));
  assert.equal(afterList.meta.total, afterList.data.length);
  assert.equal(afterList.data.every((p: { ativo: boolean }) => p.ativo === true), true);

  // SEARCH pelo codigo soft-deleted → vazio + total 0
  const search = await fetchOk(app, '/api/v1/produtos?search=PROD-API-TESTE&limit=10&offset=0', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.deepEqual(search.data, []);
  assert.equal(search.meta.total, 0);
  assert.equal(search.meta.hasMore, false);

  // GET by id soft-deleted → 404
  const getGone = await fetchStatus(app, `/api/v1/produtos/${doomed.data.id}`, {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(getGone.statusCode, 404);
  assert.equal(getGone.body.error.code, 'PRODUTO_NOT_FOUND');

  // PATCH soft-deleted → 404
  const patchGone = await fetchStatus(app, `/api/v1/produtos/${doomed.data.id}`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ descricao: 'nao deve editar' }),
  });
  assert.equal(patchGone.statusCode, 404);

  // DELETE repetido → 404 (sem soft_delete enganoso)
  const delAgain = await fetchStatus(app, `/api/v1/produtos/${doomed.data.id}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(delAgain.statusCode, 404);
});

test('soft-delete visibility respeita tenant A/B', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
    produtoRelationGuard: linkedRelations(),
    rbacGuard: linkedRbac(),
  });

  const a1 = await fetchOk(app, '/api/v1/produtos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
    },
    body: JSON.stringify({ descricao: 'A ativo', codigo: 'TA-1', marca_id: MARCA_A }),
  });
  const a2 = await fetchOk(app, '/api/v1/produtos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
    },
    body: JSON.stringify({ descricao: 'A soft', codigo: 'TA-2', marca_id: MARCA_A }),
  });
  await fetchOk(app, `/api/v1/produtos/${a2.data.id}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_A },
  });
  await fetchOk(app, '/api/v1/produtos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_B,
      'x-empresa-id': EMPRESA_B,
    },
    body: JSON.stringify({ descricao: 'B ativo', codigo: 'TB-1', marca_id: MARCA_B }),
  });

  const listA = await fetchOk(app, '/api/v1/produtos?limit=50', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(listA.data.every((p: { group_id: string; ativo: boolean }) => p.group_id === GROUP_A && p.ativo), true);
  assert.ok(listA.data.some((p: { id: string }) => p.id === a1.data.id));
  assert.equal(listA.data.some((p: { id: string }) => p.id === a2.data.id), false);

  const listB = await fetchOk(app, '/api/v1/produtos?limit=50', {
    headers: { 'x-group-id': GROUP_B },
  });
  assert.equal(listB.data.every((p: { group_id: string }) => p.group_id === GROUP_B), true);
  assert.equal(listB.data.some((p: { id: string }) => p.id === a1.data.id), false);
});

async function fetchStatus(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Unable to bind test server');
  }
  try {
    const headers = new Headers(init.headers);
    if (!headers.has('x-actor-id')) {
      headers.set('x-actor-id', headers.get('x-group-id') === GROUP_B ? ACTOR_B : ACTOR_A);
    }
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, headers });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    return { statusCode: response.status, body, headers: response.headers };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function fetchOk(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const res = await fetchStatus(app, path, init);
  assert.ok(res.statusCode >= 200 && res.statusCode < 300, JSON.stringify(res.body));
  return res.body;
}
