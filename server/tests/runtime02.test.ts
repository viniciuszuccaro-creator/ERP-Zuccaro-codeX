import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { isSensitiveAuditKey, sanitizeAuditSnapshot } from '../src/audit/sanitizeAuditSnapshot.ts';
import { loadConfig } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import {
  createInMemoryGrupoProdutoRepo,
  createInMemorySetorRepo,
  createInMemoryUnidadeRepo,
} from '../src/repositories/inMemoryCadastroRepositories.ts';
import { createInMemoryProdutoRepo } from '../src/repositories/inMemoryProdutoRepository.ts';
import {
  grupoProdutoCreateSchema,
  grupoProdutoUpdateSchema,
  produtoCreateSchema,
  produtoUpdateSchema,
  setorCreateSchema,
  setorUpdateSchema,
  unidadeCreateSchema,
  unidadeUpdateSchema,
} from '../src/repositories/cadastroTypes.ts';
import { InMemoryProdutoRelationGuard } from '../src/db/produtoRelationGuard.ts';
import { ProdutoService } from '../src/services/produtoService.ts';
import { TenantCrudService } from '../src/services/tenantCrudService.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';

function linkedGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(EMPRESA_A, GROUP_A);
  guard.link(EMPRESA_B, GROUP_B);
  return guard;
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

/** Usa o default sanitizeAuditSnapshot (sem pick parcial — causa raiz do defeito VPS). */
function makeUnidadeService(audit = new InMemoryAuditRepository(), guard = linkedGuard()) {
  return {
    service: new TenantCrudService(createInMemoryUnidadeRepo(), audit, guard, {
      entityName: 'UnidadeMedida',
      notFoundCode: 'UNIDADE_NOT_FOUND',
      createSchema: unidadeCreateSchema,
      updateSchema: unidadeUpdateSchema,
      getEmpresaId: (row) => row.empresa_id,
      resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
      resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
    }),
    audit,
  };
}

test('sanitizeAuditSnapshot keeps business fields and strips secrets', () => {
  const snap = sanitizeAuditSnapshot({
    id: '1',
    nome_completo: 'Caixa',
    password: 'secret',
    api_token: 'tok',
    service_role: 'sr',
    authorization: 'Bearer x',
    ativo: true,
  });
  assert.equal(snap?.nome_completo, 'Caixa');
  assert.equal(snap?.ativo, true);
  assert.equal(snap?.password, undefined);
  assert.equal(snap?.api_token, undefined);
  assert.equal(snap?.service_role, undefined);
  assert.equal(snap?.authorization, undefined);
  assert.equal(isSensitiveAuditKey('SUPABASE_SERVICE_ROLE_KEY'), true);
  assert.equal(isSensitiveAuditKey('nome_completo'), false);
});

test('UnidadeMedida service CRUD + audit before/after + request_id', async () => {
  const { service, audit } = makeUnidadeService();
  const ctx = {
    requestId: 'u-req-1',
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    actorId: 'actor-u',
    actorEmail: 'unidade@example.com',
  };

  const created = await service.create(ctx, { sigla: 'KG', nome_completo: 'Quilograma' });
  assert.equal(created.sigla, 'KG');
  assert.equal(created.group_id, GROUP_A);

  const updated = await service.update(ctx, created.id, { nome_completo: 'Quilo' });
  assert.equal(updated.nome_completo, 'Quilo');

  const deleted = await service.softDelete(ctx, created.id);
  assert.equal(deleted.ativo, false);

  const logs = await audit.listByEntity('UnidadeMedida', created.id);
  assert.equal(logs.length, 3);
  assert.deepEqual(logs.map((l) => l.action), ['create', 'update', 'soft_delete']);
  assert.ok(logs.every((l) => l.requestId === 'u-req-1'));
  assert.ok(logs.every((l) => l.actorEmail === 'unidade@example.com'));

  const updateLog = logs.find((l) => l.action === 'update');
  assert.ok(updateLog?.beforeData);
  assert.ok(updateLog?.afterData);
  assert.equal((updateLog?.beforeData as { nome_completo: string }).nome_completo, 'Quilograma');
  assert.equal((updateLog?.afterData as { nome_completo: string }).nome_completo, 'Quilo');

  const softLog = logs.find((l) => l.action === 'soft_delete');
  assert.ok(softLog?.beforeData);
  assert.ok(softLog?.afterData);
  assert.equal((softLog?.beforeData as { ativo: boolean }).ativo, true);
  assert.equal((softLog?.afterData as { ativo: boolean }).ativo, false);
  assert.equal((softLog?.beforeData as { nome_completo: string }).nome_completo, 'Quilo');
  assert.equal((softLog?.afterData as { nome_completo: string }).nome_completo, 'Quilo');
});

/**
 * Reproduz EXATAMENTE o defeito E2E Hostinger:
 * CREATE nome_completo=Caixa Teste API → UPDATE Caixa Teste API Alterada
 * via createApp (mesmo sanitize incompleto que existia em produção).
 */
test('AUDIT FIX: UnidadeMedida UPDATE snapshot includes nome_completo (VPS defect)', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app, auditRepo } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
  });

  const createRes = await fetchStatus(app, '/api/v1/unidades-medida', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-actor-email': 'audit-fix@example.com',
      'x-request-id': 'audit-fix-create',
    },
    body: JSON.stringify({
      sigla: 'CX',
      nome_completo: 'Caixa Teste API',
      tipo_grandeza: 'Unidade',
    }),
  });
  assert.equal(createRes.statusCode, 201);
  const id = createRes.body.data.id as string;

  const updateRes = await fetchStatus(app, `/api/v1/unidades-medida/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-actor-email': 'audit-fix@example.com',
      'x-request-id': 'audit-fix-update',
    },
    body: JSON.stringify({ nome_completo: 'Caixa Teste API Alterada' }),
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.body.data.nome_completo, 'Caixa Teste API Alterada');

  assert.ok('entries' in auditRepo);
  const updateAudit = auditRepo.entries.find(
    (e) => e.entity === 'UnidadeMedida' && e.entityId === id && e.action === 'update',
  );
  assert.ok(updateAudit, 'update audit entry missing');
  const before = updateAudit.beforeData as Record<string, unknown>;
  const after = updateAudit.afterData as Record<string, unknown>;

  assert.equal(before.nome_completo, 'Caixa Teste API');
  assert.equal(after.nome_completo, 'Caixa Teste API Alterada');
  assert.equal(before.sigla, 'CX');
  assert.equal(after.sigla, 'CX');
  assert.equal(before.tipo_grandeza, 'Unidade');
  assert.equal(after.tipo_grandeza, 'Unidade');
  assert.equal(before.ativo, true);
  assert.equal(after.ativo, true);
  assert.equal(before.group_id, GROUP_A);
  assert.equal(after.group_id, GROUP_A);
  assert.equal(before.empresa_id, EMPRESA_A);
  assert.equal(after.empresa_id, EMPRESA_A);
  assert.equal(updateAudit.requestId, 'audit-fix-update');
  assert.equal(updateAudit.actorEmail, 'audit-fix@example.com');

  const createAudit = auditRepo.entries.find(
    (e) => e.entity === 'UnidadeMedida' && e.entityId === id && e.action === 'create',
  );
  assert.ok(createAudit);
  assert.equal(createAudit.beforeData, undefined);
  assert.equal((createAudit.afterData as { nome_completo: string }).nome_completo, 'Caixa Teste API');

  const delRes = await fetchStatus(app, `/api/v1/unidades-medida/${id}`, {
    method: 'DELETE',
    headers: {
      'x-group-id': GROUP_A,
      'x-request-id': 'audit-fix-soft',
    },
  });
  assert.equal(delRes.statusCode, 200);

  const softAudit = auditRepo.entries.find(
    (e) => e.entity === 'UnidadeMedida' && e.entityId === id && e.action === 'soft_delete',
  );
  assert.ok(softAudit);
  assert.equal((softAudit.beforeData as { ativo: boolean }).ativo, true);
  assert.equal((softAudit.afterData as { ativo: boolean }).ativo, false);
  assert.equal((softAudit.beforeData as { nome_completo: string }).nome_completo, 'Caixa Teste API Alterada');
  assert.equal((softAudit.afterData as { nome_completo: string }).nome_completo, 'Caixa Teste API Alterada');
});

test('AUDIT FIX: GrupoProduto and SetorAtividade keep entity-specific fields in snapshots', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app, auditRepo } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
  });

  const grupoCreate = await fetchOk(app, '/api/v1/grupos-produto', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-request-id': 'g-create',
    },
    body: JSON.stringify({
      nome_grupo: 'Longos Audit',
      codigo: 'LG-AUD',
      natureza: 'Revenda',
      margem_sugerida: 12.5,
    }),
  });
  const grupoId = grupoCreate.data.id as string;
  await fetchOk(app, `/api/v1/grupos-produto/${grupoId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-request-id': 'g-update',
    },
    body: JSON.stringify({ nome_grupo: 'Longos Audit Alterado', margem_sugerida: 15 }),
  });

  const setorCreate = await fetchOk(app, '/api/v1/setores-atividade', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-request-id': 's-create',
    },
    body: JSON.stringify({
      nome: 'Construcao Audit',
      descricao: 'Setor teste',
      tipo_operacao: 'Revenda',
    }),
  });
  const setorId = setorCreate.data.id as string;
  await fetchOk(app, `/api/v1/setores-atividade/${setorId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-request-id': 's-update',
    },
    body: JSON.stringify({ nome: 'Construcao Audit Alterado', descricao: 'Setor alterado' }),
  });

  assert.ok('entries' in auditRepo);
  const gUpdate = auditRepo.entries.find(
    (e) => e.entity === 'GrupoProduto' && e.entityId === grupoId && e.action === 'update',
  );
  assert.ok(gUpdate);
  assert.equal((gUpdate.beforeData as { nome_grupo: string }).nome_grupo, 'Longos Audit');
  assert.equal((gUpdate.afterData as { nome_grupo: string }).nome_grupo, 'Longos Audit Alterado');
  assert.equal((gUpdate.beforeData as { codigo: string }).codigo, 'LG-AUD');
  assert.equal((gUpdate.afterData as { codigo: string }).codigo, 'LG-AUD');
  assert.equal((gUpdate.beforeData as { margem_sugerida: number }).margem_sugerida, 12.5);
  assert.equal((gUpdate.afterData as { margem_sugerida: number }).margem_sugerida, 15);
  assert.equal((gUpdate.beforeData as { natureza: string }).natureza, 'Revenda');

  const sUpdate = auditRepo.entries.find(
    (e) => e.entity === 'SetorAtividade' && e.entityId === setorId && e.action === 'update',
  );
  assert.ok(sUpdate);
  assert.equal((sUpdate.beforeData as { nome: string }).nome, 'Construcao Audit');
  assert.equal((sUpdate.afterData as { nome: string }).nome, 'Construcao Audit Alterado');
  assert.equal((sUpdate.beforeData as { descricao: string }).descricao, 'Setor teste');
  assert.equal((sUpdate.afterData as { descricao: string }).descricao, 'Setor alterado');
  assert.equal((sUpdate.beforeData as { tipo_operacao: string }).tipo_operacao, 'Revenda');
});

test('GrupoProduto / SetorAtividade / Produto base isolate tenants A/B', async () => {
  const audit = new InMemoryAuditRepository();
  const guard = linkedGuard();
  const relationGuard = new InMemoryProdutoRelationGuard();

  const grupo = new TenantCrudService(createInMemoryGrupoProdutoRepo(), audit, guard, {
    entityName: 'GrupoProduto',
    notFoundCode: 'GRUPO_PRODUTO_NOT_FOUND',
    createSchema: grupoProdutoCreateSchema,
    updateSchema: grupoProdutoUpdateSchema,
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });
  const setor = new TenantCrudService(createInMemorySetorRepo(), audit, guard, {
    entityName: 'SetorAtividade',
    notFoundCode: 'SETOR_NOT_FOUND',
    createSchema: setorCreateSchema,
    updateSchema: setorUpdateSchema,
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });
  const produto = new ProdutoService(createInMemoryProdutoRepo(), audit, guard, relationGuard);

  const a = { requestId: 'r-a', groupId: GROUP_A, empresaId: EMPRESA_A };
  const b = { requestId: 'r-b', groupId: GROUP_B, empresaId: EMPRESA_B };

  const gA = await grupo.create(a, { nome_grupo: 'Longos A' });
  await grupo.create(b, { nome_grupo: 'Longos B' });
  const sA = await setor.create(a, { nome: 'Construcao A' });
  await setor.create(b, { nome: 'Construcao B' });
  const pA = await produto.create(a, { descricao: 'Barra A', codigo: 'PA-1' });
  await produto.create(b, { descricao: 'Barra B', codigo: 'PB-1' });

  assert.equal((await grupo.list(a)).length, 1);
  assert.equal((await setor.list(a)).length, 1);
  assert.equal((await produto.list(a)).data.length, 1);
  assert.equal((await grupo.list(b)).length, 1);

  await assert.rejects(() => grupo.get(b, gA.id), /not found/i);
  await assert.rejects(() => setor.get(b, sA.id), /not found/i);
  await assert.rejects(() => produto.get(b, pA.id), /not found/i);
});

test('cross-tenant write blocked: Group A + empresa_id of Group B', async () => {
  const { service } = makeUnidadeService();
  await assert.rejects(
    () => service.create({
      requestId: 'x-tenant',
      groupId: GROUP_A,
      actorEmail: 'x@example.com',
    }, {
      sigla: 'TN',
      nome_completo: 'Tenant X',
      empresa_id: EMPRESA_B,
    }),
    (err: unknown) => {
      assert.ok(err && typeof err === 'object');
      const e = err as { statusCode?: number; code?: string };
      assert.equal(e.statusCode, 409);
      assert.equal(e.code, 'TENANT_MISMATCH');
      return true;
    },
  );
});

test('API RUNTIME-02 UnidadeMedida E2E + meta + cross-tenant HTTP', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app, auditRepo } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
  });

  const meta = await fetchOk(app, '/api/v1/meta');
  assert.match(String(meta.runtime), /^ERP-RUNTIME-(0[2345]|06A)$/);
  assert.ok(meta.httpPilotEntities.includes('UnidadeMedida'));
  assert.ok(meta.preparedEntities.includes('Produto'));

  const createA = await fetchStatus(app, '/api/v1/unidades-medida', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-actor-email': 'a@example.com',
      'x-request-id': 'rt02-u-1',
    },
    body: JSON.stringify({ sigla: 'M', nome_completo: 'Metro' }),
  });
  assert.equal(createA.statusCode, 201);
  assert.equal(createA.headers.get('x-request-id'), 'rt02-u-1');

  await fetchOk(app, '/api/v1/grupos-produto', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
    },
    body: JSON.stringify({ nome_grupo: 'Planos', codigo: 'PL' }),
  });

  await fetchOk(app, '/api/v1/setores-atividade', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_B,
      'x-empresa-id': EMPRESA_B,
    },
    body: JSON.stringify({ nome: 'Industria B' }),
  });

  const listA = await fetchOk(app, '/api/v1/unidades-medida', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(listA.data.length, 1);

  const listBUnidades = await fetchOk(app, '/api/v1/unidades-medida', {
    headers: { 'x-group-id': GROUP_B },
  });
  assert.equal(listBUnidades.data.length, 0);

  const cross = await fetchStatus(app, '/api/v1/unidades-medida', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
    },
    body: JSON.stringify({
      sigla: 'XX',
      nome_completo: 'Cruzado',
      empresa_id: EMPRESA_B,
    }),
  });
  assert.equal(cross.statusCode, 409);
  assert.equal(cross.body.error.code, 'TENANT_MISMATCH');

  const prod = await fetchOk(app, '/api/v1/produtos', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-request-id': 'rt02-p-1',
    },
    body: JSON.stringify({ descricao: 'Produto Base Sintetico', codigo: 'PB-001' }),
  });
  assert.equal(prod.data.descricao, 'Produto Base Sintetico');

  const patch = await fetchOk(app, `/api/v1/produtos/${prod.data.id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-request-id': 'rt02-p-2',
    },
    body: JSON.stringify({ ncm: '72142000' }),
  });
  assert.equal(patch.data.ncm, '72142000');

  const del = await fetchOk(app, `/api/v1/produtos/${prod.data.id}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_A, 'x-request-id': 'rt02-p-3' },
  });
  assert.equal(del.data.ativo, false);

  if ('entries' in auditRepo) {
    const produtoAudits = auditRepo.entries.filter((e) => e.entity === 'Produto');
    assert.ok(produtoAudits.length >= 3);
    const updateAudit = produtoAudits.find((e) => e.action === 'update');
    assert.ok(updateAudit?.beforeData);
    assert.ok(updateAudit?.afterData);
    assert.equal((updateAudit?.beforeData as { descricao: string }).descricao, 'Produto Base Sintetico');
    assert.equal((updateAudit?.afterData as { ncm: string }).ncm, '72142000');
    assert.equal((updateAudit?.beforeData as { ncm: string | null }).ncm, null);
    assert.equal(updateAudit?.requestId, 'rt02-p-2');
  }
});

test('validation rejects empty UnidadeMedida / GrupoProduto / Setor / Produto', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({ config, db, useMemory: true, tenantGuard: linkedGuard() });

  const cases = [
    { path: '/api/v1/unidades-medida', body: { sigla: '', nome_completo: 'X' } },
    { path: '/api/v1/grupos-produto', body: { nome_grupo: '' } },
    { path: '/api/v1/setores-atividade', body: { nome: '' } },
    { path: '/api/v1/produtos', body: { descricao: '' } },
  ];

  for (const item of cases) {
    const res = await fetchStatus(app, item.path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-group-id': GROUP_A,
      },
      body: JSON.stringify(item.body),
    });
    assert.equal(res.statusCode, 400, item.path);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
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
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
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
