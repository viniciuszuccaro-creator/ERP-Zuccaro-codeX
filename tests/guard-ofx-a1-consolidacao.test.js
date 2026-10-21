import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { httpMirrorAnnotationRemainder } from './helpers/httpMirrorAnnotationRemainder.js';
import { bankSourceHostRemainder } from './helpers/bankSourceHostRemainder.js';
import { financialUiBoundaryRemainder } from './helpers/financialUiBoundaryRemainder.js';
import { createHttpApiClient } from '../src/api/httpApiClient.js';

const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
const emit = text => ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;

test('OFX host preserves all legacy JS after exactly eight source-dialog integration hunks', () => {
  const path = 'src/components/financeiro/ConciliacaoBancariaTab.jsx';
  assert.equal(emit(bankSourceHostRemainder(financialUiBoundaryRemainder(path, read(path)))), emit(head(path)));
  const legacy = 'src/components/financeiro/ConciliacaoBancaria.jsx';
  assert.equal(financialUiBoundaryRemainder(legacy, read(legacy)), head(legacy));
});

test('read access requires all account and source PII permissions independently of import', () => {
  const path = 'src/components/financeiro/ConciliacaoBancariaTab.jsx', source = read(path);
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const expressions = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['podeLerFonte', 'podeImportarFonte'].includes(node.name.getText(tree))) expressions[node.name.getText(tree)] = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const permissions = ['Financeiro.ContaBancariaEmpresa.visualizar', 'Financeiro.ContaBancariaEmpresa.dados-sensiveis.visualizar',
    'Financeiro.conciliacao.visualizar', 'Financeiro.conciliacao.dados-sensiveis.visualizar'];
  const evaluate = granted => new Function('hasPermission', `return {read:${expressions.podeLerFonte},import:${expressions.podeImportarFonte}};`)((...parts) => granted.has(parts.join('.')));
  assert.deepEqual(evaluate(new Set(permissions)), { read: true, import: false });
  for (const missing of permissions) assert.deepEqual(evaluate(new Set([...permissions.filter(p => p !== missing), 'Financeiro.conciliacao.importar'])), { read: false, import: true });
});

test('operational app router and Cursor recovery remain unchanged', () => {
  for (const path of ['server/src/app.ts', 'server/src/api/router.ts']) assert.equal(read(path), head(path));
  assert.equal(httpMirrorAnnotationRemainder(read('src/api/localBase44Client.js')), head('src/api/localBase44Client.js'));
});

const expected = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222', actorId: '33333333-3333-4333-8333-333333333333' };
const metadata = { id: '44444444-4444-4444-8444-444444444444', fingerprint: 'a'.repeat(64), validFrom: '2026-01-01T00:00:00Z', validTo: '2027-01-01T00:00:00Z', state: 'ACTIVE', revision: '1', trustStoreVersion: 'SYNTHETIC' };
const response = value => new Response(JSON.stringify({ data: value }), { status: 200 });

test('shared request preserves JSON IA OFX and multipart channels in one client', async () => {
  const batchId = '55555555-5555-4555-8555-555555555555', accountId = metadata.id;
  const channels = [];
  const client = createHttpApiClient({ baseUrl: '', getScope: () => ({ ...expected, token: 'synthetic-session' }), fetchImpl: async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer synthetic-session');
    if (String(url).endsWith('/certificados-a1')) {
      assert.equal(options.headers['Content-Type'], undefined);
      assert.ok(options.body instanceof FormData); channels.push('multipart'); return response(metadata);
    }
    if (String(url).includes('/extratos/')) {
      assert.equal(options.headers['Content-Type'], 'application/x-ofx');
      assert.ok(options.body instanceof Blob); assert.equal(await options.body.text(), 'SYNTHETIC-OFX');
      channels.push('ofx'); return response({ batchId, disposition: 'STAGED', created: 1, replay: 0 });
    }
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(options.body).prompt || JSON.parse(options.body).observacoes, 'SYNTHETIC');
    channels.push('json'); return response({});
  } });
  await client.pedidos.create({ observacoes: 'SYNTHETIC' });
  await client.invokeIaContextual({ purpose: 'fiscal_validacao', group_id: expected.groupId, empresa_id: expected.empresaId, prompt: 'SYNTHETIC' });
  await client.bankStatements.upload(expected, { accountId, batchId, file: new File(['SYNTHETIC-OFX'], 'synthetic.ofx') });
  await client.a1Certificates.upload(expected, { file: new File(['SYNTHETIC-NOT-PKCS12'], 'synthetic.pfx'), password: 'synthetic-not-a-credential', operationId: batchId });
  assert.deepEqual(channels, ['json', 'json', 'ofx', 'multipart']);
});

test('A1 rejects pre-aborted calls without sending and ignores non-cooperative late replies', async () => {
  for (const pre of [true, false]) {
    let calls = 0;
    const controller = new AbortController(); if (pre) controller.abort();
    const api = createHttpApiClient({ getScope: () => ({ ...expected, token: 'synthetic-session' }), fetchImpl: async () => {
      calls++; controller.abort(); return response(metadata);
    } }).a1Certificates;
    await assert.rejects(api.metadata(expected, { signal: controller.signal }), error => error.status === 409 && !('body' in error));
    assert.equal(calls, pre ? 0 : 1);
  }
});

test('A1 storage failure is sanitized before network and changed session takes precedence over backend failure', async () => {
  let calls = 0;
  const inaccessible = createHttpApiClient({ getScope: () => { throw Error('SYNTHETIC_PRIVATE_STORAGE'); }, fetchImpl: async () => { calls++; assert.fail('No network'); } }).a1Certificates;
  await assert.rejects(inaccessible.metadata(expected), error => error.status === 401 && !String(error).includes('SYNTHETIC_PRIVATE_STORAGE'));
  const scope = { ...expected, token: 'synthetic-session' };
  const late = createHttpApiClient({ getScope: () => scope, fetchImpl: async () => {
    scope.token = 'synthetic-rotated-session'; return new Response('SYNTHETIC_PRIVATE_RESPONSE', { status: 503 });
  } }).a1Certificates;
  await assert.rejects(late.metadata(expected), error => error.status === 409 && !JSON.stringify(error).includes('SYNTHETIC_PRIVATE_RESPONSE'));
  assert.equal(calls, 0);
});

test('A1 panel lifecycle aborts clears refs and removes context listener without caching secrets', () => {
  const path = 'src/components/fiscal/CertificadoA1Panel.jsx', source = read(path);
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let expression;
  function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') expression = node.arguments[0].getText(tree); ts.forEachChild(node, visit); }
  visit(tree); assert.ok(expression);
  let listener, removed = 0;
  const alive = { current: false }, operation = { current: new AbortController() };
  const file = { current: { value: 'synthetic.pfx' } }, password = { current: { value: 'synthetic-only' } };
  const window = { addEventListener: (_name, fn) => { listener = fn; }, removeEventListener: (_name, fn) => { assert.equal(fn, listener); removed++; } };
  const effect = new Function('window', 'HTTP_CONTEXT_CHANGED', 'alive', 'operation', 'file', 'password', 'setError', `return (${expression});`)(window, 'synthetic-event', alive, operation, file, password, value => assert.ok(!value.includes('synthetic-only')));
  const cleanup = effect(); listener();
  assert.equal(operation.current.signal.aborted, true); assert.equal(file.current.value, ''); assert.equal(password.current.value, '');
  cleanup(); assert.equal(alive.current, false); assert.equal(removed, 1);
  assert.doesNotMatch(source, /localStorage|sessionStorage|setPassword|setFile|console\./);
});
