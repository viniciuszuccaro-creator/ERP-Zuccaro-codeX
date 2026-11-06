import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {createFunctionsModule} from '../node_modules/@base44/sdk/dist/modules/functions.js';
import {publicLookupTransportFile as file, publicLookupTransportAfter as after, publicLookupTransportBefore as before, publicLookupTransportRemainder as remainder} from './helpers/publicLookupTransportRemainder.js';

const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const previous = remainder(file, source);
test('complete stage73 lookup source retained outside exactly one SDK invocation/response-envelope hunk', () => {
  const hash = text => crypto.createHash('sha256').update(text).digest('hex');
  assert.equal(hash(previous), 'd3c26b3721b6550c354bd3fee9c6b6814d57538b8383774383a6503599be3a3f');
  assert.throws(() => remainder(file, source.replace(after, before)));
  assert.throws(() => remainder(file, source.replace(after, after + after)));
  assert.notEqual(hash(remainder(file, '// unintended\n' + source)), hash(previous));
});
function harness({reply = {sucesso: true, dados: {razao_social: 'Synthetic'}}, failure = false, text = source, fetchReply} = {}) {
  const requests = [], fetches = [], logs = [];
  const functions = createFunctionsModule({post: async (...args) => { requests.push(args); if (failure) throw Error('synthetic-private-provider-error'); return reply; }}, 'synthetic-app');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'buscarDadosCNPJ'); assert.ok(fn);
  const consoleMock = Object.fromEntries(['log', 'warn', 'error'].map(name => [name, (...args) => logs.push(args)]));
  const run = new Function('base44', 'fetch', 'console', `return (${fn.getText(ast).replace(/^export /, '')});`)(
    {functions}, async url => { fetches.push(url); if (!fetchReply) throw Error('synthetic external fetch forbidden'); return fetchReply; }, consoleMock);
  return {run, requests, fetches, logs, functions};
}
test('installed SDK counterproof: custom method absent made legacy lookup fall through; canonical invoke consumes data envelope', async () => {
  const result = {sucesso: true, dados: {razao_social: 'Synthetic'}}, reply = {data: result};
  const old = harness({reply, text: previous}); assert.equal(old.functions.ConsultarCNPJ, undefined);
  assert.equal((await old.run('00000000000000')).sucesso, false); assert.equal(old.requests.length, 0); assert.equal(old.fetches.length, 1);
  const h = harness({reply}); assert.equal(await h.run('00000000000000'), result);
  assert.equal(h.requests.length, 1); assert.equal(h.fetches.length, 0);
  assert.deepEqual(h.requests[0], ['/apps/synthetic-app/functions/ConsultarCNPJ', {cnpj: '00000000000000'}, {headers: {'Content-Type': 'application/json'}}]);
});
test('invalid input still returns before SDK or fetch; formatting normalization preserved', async () => {
  const invalid = harness(); assert.equal((await invalid.run('123')).sucesso, false); assert.deepEqual(invalid.requests, []); assert.deepEqual(invalid.fetches, []);
  const result = {sucesso: true, dados: {razao_social: 'Synthetic'}}, h = harness({reply: {data: result}});
  assert.equal(await h.run('00.000.000/0000-00'), result); assert.deepEqual(h.requests[0][1], {cnpj: '00000000000000'});
});
test('provider errors and non-success envelopes retain existing fallback without exposing raw body or error in logs', async () => {
  for (const options of [{failure: true}, {reply: null}, {reply: {}}, {reply: {data: {sucesso: false, erro: 'synthetic-private-provider-error'}}}, {reply: {data: {ok: true, local: true}}}]) {
    const h = harness(options); assert.equal((await h.run('00000000000000')).sucesso, false);
    assert.equal(h.requests.length, 1); assert.equal(h.fetches.length, 1);
    assert.ok(!JSON.stringify(h.logs).includes('synthetic-private-provider-error'));
    assert.ok(!JSON.stringify(h.logs).includes('00000000000000'));
  }
});
test('data must come from SDK response.data, not an invented top-level success contract', async () => {
  const h = harness({reply: {sucesso: true, dados: {razao_social: 'Synthetic'}}});
  assert.equal((await h.run('00000000000000')).sucesso, false); assert.equal(h.fetches.length, 1);
});
test('existing direct BrasilAPI fallback mapping remains after backend error', async () => {
  const payload = {razao_social: 'Synthetic', cnae_fiscal: 1};
  const h = harness({failure: true, fetchReply: {ok: true, status: 200, json: async () => payload}});
  const result = await h.run('00000000000000');
  assert.equal(result.sucesso, true); assert.equal(result.fonte, 'BrasilAPI (Frontend)'); assert.equal(result.dados.razao_social, 'Synthetic');
  assert.equal(h.requests.length, 1); assert.equal(h.fetches.length, 1);
});
test('lookup stays in caller SDK function namespace, without service-role escalation or new backend/endpoint implementation', () => {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'buscarDadosCNPJ');
  const calls = [];
  function visit(n) { if (ts.isCallExpression(n) && n.expression.getText(ast).includes('base44.functions')) calls.push(n); ts.forEachChild(n, visit); }
  visit(fn); assert.equal(calls.length, 1); assert.equal(calls[0].expression.getText(ast), 'base44.functions.invoke');
  assert.equal(calls[0].arguments[0].text, 'ConsultarCNPJ'); assert.ok(!fn.getText(ast).includes('asServiceRole'));
});
test('installed SDK public function contract accepts invoke and rejects old fabricated method', () => {
  const filename = path.resolve('tests/synthetic-public-lookup-sdk.js');
  const lines = ["/** @param {import('@base44/sdk').Base44Client} client */", 'function inspect(client) {',
    "client.functions.invoke('ConsultarCNPJ',{cnpj:'00000000000000'});", "client.functions.ConsultarCNPJ({cnpj:'00000000000000'});", '}'];
  const options = {allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true};
  const host = ts.createCompilerHost(options), original = host.readFile; host.readFile = file => path.resolve(file) === filename ? lines.join('\n') : original(file);
  const errors = ts.createProgram([filename], options, host).getSemanticDiagnostics().filter(e => e.file && path.resolve(e.file.fileName) === filename);
  assert.deepEqual(errors.map(e => [e.code, e.file.getLineAndCharacterOfPosition(e.start).line]), [[2339, 3]]);
});
