import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import type { StoragePort } from '../src/services/storagePort.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_A2 = '44444444-4444-4444-8444-444444444444';
const EMPRESA_B = '55555555-5555-4555-8555-555555555555';
const ACTOR_A = '66666666-6666-4666-8666-666666666666';
const ACTOR_B = '77777777-7777-4777-8777-777777777777';
const ACTOR_DENIED = '88888888-8888-4888-8888-888888888888';

function fixture(storagePort?: StoragePort) {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenantGuard = new InMemoryTenantGuard();
  tenantGuard.link(EMPRESA_A, GROUP_A);
  tenantGuard.link(EMPRESA_A2, GROUP_A);
  tenantGuard.link(EMPRESA_B, GROUP_B);
  const rbacGuard = new InMemoryRbacGuard();
  const allowed = { Cadastros: { produto: ['visualizar', 'criar', 'editar', 'inativar'] } };
  rbacGuard.link({ actorId: ACTOR_A, groupId: GROUP_A, permissions: allowed });
  rbacGuard.link({ actorId: ACTOR_B, groupId: GROUP_B, permissions: allowed });
  rbacGuard.link({ actorId: ACTOR_DENIED, groupId: GROUP_A, permissions: { Cadastros: { produto: [] } } });
  return createApp({ config, db: createDbClient(config), useMemory: true, tenantGuard, rbacGuard, storagePort });
}

function headers(groupId = GROUP_A, empresaId = EMPRESA_A, actorId = ACTOR_A) {
  return { 'content-type': 'application/json', 'x-group-id': groupId, 'x-empresa-id': empresaId, 'x-actor-id': actorId };
}

async function withHttp<T>(run: (request: (path: string, method?: string, body?: unknown, requestHeaders?: Record<string, string>) => Promise<{ status: number; body: any }>) => Promise<T>, storagePort?: StoragePort) {
  const { app, auditRepo } = fixture(storagePort);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const request = async (path: string, method = 'GET', body?: unknown, requestHeaders = headers()) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    return await run(Object.assign(request, { auditRepo }));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function product(request: (path: string, method?: string, body?: unknown, requestHeaders?: Record<string, string>) => Promise<{ status: number; body: any }>, description: string, requestHeaders = headers()) {
  const created = await request('/api/v1/produtos', 'POST', { descricao: description }, requestHeaders);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body.data.id as string;
}

test('HTTP R10: variantes e equivalentes percorrem todas as rotas, auditam e nao alteram Produto', async () => {
  await withHttp(async (request) => {
    const source = await product(request, 'Origem relacoes HTTP');
    const target = await product(request, 'Destino relacoes HTTP');
    const before = await request(`/api/v1/produtos/${source}`);
    assert.equal(before.status, 200);
    const variantPath = `/api/v1/produtos/${source}/variantes`;
    const equivalentPath = `/api/v1/produtos/${source}/equivalentes`;

    const variant = await request(variantPath, 'POST', { sku: `HTTP-${randomUUID()}`, nome: 'Azul', atributos: { cor: 'Azul' } });
    assert.equal(variant.status, 201, JSON.stringify(variant.body));
    assert.equal(variant.body.data.empresa_id, EMPRESA_A);
    const equivalent = await request(equivalentPath, 'POST', { produto_equivalente_id: target });
    assert.equal(equivalent.status, 201, JSON.stringify(equivalent.body));
    assert.equal(equivalent.body.data.produto_equivalente_id, target);
    for (const [path, id] of [[variantPath, variant.body.data.id], [equivalentPath, equivalent.body.data.id]]) {
      const listed = await request(path);
      assert.equal(listed.status, 200);
      assert.equal(listed.body.data.length, 1);
      assert.equal(listed.body.data[0].id, id);
    }
    const variantId = variant.body.data.id;
    const equivalentId = equivalent.body.data.id;
    const updatedVariant = await request(`${variantPath}/${variantId}`, 'PATCH', { nome: 'Azul revisado' });
    assert.equal(updatedVariant.status, 200);
    assert.equal(updatedVariant.body.data.nome, 'Azul revisado');
    const updatedEquivalent = await request(`${equivalentPath}/${equivalentId}`, 'PATCH', { aprovado: true });
    assert.equal(updatedEquivalent.status, 200);
    assert.equal(updatedEquivalent.body.data.aprovado, true);
    for (const path of [`${variantPath}/${variantId}`, `${equivalentPath}/${equivalentId}`]) {
      const inactive = await request(path, 'DELETE');
      assert.equal(inactive.status, 200);
      assert.equal(inactive.body.data.ativo, false);
    }
    assert.deepEqual((await request(variantPath)).body.data, []);
    assert.deepEqual((await request(equivalentPath)).body.data, []);
    const after = await request(`/api/v1/produtos/${source}`);
    assert.deepEqual(after.body.data, before.body.data);

    const audit = (request as typeof request & { auditRepo: InMemoryAuditRepository }).auditRepo;
    for (const [entity, id] of [['ProdutoVariante', variantId], ['ProdutoEquivalente', equivalentId]]) {
      const entries = await audit.listByEntity(entity, id);
      assert.deepEqual(entries.map((entry) => entry.action), ['create', 'update', 'soft_delete']);
      assert.ok(entries.every((entry) => entry.groupId === GROUP_A && entry.empresaId === EMPRESA_A && entry.actorId === ACTOR_A));
      assert.equal(entries[0].beforeData, undefined);
      assert.ok(entries[1].beforeData && entries[1].afterData);
    }
    assert.equal(audit.entries.some((entry) => /Estoque|Preco|Fiscal|NotaFiscal/.test(entry.entity)), false);
  });
});

test('HTTP R10: payload estrito rejeita tenant, ator, request e autenticacao no body', async () => {
  await withHttp(async (request) => {
    const source = await product(request, 'Origem payload estrito');
    const target = await product(request, 'Destino payload estrito');
    const variantPath = `/api/v1/produtos/${source}/variantes`;
    const equivalentPath = `/api/v1/produtos/${source}/equivalentes`;
    const variant = await request(variantPath, 'POST', { sku: 'VALIDO' });
    const equivalent = await request(equivalentPath, 'POST', { produto_equivalente_id: target });
    assert.equal(variant.status, 201);
    assert.equal(equivalent.status, 201);
    for (const field of ['groupId', 'empresaId', 'actorId', 'requestId', 'authContext', 'group_id', 'empresa_id']) {
      for (const [path, payload] of [
        [variantPath, { sku: `NOVO-${field}`, [field]: GROUP_B }],
        [equivalentPath, { produto_equivalente_id: target, [field]: GROUP_B }],
        [`${variantPath}/${variant.body.data.id}`, { nome: 'Invasao', [field]: GROUP_B }],
        [`${equivalentPath}/${equivalent.body.data.id}`, { aprovado: true, [field]: GROUP_B }],
      ] as const) {
        const result = await request(path, path.includes(variant.body.data.id) || path.includes(equivalent.body.data.id) ? 'PATCH' : 'POST', payload);
        assert.equal(result.status, 400, `${field}: ${JSON.stringify(result.body)}`);
        assert.equal(result.body.error.code, 'VALIDATION_ERROR');
      }
    }
    assert.equal((await request(variantPath, 'POST', { sku: '' })).status, 400);
    assert.equal((await request(equivalentPath, 'POST', { produto_equivalente_id: 'invalid' })).status, 400);
    assert.equal((await request('/api/v1/produtos/invalid/variantes')).status, 400);
    assert.equal((await request('/api/v1/produtos/invalid/equivalentes')).status, 400);
    assert.equal((await request(variantPath)).body.data.length, 1);
    assert.equal((await request(equivalentPath)).body.data.length, 1);
  });
});

test('HTTP R10: RBAC fail-closed cobre GET POST PATCH DELETE das duas relacoes', async () => {
  await withHttp(async (request) => {
    const source = await product(request, 'Origem RBAC');
    const target = await product(request, 'Destino RBAC');
    const variantPath = `/api/v1/produtos/${source}/variantes`;
    const equivalentPath = `/api/v1/produtos/${source}/equivalentes`;
    const variant = await request(variantPath, 'POST', { sku: 'RBAC-SKU' });
    const equivalent = await request(equivalentPath, 'POST', { produto_equivalente_id: target });
    for (const [path, id, payload] of [
      [variantPath, variant.body.data.id, { sku: 'DENIED-SKU' }],
      [equivalentPath, equivalent.body.data.id, { produto_equivalente_id: target }],
    ] as const) {
      for (const [method, url, body] of [
        ['GET', path, undefined], ['POST', path, payload],
        ['PATCH', `${path}/${id}`, path === variantPath ? { nome: 'Negado' } : { aprovado: true }], ['DELETE', `${path}/${id}`, undefined],
      ] as const) {
        const denied = await request(url, method, body, headers(GROUP_A, EMPRESA_A, ACTOR_DENIED));
        assert.equal(denied.status, 403, `${method} ${url}`);
        assert.equal(denied.body.error.code, 'PERMISSION_DENIED');
      }
    }
  });
});

test('HTTP R10: grupo, empresa e IDs cruzados retornam 404 seguro', async () => {
  await withHttp(async (request) => {
    const source = await product(request, 'Origem isolada');
    const target = await product(request, 'Destino isolado');
    const targetA2 = await product(request, 'Destino A2', headers(GROUP_A, EMPRESA_A2));
    const targetB = await product(request, 'Destino B', headers(GROUP_B, EMPRESA_B, ACTOR_B));
    const variantPath = `/api/v1/produtos/${source}/variantes`;
    const equivalentPath = `/api/v1/produtos/${source}/equivalentes`;
    const variant = await request(variantPath, 'POST', { sku: 'TENANT-SKU' });
    const equivalent = await request(equivalentPath, 'POST', { produto_equivalente_id: target });
    for (const foreignHeaders of [headers(GROUP_A, EMPRESA_A2), headers(GROUP_B, EMPRESA_B, ACTOR_B)]) {
      for (const [path, id, payload] of [
        [variantPath, variant.body.data.id, { sku: 'CROSS-SKU' }],
        [equivalentPath, equivalent.body.data.id, { produto_equivalente_id: target }],
      ] as const) {
        for (const [method, url, body] of [
          ['GET', path, undefined], ['POST', path, payload],
          ['PATCH', `${path}/${id}`, path === variantPath ? { nome: 'Negado' } : { aprovado: true }], ['DELETE', `${path}/${id}`, undefined],
        ] as const) {
          const result = await request(url, method, body, foreignHeaders);
          assert.equal(result.status, 404, `${method} ${url}`);
          assert.equal(result.body.error.code, 'PRODUTO_NOT_FOUND');
        }
      }
    }
    for (const path of [variantPath, equivalentPath]) {
      const missing = await request(`${path}/${randomUUID()}`, 'DELETE');
      assert.equal(missing.status, 404);
      assert.equal((await request(`${path}/${randomUUID()}`, 'PATCH', path === variantPath ? { nome: 'Ausente' } : { aprovado: true })).status, 404);
    }
    for (const targetId of [targetA2, targetB]) {
      const denied = await request(equivalentPath, 'POST', { produto_equivalente_id: targetId });
      assert.equal(denied.status, 404);
      assert.equal(denied.body.error.code, 'PRODUTO_EQUIVALENTE_TARGET_NOT_FOUND');
    }
    assert.equal((await request(variantPath)).body.data.length, 1);
    assert.equal((await request(equivalentPath)).body.data.length, 1);
  });
});

test('HTTP R10: duplicidade e autorreferencia nao criam relacoes nem auditoria extra', async () => {
  await withHttp(async (request) => {
    const source = await product(request, 'Origem conflito');
    const target = await product(request, 'Destino conflito');
    const variantPath = `/api/v1/produtos/${source}/variantes`;
    const equivalentPath = `/api/v1/produtos/${source}/equivalentes`;
    const variant = await request(variantPath, 'POST', { sku: 'SKU-CONFLITO' });
    const equivalent = await request(equivalentPath, 'POST', { produto_equivalente_id: target });
    for (const result of [
      await request(variantPath, 'POST', { sku: 'sku-conflito' }),
      await request(equivalentPath, 'POST', { produto_equivalente_id: target }),
    ]) {
      assert.equal(result.status, 409);
      assert.equal(result.body.error.code, 'CONFLICT');
    }
    const self = await request(equivalentPath, 'POST', { produto_equivalente_id: source });
    assert.equal(self.status, 400);
    assert.equal(self.body.error.code, 'PRODUTO_EQUIVALENTE_SELF');
    assert.equal((await request(variantPath)).body.data.length, 1);
    assert.equal((await request(equivalentPath)).body.data.length, 1);
    const audit = (request as typeof request & { auditRepo: InMemoryAuditRepository }).auditRepo;
    assert.equal((await audit.listByEntity('ProdutoVariante', variant.body.data.id)).length, 1);
    assert.equal((await audit.listByEntity('ProdutoEquivalente', equivalent.body.data.id)).length, 1);
  });
});

test('HTTP R10: falha de auditoria provoca rollback no service, sem mutacao lateral', async () => {
  await withHttp(async (request) => {
    const source = await product(request, 'Origem rollback HTTP');
    const variantPath = `/api/v1/produtos/${source}/variantes`;
    const before = (await request(`/api/v1/produtos/${source}`)).body.data;
    const audit = (request as typeof request & { auditRepo: InMemoryAuditRepository }).auditRepo;
    const append = audit.append.bind(audit);
    audit.append = async (entry, executor) => {
      if (entry.entity === 'ProdutoVariante') throw new Error('SYNTHETIC_AUDIT_FAILURE');
      return append(entry, executor);
    };
    const failed = await request(variantPath, 'POST', { sku: 'ROLLBACK-HTTP' });
    assert.equal(failed.status, 500);
    assert.deepEqual((await request(variantPath)).body.data, []);
    assert.deepEqual((await request(`/api/v1/produtos/${source}`)).body.data, before);
  });
});

test('HTTP Produto protege empresa proprietaria sem bloquear a visao do Grupo', async () => {
  await withHttp(async (request) => {
    const path = '/api/v1/produtos';
    const deniedCreate = await request(path, 'POST', { descricao: 'Atribuicao indevida', empresa_id: EMPRESA_A2 });
    assert.equal(deniedCreate.status, 403);
    assert.equal(deniedCreate.body.error.code, 'EMPRESA_SCOPE_FORBIDDEN');
    assert.equal((await request(path, 'GET', undefined, headers(GROUP_A, EMPRESA_A2))).body.meta.total, 0);

    const own = await request(path, 'POST', { descricao: 'Produto Empresa A', empresa_id: EMPRESA_A });
    assert.equal(own.status, 201);
    const id = own.body.data.id as string;
    for (const empresaId of [EMPRESA_A2, null]) {
      const deniedUpdate = await request(`${path}/${id}`, 'PATCH', { empresa_id: empresaId, descricao: 'Troca indevida' });
      assert.equal(deniedUpdate.status, 403);
      assert.equal(deniedUpdate.body.error.code, 'EMPRESA_SCOPE_FORBIDDEN');
    }
    const unchanged = await request(`${path}/${id}`);
    assert.equal(unchanged.body.data.empresa_id, EMPRESA_A);
    assert.equal(unchanged.body.data.descricao, 'Produto Empresa A');
    assert.equal((await request(`${path}/${id}`, 'GET', undefined, headers(GROUP_A, EMPRESA_A2))).status, 404);
    const audit = (request as typeof request & { auditRepo: InMemoryAuditRepository }).auditRepo;
    assert.equal((await audit.listByEntity('Produto', id)).length, 1);

    const groupHeaders = { ...headers() };
    delete (groupHeaders as Partial<typeof groupHeaders>)['x-empresa-id'];
    const groupCreate = await request(path, 'POST', {
      descricao: 'Produto Empresa A2 pelo Grupo', empresa_id: EMPRESA_A2,
    }, groupHeaders);
    assert.equal(groupCreate.status, 201);
    assert.equal(groupCreate.body.data.empresa_id, EMPRESA_A2);
    assert.equal((await request(`${path}/${groupCreate.body.data.id}`, 'GET', undefined,
      headers(GROUP_A, EMPRESA_A2))).status, 200);
    const foreignGroup = await request(path, 'POST', { descricao: 'Grupo externo', empresa_id: EMPRESA_B }, groupHeaders);
    assert.equal(foreignGroup.status, 409);
    assert.equal(foreignGroup.body.error.code, 'TENANT_MISMATCH');
  });
});
test('HTTP R10 DAM: reserva, confirmacao unica, tenant e auditoria sanitizada', async () => {
  let signCalls = 0;
  let verifyCalls = 0;
  const storage: StoragePort = {
    createSignedUploadUrl: async () => {
      signCalls += 1;
      return { url: 'https://synthetic.example.test/upload?token=synthetic',
        expiresAt: new Date(Date.now() + 60_000).toISOString(), requiredHeaders: {} };
    },
    confirmUpload: async (request) => {
      verifyCalls += 1;
      return { storageKey: request.storageKey, fileName: request.fileName,
        mimeType: request.mimeType, sizeBytes: request.sizeBytes, sha256: request.sha256, version: 1 };
    },
    createSignedDownloadUrl: async () => { throw new Error('UNUSED'); },
  };
  await withHttp(async (request) => {
    const id = await product(request, 'Produto DAM HTTP sintetico');
    const path = `/api/v1/produtos/${id}/midias/reservas`;
    const payload = {
      storage_key: `groups/${GROUP_A}/companies/${EMPRESA_A}/products/${id}/images/${randomUUID()}-synthetic.png`,
      categoria: 'IMAGEM', nome_arquivo: 'synthetic.png', mime_type: 'image/png',
      tamanho_bytes: 8, sha256: 'b'.repeat(64), versao: 1,
    };
    assert.equal((await request(path, 'POST', { ...payload, groupId: GROUP_A })).status, 400);
    assert.equal((await request(path, 'POST', payload, headers(GROUP_A, EMPRESA_A, ACTOR_DENIED))).status, 403);
    assert.equal((await request(path, 'POST', payload, headers(GROUP_B, EMPRESA_B, ACTOR_B))).status, 400);
    assert.equal((await request(path, 'POST', payload, headers(GROUP_A, EMPRESA_A2))).status, 400);
    assert.equal(signCalls, 0);
    const reserved = await request(path, 'POST', payload);
    assert.equal(reserved.status, 201, JSON.stringify(reserved.body));
    assert.equal(signCalls, 1);
    assert.ok(reserved.body.data.mediaId);
    assert.ok(reserved.body.data.attemptId);
    const mediaPath = `/api/v1/produtos/${id}/midias`;
    const pending = await request(mediaPath);
    assert.equal(pending.status, 200);
    assert.deepEqual(pending.body.data, []);
    assert.equal((await request(mediaPath, 'GET', undefined, headers(GROUP_A, EMPRESA_A, ACTOR_DENIED))).status, 403);
    assert.equal((await request(mediaPath, 'GET', undefined, headers(GROUP_A, EMPRESA_A2))).status, 404);
    assert.equal((await request(mediaPath, 'GET', undefined, headers(GROUP_B, EMPRESA_B, ACTOR_B))).status, 404);
    assert.equal((await request('/api/v1/produtos/invalid/midias')).status, 400);

    const confirmPath = `/api/v1/produtos/${id}/midias/${reserved.body.data.mediaId}/confirmar`;
    const attempt = { attemptId: reserved.body.data.attemptId };
    assert.equal((await request(confirmPath, 'POST', { ...attempt, actorId: ACTOR_A })).status, 400);
    assert.equal((await request(confirmPath, 'POST', { attemptId: 'invalid' })).status, 400);
    assert.equal((await request(confirmPath, 'POST', attempt, headers(GROUP_A, EMPRESA_A2))).status, 404);
    assert.equal((await request(confirmPath, 'POST', attempt, headers(GROUP_A, EMPRESA_A, ACTOR_DENIED))).status, 403);
    assert.equal(verifyCalls, 0);
    const confirmed = await request(confirmPath, 'POST', attempt);
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.data.status, 'QUARENTENA');
    assert.equal(confirmed.body.data.storage_key, undefined);
    assert.equal(confirmed.body.data.sha256, undefined);
    assert.equal(verifyCalls, 1);
    assert.equal((await request(confirmPath, 'POST', attempt)).status, 404);
    const audit = (request as typeof request & { auditRepo: InMemoryAuditRepository }).auditRepo;
    const visible = await request(mediaPath);
    assert.equal(visible.status, 200);
    assert.equal(visible.body.data.length, 1);
    assert.deepEqual(visible.body.data[0], {
      id: reserved.body.data.mediaId, categoria: 'IMAGEM', nome_arquivo: 'synthetic.png',
      mime_type: 'image/png', tamanho_bytes: 8, versao: 1, status: 'QUARENTENA', principal: false,
    });
    assert.equal(JSON.stringify(visible.body).includes(payload.storage_key), false);
    assert.equal(JSON.stringify(visible.body).includes(payload.sha256), false);
    assert.equal(JSON.stringify(visible.body).includes(reserved.body.data.url), false);
    assert.equal(JSON.stringify(visible.body).includes(reserved.body.data.attemptId), false);
    assert.equal(visible.body.data[0].upload_actor_id, undefined);

    const logs = await audit.listByEntity('ProdutoMidia', reserved.body.data.mediaId);
    assert.deepEqual(logs.map((entry) => entry.action), ['create', 'change_status']);
    assert.equal(JSON.stringify(logs).includes(payload.storage_key), false);
    assert.equal(JSON.stringify(logs).includes(reserved.body.data.url), false);
  }, storage);
});

test('HTTP R10 DAM: sem Storage configurado falha fechado', async () => {
  await withHttp(async (request) => {
    const id = await product(request, 'DAM sem adapter');
    const path = `/api/v1/produtos/${id}/midias/reservas`;
    const result = await request(path, 'POST', {});
    const list = await request(`/api/v1/produtos/${id}/midias`);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data, []);
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, 'STORAGE_ADAPTER_NOT_CONFIGURED');
  });
});

test('HTTP R10 DAM: rejeicao individual de reserva vencida exige tenant e inativar', async (t) => {
  let storageCalls = 0;
  const storage: StoragePort = {
    createSignedUploadUrl: async () => {
      storageCalls += 1;
      return { url: 'https://synthetic.example.test/upload?token=synthetic',
        expiresAt: new Date(Date.now() + 60_000).toISOString(), requiredHeaders: {} };
    },
    confirmUpload: async () => { throw new Error('UNUSED'); },
    createSignedDownloadUrl: async () => { throw new Error('UNUSED'); },
  };
  await withHttp(async (request) => {
    const id = await product(request, 'Reserva HTTP vencida');
    const before = await request(`/api/v1/produtos/${id}`);
    const payload = {
      storage_key: `groups/${GROUP_A}/companies/${EMPRESA_A}/products/${id}/images/${randomUUID()}-synthetic.png`,
      categoria: 'IMAGEM', nome_arquivo: 'synthetic.png', mime_type: 'image/png',
      tamanho_bytes: 8, sha256: 'b'.repeat(64), versao: 1,
    };
    const reservation = await request(`/api/v1/produtos/${id}/midias/reservas`, 'POST', payload);
    assert.equal(reservation.status, 201);
    const mediaId = reservation.body.data.mediaId;
    const path = `/api/v1/produtos/${id}/midias/reservas/${mediaId}/rejeitar`;
    assert.equal((await request(path, 'POST', {})).status, 404);
    assert.equal((await request(path, 'POST', { groupId: GROUP_A })).status, 400);
    assert.equal((await request(path, 'POST', {}, headers(GROUP_A, EMPRESA_A, ACTOR_DENIED))).status, 403);
    assert.equal((await request(path, 'POST', {}, headers(GROUP_A, EMPRESA_A2))).status, 404);
    assert.equal((await request(path, 'POST', {}, headers(GROUP_B, EMPRESA_B, ACTOR_B))).status, 404);
    assert.equal((await request(path.replace(mediaId, 'invalid'), 'POST', {})).status, 400);
    const now = Date.now();
    t.mock.method(Date, 'now', () => now + 3 * 60 * 60 * 1000);
    const rejected = await request(path, 'POST', {});
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    assert.deepEqual(rejected.body.data, { id: mediaId, status: 'REJEITADO' });
    assert.equal((await request(path, 'POST', {})).status, 404);
    assert.equal(storageCalls, 1);
    assert.deepEqual((await request(`/api/v1/produtos/${id}`)).body.data, before.body.data);
    const audit = (request as typeof request & { auditRepo: InMemoryAuditRepository }).auditRepo;
    const logs = await audit.listByEntity('ProdutoMidia', mediaId);
    assert.deepEqual(logs.map((entry) => entry.action), ['create', 'change_status']);
    assert.equal(JSON.stringify(logs).includes(payload.storage_key), false);
    assert.equal(JSON.stringify(logs).includes(payload.sha256), false);
    assert.equal(JSON.stringify(logs).includes(reservation.body.data.url), false);
  }, storage);
});
