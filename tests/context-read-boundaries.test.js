import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { buildMultiempresaReadFilter } from '../src/components/lib/contextoMultiempresaPolicy.js';
import { contextReadHunks, contextReadRemainder } from './helpers/contextReadBoundaryRemainder.js';

const file = 'src/components/lib/useContextoVisual.jsx';
const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const before = contextReadRemainder(file, source);
function bind(name, deps, text = source) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let fn;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) { assert.ok(fn === undefined); fn = node.initializer; }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(fn, name);
  return new Function(...Object.keys(deps), `return (${fn.getText(ast)});`)(...Object.values(deps));
}
test('complete stage55 context source remains outside exact bounded changes', () => {
  assert.equal(crypto.createHash('sha256').update(before).digest('hex'), 'd2a59a582c73eeb4e924181b60742c247ca410a55c2b0704ecf6e60cc8715610');
  for (const [current] of contextReadHunks) {
    assert.throws(() => contextReadRemainder(file, source.replace(current, '')));
    assert.throws(() => contextReadRemainder(file, source.replace(current, current + current)));
  }
  assert.notEqual(crypto.createHash('sha256').update(contextReadRemainder(file, '// unexpected\n' + source)).digest('hex'), 'd2a59a582c73eeb4e924181b60742c247ca410a55c2b0704ecf6e60cc8715610');
});
function harness({ entity = {}, scope = { group_id: 'synthetic-group', empresa_id: 'synthetic-a' }, text = source, invoke } = {}) {
  const calls = [], fields = [], warnings = [];
  const deps = {
    base44: { entities: { Synthetic: entity, Fornecedor: entity, NotaFiscal: entity, Campanha: entity }, functions: { invoke: async (...args) => { calls.push(args); return invoke ? invoke(...args) : { data: [{ id: 'synthetic-row' }] }; } } },
    getFiltroContexto: field => { fields.push(field); return scope; },
    contextoCanonico: { groupId: scope.group_id },
    TENANT_MASTER_ENTITIES: [],
    buildMultiempresaReadFilter,
    empresasDoGrupo: [{ id: 'synthetic-a' }],
    normalizeSortField: (_entity, field) => field,
    setLastSort: () => {}, getLastSort: () => null, DEFAULT_SORTS: {},
    console: { warn: message => warnings.push(message) },
  };
  return { run: bind('filterInContext', deps, text), calls, fields, warnings };
}
const expected = (scope, criteria = {}, ctxField = 'empresa_id', shared = false) => buildMultiempresaReadFilter({ groupId: scope.group_id, empresaId: scope[ctxField], ctxField, shared, rest: criteria, empresaIdsDoGrupo: scope[ctxField] ? [] : ['synthetic-a'] });

test('counterproof: absent schema previously sent unscoped request even without any context', async () => {
  const legacy = harness({ scope: {}, text: before });
  await legacy.run('Synthetic', { status: 'synthetic' });
  assert.equal(legacy.calls.length, 1); assert.deepEqual(legacy.calls[0][1].filter, { status: 'synthetic' });
  const current = harness({ scope: {} });
  assert.deepEqual(await current.run('Synthetic', { status: 'synthetic' }), []);
  assert.deepEqual(current.calls, []);
});

const uncertain = [
  ['absent', {}], ['noncallable', { schema: true }], ['null', { schema: async () => null }],
  ['text', { schema: async () => 'synthetic' }], ['no properties', { schema: async () => ({}) }],
  ['null properties', { schema: async () => ({ properties: null }) }],
  ['array properties', { schema: async () => ({ properties: [] }) }],
  ['number properties', { schema: async () => ({ properties: 12 }) }],
  ['failure', { schema: async () => { throw new Error('synthetic secret must not reach warning'); } }],
];
for (const [label, entity] of uncertain) test(`uncertain schema ${label}: mandatory scoped filter and denial without scope`, async () => {
  const h = harness({ entity }), criteria = { status: 'synthetic' };
  await h.run('Synthetic', criteria, '-created_date', 20);
  assert.deepEqual(h.calls[0][1], { entityName: 'Synthetic', filter: expected({ group_id: 'synthetic-group', empresa_id: 'synthetic-a' }, criteria), sortField: 'created_date', sortDirection: 'desc', limit: 20 });
  const denied = harness({ entity, scope: {} }); await denied.run('Synthetic'); assert.deepEqual(denied.calls, []);
  if (label === 'failure') { assert.equal(h.warnings.length, 1); assert.ok(!h.warnings[0].includes('secret')); }
});

test('valid schema keeps exact method receiver and existing scoped/global distinctions', async () => {
  let receiver;
  const entity = { schema: async function () { receiver = this; return { properties: { group_id: {}, empresa_id: {} } }; } };
  const scoped = harness({ entity }); await scoped.run('Synthetic'); assert.equal(receiver, entity);
  assert.deepEqual(scoped.calls[0][1].filter, expected({ group_id: 'synthetic-group', empresa_id: 'synthetic-a' }));
  const explicit = harness({ entity: { schema: async () => ({ properties: {} }) }, scope: {} });
  await explicit.run('Synthetic', { status: 'synthetic' });
  assert.deepEqual(explicit.calls[0][1].filter, { status: 'synthetic' });
});

test('distinct company/group scopes use the canonical filter without merging criteria destructively', async () => {
  const criteria = { $or: [{ status: 'synthetic-open' }, { status: 'synthetic-pending' }] };
  for (const scope of [{ group_id: 'synthetic-group', empresa_id: 'synthetic-a' }, { group_id: 'synthetic-group', empresa_id: 'synthetic-b' }, { group_id: 'synthetic-group' }]) {
    const h = harness({ scope }); await h.run('Synthetic', criteria);
    assert.deepEqual(h.calls[0][1].filter, expected(scope, criteria));
    assert.deepEqual(criteria, { $or: [{ status: 'synthetic-open' }, { status: 'synthetic-pending' }] });
  }
});

test('fifth field counterproof and compatibility: literal forwarded field, legacy second-field syntax retained', async () => {
  for (const text of [before, source]) {
    const calls = [], deps = { filterInContext: async (...args) => { calls.push(args); return []; } };
    const filter = bind('filtrarPorContexto', deps, text), criteria = { status: 'synthetic' };
    await filter('Synthetic', criteria, '-created_date', 20, 'empresa_faturamento_id');
    assert.equal(calls[0][4], text === before ? 'empresa_id' : 'empresa_faturamento_id');
    assert.equal(calls[0][1], criteria);
    await filter('Synthetic', 'empresa_dona_id', 'created_date', 10);
    assert.equal(calls[1][4], 'empresa_dona_id');
  }
});

test('three real five-argument consumers forward the requested field through the actual wrapper', async () => {
  for (const [path, entity, campo, limit] of [
    ['src/pages/Compras.jsx', 'Fornecedor', 'empresa_dona_id', 100],
    ['src/pages/CRM.jsx', 'Campanha', 'empresa_dona_id', 50],
    ['src/pages/Fiscal.jsx', 'NotaFiscal', 'empresa_faturamento_id', 100],
  ]) {
    const scope = { group_id: 'synthetic-group', [campo]: 'synthetic-a' }, h = harness({ scope });
    const filter = bind('filtrarPorContexto', { filterInContext: h.run });
    const ast = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
    let call;
    function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(ast) === 'filtrarPorContexto' && node.arguments.length === 5) { assert.ok(call === undefined); call = node; } ts.forEachChild(node, visit); }
    visit(ast); assert.ok(call);
    await new Function('filtrarPorContexto', `return ${call.getText(ast)};`)(filter);
    assert.deepEqual(h.fields, [campo]);
    assert.deepEqual(h.calls[0][1], { entityName: entity, filter: expected(scope, {}, campo, entity === 'Fornecedor'), sortField: 'created_date', sortDirection: 'desc', limit });
  }
});

test('backend failure remains visible; no fallback to unscoped request', async () => {
  const failure = new Error('synthetic backend failure'), h = harness({ invoke: async () => { throw failure; } });
  await assert.rejects(h.run('Synthetic'), error => error === failure); assert.equal(h.calls.length, 1);
});
