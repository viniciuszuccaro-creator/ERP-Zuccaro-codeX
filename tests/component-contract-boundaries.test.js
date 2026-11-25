import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as SelectPrimitive from '@radix-ui/react-select';
import { normalizeGuardAction } from '../base44/functions/_lib/security/entityGuardPolicy/entry.ts';
import { createPedidoMutationGate } from '../src/components/comercial/pedidoUiPolicy.js';
import { componentContractHunks, componentContractRemainder } from './helpers/componentContractRemainder.js';

const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const parse = (file, source = read(file)) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function nodes(ast, predicate) {
  const out = []; const visit = node => { if (predicate(node)) out.push(node); ts.forEachChild(node, visit); };
  visit(ast); return out;
}
const emit = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
function module(file, dependencies) {
  const exports = {};
  new Function('require', 'exports', emit(read(file)))(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`); return dependencies[name];
  }, exports); return exports;
}
function functionComponent(file, name, bindings = {}) {
  const ast = parse(file), fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn);
  return new Function('React', ...Object.keys(bindings), `${emit(fn.getText(ast).replace('export default ', '').replace('export ', ''))};return ${name};`)(React, ...Object.values(bindings));
}
const hashes = {
  'src/components/lib/usePermissions.jsx': '46098fb87ed8761f153abb301fbf0993abe716f3b86f479edefb6c3f7f04875d',
  'src/components/estoque/estoque-launchpad/KPIsEstoque.jsx': '3ab9ddc98e699abbb81458f1ffeba81268b7a05bc49b1aae10f5c68c2ac56f60',
  'src/components/estoque/RelatoriosEstoque.jsx': '304aa6c0cb77fd8c1f4bd107bb463c5ed0aab811669a7be1d3b76559f755de9c',
  'src/components/layout/ModuleHeader.jsx': 'a9a0f2fdbe74006c01814c1883ac3e49c1acb5fcea7a1b87284bad2fbe26f18b',
  'src/components/lib/GuardRails.jsx': '0f7ad1ddd27367e7cbd89b3a41e4e26c638548b99d9d2629123e4e1fcf35a8f0',
  'src/components/expedicao/RoteirizacaoMapa.jsx': '598cfbd17611322a884d5653213f0ebc8bf2370ad2b0bf7ab745aee6e1a4918f',
  'src/components/comercial/pedidoUiPolicy.js': '78fd955d2ad2cd184bd2cce907ae7f47ffe89d2b7d094fe8ada6424d03d98585',
};
for (const [file, expected] of Object.entries(hashes)) test(`${file}: full stage52 source outside exact component-contract hunks unchanged`, () => {
  const digest = source => createHash('sha256').update(source).digest('hex');
  assert.equal(digest(componentContractRemainder(file, read(file))), expected);
  for (const [current, previous] of componentContractHunks[file]) {
    assert.throws(() => componentContractRemainder(file, read(file).replace(current, () => previous)));
    assert.throws(() => componentContractRemainder(file, read(file).replace(current, () => current + '\n' + current)));
    const midpoint = Math.floor(current.length / 2);
    const mutated = read(file).replace(current, () => current.slice(0, midpoint) + '/* unintended */' + current.slice(midpoint));
    assert.notEqual(mutated, read(file));
    assert.throws(() => componentContractRemainder(file, mutated));
  }
  assert.notEqual(digest(componentContractRemainder(file, '// unintended edit\n' + read(file))), expected);
});

const permissionFile = 'src/components/lib/usePermissions.jsx';
function permissions(tree, loading = false) {
  return module(permissionFile, {
    './UserContext': { useUser: () => ({ user: { id: 'synthetic-user', role: 'admin', permissoes: tree }, isLoading: loading }) },
    '@tanstack/react-query': { useQuery: options => { assert.equal(options.enabled, false); return { data: { permissoes: {} }, isLoading: false }; } },
    '@/api/base44Client': { isHttpBackendMode: true },
    '../../../base44/functions/_lib/security/entityGuardPolicy/entry': { normalizeGuardAction },
  }).default();
}
test('extensionless RBAC import resolves to the same canonical TS source under the actual bundler resolution mode', () => {
  const ast = parse(permissionFile);
  const importPath = ast.statements.find(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text.includes('entityGuardPolicy')).moduleSpecifier.text;
  assert.ok(!importPath.endsWith('.ts'));
  const resolved = ts.resolveModuleName(importPath, path.resolve(permissionFile), { moduleResolution: ts.ModuleResolutionKind.Bundler }, ts.sys).resolvedModule;
  assert.equal(path.resolve(resolved.resolvedFileName), path.resolve('base44/functions/_lib/security/entityGuardPolicy/entry.ts'));
});
const protectedFile = 'src/components/security/ProtectedField.jsx';
function protectedProps(node, ast) {
  return Object.fromEntries(node.attributes.properties.map(attr => [attr.name.text, !attr.initializer ? true
    : ts.isStringLiteral(attr.initializer) ? attr.initializer.text
      : new Function(`return (${attr.initializer.expression.getText(ast)});`)()]));
}
let fieldCount = 0;
for (const file of ['src/components/estoque/estoque-launchpad/KPIsEstoque.jsx', 'src/components/estoque/RelatoriosEstoque.jsx']) {
  const ast = parse(file);
  const fields = nodes(ast, node => ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'ProtectedField');
  for (const [index, field] of fields.entries()) {
    fieldCount++;
    const props = protectedProps(field, ast);
    test(`${file}/${index}: explicit null tab preserves exact field path and fail-closed render`, () => {
      assert.equal(props.tab, null);
      const granted = { Estoque: { [props.submodule]: { [props.field]: ['visualizar'] } } };
      for (const tree of [{}, granted, { Estoque: { Other: ['visualizar'] } }, { Financeiro: { [props.submodule]: { [props.field]: ['visualizar'] } } }]) {
        const result = permissions(tree);
        const old = result.hasFieldPermission(props.module, props.submodule, undefined, props.field, props.action);
        assert.equal(result.hasFieldPermission(props.module, props.submodule, null, props.field, props.action), old);
        const Component = functionComponent(protectedFile, 'ProtectedField', { usePermissions: () => result });
        const html = renderToStaticMarkup(React.createElement(Component, props, 'Synthetic protected value'));
        assert.equal(html.includes('Synthetic protected value'), tree === granted);
      }
      const loading = functionComponent(protectedFile, 'ProtectedField', { usePermissions: () => ({ isLoading: true, hasFieldPermission: () => { throw Error('Must not inspect while loading'); } }) });
      assert.equal(renderToStaticMarkup(React.createElement(loading, props, 'Synthetic protected value')), '');
      const missing = functionComponent(protectedFile, 'ProtectedField', { usePermissions: () => ({ isLoading: false }) });
      assert.ok(!renderToStaticMarkup(React.createElement(missing, props, 'Synthetic protected value')).includes('Synthetic protected value'));
    });
  }
}
test('all four stock protected values accounted for without optionalizing ProtectedField', () => assert.equal(fieldCount, 4));
test('real RBAC field helper still distinguishes tabs, fields, modules and actions; admin role alone does not grant', () => {
  const result = permissions({ Estoque: { KPIs: { TabA: { valores: ['visualizar'] } } } });
  assert.equal(result.hasFieldPermission('Estoque', 'KPIs', 'TabA', 'valores', 'ver'), true);
  for (const args of [['Estoque', 'KPIs', null, 'valores', 'ver'], ['Estoque', 'KPIs', 'TabB', 'valores', 'ver'], ['Estoque', 'KPIs', 'TabA', 'other', 'ver'], ['Estoque', 'KPIs', 'TabA', 'valores', 'editar']]) assert.equal(result.hasFieldPermission(...args), false);
  assert.equal(permissions({}).hasFieldPermission('Estoque', 'KPIs', null, 'valores', 'ver'), false);
});

test('actual ModuleHeader retains children-only, title, subtitle and action rendering', () => {
  const Component = functionComponent('src/components/layout/ModuleHeader.jsx', 'ModuleHeader');
  assert.ok(renderToStaticMarkup(React.createElement(Component, {}, 'Synthetic content')).includes('Synthetic content'));
  assert.ok(!renderToStaticMarkup(React.createElement(Component, {})).includes('<h1'));
  const html = renderToStaticMarkup(React.createElement(Component, { title: 'Synthetic title', subtitle: 'Synthetic subtitle', actions: React.createElement('button', null, 'Synthetic action') }, 'Synthetic extra'));
  for (const text of ['Synthetic title', 'Synthetic subtitle', 'Synthetic action', 'Synthetic extra']) assert.ok(html.includes(text));
});
for (const supportsPasswordLogin of [false, true]) test(`actual session escape presentation/${supportsPasswordLogin}: missing hint does not weaken logout`, () => {
  const clicks = [], logouts = [];
  const Component = functionComponent('src/components/lib/GuardRails.jsx', 'SessionEscapeActions', {
    useAuth: () => ({ supportsPasswordLogin, logout: value => logouts.push(value) }),
    Button: props => { clicks.push(props.onClick); return React.createElement('button', null, props.children); },
    LogOut: () => null, isHttpBackendMode: true,
  });
  const html = renderToStaticMarkup(React.createElement(Component, {}));
  assert.ok(html.includes(supportsPasswordLogin ? 'Sair e entrar com outra conta' : 'Sair'));
  clicks[0](); assert.deepEqual(logouts, [true]);
  assert.ok(renderToStaticMarkup(React.createElement(Component, { hint: 'Synthetic hint' })).includes('Synthetic hint'));
});

const actualSelect = module('src/components/ui/select.jsx', {
  react: React, '@radix-ui/react-select': SelectPrimitive,
  'lucide-react': { Check: () => null, ChevronDown: () => null, ChevronUp: () => null },
  '@/lib/utils': { cn: (...values) => values.filter(value => typeof value === 'string').join(' ') },
  '@/components/lib/usePermissions': { __esModule: true, default: () => ({ hasPermissionKey: () => true }) },
  '@/components/lib/uiAudit': { uiAuditWrap: (_name, fn) => fn },
});
const mapFile = 'src/components/expedicao/RoteirizacaoMapa.jsx';
for (const id of ['motorista-select', 'veiculo-select']) test(`${id}: actual audited Select/Radix Trigger gains the label target; value callback unchanged`, () => {
  const selectNode = (ast, old = false) => nodes(ast, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Select'
    && (old ? node.openingElement.getText(ast).includes(`id="${id}"`) : node.getText(ast).includes(`<SelectTrigger id="${id}">`)))[0];
  const after = parse(mapFile), before = parse(mapFile, componentContractRemainder(mapFile, read(mapFile)));
  const values = [], bindings = {
    React, ...actualSelect, motoristaSelecionado: 'motorista-a', veiculoSelecionado: 'veiculo-a',
    motoristas: [{ id: 'motorista-a', nome_completo: 'Synthetic driver' }], veiculos: [{ id: 'veiculo-a', modelo: 'Synthetic vehicle', placa: 'SYNTHETIC' }],
    setMotoristaSelecionado: value => values.push(value), setVeiculoSelecionado: value => values.push(value),
  };
  const element = (node, ast) => new Function(...Object.keys(bindings), `${emit(`const element=(${node.getText(ast)});`)}; return element;`)(...Object.values(bindings));
  const current = element(selectNode(after), after), old = element(selectNode(before, true), before);
  const html = renderToStaticMarkup(current), previous = renderToStaticMarkup(old);
  assert.ok(html.includes(`id="${id}"`)); assert.ok(!previous.includes(`id="${id}"`));
  current.props.onValueChange('synthetic-next'); assert.deepEqual(values, ['synthetic-next']);
  const labels = nodes(after, node => ts.isJsxOpeningElement(node) && node.tagName.getText(after) === 'Label' && node.attributes.getText(after).includes(`htmlFor="${id}"`));
  assert.equal(labels.length, 1);
});

test('actual mutation subscription cleanup returns void, is idempotent and retains pending scope through remount', () => {
  const gate = createPedidoMutationGate(), events = [];
  const scope = { groupId: 'group-a', empresaId: 'company-a', actorId: 'actor-a' };
  const cleanup = gate.subscribe(() => events.push('old'));
  const ticket = gate.begin(scope); assert.ok(ticket); assert.deepEqual(events, ['old']);
  assert.equal(cleanup(), undefined); assert.equal(cleanup(), undefined);
  assert.equal(gate.isPending(scope), true); assert.equal(gate.begin(scope), null);
  const secondCleanup = gate.subscribe(() => events.push('new'));
  gate.end(ticket); assert.deepEqual(events, ['old', 'new']); assert.equal(gate.isPending(scope), false);
  secondCleanup(); const other = gate.begin({ ...scope, empresaId: 'company-b' }); gate.end(other);
  assert.deepEqual(events, ['old', 'new']);
});
