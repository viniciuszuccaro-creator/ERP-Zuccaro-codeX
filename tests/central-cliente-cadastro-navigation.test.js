import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createCentralClienteNavigationReceipt, createCentralOpenGate, openCentralClienteWindow, centralOpenErrorMessage, isCanonicalClienteId, isCanonicalPedidoId } from '../src/components/comercial/centralCliente360Navigation.js';
import { assertCadastroRecordInTenant, classifyCadastroEditLoad, mergeCadastroEditHydration } from '../src/components/cadastros/cadastroEditLoadPolicy.js';
import { isEditRequestCurrent } from '../src/components/lib/contextoMultiempresaPolicy.js';
import { isCrmConversionScopeCurrent } from '../src/components/crm/crmFormSubmission.js';
import { z } from 'zod';

const id = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const scope = { groupId: 'synthetic-group', empresaId: 'synthetic-company', actorId: 'synthetic-actor', token: 'synthetic-session' };
const rendered = { groupId: scope.groupId, empresaId: scope.empresaId };
const receipt = () => createCentralClienteNavigationReceipt(scope);
const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
function parse(path) { return ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); }
function find(tree, predicate) {
  const result = [];
  function visit(node) { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }
  visit(tree); return result;
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('Cliente UUID contract does not inherit the narrower Pedido version filter', async () => {
  const version7 = '018f3d6a-1234-7123-8123-123456789abc';
  assert.equal(z.string().uuid().safeParse(version7).success, true);
  let opened = false;
  assert.equal(await openCentralClienteWindow({ clienteId: version7, identity: { id: version7 }, allowed: true, scope,
    assertCurrent: () => true, loadPanel: async () => () => null, openWindow: () => { opened = true; } }), true);
  assert.equal(opened, true);
  assert.equal(isCanonicalPedidoId(version7), false, 'Pedido contract remains unchanged');
  const e = editor(async () => full(version7)), h = hookHarness();
  h.render({ id: version7, openRecord: e.open, closeRecord: () => { e.state.item = null; } });
  await settle(); assert.deepEqual(e.state.item, full(version7)); h.unmount();
});

test('receipt compares exact tenant/actor/token, carries no token property and fails closed after serialization', () => {
  const r = receipt();
  assert.equal(r.isCurrent(rendered, scope), true);
  assert.equal(r.isCurrent(rendered, { ...scope, token: 'synthetic-sessioX' }), false);
  for (const field of ['groupId', 'empresaId', 'actorId', 'token']) assert.equal(r.isCurrent(rendered, { ...scope, [field]: '' }), false);
  assert.equal(r.isCurrent({ ...rendered, empresaId: 'other' }, scope), false);
  assert.equal(r.isCurrent(rendered, null), false);
  assert.equal(Object.hasOwn(r, 'token'), false);
  assert.ok(!JSON.stringify(r).includes(scope.token));
  assert.equal(JSON.parse(JSON.stringify(r)).isCurrent, undefined);
  assert.equal(createCentralClienteNavigationReceipt({ ...scope, token: '' }), null);
});

test('Central opens existing ClientesTab by literal ID with scoped key/reuse request and no customer projection', async () => {
  const calls = [];
  const Panel = () => null;
  const input = { clienteId: id, identity: { id, nome: 'Projection must not be forwarded' }, allowed: true, scope,
    assertCurrent: () => calls.push('assert'), loadPanel: async () => Panel,
    openWindow: (component, props, options) => calls.push({ component, props, options }) };
  assert.equal(await openCentralClienteWindow(input), true);
  assert.deepEqual(calls.slice(0, 2), ['assert', 'assert']);
  assert.equal(calls[2].component, Panel);
  assert.equal(calls[2].props.initialClienteId, id);
  assert.equal(calls[2].props.cliente, undefined);
  assert.equal(calls[2].props.token, undefined);
  assert.equal(calls[2].props.navigationReceipt.isCurrent(rendered, scope), true);
  assert.equal(calls[2].options.refreshPropsOnReuse, true);
  const first = calls[2]; calls.length = 0;
  await openCentralClienteWindow(input);
  assert.equal(calls[2].options.uniqueKey, first.options.uniqueKey);
  assert.notEqual(calls[2].props.reopenRequestId, first.props.reopenRequestId);
  calls.length = 0;
  await openCentralClienteWindow({ ...input, scope: { ...scope, empresaId: 'other-company' } });
  assert.notEqual(calls[2].options.uniqueKey, first.options.uniqueKey);
});

test('no panel import on denied, tampered or absent identity; import failure remains retryable', async () => {
  let loads = 0, opened = 0;
  const input = { clienteId: id, identity: { id }, allowed: true, scope, assertCurrent: () => true,
    loadPanel: async () => { loads++; return () => null; }, openWindow: () => { opened++; } };
  for (const patch of [{ allowed: false }, { identity: null }, { identity: { id: secondId } }, { clienteId: '00000042' }, { scope: { ...scope, token: '' } }]) {
    assert.equal(await openCentralClienteWindow({ ...input, ...patch }), false);
  }
  assert.equal(loads, 0); assert.equal(opened, 0);
  const gate = createCentralOpenGate(), ticket = gate.begin('cliente', 'scope');
  assert.equal(gate.begin('cliente', 'scope'), null);
  await assert.rejects(openCentralClienteWindow({ ...input, loadPanel: async () => { throw Error('synthetic import failure'); } }));
  gate.end(ticket); assert.ok(gate.begin('cliente', 'scope'));
  assert.equal(await openCentralClienteWindow(input), true); assert.equal(opened, 1);
});

test('session/permission revoked during import prevents opening the window', async () => {
  for (const change of ['token', 'permission']) {
    let active = true, opened = false;
    await assert.rejects(openCentralClienteWindow({ clienteId: id, identity: { id }, allowed: true, scope,
      assertCurrent: () => { if (!active) throw Error(change); },
      loadPanel: async () => { active = false; return () => null; }, openWindow: () => { opened = true; } }));
    assert.equal(opened, false);
  }
});

function editor(load) {
  const tree = parse('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx');
  const node = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'handleEditItem')[0];
  const state = { item: null, blocked: false, loading: false, shown: false, reads: [], audits: [], errors: 0 };
  const refs = { formScopeRef: { current: null }, editRequestRef: { current: 0 }, activeScopeRef: { current: 'synthetic-scope' } };
  const env = { ...refs, ENTITY: 'Cliente', contextoValido: true, canEditCadastro: true, scopeKey: 'synthetic-scope',
    groupId: scope.groupId, empresaId: scope.empresaId, contextoCanonico: { ...rendered, scopeType: 'empresa' }, ENTITY_CONTEXT_FIELD: {},
    isEditRequestCurrent, assertCadastroRecordInTenant, classifyCadastroEditLoad, mergeCadastroEditHydration,
    auditCadastroEvent: (...args) => state.audits.push(args), alert: message => { state.alert = message; },
    console: { error: () => { state.errors++; } },
    setEditError: value => { state.error = value; }, setEditLoadBlocked: value => { state.blocked = value; },
    setIsLoadingEdit: value => { state.loading = value; }, setShowForm: value => { state.shown = value; },
    setFormKey: () => { state.formKeys = (state.formKeys || 0) + 1; }, setEditItem: value => { state.item = value; },
    getInContext: async (...args) => { state.reads.push(args); return load(...args); },
  };
  const open = new Function(...Object.keys(env), `return (${node.initializer.arguments[0].getText(tree)});`)(...Object.values(env));
  return { state, refs, open };
}
const full = (recordId = id) => ({ id: recordId, group_id: scope.groupId, empresa_id: scope.empresaId, nome: 'Synthetic canonical customer', documento: '00000000000000' });

test('actual V24 callback reads by ID without first-page dependency; complete read and audit precede readiness', async () => {
  const e = editor(async () => full());
  assert.equal(await e.open({ id }, () => true), true);
  assert.deepEqual(e.state.reads, [['Cliente', id, 'empresa_id']]);
  assert.deepEqual(e.state.item, full());
  assert.equal(e.state.blocked, false); assert.equal(e.state.loading, false);
  assert.equal(e.state.audits[0][0], 'Visualizacao');
  assert.equal(e.state.audits[0][2].registro_id, id);
});

test('actual V24 callback rejects wrong ID, missing/deleted, partial and other-tenant rows; query failure blocks', async () => {
  for (const row of [full(secondId), null, { id }, { ...full(), group_id: 'other-group' }, { ...full(), empresa_id: 'other-company' }]) {
    const e = editor(async () => row);
    assert.notEqual(await e.open({ id }, () => true), true);
    assert.equal(e.state.blocked, true);
  }
  const e = editor(async () => { throw Error('synthetic read failure'); });
  assert.equal(await e.open({ id }, () => true), false); assert.equal(e.state.blocked, true);
});

function hookHarness() {
  const hooks = []; let cursor = 0, pending = [], session = { ...scope };
  const compiled = ts.transpileModule(read('src/components/cadastros/hooks/useClienteCadastroNavigation.js'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => ({
    react: {
      useRef: initial => { const index = cursor++; return hooks[index] ||= { current: initial }; },
      useState: initial => { const index = cursor++; hooks[index] ??= initial; return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }]; },
      useEffect: (effect, deps) => {
        const index = cursor++, old = hooks[index];
        if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) pending.push(() => { old?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; });
      },
    },
    '@/api/erpHttpSession': { readErpHttpSession: () => session },
    '@/components/comercial/centralCliente360Navigation': { centralOpenErrorMessage, isCanonicalClienteId },
  })[name] });
  const props = { entityName: 'Cliente', id, requestId: 1, receipt: receipt(), ...rendered, canView: true, canEdit: true, permissionsLoading: false };
  return {
    render(changes = {}) { Object.assign(props, changes); cursor = 0; pending = []; const value = exports.default(props); for (const run of pending) run(); return value; },
    session(value) { session = value; }, unmount() { for (const hook of hooks) hook?.cleanup?.(); },
  };
}

test('actual navigation hook opens once across callback rerenders, allows explicit reopen and retries failures', async () => {
  const h = hookHarness(); let opens = 0, closes = 0;
  const openRecord = async () => { opens++; return true; }, closeRecord = () => { closes++; };
  h.render({ openRecord, closeRecord }); await settle();
  assert.equal(opens, 1);
  h.render({ openRecord: async () => { opens++; return true; } }); await settle(); assert.equal(opens, 1);
  h.render({ requestId: 2 }); await settle(); assert.equal(opens, 2);
  h.render({ requestId: 3, openRecord: async () => { throw Error('synthetic-sensitive-body'); } }); await settle();
  const failed = h.render(); assert.equal(failed.error, centralOpenErrorMessage()); assert.ok(!failed.error.includes('synthetic-sensitive'));
  failed.retry(); h.render({ openRecord }); await settle(); assert.equal(h.render().error, '');
  assert.equal(opens, 3); assert.ok(closes >= 4); h.unmount();
});

test('actual hook fails closed for loading/denied permissions, invalid ID and absent/serialized receipt', async () => {
  for (const patch of [{ canView: false }, { canEdit: false }, { permissionsLoading: true }, { id: '00042' }, { receipt: undefined }, { receipt: JSON.parse(JSON.stringify(receipt())) }]) {
    const h = hookHarness(); let opens = 0;
    h.render({ ...patch, openRecord: async () => { opens++; return true; }, closeRecord: () => true }); await settle();
    assert.equal(opens, 0); h.unmount();
  }
});

test('actual hook plus actual editor discards delayed reads on token/actor/company changes and unmount', async () => {
  for (const change of ['token', 'actorId', 'empresaId', 'groupId', 'permission', 'unmount']) {
    let resolve;
    const e = editor(() => new Promise(done => { resolve = done; }));
    const h = hookHarness();
    h.render({ openRecord: e.open, closeRecord: () => { e.state.shown = false; e.state.item = null; } }); await settle();
    assert.equal(e.state.reads.length, 1);
    if (change === 'unmount') h.unmount();
    else if (change === 'permission') h.render({ canEdit: false });
    else h.session({ ...scope, [change]: 'changed' });
    resolve(full()); await settle();
    assert.notDeepEqual(e.state.item, full());
    h.unmount();
  }
});

test('actual initial-ID flow rejects delayed A after B is requested and does not consume loading permission state', async () => {
  const pending = new Map();
  const e = editor((_entity, recordId) => new Promise(resolve => pending.set(recordId, resolve)));
  const h = hookHarness();
  h.render({ permissionsLoading: true, openRecord: e.open, closeRecord: () => { e.state.item = null; e.state.shown = false; } });
  await settle(); assert.equal(e.state.reads.length, 0);
  h.render({ permissionsLoading: false }); await settle(); assert.equal(e.state.reads.length, 1);
  h.render({ id: secondId, requestId: 2 }); await settle(); assert.equal(e.state.reads.length, 2);
  pending.get(id)(full()); await settle(); assert.notDeepEqual(e.state.item, full());
  pending.get(secondId)(full(secondId)); await settle(); assert.deepEqual(e.state.item, full(secondId));
  h.unmount();
});

test('component wiring forwards technical ID and receipt to the existing editor, with granular permission and retry', () => {
  const tab = read('src/components/comercial/ClientesTab.jsx');
  for (const prop of ['initialRecordId={initialClienteId}', 'navigationReceipt={navigationReceipt}', 'reopenRequestId={reopenRequestId}', 'componenteEdicao={CadastroClienteCompleto}']) assert.ok(tab.includes(prop));
  const central = read('src/components/comercial/CentralCliente360Panel.jsx');
  assert.ok(central.includes("hasCadastroEntityPermission('Cliente', 'visualizar'"));
  assert.ok(central.includes("hasCadastroEntityPermission('Cliente', 'editar'"));
  assert.ok(central.includes('cadastroAllowedRef.current'));
  assert.ok(central.includes('central360-abrir-cadastro-cliente'));
  assert.ok(central.includes("import('@/components/comercial/ClientesTab')"));
});

test('Group view preserves its canonical scope instead of impersonating the Central target company', async () => {
  const active = { ...scope, empresaId: null, scopeType: 'grupo', profileEmpresaId: null };
  const view = { groupId: scope.groupId, empresaId: null, scopeType: 'grupo' };
  let windowProps;
  assert.equal(await openCentralClienteWindow({ clienteId: id, identity: { id }, allowed: true, scope, renderedScope: view,
    assertCurrent: () => assert.equal(isCrmConversionScopeCurrent(scope, view, active), true),
    loadPanel: async () => () => null, openWindow: (_panel, props) => { windowProps = props; } }), true);
  assert.equal(windowProps.navigationReceipt.empresaId, null);
  assert.equal(windowProps.navigationReceipt.isCurrent(view, active), true);
  assert.equal(windowProps.navigationReceipt.isCurrent(view, { ...active, profileEmpresaId: 'restricted-company' }), false);
  assert.equal(windowProps.navigationReceipt.isCurrent(view, { ...active, scopeType: 'empresa' }), false);
  assert.equal(createCentralClienteNavigationReceipt({ ...scope, empresaId: null }), null);
  const h = hookHarness(); let opened = 0;
  h.session(active);
  h.render({ ...view, receipt: windowProps.navigationReceipt, openRecord: async () => { opened++; return true; }, closeRecord: () => true });
  await settle(); assert.equal(opened, 1); h.unmount();
});

test('actual Central click handler guards double-click and revoked permission during module import, then allows retry', async () => {
  const tree = parse('src/components/comercial/CentralCliente360Panel.jsx');
  const declaration = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'openCadastro')[0];
  const gate = createCentralOpenGate(), allowed = { current: true }, viewRef = { current: 'synthetic-view' };
  let opening = {}, error = '', imports = 0, opens = 0, release;
  const env = { openGate: { current: gate }, viewKey: 'synthetic-view', viewRef, cadastroAllowedRef: allowed,
    groupId: scope.groupId, empresaId: scope.empresaId, actorId: scope.actorId, sessionToken: scope.token,
    renderedScope: { current: rendered }, readErpHttpSession: () => scope, isCrmConversionScopeCurrent,
    clienteId: id, identity: { id }, cadastroAllowed: true, centralOpenErrorMessage,
    setCadastroOpenError: value => { error = value; }, setOpeningRecord: update => { opening = update(opening); },
    openWindow: () => { opens++; },
    openCentralClienteWindow: args => openCentralClienteWindow({ ...args, loadPanel: () => { imports++; return new Promise(resolve => { release = resolve; }); } }),
  };
  const click = new Function(...Object.keys(env), `return ${declaration.initializer.getText(tree)};`)(...Object.values(env));
  const first = click(); await settle();
  await click(); assert.equal(imports, 1); assert.equal(opening.cliente, true);
  allowed.current = false; release(() => null); await first;
  assert.equal(opens, 0); assert.equal(error, centralOpenErrorMessage()); assert.equal(opening.cliente, null);
  allowed.current = true;
  const retry = click(); await settle(); release(() => null); await retry;
  assert.equal(opens, 1); assert.equal(error, ''); assert.equal(opening.cliente, null);
});
