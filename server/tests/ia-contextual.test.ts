import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { IaContextualService, type IaProvider } from '../src/services/iaContextualService.ts';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { AppError } from '../src/api/errors.ts';
import { mountIaContextualRoutes } from '../src/api/iaContextualRoutes.ts';
import { requestIdMiddleware, scopeMiddleware } from '../src/middleware/requestContext.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';

const G = '11111111-1111-4111-8111-111111111111';
const E = '22222222-2222-4222-8222-222222222222';
const P = '33333333-3333-4333-8333-333333333333';
const purposes = ['atendimento_analise', 'atendimento_intencao', 'comercial_produtos', 'fiscal_validacao', 'entrega_previsao'] as const;
const ctx = { groupId: G, empresaId: E, actorId: P, requestId: 'synthetic-correlation' };
const input = { purpose: 'comercial_produtos', group_id: G, empresa_id: E, prompt: 'SYNTHETIC PRIVATE TEXT' };
const permissions = () => ({ CRM: { interacoes: ['visualizar'] }, Comercial: { pedidos: ['visualizar'] },
  Fiscal: { nfe: ['visualizar'] }, 'Expedição': { entregas: ['visualizar'] },
  IA: Object.fromEntries(purposes.map(purpose => [purpose, ['visualizar']])) });
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
function fixture(provider?: IaProvider) {
  const audit = new InMemoryAuditRepository();
  const tenant = new InMemoryTenantGuard(); tenant.link(E, G);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: P, groupId: G, permissions: permissions() });
  return { audit, tenant, rbac, service: new IaContextualService(audit, tenant, rbac, provider) };
}

test('financial IA requires all scoped read and PII capabilities, rechecks after provider and never grants writes',async()=>{
  const request={...input,purpose:'financeiro_conciliacao'};
  const allowed={IA:{financeiro_conciliacao:['visualizar']},Financeiro:Object.fromEntries(
    ['conciliacao','Caixa','ContaBancariaEmpresa'].map(section=>[section,['visualizar','dados-sensiveis.visualizar']]))};
  let calls=0;
  const f=fixture({invoke:async()=>{calls++;return {suggestions:[]};}});
  f.rbac.link({actorId:P,groupId:G,empresaId:E,permissions:allowed});
  assert.deepEqual(await f.service.invoke(ctx,request),{suggestions:[]});
  assert.equal(calls,1);assert(!JSON.stringify(f.audit.entries).includes(input.prompt));
  for(const section of ['conciliacao','Caixa','ContaBancariaEmpresa']){
    const denied=structuredClone(allowed);denied.Financeiro[section]=['visualizar'];
    f.rbac.link({actorId:P,groupId:G,empresaId:E,permissions:denied});
    await assert.rejects(f.service.invoke(ctx,request),code('PERMISSION_DENIED'));
  }
  assert.equal(calls,1);
  const late=fixture({invoke:async()=>{late.rbac.link({actorId:P,groupId:G,empresaId:E,permissions:{}});return {suggestions:[]};}});
  late.rbac.link({actorId:P,groupId:G,empresaId:E,permissions:allowed});
  await assert.rejects(late.service.invoke(ctx,request),code('PERMISSION_DENIED'));
  const unavailable=fixture();unavailable.rbac.link({actorId:P,groupId:G,empresaId:E,permissions:allowed});
  await assert.rejects(unavailable.service.invoke(ctx,request),code('IA_PROVIDER_NOT_CONFIGURED'));
  await assert.rejects(f.service.invoke({...ctx,empresaId:undefined},{...request,empresa_id:null}));
});
test('five purposes use explicit domain and IA permissions without changing IDs', async () => {
  const calls: unknown[] = [];
  const f = fixture({ invoke: async (request, context) => { calls.push({ request, context }); return { suggestion: true }; } });
  for (const purpose of purposes) assert.deepEqual(await f.service.invoke(ctx, { ...input, purpose }), { suggestion: true });
  assert.equal(calls.length, 5);
  assert.equal(f.audit.entries.length, 10);
  assert.ok(!JSON.stringify(f.audit.entries).includes(input.prompt));
  assert.ok(f.audit.entries.every(row => row.groupId === G && row.empresaId === E && row.actorId === P));
});

test('missing provider is explicit and audited, never fabricated success', async () => {
  const f = fixture();
  await assert.rejects(f.service.invoke(ctx, input), code('IA_PROVIDER_NOT_CONFIGURED'));
  assert.equal(f.audit.entries[0].afterData && JSON.stringify(f.audit.entries[0].afterData).includes('provider_not_configured'), true);
});

test('scope manipulation, unknown fields and absent user block before provider', async () => {
  let calls = 0;
  const f = fixture({ invoke: async () => { calls++; return {}; } });
  await assert.rejects(f.service.invoke({ ...ctx, actorId: undefined }, input), code('AUTH_REQUIRED'));
  await assert.rejects(f.service.invoke(ctx, { ...input, empresa_id: null }), code('IA_SCOPE_DENIED'));
  await assert.rejects(f.service.invoke(ctx, { ...input, group_id: E }), code('IA_SCOPE_DENIED'));
  await assert.rejects(f.service.invoke(ctx, { ...input, api_key: 'SYNTHETIC_SECRET' }), code('IA_INPUT_INVALID'));
  await assert.rejects(f.service.invoke(ctx, { ...input, prompt: 'x'.repeat(32001) }), code('IA_INPUT_INVALID'));
  assert.equal(calls, 0);
  assert.ok(!JSON.stringify(f.audit.entries).includes('SYNTHETIC_SECRET'));
});

test('domain permission alone, sibling purpose and wildcard do not grant IA', async () => {
  const f = fixture({ invoke: async () => assert.fail('provider must not run') });
  for (const tree of [{ Comercial: { pedidos: ['visualizar'] } },
    { Comercial: { pedidos: ['visualizar'] }, IA: { fiscal_validacao: ['visualizar'] } }, { '*': ['visualizar'] }]) {
    f.rbac.link({ actorId: P, groupId: G, permissions: tree });
    await assert.rejects(f.service.invoke(ctx, input), code('PERMISSION_DENIED'));
  }
});

test('company outside group and permissions revoked during provider response block release', async () => {
  const f = fixture({ invoke: async () => {
    f.rbac.link({ actorId: P, groupId: G, permissions: {} }); return { classified: true };
  } });
  await assert.rejects(f.service.invoke(ctx, input), code('PERMISSION_DENIED'));
  const other = fixture({ invoke: async () => assert.fail('outside company') });
  other.tenant.link(E, P);
  await assert.rejects(other.service.invoke(ctx, input), code('TENANT_MISMATCH'));
});

test('audit failure prevents provider invocation; raw provider failures are not exposed', async () => {
  const f = fixture({ invoke: async () => assert.fail('audit must block first') });
  f.audit.append = async () => { throw new Error('AUDIT_UNAVAILABLE'); };
  await assert.rejects(f.service.invoke(ctx, input), /AUDIT_UNAVAILABLE/);
  const g = fixture({ invoke: async () => { throw new Error('PRIVATE_PROVIDER_DETAIL'); } });
  await assert.rejects(g.service.invoke(ctx, input), error => code('IA_PROVIDER_UNAVAILABLE')(error) && !String(error).includes('PRIVATE_PROVIDER_DETAIL'));
  assert.ok(!JSON.stringify(g.audit.entries).includes('PRIVATE_PROVIDER_DETAIL'));
});

test('invalid/oversized provider responses and cancelled requests never return success', async () => {
  for (const value of [null, false, [], 'x'.repeat(250001)]) {
    const f = fixture({ invoke: async () => value });
    await assert.rejects(f.service.invoke(ctx, input), code('IA_RESPONSE_INVALID'));
  }
  const disconnected = new AbortController();
  const f = fixture({ invoke: async () => { disconnected.abort(); return new Promise(() => {}); } });
  await assert.rejects(f.service.invoke(ctx, input, disconnected.signal), code('IA_PROVIDER_UNAVAILABLE'));
});

test('HTTP route requires verified session, uses same scope and no-store envelope', async () => {
  const f = fixture({ invoke: async () => ({ ok: true }) });
  const app = express(); app.use(express.json(), requestIdMiddleware, scopeMiddleware);
  // Synthetic verification only in this harness; production must use the real Auth middleware.
  app.use((req, _res, next) => { req.authVerified = req.header('authorization') === 'Bearer synthetic-session'; next(); });
  mountIaContextualRoutes(app, f.service);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error instanceof AppError ? error.statusCode : 500).json({ code: error instanceof AppError ? error.code : 'FAILED' });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  try {
    const headers = { 'content-type': 'application/json', 'x-group-id': G, 'x-empresa-id': E, 'x-actor-id': P };
    const url = `http://127.0.0.1:${address.port}/api/v1/ia/invocations`;
    const denied = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input) });
    assert.equal(denied.status, 401);
    const response = await fetch(url, { method: 'POST', headers: { ...headers, authorization: 'Bearer synthetic-session' }, body: JSON.stringify(input) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { data: { ok: true } });
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('canonical app keeps prepared IA route unmounted during consolidation', async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const db = createDbClient(config);
  const { app } = createApp({ config, db, useMemory: true });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/ia/invocations`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-group-id': G, 'x-empresa-id': E, 'x-actor-id': P }, body: JSON.stringify(input) });
    assert.equal(response.status, 404);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await db.end(); }
});
