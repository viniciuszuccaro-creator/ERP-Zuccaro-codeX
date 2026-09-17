import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { isValidCnpj, isValidCpf, maskDocumento, normalizeDocumento } from '../src/db/documentoValidators.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { listMigrationFiles } from '../src/db/migrate.ts';
import { createInMemoryClienteRepo } from '../src/repositories/inMemoryClienteRepository.ts';
import { CLIENTE_FORBIDDEN_FIELDS, CLIENTE_RBAC_KEYS } from '../src/repositories/clienteTypes.ts';
import { ClienteService } from '../src/services/clienteService.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';

/** Documentos sintéticos válidos (nunca reais). */
const CPF_A = '529.982.247-25';
const CPF_A_NORM = '52998224725';
const CPF_B = '390.533.447-05';
const CNPJ_A = '11.222.333/0001-81';
const CNPJ_A_NORM = '11222333000181';
const CNPJ_B = '34.028.316/0001-03';
const CNPJ_C = '00.000.000/0001-91';

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

function makeService(audit = new InMemoryAuditRepository()) {
  return {
    service: new ClienteService(createInMemoryClienteRepo(), audit, linkedGuard()),
    audit,
  };
}

test('runtime-04 migration 009 exists after 001-008', () => {
  const files = listMigrationFiles();
  assert.ok(files.includes('009_clientes_master_data.sql'));
  assert.ok(files.indexOf('009_clientes_master_data.sql') > files.indexOf('008_produtos_fk_tenant.sql'));
  assert.ok(files.includes('001_foundation.sql'));
});

test('documento validators normalize and validate CPF/CNPJ', () => {
  assert.equal(normalizeDocumento(CNPJ_A), CNPJ_A_NORM);
  assert.equal(normalizeDocumento(CPF_A), CPF_A_NORM);
  assert.equal(isValidCpf(CPF_A), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCnpj(CNPJ_A), true);
  assert.equal(isValidCnpj('11.111.111/1111-11'), false);
  assert.ok(String(maskDocumento(CPF_A)).includes('**'));
  assert.ok(CLIENTE_RBAC_KEYS.includes('cadastros.cliente.visualizar'));
  assert.ok(CLIENTE_FORBIDDEN_FIELDS.includes('limite_credito'));
});

test('AUDIT: Cliente create/update/soft_delete/restore + documento mascarado', async () => {
  const { service, audit } = makeService();
  const ctx = {
    requestId: 'c-audit-1',
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    actorEmail: 'cliente@example.com',
  };

  const created = await service.create(ctx, {
    tipo: 'Pessoa Jurídica',
    documento: CNPJ_A,
    razao_social: 'CLIENTE API TESTE LTDA',
    nome_fantasia: 'Cliente API',
  });
  assert.equal(created.documento_normalizado, CNPJ_A_NORM);
  assert.equal(created.codigo, '000001');

  const updated = await service.update(ctx, created.id, {
    razao_social: 'CLIENTE API TESTE ALTERADO LTDA',
  });
  assert.equal(updated.razao_social, 'CLIENTE API TESTE ALTERADO LTDA');

  const deleted = await service.softDelete({ ...ctx, requestId: 'c-audit-soft' }, created.id);
  assert.equal(deleted.ativo, false);

  const restored = await service.restore({ ...ctx, requestId: 'c-audit-restore' }, created.id);
  assert.equal(restored.ativo, true);
  assert.equal(restored.status, 'Ativo');

  const logs = await audit.listByEntity('Cliente', created.id);
  assert.ok(logs.some((l) => l.action === 'create'));
  assert.ok(logs.some((l) => l.action === 'update'));
  assert.ok(logs.some((l) => l.action === 'soft_delete'));
  assert.ok(logs.some((l) => l.action === 'restore'));
  const createLog = logs.find((l) => l.action === 'create');
  const after = createLog?.afterData as { documento?: string; documento_normalizado?: string };
  assert.ok(after.documento?.includes('*'));
  assert.ok(after.documento_normalizado?.includes('*'));
  assert.ok(logs.every((l) => l.actorEmail === 'cliente@example.com'));
});

test('duplicidade CPF/CNPJ formatado diferente → 409 DUPLICATE_DOCUMENT', async () => {
  const { service, audit } = makeService();
  const ctx = { requestId: 'dup', groupId: GROUP_A, empresaId: EMPRESA_A };

  await service.create(ctx, {
    tipo: 'Pessoa Jurídica',
    documento: CNPJ_A,
    razao_social: 'Primeiro PJ',
  });
  await assert.rejects(
    () => service.create(ctx, {
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_A_NORM,
      razao_social: 'Segundo PJ',
    }),
    (err: unknown) => ((err as { code?: string }).code === 'DUPLICATE_DOCUMENT'),
  );

  await service.create(ctx, {
    tipo: 'Pessoa Física',
    documento: CPF_A,
    nome: 'Primeiro PF',
  });
  await assert.rejects(
    () => service.create(ctx, {
      tipo: 'Pessoa Física',
      documento: CPF_A_NORM,
      nome: 'Segundo PF',
    }),
    (err: unknown) => ((err as { code?: string }).code === 'DUPLICATE_DOCUMENT'),
  );

  const dupLogs = audit.entries.filter((e) => e.action === 'duplicate_block');
  assert.ok(dupLogs.length >= 2);

  // mesmo documento em outro tenant permitido
  const other = await service.create(
    { requestId: 'dup-b', groupId: GROUP_B, empresaId: EMPRESA_B },
    { tipo: 'Pessoa Jurídica', documento: CNPJ_A, razao_social: 'PJ Outro Grupo' },
  );
  assert.equal(other.documento_normalizado, CNPJ_A_NORM);
});

test('código sequencial concorrente gera códigos distintos', async () => {
  const { service } = makeService();
  const ctx = { requestId: 'conc', groupId: GROUP_A, empresaId: EMPRESA_A };
  const [a, b] = await Promise.all([
    service.create(ctx, {
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_B,
      razao_social: 'Conc A',
    }),
    service.create(ctx, {
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_C,
      razao_social: 'Conc B',
    }),
  ]);
  assert.notEqual(a.codigo, b.codigo);
  assert.notEqual(a.id, b.id);
  const codes = [a.codigo, b.codigo].sort();
  assert.deepEqual(codes, ['000001', '000002']);
});

test('Cliente rejeita campos operacionais de crédito/preço', async () => {
  const { service } = makeService();
  const ctx = { requestId: 'op', groupId: GROUP_A, empresaId: EMPRESA_A };
  await assert.rejects(
    () => service.create(ctx, {
      tipo: 'Pessoa Física',
      documento: CPF_B,
      nome: 'X',
      limite_credito: 1000,
    } as never),
    (err: unknown) => ((err as { code?: string }).code === 'OPERATIONAL_FIELD_FORBIDDEN'),
  );
});

test('API Cliente isolation + pagination + search + soft delete + restore', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
  });

  const headersA = {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-empresa-id': EMPRESA_A,
  };
  const headersB = {
    'content-type': 'application/json',
    'x-group-id': GROUP_B,
    'x-empresa-id': EMPRESA_B,
  };

  // Paginação: 3 no A + 1 no B
  const docsA = [
    { tipo: 'Pessoa Jurídica', documento: '11.222.333/0001-81', razao_social: 'CLIENTE PAG A0' },
    { tipo: 'Pessoa Física', documento: '529.982.247-25', nome: 'CLIENTE PAG A1' },
    { tipo: 'Pessoa Física', documento: '390.533.447-05', nome: 'CLIENTE PAG A2 UNIQUE' },
  ];
  const createdA = [];
  for (const body of docsA) {
    createdA.push(await fetchOk(app, '/api/v1/clientes', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(body),
    }));
  }
  await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_B,
      razao_social: 'CLIENTE PAG B0',
    }),
  });

  const page1 = await fetchOk(app, '/api/v1/clientes?limit=2&offset=0&order_by=codigo', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(page1.data.length, 2);
  assert.equal(page1.meta.total, 3);
  assert.equal(page1.meta.hasMore, true);
  assert.equal(page1.data[0].codigo, '000001');
  assert.equal(page1.data[1].codigo, '000002');

  const page2 = await fetchOk(app, '/api/v1/clientes?limit=2&offset=2&order_by=codigo', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(page2.data.length, 1);
  assert.equal(page2.data[0].codigo, '000003');

  // busca fora da página 1
  const search = await fetchOk(app, '/api/v1/clientes?search=UNIQUE', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(search.data.length, 1);
  assert.equal(search.meta.total, 1);

  // busca por documento formatado
  const searchDoc = await fetchOk(app, `/api/v1/clientes?search=${encodeURIComponent(CNPJ_A)}`, {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(searchDoc.data.length, 1);

  // Tenant B não vê A
  const listB = await fetchOk(app, '/api/v1/clientes', {
    headers: { 'x-group-id': GROUP_B },
  });
  assert.equal(listB.data.length, 1);
  assert.equal(listB.data.every((c: { group_id: string }) => c.group_id === GROUP_B), true);

  const idA = createdA[0].data.id;
  const getCross = await fetchStatus(app, `/api/v1/clientes/${idA}`, {
    headers: { 'x-group-id': GROUP_B },
  });
  assert.equal(getCross.statusCode, 404);

  const patchCross = await fetchStatus(app, `/api/v1/clientes/${idA}`, {
    method: 'PATCH',
    headers: headersB,
    body: JSON.stringify({ nome_fantasia: 'hack' }),
  });
  assert.equal(patchCross.statusCode, 404);

  const delCross = await fetchStatus(app, `/api/v1/clientes/${idA}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_B },
  });
  assert.equal(delCross.statusCode, 404);

  // empresa cruzada no create
  const crossEmpresa = await fetchStatus(app, '/api/v1/clientes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-group-id': GROUP_A },
    body: JSON.stringify({
      tipo: 'Pessoa Física',
      documento: '111.444.777-35',
      nome: 'Cross',
      empresa_id: EMPRESA_B,
    }),
  });
  assert.equal(crossEmpresa.statusCode, 409);
  assert.equal(crossEmpresa.body.error.code, 'TENANT_MISMATCH');

  // Soft delete + restore
  const doomed = createdA[2].data;
  await fetchOk(app, `/api/v1/clientes/${doomed.id}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_A },
  });
  const afterList = await fetchOk(app, '/api/v1/clientes?limit=50', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(afterList.data.some((c: { id: string }) => c.id === doomed.id), false);
  assert.equal(afterList.meta.total, 2);

  const getGone = await fetchStatus(app, `/api/v1/clientes/${doomed.id}`, {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(getGone.statusCode, 404);

  const restored = await fetchOk(app, `/api/v1/clientes/${doomed.id}/restore`, {
    method: 'POST',
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(restored.data.ativo, true);

  const afterRestore = await fetchOk(app, '/api/v1/clientes?search=UNIQUE', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(afterRestore.data.length, 1);

  // duplicidade HTTP
  const dupHttp = await fetchStatus(app, '/api/v1/clientes', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_A_NORM,
      razao_social: 'Dup HTTP',
    }),
  });
  assert.equal(dupHttp.statusCode, 409);
  assert.equal(dupHttp.body.error.code, 'DUPLICATE_DOCUMENT');

  const meta = await fetchOk(app, '/api/v1/meta');
  assert.equal(meta.runtime, 'ERP-RUNTIME-04');
  assert.equal(meta.cliente.frontendHttp, false);
  assert.ok(meta.preparedEntities.includes('Cliente'));
  assert.ok(!meta.httpPilotEntities.includes('Cliente'));
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
