import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { TenantCrudService, z } from '../src/services/tenantCrudService.ts';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

test('Setor authorization captures immutable scope before asynchronous guard', async () => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let queried: unknown;
  const unused = async (): Promise<never> => { throw new Error('UNEXPECTED_OPERATION'); };
  const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: 'synthetic-context' };
  const service = new TenantCrudService({ list: async scope => { queried = scope; return []; },
    getById: unused, create: unused, update: unused, softDelete: unused },
  new InMemoryAuditRepository(), new InMemoryTenantGuard(), {
    entityName: 'SetorAtividade', notFoundCode: 'SETOR_NOT_FOUND', createSchema: z.object({}), updateSchema: z.object({}),
    getEmpresaId: () => null, resolveEmpresaIdFromCreate: () => null, resolveEmpresaIdFromUpdate: () => null,
    authorization: { moduleName: 'Cadastros', section: 'setor_atividade', guard: { assertAllowed: async (captured, module, section, action, options) => {
      assert.ok(Object.isFrozen(captured)); assert.equal(module, 'Cadastros'); assert.equal(section, 'setor_atividade');
      assert.equal(action, 'visualizar'); assert.equal(options?.allowGlobalWildcard, false);
      await waiting; assert.equal(captured.actorId, ID.runtimeActorA); assert.equal(captured.groupId, ID.groupA);
    } } },
  });
  const result = service.list(ctx);
  ctx.groupId = ID.groupB; ctx.actorId = ID.runtimeActorB;
  release(); await result;
  assert.deepEqual(queried, { groupId: ID.groupA, empresaId: null });
});

test('Setor canonical HTTP authorizes before SQL; synthetic PGlite is not real Auth/HML', async t => {
  const f = await localCrmFixture();
  const userId = randomUUID();
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'hml', ERP_AUTH_MODE: 'supabase_user',
    DATABASE_URL: 'postgres://synthetic.invalid/test', SUPABASE_URL: 'https://synthetic.invalid',
    SUPABASE_ANON_KEY: 'synthetic-only' });
  let sectorQueries = 0;
  const data = { ...f.data, query: async (...args: Parameters<typeof f.data.query>) => {
    if (/\bsetores_atividade\b/.test(args[0])) sectorQueries++;
    return f.data.query(...args);
  } };
  const { app } = createApp({ config, db: data, authDb: f.admin, authFetchImpl: async (_url, init) =>
    new Headers(init?.headers).get('authorization') === 'Bearer synthetic-valid'
      ? Response.json({ id: userId, email: 'sector@synthetic.invalid' }) : new Response('{}', { status: 401 }) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1/setores-atividade`;
  const request = (path = '', extra: Record<string, string> = {}, method = 'GET') => fetch(base + path,
    { method, headers: { Authorization: 'Bearer synthetic-valid', 'Content-Type': 'application/json',
      'x-group-id': ID.groupA, 'x-actor-id': ID.runtimeActorA, ...extra },
    ...(method === 'POST' || method === 'PATCH' ? { body: JSON.stringify({ nome: 'SYNTHETIC SECTOR' }) } : {}) });
  const permissions = async (tree: unknown, ativo = true) => f.admin.query(
    'UPDATE profiles SET auth_user_id=$1,permissoes=$2::jsonb,ativo=$3 WHERE id=$4',
    [userId, JSON.stringify(tree), ativo, ID.runtimeActorA]);
  try {
    await f.exec(`SELECT set_config('app.group_id','${ID.groupA}',false),set_config('app.empresa_id','',false)`);
    await permissions({ Cadastros: { cliente: ['visualizar'] } });
    await t.test('client-only and wildcard-only cannot list/read/write or consult sector SQL', async () => {
      for (const tree of [{ Cadastros: { cliente: ['visualizar'] } }, { '*': ['*'] }]) {
        await permissions(tree);
        for (const [path, method] of [['', 'GET'], [`/${randomUUID()}`, 'GET'], ['', 'POST'],
          [`/${randomUUID()}`, 'PATCH'], [`/${randomUUID()}`, 'DELETE']]) {
          const res = await request(path, {}, method);
          assert.equal(res.status, 403);
          assert.equal((await res.json()).error.code, 'PERMISSION_DENIED');
        }
      }
      assert.equal(sectorQueries, 0);
    });
    await t.test('authorized SQL failure stays failure, not empty or permission-denied', async () => {
      await permissions({ Cadastros: { setor_atividade: ['visualizar'] } });
      const res = await request();
      assert.equal(res.status, 500);
      assert.equal((await res.json()).error.code, 'INTERNAL_ERROR');
      assert.equal(sectorQueries, 1);
    });
    await t.test('same-scope read succeeds with representative fixture privileges; revocation and forged scopes fail', async () => {
      const sectorId = randomUUID();
      await f.exec(`GRANT SELECT ON setores_atividade TO ${ROLE};
        CREATE POLICY setor_http_fixture ON setores_atividade FOR SELECT TO ${ROLE}
        USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
        INSERT INTO setores_atividade(id,group_id,nome) VALUES('${sectorId}','${ID.groupA}','SYNTHETIC SECTOR');`);
      const res = await request(); assert.equal(res.status, 200);
      const rows = (await res.json()).data;
      assert.equal(rows.length, 2);
      assert.equal(rows.filter((r: { id: string }) => r.id === sectorId).length, 1);
      assert.ok(rows.every((r: { group_id: string }) => r.group_id === ID.groupA));
      const before = sectorQueries;
      for (const extra of [{ 'x-group-id': ID.groupB }, { 'x-actor-id': ID.runtimeActorB },
        { 'x-empresa-id': ID.empresaB }]) assert.equal((await request('', extra)).status, 403);
      await permissions({ Cadastros: { setor_atividade: ['visualizar'] } }, false);
      assert.equal((await request()).status, 403);
      assert.equal(sectorQueries, before);
      assert.equal((await request('', { Authorization: '' })).status, 401);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await f.close();
  }
});
