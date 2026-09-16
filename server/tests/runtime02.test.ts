import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import {
  createInMemoryGrupoProdutoRepo,
  createInMemoryProdutoRepo,
  createInMemorySetorRepo,
  createInMemoryUnidadeRepo,
} from '../src/repositories/inMemoryCadastroRepositories.ts';
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

function makeUnidadeService(audit = new InMemoryAuditRepository(), guard = linkedGuard()) {
  return {
    service: new TenantCrudService(createInMemoryUnidadeRepo(), audit, guard, {
      entityName: 'UnidadeMedida',
      notFoundCode: 'UNIDADE_NOT_FOUND',
      createSchema: unidadeCreateSchema,
      updateSchema: unidadeUpdateSchema,
      sanitize: (row) => ({
        id: row.id,
        group_id: row.group_id,
        empresa_id: row.empresa_id,
        sigla: row.sigla,
        nome_completo: row.nome_completo,
        ativo: row.ativo,
      }),
      getEmpresaId: (row) => row.empresa_id,
      resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
      resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
    }),
    audit,
  };
}

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
});

test('GrupoProduto / SetorAtividade / Produto base isolate tenants A/B', async () => {
  const audit = new InMemoryAuditRepository();
  const guard = linkedGuard();

  const grupo = new TenantCrudService(createInMemoryGrupoProdutoRepo(), audit, guard, {
    entityName: 'GrupoProduto',
    notFoundCode: 'GRUPO_PRODUTO_NOT_FOUND',
    createSchema: grupoProdutoCreateSchema,
    updateSchema: grupoProdutoUpdateSchema,
    sanitize: (row) => ({ id: row.id, group_id: row.group_id, nome_grupo: row.nome_grupo, ativo: row.ativo }),
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });
  const setor = new TenantCrudService(createInMemorySetorRepo(), audit, guard, {
    entityName: 'SetorAtividade',
    notFoundCode: 'SETOR_NOT_FOUND',
    createSchema: setorCreateSchema,
    updateSchema: setorUpdateSchema,
    sanitize: (row) => ({ id: row.id, group_id: row.group_id, nome: row.nome, ativo: row.ativo }),
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });
  const produto = new TenantCrudService(createInMemoryProdutoRepo(), audit, guard, {
    entityName: 'Produto',
    notFoundCode: 'PRODUTO_NOT_FOUND',
    createSchema: produtoCreateSchema,
    updateSchema: produtoUpdateSchema,
    sanitize: (row) => ({ id: row.id, group_id: row.group_id, descricao: row.descricao, ativo: row.ativo }),
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });

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
  assert.equal((await produto.list(a)).length, 1);
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
  assert.equal(meta.runtime, 'ERP-RUNTIME-02');
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
