import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const hook = 'src/components/lib/useEntityListSorted.jsx';
const declaration = 'src/components/lib/browserRuntimeContracts.d.ts';
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const frozen = {
  [hook]: 'a40d1d7d68a80855cd3956254541fe58e931bc18ce9c61c12088b9ccd207c500',
  'src/components/comercial/CentralAprovacoesManager.jsx': '83ad4e3b0fe276e61e4ea4edf8eff7ae63c452d8c62b83f84701bd7bc6e2d62c',
  'src/components/comercial/PedidoFormCompleto.jsx': '4a1c1c3ca26697513b2c76b7fad56e7a4ee3c135f73cf91eadb60043c6a4ad7d',
};
for (const [file, hash] of Object.entries(frozen)) test(`${file}: only one type-only reference added to stage54 source`, () => {
  const reference = `/// <reference path="${file === hook ? './' : '../lib/'}browserRuntimeContracts.d.ts" />\n`;
  const source = read(file);
  assert.ok(source.startsWith(reference)); assert.equal(source.split(reference).length, 2);
  assert.equal(digest(source.slice(reference.length)), hash);
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, removeComments: true };
  assert.equal(ts.transpileModule(source, { compilerOptions: options }).outputText, ts.transpileModule(source.slice(reference.length), { compilerOptions: options }).outputText);
});

test('browser declaration emits no JavaScript and does not install a global callback', () => {
  const tree = ts.createSourceFile(declaration, read(declaration), ts.ScriptTarget.Latest, true);
  assert.ok(tree.isDeclarationFile);
  assert.equal(tree.statements.length, 2);
  assert.ok(ts.isExportDeclaration(tree.statements[0]));
  assert.ok(ts.isModuleDeclaration(tree.statements[1]));
  assert.ok(tree.statements[1].modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword));
  for (const file of Object.keys(frozen)) assert.ok(!read(file).includes('window.__currentOpenWindow ='));
  const canonical = read('src/components/cadastros/openCadastroWindow.js');
  assert.ok(canonical.includes('@param {(component: unknown, props?: object, options?: object) => string} openWindow'));
  assert.ok(read(declaration).includes('(component: unknown, props?: object, options?: object) => string'));
});

test('typed browser maps reject malformed entries, opaque rows and invalid optional callback arguments', () => {
  const filename = path.resolve('tests/synthetic-browser-runtime.ts');
  const lines = [
    '/// <reference path="../src/components/lib/browserRuntimeContracts.d.ts" />',
    'window.__elsInflight = new Map<string, Promise<unknown[]>>();',
    'window.__elsCache = new Map<string, unknown[]>();',
    'window.__elsLastCallAt = new Map<string, number>();',
    'window.__elsCooldownUntil = new Map<string, number>();',
    'window.__elsEntityBusy = new Map<string, boolean>();',
    'window.__elsStrikeCount = new Map<string, number>();',
    "window.__elsInflight.set('synthetic', Promise.resolve([{synthetic:true}]));",
    "window.__elsCache.set('synthetic', [{synthetic:true}]);",
    "window.__elsLastCallAt.set('Synthetic', 123);",
    "window.__elsCooldownUntil.set('Synthetic', 456);",
    "window.__elsEntityBusy.set('Synthetic', true);",
    "window.__elsStrikeCount.set('Synthetic', 2);",
    'window.__currentOpenWindow?.(null, {}, {});',
  ];
  const negatives = [];
  for (const line of [
    "window.__elsInflight.set('synthetic', Promise.resolve(3));",
    "window.__elsCache.set('synthetic', {});",
    "window.__elsLastCallAt.set('Synthetic', '123');",
    "window.__elsCooldownUntil.set('Synthetic', false);",
    "window.__elsEntityBusy.set('Synthetic', 1);",
    "window.__elsStrikeCount.set('Synthetic', '2');",
    "window.__elsCache.set(123, []);",
    "window.__elsCache.get('synthetic')?.[0].id;",
    'window.__currentOpenWindow?.(null, 123, {});',
    'window.__currentOpenWindow?.(null, {}, 123);',
  ]) { negatives.push(lines.length); lines.push(line); }
  const options = { allowJs: true, checkJs: true, noEmit: true, strictNullChecks: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true };
  const host = ts.createCompilerHost(options), original = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? lines.join('\n') : original(file);
  const diagnostics = ts.createProgram([filename], options, host).getSemanticDiagnostics().filter(error => error.file && path.resolve(error.file.fileName) === filename);
  assert.deepEqual(diagnostics.map(error => error.file.getLineAndCharacterOfPosition(error.start).line), negatives, JSON.stringify(diagnostics.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))));
});

function harness({ browser, invoke = async () => ({ data: [] }), idbGet = async () => undefined } = {}) {
  let options, scope = { empresa_id: 'synthetic-a' }, clock = 100000;
  const calls = [], waits = [], writes = [], warnings = [];
  const dependencies = {
    '@tanstack/react-query': { useQuery: value => { options = value; return value; } },
    react: { useEffect: () => {}, useRef: current => ({ current }) },
    '@/api/base44Client': { base44: { functions: { invoke: async (...args) => { calls.push(args); return invoke(...args); } } } },
    '@/components/lib/useContextoVisual': { useContextoVisual: () => ({ getFiltroContexto: () => scope, grupoAtual: { id: 'synthetic-group' }, empresaAtual: { id: scope.empresa_id, group_id: 'synthetic-group' } }) },
    '@/components/lib/useIndexedDBCache': { idbGet, idbSet: async (...args) => { writes.push(args); } },
  };
  const output = ts.transpileModule(read(hook), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, removeComments: true } }).outputText;
  const exports = {};
  new Function('require', 'exports', 'window', 'localStorage', 'Date', 'setTimeout', 'console', output + '\nexports.maps = {__elsInflight,__elsCache,__elsLastCallAt,__elsCooldownUntil,__elsEntityBusy,__elsStrikeCount};')(
    name => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; }, exports, browser,
    { getItem: () => null }, { now: () => clock }, (callback, ms) => { waits.push(ms); clock += ms; queueMicrotask(callback); }, { warn: (...args) => warnings.push(args) });
  return { module: exports, calls, waits, writes, warnings, setScope: value => { scope = value; }, render: (criteria = {}, config = {}) => { exports.default('Synthetic', criteria, config); return options; } };
}

test('SSR initializes independent native maps without touching window', () => {
  const a = harness(), b = harness();
  for (const key of Object.keys(a.module.maps)) {
    assert.ok(a.module.maps[key] instanceof Map); assert.notEqual(a.module.maps[key], b.module.maps[key]);
  }
  assert.equal(a.render().enabled, true); assert.equal(a.calls.length, 0);
});

test('browser initializes six maps once and reuses their identities across module loads', () => {
  const browser = {}, a = harness({ browser }), b = harness({ browser });
  assert.equal(browser.__currentOpenWindow, undefined);
  for (const key of Object.keys(a.module.maps)) assert.equal(a.module.maps[key], b.module.maps[key]);
  browser.__elsCache.set('synthetic', []);
  assert.equal(a.module.maps.__elsCache.has('synthetic'), true);
});

test('actual query deduplicates same scoped request and clears inflight/busy after success', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const h = harness({ browser: {}, invoke: () => pending });
  const query = h.render({}, { page: 2, pageSize: 20 });
  const first = query.queryFn(), second = query.queryFn();
  assert.equal(h.calls.length, 1); assert.equal(h.module.maps.__elsInflight.size, 1);
  release({ data: [{ id: 'synthetic-row' }] });
  assert.deepEqual(await first, [{ id: 'synthetic-row' }]); assert.deepEqual(await second, await first);
  assert.equal(h.module.maps.__elsInflight.size, 0); assert.equal(h.module.maps.__elsEntityBusy.get('Synthetic'), false);
  const payload = h.calls[0][1];
  assert.equal(payload.group_id, 'synthetic-group'); assert.equal(payload.empresa_id, 'synthetic-a');
  assert.equal(payload.limit, 20); assert.equal(payload.skip, 20);
  assert.equal(h.writes[0][2], 600000);
});

test('actual query keeps distinct scoped payloads and does not reuse another company request', async () => {
  const h = harness({ browser: {}, invoke: async (_name, payload) => ({ data: [{ id: payload.empresa_id }] }) });
  assert.deepEqual(await h.render().queryFn(), [{ id: 'synthetic-a' }]);
  h.setScope({ empresa_id: 'synthetic-b' });
  assert.deepEqual(await h.render().queryFn(), [{ id: 'synthetic-b' }]);
  assert.equal(h.calls.length, 2); assert.equal(h.module.maps.__elsCache.size, 2);
});

test('actual query propagates uncached failure and clears inflight/busy without retry fiction', async () => {
  const failure = new Error('synthetic failure');
  const h = harness({ browser: {}, invoke: async () => { throw failure; } });
  await assert.rejects(h.render().queryFn(), error => error === failure);
  assert.equal(h.module.maps.__elsInflight.size, 0); assert.equal(h.module.maps.__elsEntityBusy.get('Synthetic'), false);
  assert.equal(h.calls.length, 1);
});

test('actual 429 retry remains bounded and preserves existing array fallback policy', async () => {
  const h = harness({ browser: {}, invoke: async () => { throw { status: 429 }; }, idbGet: async () => [{ id: 'synthetic-offline' }] });
  assert.deepEqual(await h.render().queryFn(), [{ id: 'synthetic-offline' }]);
  assert.equal(h.calls.length, 6); assert.equal(h.module.maps.__elsStrikeCount.get('Synthetic'), 6);
  assert.equal(h.waits.length, 5); assert.equal(h.module.maps.__elsInflight.size, 0);
});

test('missing scope remains disabled; declarations do not validate cache rows or authorize queries', () => {
  const h = harness(); h.setScope({});
  assert.equal(h.render().enabled, false); assert.equal(h.calls.length, 0);
  const rows = [{ opaque: 'synthetic' }]; h.module.maps.__elsCache.set('synthetic', rows);
  assert.equal(h.module.maps.__elsCache.get('synthetic'), rows);
});
