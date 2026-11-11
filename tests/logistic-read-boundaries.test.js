import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { logisticReadHunks, logisticReadRemainder } from './helpers/logisticReadRemainder.js';

const file = 'src/components/expedicao/DashboardLogistico.jsx';
const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const before = logisticReadRemainder(source);
test('complete stage58 dashboard retained outside exact counted read-boundary changes', () => {
  const hash = text => crypto.createHash('sha256').update(text).digest('hex');
  assert.equal(hash(before), '5449fec43b08aa8f30bb57a770a5ca11338df7ba70cce886423bc14c73fa14b3');
  for (const [current] of logisticReadHunks) {
    assert.throws(() => logisticReadRemainder(source.replace(current, '')));
    assert.throws(() => logisticReadRemainder(source.replace(current, current + current)));
  }
  assert.notEqual(hash(logisticReadRemainder('// unrelated\n' + source)), hash(before));
});
function component(name) { const fn = () => null; fn.displayName = name; return fn; }
function load(text, deps, globals = {}) {
  const output = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, exports = {};
  new Function('require', 'exports', ...Object.keys(globals), output)(name => { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; }, exports, ...Object.values(globals));
  return exports.default;
}
function nodes(tree, name) {
  const result = [];
  function visit(node) { if (!React.isValidElement(node)) return; if (node.type?.displayName === name) result.push(node); React.Children.forEach(node.props.children, visit); }
  visit(tree); return result;
}
const delivery = (id = 'synthetic-delivery', extra = {}) => ({ id, group_id: 'synthetic-group', empresa_id: 'synthetic-a', cliente_nome: 'Synthetic', status: 'Em Trânsito', endereco_entrega_completo: { latitude: 1, longitude: 2 }, ...extra });
function harness({ text = source, rows = [delivery()], props = {}, permission = true, auditFailure = false } = {}) {
  const states = [], effects = [], queries = [], audits = [], warnings = [], listeners = new Map();
  let cursor = 0, context = { contextoValido: true, isLoading: false, grupoAtual: { id: 'synthetic-group' }, empresaAtual: { id: 'synthetic-a', group_id: 'synthetic-group' } };
  let user = { id: 'synthetic-user' }, loadingUser = false, loadingPermissions = false, cleanup;
  const deps = {
    react: { ...React, useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; }, useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn) },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: async () => {} }), useQuery: options => { queries.push(options); return { data: options.queryKey[0] === 'log-rules' ? {} : rows, isLoading: false }; }, useMutation: () => ({ isPending: false, mutate: () => { throw Error('Mutation forbidden'); } }) },
    '@/api/base44Client': { base44: { entities: { AuditLog: { create: async row => { audits.push(row); if (auditFailure) throw Error('synthetic-private-audit-error'); return row; } } } } },
    '@/components/lib/useContextoVisual': { useContextoVisual: () => ({ ...context, filterInContext: async () => { throw Error('Operational query forbidden'); }, createInContext: async () => { throw Error('Mutation forbidden'); }, updateInContext: async () => { throw Error('Mutation forbidden'); } }) },
    '@/components/lib/usePermissions': () => ({ hasPermission: () => permission, isLoading: loadingPermissions }),
    '@/components/lib/UserContext': { useUser: () => ({ user, isLoading: loadingUser }) },
    '@/components/ui/resizable': Object.fromEntries(['ResizablePanelGroup', 'ResizablePanel', 'ResizableHandle'].map(name => [name, component(name)])),
    '@/components/ui/card': Object.fromEntries(['Card', 'CardHeader', 'CardTitle', 'CardContent'].map(name => [name, component(name)])),
    '@/components/ui/badge': { Badge: component('Badge') }, '@/components/ui/button': { Button: component('Button') }, 'lucide-react': { Activity: component('Activity') },
  };
  for (const name of ['ControlsBar', 'MapView', 'QueuePanels', 'BottlenecksPanel', 'AlertsPanel', 'DriverChat', 'OcorrenciasPanel', 'PerformanceReportDialog', 'RouteOptimizerPanel']) deps['./painel-logistico/' + name] = component(name);
  const Dashboard = load(text, deps, { window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } }, console: { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args) } });
  return { audits, warnings, listeners, queries,
    setContext: value => { context = { ...context, ...value }; }, setUser: value => { user = value; }, setRows: value => { rows = value; }, setPermission: value => { permission = value; },
    setLoading: (kind, value) => { if (kind === 'context') context.isLoading = value; if (kind === 'user') loadingUser = value; if (kind === 'permission') loadingPermissions = value; },
    render: () => { cursor = 0; effects.length = 0; queries.length = 0; return Dashboard(props); },
    flushEffects: () => { cleanup?.(); for (const fn of effects) cleanup = fn(); }, dispose: () => cleanup?.(),
  };
}
test('counterproof: denied parent previously rendered map and queues; current parent renders no child with cached rows', () => {
  const old = harness({ text: before, permission: false }), current = harness({ permission: false });
  assert.equal(nodes(old.render(), 'MapView').length, 1);
  const tree = current.render(); assert.equal(nodes(tree, 'MapView').length, 0); assert.equal(nodes(tree, 'QueuePanels').length, 0);
  assert.ok(current.queries.every(query => query.enabled === false));
});
for (const [label, change] of [
  ['canonical context invalid', h => h.setContext({ contextoValido: false })],
  ['context loading', h => h.setLoading('context', true)], ['permission loading', h => h.setLoading('permission', true)],
  ['user loading', h => h.setLoading('user', true)], ['missing actor', h => h.setUser(null)],
  ['missing group', h => h.setContext({ grupoAtual: null, empresaAtual: { id: 'synthetic-a' } })],
]) test(`${label}: cached rows never reach children; both queries disabled`, () => {
  const h = harness(); change(h); const tree = h.render();
  assert.equal(nodes(tree, 'MapView').length, 0); assert.equal(nodes(tree, 'DriverChat').length, 0);
  assert.ok(h.queries.every(query => query.enabled === false));
});
test('stale explicit company prop blocks a window after active-company change', () => {
  const h = harness({ props: { empresaId: 'synthetic-a' } });
  assert.equal(nodes(h.render(), 'MapView').length, 1);
  h.setContext({ empresaAtual: { id: 'synthetic-b', group_id: 'synthetic-group' } });
  assert.equal(nodes(h.render(), 'MapView').length, 0); assert.ok(h.queries.every(query => query.enabled === false));
});
test('all four real bindings forward the same canonical gates, selection function and audit callback', () => {
  const h = harness(), tree = h.render(), children = ['MapView', 'AlertsPanel', 'BottlenecksPanel', 'QueuePanels'].map(name => nodes(tree, name)[0]);
  for (const node of children) { assert.equal(node.props.contextoValido, true); assert.equal(node.props.canView, true); assert.equal(typeof node.props.onAudit, 'function'); assert.equal(node.props.onAudit, children[0].props.onAudit); }
  assert.equal(children[0].props.onSelect, children[1].props.onSelectEntrega);
  assert.ok(h.queries.every(query => query.queryKey.at(-1) === 'synthetic-user'));
});
test('rows require literal owner evidence: aliases allowed, contradictory/missing/foreign owners excluded', () => {
  const allowed = delivery(), alias = delivery('synthetic-alias', { group_id: undefined, grupo_id: 'synthetic-group' });
  const h = harness({ rows: [allowed, alias, delivery('other-company', { empresa_id: 'synthetic-b' }), delivery('other-group', { group_id: 'other' }), delivery('contradiction', { grupo_id: 'other' }), { id: 'unknown-owner' }] });
  assert.deepEqual(nodes(h.render(), 'MapView')[0].props.entregas, [allowed, alias]);
  h.setContext({ empresaAtual: null });
  assert.deepEqual(nodes(h.render(), 'MapView')[0].props.entregas.map(row => row.id), [allowed.id, alias.id, 'other-company']);
});
test('ID-only bottleneck selection resolves the complete current row, never an injected or fabricated record', () => {
  const row = delivery(), h = harness({ rows: [row] }); let tree = h.render();
  nodes(tree, 'BottlenecksPanel')[0].props.onSelectEntrega({ id: row.id, cliente_nome: 'injected' });
  tree = h.render(); assert.equal(nodes(tree, 'DriverChat')[0].props.entrega, row); assert.equal(nodes(tree, 'OcorrenciasPanel')[0].props.entrega, row);
  nodes(tree, 'MapView')[0].props.onSelect({ id: 'unknown' });
  assert.equal(nodes(h.render(), 'DriverChat').length, 0);
});
test('selection and late callbacks from a different actor or company cannot reopen old detail', () => {
  const h = harness(); let tree = h.render(); const oldSelect = nodes(tree, 'MapView')[0].props.onSelect;
  oldSelect({ id: 'synthetic-delivery' }); assert.equal(nodes(h.render(), 'DriverChat').length, 1);
  h.setUser({ id: 'synthetic-other-user' }); tree = h.render(); assert.equal(nodes(tree, 'DriverChat').length, 0);
  oldSelect({ id: 'synthetic-delivery' }); assert.equal(nodes(h.render(), 'DriverChat').length, 0);
  h.setContext({ empresaAtual: { id: 'synthetic-b', group_id: 'synthetic-group' } }); h.setRows([delivery('synthetic-other', { empresa_id: 'synthetic-b' })]);
  tree = h.render(); assert.equal(nodes(tree, 'MapView')[0].props.selected, null); assert.equal(h.queries[1].queryKey.at(-1), 'synthetic-other-user');
});
test('selection survives display filters and reflects current-owner updates before query refetch', () => {
  const row = delivery(), h = harness({ rows: [row] }); let tree = h.render();
  nodes(tree, 'MapView')[0].props.onSelect(row); tree = h.render();
  nodes(tree, 'ControlsBar')[0].props.setFilters({ q: 'not-matching-synthetic', statuses: [] });
  tree = h.render(); assert.deepEqual(nodes(tree, 'MapView')[0].props.entregas, []);
  assert.equal(nodes(tree, 'DriverChat')[0].props.entrega, row);
  const updated = { ...row, mensagens_motorista: [{ texto: 'synthetic-update' }] };
  nodes(tree, 'DriverChat')[0].props.onUpdated(updated);
  tree = h.render(); assert.equal(nodes(tree, 'DriverChat')[0].props.entrega, updated);
  nodes(tree, 'DriverChat')[0].props.onUpdated({ ...updated, empresa_id: 'synthetic-other' });
  assert.equal(nodes(h.render(), 'DriverChat')[0].props.entrega, row);
  h.setRows([null]); assert.equal(nodes(h.render(), 'DriverChat').length, 0);
  h.setRows(null); assert.equal(nodes(h.render(), 'DriverChat').length, 0);
});
test('counterproof of intermediate selected-from-filtered expression: detail was hidden by search and used stale row after update', () => {
  const current = 'const selected = selectedRow ? (selection.updated && isEntregaInScope(selection.record) ? selection.record : selectedRow) : null;';
  assert.equal(source.split(current).length, 2);
  const intermediate = source.replace(current, 'const selected = selection?.scopeKey === scopeKey ? filtradas.find((record) => record.id === selection.record?.id) || null : null;');
  const row = delivery(), h = harness({ text: intermediate, rows: [row] }); let tree = h.render();
  nodes(tree, 'MapView')[0].props.onSelect(row); tree = h.render();
  nodes(tree, 'ControlsBar')[0].props.setFilters({ q: 'not-matching-synthetic', statuses: [] });
  assert.equal(nodes(h.render(), 'DriverChat').length, 0);
  nodes(h.render(), 'ControlsBar')[0].props.setFilters({ q: '', statuses: [] }); tree = h.render();
  const updated = { ...row, mensagens_motorista: [{ texto: 'synthetic-new' }] };
  nodes(tree, 'DriverChat')[0].props.onUpdated(updated);
  assert.equal(nodes(h.render(), 'DriverChat')[0].props.entrega, row);
});
test('stored simulation and old listener callbacks remain scoped; listeners clean up without map/network access', () => {
  const h = harness(); h.render(); h.flushEffects(); const old = h.listeners.get('logistica:simulation');
  old({ detail: { total_distance_km: 999999 } });
  h.setContext({ grupoAtual: { id: 'synthetic-other-group' }, empresaAtual: { id: 'synthetic-b', group_id: 'synthetic-other-group' } });
  const tree = h.render();
  assert.ok(!JSON.stringify(tree.props).includes('999999'));
  h.flushEffects(); old({ detail: { total_distance_km: 999999 } });
  assert.ok(!JSON.stringify(h.render().props).includes('999999')); h.dispose(); assert.equal(h.listeners.size, 0);
});
test('selection audit callback uses active actor/group/company and logs no raw failure; logger remains informational', async () => {
  for (const failed of [false, true]) {
    const h = harness({ auditFailure: failed }), callback = nodes(h.render(), 'MapView')[0].props.onAudit;
    await callback({ acao: 'PainelLogistico.mapa.selecionar', detalhes: { entrega_id: 'synthetic-delivery' } });
    assert.equal(h.audits.length, 1); assert.equal(h.audits[0].usuario_id, 'synthetic-user');
    assert.equal(h.audits[0].group_id, 'synthetic-group'); assert.equal(h.audits[0].empresa_id, 'synthetic-a');
    assert.ok(!JSON.stringify(h.warnings).includes('synthetic-private-audit-error'));
    if (failed) assert.equal(h.warnings.length, 1);
  }
});
test('actual MapView marker gates denial and preserves audit-before-selection order', async () => {
  const mapSource = fs.readFileSync('src/components/expedicao/painel-logistico/MapView.jsx', 'utf8');
  const deps = { react: { ...React, useMemo: fn => fn() }, 'react-leaflet': Object.fromEntries(['MapContainer', 'TileLayer', 'CircleMarker', 'Popup', 'useMap'].map(name => [name, component(name)])), 'leaflet/dist/leaflet.css': {} };
  const Map = load(mapSource, deps), row = delivery();
  for (const [contextoValido, canView] of [[false, true], [true, false], [true, true]]) {
    const calls = [], tree = Map({ entregas: [row], contextoValido, canView, selected: null, onSelect: value => calls.push(['select', value]), onAudit: async value => calls.push(['audit', value]) });
    await nodes(tree, 'CircleMarker')[0].props.eventHandlers.click();
    assert.equal(calls[0][0], 'audit');
    if (contextoValido && canView) { assert.equal(calls[1][0], 'select'); assert.equal(calls[1][1], row); }
    else { assert.equal(calls.length, 1); assert.equal(calls[0][1].sucesso, false); }
  }
});
