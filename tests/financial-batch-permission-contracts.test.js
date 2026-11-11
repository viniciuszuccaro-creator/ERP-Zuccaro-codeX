import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {isSensitiveGuardAllowed} from '../src/components/lib/sensitiveActionGuardPolicy.js';
import {normalizeGuardAction, resolveGuardPermission} from '../base44/functions/_lib/security/entityGuardPolicy/entry.ts';
import {financialBatchHunks, financialBatchPermissionRemainder as remainder} from './helpers/financialBatchPermissionRemainder.js';

const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const hashes = [
  '6351c880855076ab2b5acbb32546ca3f619137aa0523f5a2a1993a57b0fd9098',
  '9877fa1fc73f12bc706a52bce3e4e04cbcc11699322ce80874b505ec47fb99ae',
  '17476d9f90f95c6aacfb88b96b6d6787e3d9c7b4fb720135ed6863c79de57b99',
  '40df5e3a4e90a196abffdc306f5d9ace185281bb6f1b481bfe4a5ce4a8849a27',
  '3ab4481c0d6e31ae451f3dd3c6045c6cfef7e00c85462ff9934e010db061893e',
];
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
for (const [index, file] of Object.keys(financialBatchHunks).entries()) test(`${file}: whole previous source retained outside counted batch/date hunks`, () => {
  const source = read(file), [first] = financialBatchHunks[file];
  assert.equal(digest(remainder(file, source)), hashes[index]);
  assert.throws(() => remainder(file, source.replace(first[0], first[1])));
  assert.throws(() => remainder(file, source.replace(first[0], first[0] + first[0])));
  assert.notEqual(digest(remainder(file, '// unintended\n' + source)), hashes[index]);
});
function variable(file, name, source = read(file)) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) { assert.ok(found === undefined); found = node.initializer; }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(found, name); return {ast, node: found};
}
function bind(file, name, deps, source) {
  const {ast, node} = variable(file, name, source);
  const expression = name.endsWith('Mutation') ? node.arguments[0].properties.find(p => p.name?.getText(ast) === 'mutationFn').initializer : node;
  return new Function(...Object.keys(deps), `return (${expression.getText(ast)});`)(...Object.values(deps));
}
function permissions(tree, loading = false) {
  const exports = {}, file = 'src/components/lib/usePermissions.jsx';
  const dependencies = {
    './UserContext': {useUser: () => ({user: {id: 'synthetic-user', role: 'admin', permissoes: tree}, isLoading: loading})},
    '@tanstack/react-query': {useQuery: () => ({data: null, isLoading: false})},
    '@/api/base44Client': {isHttpBackendMode: true},
    '../../../base44/functions/_lib/security/entityGuardPolicy/entry': {normalizeGuardAction},
  };
  const emitted = ts.transpileModule(read(file), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function('require', 'exports', emitted)(name => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; }, exports);
  return exports.default();
}
const cases = [['Pagar', 'ContaPagar', 'pagar'], ['Receber', 'ContaReceber', 'receber']];
function environment(kind, tree, {loading = false, context = true, selected = ['synthetic-title'], fail = false} = {}) {
  const file = `src/components/financeiro/Contas${kind}Tab.jsx`, events = [], permission = permissions(tree, loading);
  const deps = {hasPermission: permission.hasPermission, permissionsLoading: permission.isLoading,
    contextoValido: context, contasSelecionadas: selected,
    contasList: [{id: 'synthetic-title', valor: 100}], contaAtual: null,
    dadosBaixa: {juros: 2, multa: 3, desconto: 4}, toast: value => events.push(['toast', value]),
    setContaAtual: value => events.push(['current', value]), setDadosBaixa: value => events.push(['data', value]),
    setDialogBaixaOpen: value => events.push(['dialog', value]),
    window: {confirm: () => { events.push(['confirm']); return true; }},
    baixarTituloMutation: {mutate: value => events.push(['single-submit', value]), mutateAsync: async value => { if (fail) throw Error('synthetic write failure'); events.push(['single', value]); }},
    baixarMultiplaMutation: {mutate: value => events.push(['batch-submit', value])},
    auditarFinanceiro: async value => events.push(['audit', value]),
  };
  deps[`podeBaixar${kind}`] = bind(file, `podeBaixar${kind}`, deps);
  deps[`podeBaixarMultipla${kind}`] = bind(file, `podeBaixarMultipla${kind}`, deps);
  return {file, deps, events};
}
for (const [kind, entity, individual] of cases) {
  const tree = actions => ({Financeiro: {[entity]: actions}});
  test(`${kind}: actual resolver requires dedicated action plus existing individual permission and loaded profile`, () => {
    for (const actions of [[], [individual], ['baixar'], ['liquidar'], ['editar'], ['executar'], ['baixar_multiplos']]) {
      assert.equal(environment(kind, tree(actions)).deps[`podeBaixarMultipla${kind}`], false);
    }
    assert.equal(environment(kind, tree([individual, 'baixar_multiplos'])).deps[`podeBaixarMultipla${kind}`], true);
    assert.equal(environment(kind, tree([individual, 'baixar_multiplos']), {loading: true}).deps[`podeBaixarMultipla${kind}`], false);
    assert.equal(environment(kind, {Other: {[entity]: [individual, 'baixar_multiplos']}}).deps[`podeBaixarMultipla${kind}`], false);
    assert.equal(environment(kind, {Financeiro: {Other: [individual, 'baixar_multiplos']}}).deps[`podeBaixarMultipla${kind}`], false);
  });
  test(`${kind}: counterproof old actual batch accepted individual-only; new command rejects before any delegate`, async () => {
    const h = environment(kind, tree([individual]));
    await bind(h.file, 'baixarMultiplaMutation', h.deps, remainder(h.file, read(h.file)))(h.deps.dadosBaixa);
    assert.equal(h.events.length, 1); h.events.length = 0;
    await assert.rejects(bind(h.file, 'baixarMultiplaMutation', h.deps)(h.deps.dadosBaixa), /permissao/);
    assert.deepEqual(h.events, []);
  });
  test(`${kind}: loading, missing context, empty selection and revoked grant block direct batch command`, async () => {
    for (const [actions, options] of [[[individual, 'baixar_multiplos'], {loading: true}], [[individual, 'baixar_multiplos'], {context: false}], [[individual, 'baixar_multiplos'], {selected: []}], [[individual], {}]]) {
      const h = environment(kind, tree(actions), options);
      await assert.rejects(bind(h.file, 'baixarMultiplaMutation', h.deps)(h.deps.dadosBaixa)); assert.deepEqual(h.events, []);
    }
  });
  test(`${kind}: allowed batch preserves actual forwarding/calculation and propagates downstream failure`, async () => {
    const h = environment(kind, tree([individual, 'baixar_multiplos']));
    await bind(h.file, 'baixarMultiplaMutation', h.deps)(h.deps.dadosBaixa);
    assert.equal(h.events.length, 1); assert.equal(h.events[0][1].id, 'synthetic-title');
    if (kind === 'Pagar') assert.equal(h.events[0][1].dados, h.deps.dadosBaixa);
    else assert.equal(h.events[0][1].dados.valor_recebido, 101);
    const failure = environment(kind, tree([individual, 'baixar_multiplos']), {fail: true});
    await assert.rejects(bind(failure.file, 'baixarMultiplaMutation', failure.deps)(failure.deps.dadosBaixa), /synthetic write failure/);
    assert.deepEqual(failure.events, []);
  });
  test(`${kind}: direct open and submit denied without batch grant; single-submit remains independent`, () => {
    const h = environment(kind, tree([individual]));
    bind(h.file, 'handleBaixarMultipla', h.deps)();
    assert.deepEqual(h.events.map(e => e[0]), ['toast']); h.events.length = 0;
    bind(h.file, 'handleSubmitBaixa', h.deps)({preventDefault() {}});
    assert.deepEqual(h.events.map(e => e[0]), ['toast']); h.events.length = 0;
    h.deps.contaAtual = {id: 'synthetic-title'};
    bind(h.file, 'handleSubmitBaixa', h.deps)({preventDefault() {}});
    assert.deepEqual(h.events.map(e => e[0]), ['confirm', 'single-submit']);
  });
  test(`${kind}: allowed open/submit preserved and selected action metadata identifies batch versus single`, () => {
    const h = environment(kind, tree([individual, 'baixar_multiplos']));
    bind(h.file, 'handleBaixarMultipla', h.deps)();
    assert.deepEqual(h.events.map(e => e[0]), ['current', 'data', 'dialog']); h.events.length = 0;
    bind(h.file, 'handleSubmitBaixa', h.deps)({preventDefault() {}});
    assert.deepEqual(h.events.map(e => e[0]), ['confirm', 'batch-submit']);
    const ast = ts.createSourceFile(h.file, read(h.file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
    let button;
    function visit(n) { if (ts.isJsxOpeningElement(n) && n.tagName.getText(ast) === 'Button' && n.attributes.properties.some(p => p.name?.text === 'type' && p.initializer?.text === 'submit')) { assert.ok(button === undefined); button = n; } ts.forEachChild(n, visit); }
    visit(ast); assert.ok(button);
    for (const current of [null, {id: 'synthetic-title'}]) {
      const evaluate = attr => new Function('contaAtual', 'contextoValido', `podeBaixarMultipla${kind}`, 'baixarTituloMutation', 'baixarMultiplaMutation', `return (${button.attributes.properties.find(p => p.name?.text === attr).initializer.expression.getText(ast)});`)(current, true, false, {isPending: false}, {isPending: false});
      assert.equal(evaluate('disabled'), !current);
      assert.equal(evaluate('data-permission'), `Financeiro.${entity}.${current ? 'baixar' : 'baixar_multiplos'}`);
    }
  });
  test(`${kind}: filter uses existing ProtectedAction contract for batch, export and create, with no legacy ignored permission prop`, () => {
    const file = `src/components/financeiro/contas-${kind.toLowerCase()}/Filtros${kind}.jsx`;
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX), guards = [];
    function visit(n) { if (ts.isJsxOpeningElement(n) && n.tagName.getText(ast) === 'ProtectedAction') guards.push(n); ts.forEachChild(n, visit); }
    visit(ast);
    assert.deepEqual(guards.map(g => Object.fromEntries(g.attributes.properties.map(p => [p.name.text, p.initializer.text]))),
      ['exportar', 'baixar_multiplos', ...(kind === 'Receber' ? ['criar'] : [])].map(action => ({module: 'Financeiro', section: entity, action})));
  });
}

test('canonical backend permission resolver never aliases individual or generic action to batch', () => {
  assert.equal(normalizeGuardAction('baixar_multiplos'), 'baixar_multiplos');
  for (const action of ['pagar', 'receber', 'baixar', 'liquidar', 'editar', 'executar']) {
    assert.notEqual(normalizeGuardAction(action), 'baixar_multiplos');
    assert.equal(resolveGuardPermission({permissions: {Financeiro: {ContaPagar: [action]}}, moduleName: 'Financeiro', section: 'ContaPagar', action: 'baixar_multiplos'}), false);
  }
  assert.equal(resolveGuardPermission({permissions: {Financeiro: {ContaPagar: ['baixar_multiplos']}}, moduleName: 'Financeiro', section: 'ContaPagar', action: 'baixar_multiplos'}), true);
});
test('actual ProtectedAction sends dedicated action and explicit tenant; loading, backend denial/failure remain closed', async () => {
  const file = 'src/components/ProtectedAction.jsx';
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const functions = ['getGuardKey', 'ProtectedAction'].map(name => {
    const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
    assert.ok(fn); return fn.getText(ast).replace(/^export /, '');
  }).join('\n');
  const emitted = ts.transpileModule(functions, {compilerOptions: {target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React}}).outputText;
  for (const [loading, local, backend, expected, requests] of [
    [true, true, true, null, 0], [false, false, true, false, 0],
    [false, true, false, false, 1], [false, true, 'fail', false, 1], [false, true, true, true, 1],
  ]) {
    const effects = [], states = [], calls = []; let cursor = 0;
    const useState = initial => { const index = cursor++; states[index] = initial; return [initial, value => { states[index] = value; }]; };
    const deps = {React: {...React, useEffect: fn => effects.push(fn)}, useState,
      usePermissions: () => ({isLoading: loading, hasPermission: (...args) => { assert.deepEqual(args, ['Financeiro', 'ContaPagar', 'baixar_multiplos']); return local; }}),
      useUser: () => ({user: {id: 'synthetic-user'}}),
      useContextoVisual: () => ({empresaAtual: {id: 'synthetic-a'}, grupoAtual: {id: 'synthetic-group'}, contexto: 'empresa'}),
      __guardCache: new Map(), __guardInflight: new Map(), GUARD_TTL_MS: 300000, isSensitiveGuardAllowed,
      base44: {functions: {invoke: async (...args) => { calls.push(args); if (backend === 'fail') throw Error('synthetic offline'); return {data: {allowed: backend}}; }}},
      console: {warn: () => {}},
    };
    const Component = new Function(...Object.keys(deps), emitted + '\nreturn ProtectedAction;')(...Object.values(deps));
    Component({module: 'Financeiro', section: 'ContaPagar', action: 'baixar_multiplos', auditDenied: false, children: 'Synthetic'});
    assert.equal(states[1], null); effects[0](); await new Promise(resolve => setImmediate(resolve));
    assert.equal(states[1], expected); assert.equal(calls.length, requests);
    if (requests) assert.deepEqual(calls[0], ['entityGuard', {module: 'Financeiro', section: 'ContaPagar', action: 'baixar_multiplos', empresa_id: 'synthetic-a', group_id: 'synthetic-group'}]);
  }
});
test('DRE explicit Number conversion preserves existing last-day calculation, leap years and invalid-period failure', () => {
  const file = 'src/components/fiscal/RelatorioDRE.jsx';
  function expression(source) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); let node;
    function visit(n) { if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'dataFim') { assert.ok(node === undefined); node = n.initializer; } ts.forEachChild(n, visit); }
    visit(ast); assert.ok(node); return new Function('periodo', `return (${node.getText(ast)});`);
  }
  const after = expression(read(file)), before = expression(remainder(file, read(file)));
  for (let year = 1996; year <= 2030; year++) for (let month = 1; month <= 12; month++) {
    const period = `${year}-${String(month).padStart(2, '0')}`; assert.equal(after(period), before(period));
  }
  for (const period of ['invalid', '2026-invalid']) { assert.throws(() => before(period), RangeError); assert.throws(() => after(period), RangeError); }
});
