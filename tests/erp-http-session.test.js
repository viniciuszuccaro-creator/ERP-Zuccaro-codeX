import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {
  buildHttpDevAdminUser,
  buildHttpSessionUser,
  clearErpHttpSession,
  loginErpHttpSession,
  persistErpHttpSession,
  readErpHttpSession,
  refreshErpHttpSessionFromServer,
  resolveRefreshEmpresaId,
  switchErpHttpSessionEmpresa,
} from '../src/api/erpHttpSession.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

const GROUP = '33333333-3333-4333-8333-333333333333';
const EMPRESA_A = '44444444-4444-4444-8444-444444444444';
const EMPRESA_B = '55555555-5555-4555-8555-555555555555';
const ACTOR = '22222222-2222-4222-8222-222222222222';

async function loadRealHook(file, dependencies, globals = {}) {
  const source = (await readFile(new URL(file, import.meta.url), 'utf8')).replaceAll('import.meta.env', '({ VITE_ERP_BACKEND: "http" })');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: id => {
    assert.ok(id in dependencies, `Unmocked dependency ${id}`);
    return dependencies[id];
  }, console, localStorage: memoryStorage(), window: { addEventListener() {}, removeEventListener() {} }, ...globals });
  return exports;
}

test('fachada Base44 real em HTTP encaminha entityGuard somente ao BFF, sem fallback em falha', async () => {
  let localCalls = 0; let backendCalls = 0;
  const facade = await loadRealHook('../src/api/base44Client.js', {
    '@base44/sdk': {}, '@/lib/app-params': { appParams: {} },
    './localBase44Client.js': { localApiUser: {}, localBase44: { entities: {}, auth: {}, functions: { invoke: async () => { localCalls++; return 'legacy'; } } } },
    './localAuthSessionPolicy.js': { assertInteractiveAuthAllowed: () => ({ allowed: true }) },
    './httpApiClient.js': { createHttpApiClient: () => ({ entities: {}, entityGuard: async payload => { backendCalls++; assert.equal(payload.module, 'Comercial'); throw new Error('Bearer rejected'); } }) },
    './runtimeBackend.js': { HTTP_PILOT_ENTITIES: [], resolveErpApiBaseUrl: () => '', resolveErpBackendMode: () => 'http', resolveHttpPilotEntities: () => [] },
  });
  await assert.rejects(facade.base44.functions.invoke('entityGuard', { module: 'Comercial' }), /Bearer rejected/);
  assert.equal(backendCalls, 1); assert.equal(localCalls, 0);
  assert.equal(await facade.base44.functions.invoke('legacyFlow', {}), 'legacy');
  assert.equal(localCalls, 1);
});

test('ProtectedSection real revalida HTTP e não reaproveita aprovação entre perfis/empresas', async () => {
  let user = { id: ACTOR, permissoes: { Comercial: { pedido: ['visualizar'] } } };
  let company = EMPRESA_A;
  const states = []; let cursor = 0; const effects = [];
  const pending = []; const calls = []; const cache = new Map(); const inflight = new Map();
  const react = { createElement: (type, props, ...children) => ({ type, props, children }),
    useRef: () => ({ current: false }),
    useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    useEffect: fn => effects.push(fn),
  };
  const hook = await loadRealHook('../src/components/security/ProtectedSection.jsx', {
    react: { ...react, default: react },
    '@/components/lib/usePermissions': { default: () => ({ isLoading: false, hasPermission: () => true }) },
    '@/api/base44Client': { isHttpBackendMode: true, base44: { functions: { invoke: (name, body) => { assert.equal(name, 'entityGuard'); calls.push(body); return new Promise(resolve => pending.push(resolve)); } }, entities: { AuditLog: { create() {} } } } },
    '@/components/lib/useContextoVisual': { useContextoVisual: () => ({ empresaAtual: { id: company }, grupoAtual: { id: GROUP } }) },
    '@/components/lib/UserContext': { useUser: () => ({ user }) },
    '@/components/ui/dialog': {}, '@/components/ui/button': {},
    '@/components/lib/sensitiveActionGuardPolicy': { getSensitiveGuardState: () => ({ cache, inflight }), isSensitiveGuardAllowed: value => value.data.allowed === true },
  });
  const render = () => { cursor = 0; effects.length = 0; return hook.default({ module: 'Comercial', children: 'PRIVATE' }); };
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  assert.ok(render().props['data-ps-loading'] === true);
  const cleanup = effects[0]();
  pending.shift()({ data: { allowed: true } }); await flush();
  assert.equal(render().children[0], 'PRIVATE');
  const secondCleanup = effects[0](); assert.equal(calls.length, 2); // HTTP never consumes completed TTL approval.
  company = EMPRESA_B; user = { ...user, id: 'another-profile' };
  assert.ok(render().props['data-ps-loading'] === true);
  cleanup(); secondCleanup();
  const oldCleanup = effects[0]();
  // Stop this request before its late ACK; current context must remain unapproved.
  oldCleanup(); company = EMPRESA_A; user = { ...user, id: ACTOR };
  render();
  pending.splice(0).forEach(resolve => resolve({ data: { allowed: true } })); await flush();
  assert.ok(render().props['data-ps-loading'] === true);
});

test('hook real troca Grupo/A/B usando empresas revalidadas sem filtro do cadastro local', async () => {
  const mutations = [];
  const empresas = [EMPRESA_A, EMPRESA_B].map(id => ({ id, group_id: GROUP, status: 'Ativa' }));
  const session = { token: 'synthetic', groupId: GROUP, actorId: ACTOR, role: 'admin', empresas };
  const selected = [];
  const localEntity = new Proxy({}, { get() { throw new Error('Local mirror must not authorize context'); } });
  const hooks = await loadRealHook('../src/components/lib/useContextoGrupoEmpresa.jsx', {
    react: { useState: value => [typeof value === 'function' ? value() : value, () => {}], useEffect() {}, useRef: value => ({ current: value }) },
    '@/api/base44Client': { isHttpBackendMode: true, base44: { entities: localEntity } },
    '@tanstack/react-query': { useQuery: () => ({}), useQueryClient: () => ({ invalidateQueries() {} }),
      useMutation: options => { mutations.push(options); return options; } },
    './contextoMultiempresaPolicy': {},
    '@/api/erpHttpSession': { HTTP_CONTEXT_CHANGED: 'test',
      refreshErpHttpSessionFromServer: async () => session,
      buildHttpSessionUser: () => ({ pode_operar_em_grupo: true }),
      switchErpHttpSessionEmpresa: ({empresaId}) => selected.push(empresaId),
    },
  });
  hooks.useContextoGrupoEmpresa();
  assert.equal((await mutations[0].mutationFn(GROUP)).id, GROUP);
  for (const id of [EMPRESA_A, EMPRESA_B]) assert.equal((await mutations[1].mutationFn(id)).id, id);
  await assert.rejects(mutations[1].mutationFn(ACTOR), /não autorizada/);
  await assert.rejects(mutations[0].mutationFn(ACTOR), /não autorizado/);
  assert.deepEqual(selected, [null, EMPRESA_A, EMPRESA_B]);
});

test('hook de Cadastros ignora carregamento antigo após evento de troca Empresa', async () => {
  const groupSession = { token: 'synthetic-token', groupId: GROUP, empresaId: null, scopeType: 'grupo', actorId: ACTOR };
  const companySession = { ...groupSession, empresaId: EMPRESA_A, scopeType: 'empresa',
    empresas: [{ id: EMPRESA_A, group_id: GROUP, status: 'Ativa' }] };
  let activeSession = groupSession;
  let releaseOld;
  let refreshCount = 0;
  let contextChanged;
  const effects = [];
  const updates = [];
  let stateIndex = 0;
  const hooks = await loadRealHook('../src/components/lib/useContextoGrupoEmpresa.jsx', {
    react: { useState: initial => {
      const index = stateIndex++;
      return [typeof initial === 'function' ? initial() : initial, value => updates.push({ index, value })];
    }, useRef: value => ({ current: value }), useEffect: effect => effects.push(effect) },
    '@/api/base44Client': { isHttpBackendMode: true, isLocalOnlyMode: false, isApiKeyMode: true },
    '@tanstack/react-query': { useQuery: () => ({ data: [] }), useQueryClient: () => ({ invalidateQueries() {} }),
      useMutation: options => options },
    './contextoMultiempresaPolicy': { userTemAcessoGrupo: () => true, userTemAcessoEmpresa: () => true,
      empresaPertenceAoGrupo: () => true },
    '@/api/erpHttpSession': { HTTP_CONTEXT_CHANGED: 'erp-http-context-changed',
      refreshErpHttpSessionFromServer: () => (++refreshCount === 1
        ? new Promise(resolve => { releaseOld = resolve; }) : Promise.resolve(companySession)),
      ensureHttpTenantLocalMirror: async () => {},
      buildHttpSessionUser: session => ({ id: ACTOR, contexto_atual: session.scopeType,
        grupo_atual_id: GROUP, empresa_atual_id: session.empresaId }),
      readErpHttpSession: () => activeSession,
    },
  }, { window: { addEventListener: (_, handler) => { contextChanged = handler; }, removeEventListener() {} } });
  hooks.useContextoGrupoEmpresa();
  effects[0]();
  activeSession = companySession;
  contextChanged();
  await new Promise(resolve => setImmediate(resolve));
  releaseOld(groupSession);
  await new Promise(resolve => setImmediate(resolve));
  const companyUpdates = updates.filter(update => update.index === 4 && update.value?.id);
  assert.equal(companyUpdates.at(-1)?.value.id, EMPRESA_A, JSON.stringify(updates));
  assert.equal(updates.some(update => update.index === 4 && update.value === null), false);
});

test('permissões HTTP do hook real usam perfil servidor mesmo com espelho local vazio', async () => {
  const hook = await loadRealHook('../src/components/lib/usePermissions.jsx', {
    './UserContext': { useUser: () => ({ user: { id: ACTOR, permissoes: { Comercial: { pedido: ['visualizar'] } } } }) },
    '@tanstack/react-query': { useQuery: options => { assert.equal(options.enabled, false); return { data: { permissoes: {} } }; } },
    '@/api/base44Client': { isHttpBackendMode: true },
    '../../../base44/functions/_lib/security/entityGuardPolicy/entry.ts': { normalizeGuardAction: action => action === 'ver' ? 'visualizar' : action },
  });
  const permissions = hook.default();
  assert.equal(permissions.hasPermission('Comercial', null, 'ver'), true);
  assert.equal(permissions.hasPermission('Comercial', 'pedido', 'aprovar'), false);
  assert.equal(permissions.hasPermission('Fiscal', null, 'ver'), false);
});

test('owner canônico abre paths reais de Configurações/Segurança no hook frontend', async () => {
  const permissoes = JSON.parse(await readFile(new URL('../scripts/vps/owner-admin-permissoes.json', import.meta.url), 'utf8'));
  const hook = await loadRealHook('../src/components/lib/usePermissions.jsx', {
    './UserContext': { useUser: () => ({ user: { id: ACTOR, role: 'admin', permissoes } }) },
    '@tanstack/react-query': { useQuery: () => ({ data: { permissoes: {} } }) },
    '@/api/base44Client': { isHttpBackendMode: true },
    '../../../base44/functions/_lib/security/entityGuardPolicy/entry.ts': { normalizeGuardAction: action => action === 'ver' ? 'visualizar' : action },
  });
  const permissions = hook.default();
  for (const section of [['Configurações', 'Gerais'], ['Configurações', 'Fiscal'], ['Configurações', 'Integrações'], ['Configurações', 'IA'], ['Configurações', 'ConflictPolicy'], ['Configurações', 'Notificações'], ['Segurança'], ['Segurança', 'Monitoramento'], ['Segurança', 'Monitoramento', 'AcessoRealtime'], ['Segurança', 'Backup']]) assert.equal(permissions.hasPermission('Sistema', section, 'visualizar'), true, section.join('.'));
  assert.equal(permissions.hasPermission('Sistema', 'Auditoria', 'excluir'), false);
});

test('admin de Grupo preserva visão consolidada; troca A/B/Grupo não fabrica empresa', async () => {
  const storage = memoryStorage();
  const empresas = [EMPRESA_A, EMPRESA_B].map(id => ({ id, group_id: GROUP, status: 'Ativa' }));
  persistErpHttpSession({ accessToken: 'synthetic-token', actorId: ACTOR, groupId: GROUP,
    role: 'admin', empresas, scopeType: 'grupo', storage });
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: { profiles: [{
    id: ACTOR, group_id: GROUP, empresa_id: null, role: 'admin', empresas,
    permissoes: { Comercial: { pedido: ['visualizar', 'criar'] } },
  }] } }) });
  let session = await refreshErpHttpSessionFromServer({ storage, fetchImpl, baseUrl: '' });
  assert.equal(session.empresaId, null);
  assert.equal(buildHttpSessionUser(session).contexto_atual, 'grupo');
  for (const empresaId of [EMPRESA_A, EMPRESA_B, null]) {
    switchErpHttpSessionEmpresa({ storage, empresaId });
    session = await refreshErpHttpSessionFromServer({ storage, fetchImpl, baseUrl: '' });
    assert.equal(session.empresaId, empresaId);
    assert.equal(buildHttpSessionUser(session).contexto_atual, empresaId ? 'empresa' : 'grupo');
    assert.deepEqual(session.permissoes, { Comercial: { pedido: ['visualizar', 'criar'] } });
  }
});

test('refresh HTTP iniciado no Grupo não desfaz Empresa selecionada durante resposta atrasada', async () => {
  const storage = memoryStorage();
  const empresas = [EMPRESA_A, EMPRESA_B].map(id => ({ id, group_id: GROUP, status: 'Ativa' }));
  persistErpHttpSession({ accessToken: 'synthetic-token', actorId: ACTOR, groupId: GROUP,
    role: 'admin', empresas, scopeType: 'grupo', storage });
  let completeFetch;
  const fetchImpl = () => new Promise(resolve => { completeFetch = resolve; });
  const pendingRefresh = refreshErpHttpSessionFromServer({ storage, fetchImpl, baseUrl: '' });
  switchErpHttpSessionEmpresa({ storage, empresaId: EMPRESA_A });
  completeFetch({ ok: true, json: async () => ({ data: { profiles: [{
    id: ACTOR, group_id: GROUP, empresa_id: null, role: 'admin', empresas,
    permissoes: { Cadastros: { Fornecedor: ['visualizar'] } },
  }] } }) });
  const session = await pendingRefresh;
  assert.equal(session.empresaId, EMPRESA_A);
  assert.equal(session.scopeType, 'empresa');
  assert.equal(readErpHttpSession(storage).empresaId, EMPRESA_A);
  assert.equal(buildHttpSessionUser(session).contexto_atual, 'empresa');
});

test('falha de refresh antigo não apaga a Empresa escolhida enquanto ele aguardava', async () => {
  const storage = memoryStorage();
  const empresas = [EMPRESA_A].map(id => ({ id, group_id: GROUP, status: 'Ativa' }));
  persistErpHttpSession({ accessToken: 'synthetic-token', actorId: ACTOR, groupId: GROUP,
    role: 'admin', empresas, scopeType: 'grupo', storage });
  let failFetch;
  const pendingRefresh = refreshErpHttpSessionFromServer({ storage,
    fetchImpl: () => new Promise((_, reject) => { failFetch = reject; }), baseUrl: '' });
  switchErpHttpSessionEmpresa({ storage, empresaId: EMPRESA_A });
  failFetch(new Error('network unavailable'));
  assert.equal(await pendingRefresh, null);
  assert.equal(readErpHttpSession(storage)?.empresaId, EMPRESA_A);
});

test('refresh HTTP da Empresa A não reverte troca para Empresa B no mesmo Grupo', async () => {
  const storage = memoryStorage();
  const empresas = [EMPRESA_A, EMPRESA_B].map(id => ({ id, group_id: GROUP, status: 'Ativa' }));
  persistErpHttpSession({ accessToken: 'synthetic-token', actorId: ACTOR, groupId: GROUP,
    empresaId: EMPRESA_A, role: 'admin', empresas, scopeType: 'empresa', storage });
  let completeFetch;
  const pendingRefresh = refreshErpHttpSessionFromServer({ storage,
    fetchImpl: () => new Promise(resolve => { completeFetch = resolve; }), baseUrl: '' });
  switchErpHttpSessionEmpresa({ storage, empresaId: EMPRESA_B });
  completeFetch({ ok: true, json: async () => ({ data: { profiles: [{
    id: ACTOR, group_id: GROUP, empresa_id: null, role: 'admin', empresas, permissoes: {},
  }] } }) });
  assert.equal((await pendingRefresh).empresaId, EMPRESA_B);
  assert.equal(readErpHttpSession(storage).empresaId, EMPRESA_B);
});

test('admin exclusivo de filial não recebe operação no Grupo nem outra empresa', async () => {
  const storage = memoryStorage();
  persistErpHttpSession({ accessToken: 'synthetic-token', actorId: ACTOR, groupId: GROUP,
    role: 'admin', empresaId: EMPRESA_A, scopeType: 'grupo', storage });
  const session = await refreshErpHttpSessionFromServer({ storage, baseUrl: '', fetchImpl: async () => ({
    ok: true, json: async () => ({ data: { profiles: [{ id: ACTOR, group_id: GROUP,
      empresa_id: EMPRESA_A, role: 'admin', empresas: [{id: EMPRESA_A, group_id: GROUP, status: 'Ativa'}],
      permissoes: { Comercial: { pedido: ['visualizar'] } },
    }] } }),
  }) });
  assert.equal(session.empresaId, EMPRESA_A);
  assert.equal(buildHttpSessionUser(session).pode_operar_em_grupo, false);
  assert.throws(() => switchErpHttpSessionEmpresa({ storage, empresaId: null }), /Grupo/);
  assert.throws(() => switchErpHttpSessionEmpresa({ storage, empresaId: EMPRESA_B }), /não autorizada/);
});

test('persistErpHttpSession espelha cnpj das empresas do perfil (edit Cadastros)', () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok',
    groupId: GROUP,
    actorId: ACTOR,
    role: 'admin',
    empresas: [
      { id: EMPRESA_A, group_id: GROUP, razao_social: 'A', nome_fantasia: 'A', cnpj: '67.370.123/0001-99', status: 'Ativa' },
      { id: EMPRESA_B, group_id: GROUP, razao_social: 'B', cnpj: '05431234000188', status: 'Ativa' },
    ],
    storage,
  });
  const session = readErpHttpSession(storage);
  assert.equal(session.empresas.length, 2);
  assert.equal(session.empresas[0].cnpj, '67.370.123/0001-99');
  assert.equal(session.empresas[1].cnpj, '05431234000188');
});

test('persist/readErpHttpSession guarda token + tenant + role + expiresAt', () => {
  const storage = memoryStorage();
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();
  persistErpHttpSession({
    accessToken: 'tok_abc',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'a@b.com',
    role: 'admin',
    fullName: 'Proprietario',
    expiresAt,
    storage,
  });
  const session = readErpHttpSession(storage);
  assert.equal(session.token, 'tok_abc');
  assert.equal(session.groupId, GROUP);
  assert.equal(session.actorId, ACTOR);
  assert.equal(session.role, 'admin');
  assert.equal(session.fullName, 'Proprietario');
  assert.equal(session.expiresAt, expiresAt);
  clearErpHttpSession(storage);
  assert.equal(readErpHttpSession(storage), null);
});

test('buildHttpSessionUser libera admin só quando role=admin no perfil', () => {
  const admin = buildHttpSessionUser({
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'vinicius.zuccaro@gmail.com',
    role: 'admin',
    fullName: 'Vinicius Zuccaro',
    groupName: 'Grupo CPA',
    empresas: [
      { id: EMPRESA_A, razao_social: 'CPA', nome_fantasia: 'CPA ferro e aço', status: 'Ativa' },
      { id: EMPRESA_B, razao_social: '3Z', nome_fantasia: '3Z LTDA', status: 'Ativa' },
    ],
    permissoes: { Sistema: { acessos: ['visualizar'] } },
  });
  assert.equal(admin.role, 'admin');
  assert.equal(admin.perfil_acesso_id, `http_perfil_${ACTOR}`);
  assert.deepEqual(admin.permissoes, { Sistema: { acessos: ['visualizar'] } });
  assert.equal(admin.pode_ver_todas_empresas, true);
  assert.equal(admin.full_name, 'Vinicius Zuccaro');
  assert.equal(admin.empresa_atual_id, EMPRESA_A);
  assert.equal(admin.empresas_vinculadas.length, 2);
  assert.equal(admin.empresas_vinculadas[1].empresa_id, EMPRESA_B);

  const synth = buildHttpSessionUser({
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'gate-d.synth@dev.synthetic.local',
    role: 'user',
    fullName: 'Synth DEV',
    permissoes: { Comercial: { pedido: ['visualizar'] } },
  });
  assert.equal(synth.role, 'user');
  assert.equal(synth.perfil_acesso_id, `http_perfil_${ACTOR}`);
  assert.deepEqual(synth.permissoes, { Comercial: { pedido: ['visualizar'] } });
  assert.equal(synth.pode_ver_todas_empresas, false);
  assert.equal(synth.full_name, 'Synth DEV');
});

test('buildHttpDevAdminUser permanece alias de buildHttpSessionUser (sem forçar admin)', () => {
  const user = buildHttpDevAdminUser({
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'gate-d.synth@dev.synthetic.local',
    role: 'user',
  });
  assert.equal(user.role, 'user');
  assert.equal(user.perfil_acesso_id, `http_perfil_${ACTOR}`);
});

test('sessão expirada é limpa (fail-closed)', () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_exp',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    role: 'admin',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    storage,
  });
  assert.equal(readErpHttpSession(storage, { now: Date.now() }), null);
  assert.equal(storage.getItem('erp_runtime_scope'), null);
  assert.equal(storage.getItem('base44_access_token'), null);
});

test('armazenamento adulterado (JSON inválido / role / uuid) é limpo', () => {
  const badJson = memoryStorage({ erp_runtime_scope: '{not-json' });
  assert.equal(readErpHttpSession(badJson), null);

  const badRole = memoryStorage();
  badRole.setItem('erp_runtime_scope', JSON.stringify({
    token: 'tok',
    groupId: GROUP,
    actorId: ACTOR,
    empresaId: EMPRESA_A,
    role: 'superadmin',
  }));
  assert.equal(readErpHttpSession(badRole), null);

  const badUuid = memoryStorage();
  badUuid.setItem('erp_runtime_scope', JSON.stringify({
    token: 'tok',
    groupId: 'not-a-uuid',
    actorId: ACTOR,
    role: 'admin',
  }));
  assert.equal(readErpHttpSession(badUuid), null);

  const badEmpresa = memoryStorage();
  badEmpresa.setItem('erp_runtime_scope', JSON.stringify({
    token: 'tok',
    groupId: GROUP,
    actorId: ACTOR,
    empresaId: 'empresa-adulterada',
    role: 'user',
  }));
  assert.equal(readErpHttpSession(badEmpresa), null);
});

test('troca de empresa atualiza sessão HTTP preservando token e expiração', () => {
  const storage = memoryStorage();
  const expiresAt = new Date(Date.now() + 7200_000).toISOString();
  persistErpHttpSession({
    accessToken: 'tok_switch',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'owner@example.com',
    role: 'admin',
    expiresAt,
    empresas: [
      { id: EMPRESA_A, razao_social: 'A', status: 'Ativa' },
      { id: EMPRESA_B, razao_social: 'B', status: 'Ativa' },
    ],
    storage,
  });
  const switched = switchErpHttpSessionEmpresa({ empresaId: EMPRESA_B, storage });
  assert.equal(switched.empresaId, EMPRESA_B);
  assert.equal(switched.token, 'tok_switch');
  assert.equal(switched.groupId, GROUP);
  assert.equal(switched.expiresAt, expiresAt);
  assert.equal(readErpHttpSession(storage).empresaId, EMPRESA_B);
});

test('troca de empresa rejeita UUID fabricado fora da lista do servidor', () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_switch',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    role: 'admin',
    empresas: [{ id: EMPRESA_A, razao_social: 'A', status: 'Ativa' }],
    storage,
  });
  assert.throws(
    () => switchErpHttpSessionEmpresa({ empresaId: EMPRESA_B, storage }),
    /não autorizada/,
  );
});

test('loginErpHttpSession persiste expires_in e monta admin/comum conforme role HTTP', async () => {
  const adminBody = {
    data: {
      access_token: 'tok_admin',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.com' },
      profiles: [{
        id: ACTOR,
        group_id: GROUP,
        empresa_id: EMPRESA_A,
        role: 'admin',
        full_name: 'Admin Real',
      }],
    },
  };
  const commonBody = {
    data: {
      access_token: 'tok_user',
      token_type: 'bearer',
      expires_in: 1800,
      user: { id: '11111111-1111-4111-8111-111111111112', email: 'user@example.com' },
      profiles: [{
        id: ACTOR,
        group_id: GROUP,
        empresa_id: EMPRESA_B,
        role: 'user',
        full_name: 'Usuario Comum',
      }],
    },
  };

  const adminStorage = memoryStorage();
  const origLocal = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: adminStorage,
  });
  try {
    const admin = await loginErpHttpSession({
      email: 'admin@example.com',
      password: 'senha-forte-123',
      baseUrl: '',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() { return adminBody; },
      }),
    });
    assert.equal(admin.role, 'admin');
    assert.equal(admin.user.role, 'admin');
    assert.ok(admin.expiresAt);
    assert.equal(readErpHttpSession(adminStorage).role, 'admin');
    assert.equal(readErpHttpSession(adminStorage).empresaId, EMPRESA_A);

    clearErpHttpSession(adminStorage);
    const common = await loginErpHttpSession({
      email: 'user@example.com',
      password: 'senha-forte-123',
      baseUrl: '',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() { return commonBody; },
      }),
    });
    assert.equal(common.role, 'user');
    assert.equal(common.user.role, 'user');
    assert.equal(common.user.perfil_acesso_id, `http_perfil_${ACTOR}`);
    assert.equal(common.empresaId, EMPRESA_B);
    assert.equal(readErpHttpSession(adminStorage).role, 'user');
  } finally {
    if (origLocal === undefined) {
      delete globalThis.localStorage;
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: origLocal,
      });
    }
  }
});

test('refreshErpHttpSessionFromServer rejeita token inválido e limpa storage', async () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_fake',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    role: 'admin',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    storage,
  });
  const origLocal = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const result = await refreshErpHttpSessionFromServer({
      storage,
      baseUrl: '',
      fetchImpl: async () => ({ ok: false, status: 401, async json() { return { error: { code: 'AUTH_INVALID' } }; } }),
    });
    assert.equal(result, null);
    assert.equal(readErpHttpSession(storage), null);
  } finally {
    if (origLocal === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: origLocal });
  }
});

test('refreshErpHttpSessionFromServer aplica role/permissoes do servidor (não do localStorage)', async () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_ok',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    role: 'admin', // adulterado localmente
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    storage,
  });
  const origLocal = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const result = await refreshErpHttpSessionFromServer({
      storage,
      baseUrl: '',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              access_token: 'tok_ok',
              user: { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' },
              profiles: [{
                id: ACTOR,
                group_id: GROUP,
                empresa_id: EMPRESA_A,
                role: 'user',
                full_name: 'Comum',
                permissoes: { Comercial: { pedido: ['visualizar'] } },
              }],
            },
          };
        },
      }),
    });
    assert.equal(result.role, 'user');
    assert.deepEqual(result.permissoes, { Comercial: { pedido: ['visualizar'] } });
    assert.equal(readErpHttpSession(storage).role, 'user');
  } finally {
    if (origLocal === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: origLocal });
  }
});

test('resolveRefreshEmpresaId: vínculo explícito do perfil prevalece sobre preferência local', () => {
  assert.equal(resolveRefreshEmpresaId({
    profile: { group_id: GROUP, empresa_id: EMPRESA_B },
    profiles: [{ group_id: GROUP, empresa_id: EMPRESA_B }],
    preferredEmpresaId: EMPRESA_A,
  }), EMPRESA_B);
});

test('resolveRefreshEmpresaId: perfil de grupo só preserva preferência autorizada no mesmo grupo', () => {
  assert.equal(resolveRefreshEmpresaId({
    profile: { group_id: GROUP, empresa_id: null },
    profiles: [
      { group_id: GROUP, empresa_id: null },
      { group_id: GROUP, empresa_id: EMPRESA_A },
    ],
    preferredEmpresaId: EMPRESA_A,
  }), EMPRESA_A);
  assert.equal(resolveRefreshEmpresaId({
    profile: { group_id: GROUP, empresa_id: null },
    profiles: [{ group_id: GROUP, empresa_id: null }],
    preferredEmpresaId: EMPRESA_A,
  }), null);
});

test('refresh: reassociação A→B ignora empresa local revogada', async () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_reassoc',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    role: 'user',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    storage,
  });
  const origLocal = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const result = await refreshErpHttpSessionFromServer({
      storage,
      baseUrl: '',
      preferredActorId: ACTOR,
      preferredGroupId: GROUP,
      preferredEmpresaId: EMPRESA_A,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              access_token: 'tok_reassoc',
              user: { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' },
              profiles: [{
                id: ACTOR,
                group_id: GROUP,
                empresa_id: EMPRESA_B,
                role: 'user',
                full_name: 'Reassociado',
                permissoes: {},
              }],
            },
          };
        },
      }),
    });
    assert.equal(result.empresaId, EMPRESA_B);
    assert.equal(readErpHttpSession(storage).empresaId, EMPRESA_B);
  } finally {
    if (origLocal === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: origLocal });
  }
});

test('refresh: fallback para outro grupo não transporta empresa antiga', async () => {
  const GROUP_B = '66666666-6666-4666-8666-666666666666';
  const ACTOR_B = '77777777-7777-4777-8777-777777777777';
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_cross',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    role: 'user',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    storage,
  });
  const origLocal = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const result = await refreshErpHttpSessionFromServer({
      storage,
      baseUrl: '',
      preferredActorId: ACTOR,
      preferredGroupId: GROUP,
      preferredEmpresaId: EMPRESA_A,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              access_token: 'tok_cross',
              user: { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' },
              // Perfil antigo do grupo G/empresa A sumiu; só resta perfil noutro grupo.
              profiles: [{
                id: ACTOR_B,
                group_id: GROUP_B,
                empresa_id: EMPRESA_B,
                role: 'user',
                full_name: 'Outro Grupo',
                permissoes: {},
              }],
            },
          };
        },
      }),
    });
    assert.equal(result.groupId, GROUP_B);
    assert.equal(result.actorId, ACTOR_B);
    assert.equal(result.empresaId, EMPRESA_B);
    assert.notEqual(result.empresaId, EMPRESA_A);
    assert.equal(readErpHttpSession(storage).empresaId, EMPRESA_B);
  } finally {
    if (origLocal === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: origLocal });
  }
});
