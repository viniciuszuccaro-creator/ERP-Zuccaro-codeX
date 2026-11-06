import test from 'node:test';
import {validarSugestaoNcmConsultaIA, validarSugestaoRntrcConsultaIA} from '../src/components/lib/iaResponsePolicy.js';
import {publicLookupTransportRemainder} from './helpers/publicLookupTransportRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const file = 'src/components/lib/BuscaDadosPublicos.jsx';
const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const loggingHunks = [
  ["console.log('🔍 [Frontend] Iniciando busca CNPJ');", "console.log('🔍 [Frontend] Iniciando busca CNPJ:', cnpjLimpo);"],
  ["console.error('❌ [Frontend] CNPJ inválido');", "console.error('❌ [Frontend] CNPJ inválido:', cnpjLimpo);"],
  ["console.log('📦 [Frontend] Backend retornou');", "console.log('📦 [Frontend] Backend retornou:', resultado);"],
  ["console.log('✅ [Frontend] Backend SUCESSO');", "console.log('✅ [Frontend] Backend SUCESSO:', resultado.dados?.razao_social);"],
  ["console.warn('⚠️ [Frontend] Backend sem sucesso');", "console.warn('⚠️ [Frontend] Backend sem sucesso:', resultado.erro);"],
  ["console.warn('⚠️ [Frontend] Backend não disponível');", "console.warn('⚠️ [Frontend] Backend não disponível:', error.message);"],
  ["console.log('✅ [Frontend] BrasilAPI SUCESSO');", "console.log('✅ [Frontend] BrasilAPI SUCESSO:', dados.razao_social);"],
  ["console.error('❌ [Frontend] BrasilAPI falhou');", "console.error('❌ [Frontend] BrasilAPI falhou:', error.message);"],
  ["console.warn('Não foi possível obter coordenadas GPS');", "console.warn('Não foi possível obter coordenadas GPS:', erroGPS);"],
];
function remainder(text) {
  text = publicLookupTransportRemainder(file, text);
  assert.equal(text.split('@returns {Promise<object>}').length - 1, 5);
  let result = text.replaceAll('@returns {Promise<object>}', '@returns {object}');
  for (const [current, previous] of loggingHunks) {
    assert.equal(result.split(current).length - 1, 1);
    result = result.replace(current, previous);
  }
  return result;
}
const before = remainder(source);
test('complete stage57 source remains outside exactly five Promise annotations and nine logging hunks', () => {
  const hash = text => crypto.createHash('sha256').update(text).digest('hex');
  assert.equal(hash(before), '64297bf7b2493891a74487b4347d241082f7ca9ba8e0529d232f4bdc633ca63f');
  for (const [current] of loggingHunks) {
    assert.throws(() => remainder(source.replace(current, '')));
    assert.throws(() => remainder(source.replace(current, current + current)));
  }
  assert.throws(() => remainder(source.replace('@returns {Promise<object>}', '@returns {object}')));
  assert.notEqual(hash(remainder('// unrelated edit\n' + source)), hash(before));
});
function bind(name, deps, text = source) {
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn, name);
  return new Function(...Object.keys(deps), `return (${fn.getText(tree).replace(/^export /, '')});`)(...Object.values(deps));
}
function harness(name, { backend, fetch, llm, text } = {}) {
  const logs = [], calls = [];
  const deps = {
    validarSugestaoNcmConsultaIA, validarSugestaoRntrcConsultaIA,
    console: Object.fromEntries(['log', 'warn', 'error'].map(level => [level, (...args) => logs.push([level, ...args])])),
    fetch: async (...args) => { calls.push(['fetch', ...args]); if (!fetch) throw Error('synthetic external access forbidden'); return fetch(...args); },
    base44: { functions: {
      ConsultarCNPJ: async (...args) => { calls.push(['legacy-backend', ...args]); if (!backend) throw Error('synthetic backend unavailable'); return backend(...args); },
      invoke: async (name, payload) => { assert.equal(name, 'ConsultarCNPJ'); calls.push(['invoke', name, payload]); if (!backend) throw Error('synthetic backend unavailable'); return {data: await backend(payload)}; },
    }, integrations: { Core: { InvokeLLM: async (...args) => { calls.push(['llm', ...args]); if (!llm) throw Error('synthetic offline'); return llm(...args); } } } },
  };
  return { run: bind(name, deps, text), logs, calls };
}

for (const [name, input] of [
  ['buscarDadosCNPJ', '123'], ['buscarDadosCPF', '00000000000'], ['buscarEnderecoCEP', 'bad'],
  ['buscarDadosNCM', 'bad'], ['buscarDadosRNTRC', 'synthetic'],
]) test(`${name}: actual async API returns a Promise and preserves offline failure result`, async () => {
  const a = harness(name), b = harness(name, { text: before });
  const result = a.run(input); assert.ok(result instanceof Promise);
  const current = await result, old = await b.run(input);
  if (name === 'buscarDadosRNTRC') {
    assert.equal(old.sucesso, false);
    assert.equal(current.erro, 'Nao foi possivel obter uma sugestao RNTRC valida.');
  } else assert.deepEqual(current, old);
  assert.equal(current.sucesso, false);
  assert.equal(a.calls.filter(call => call[0] === 'fetch').length, 0);
});

test('counterproof: legacy successful CNPJ branch logged raw result and name; current branch returns same identity without payload logging', async () => {
  const marker = 'synthetic-private-provider-marker';
  const result = { sucesso: true, dados: { razao_social: marker }, token: marker };
  const old = harness('buscarDadosCNPJ', { text: before, backend: async () => result });
  assert.equal(await old.run('00000000000000'), result);
  assert.ok(JSON.stringify(old.logs).includes(marker));
  const current = harness('buscarDadosCNPJ', { backend: async () => result });
  assert.equal(await current.run('00000000000000'), result);
  assert.ok(!JSON.stringify(current.logs).includes(marker));
  assert.ok(!JSON.stringify(current.logs).includes('00000000000000'));
  assert.equal(current.calls.filter(call => call[0] === 'fetch').length, 0);
});

test('invalid CNPJ log contains no input while validation result remains unchanged', async () => {
  const old = harness('buscarDadosCNPJ', { text: before }), current = harness('buscarDadosCNPJ');
  assert.deepEqual(await old.run('1234567'), await current.run('1234567'));
  assert.ok(JSON.stringify(old.logs).includes('1234567')); assert.ok(!JSON.stringify(current.logs).includes('1234567'));
  assert.deepEqual(current.calls, []);
});

test('backend and fetch errors do not leak exception messages, identifiers or provider bodies to console', async () => {
  const marker = 'synthetic-private-error-marker';
  const h = harness('buscarDadosCNPJ', { backend: async () => { throw Error(marker); }, fetch: async () => { throw Error(marker); } });
  assert.equal((await h.run('00000000000000')).sucesso, false);
  assert.ok(!JSON.stringify(h.logs).includes(marker)); assert.ok(!JSON.stringify(h.logs).includes('00000000000000'));
  assert.deepEqual(h.calls.map(call => call[0]), ['invoke', 'fetch']);
});

test('BrasilAPI fallback mapping, defaults and numeric HTTP status log remain unchanged without company logging', async () => {
  const marker = 'synthetic-private-company';
  const payload = { razao_social: marker, cnae_fiscal: 12, capital_social: 20, logradouro: 'Synthetic' };
  const config = { backend: async () => ({ sucesso: false, erro: 'synthetic-private-reason' }), fetch: async () => ({ status: 200, ok: true, json: async () => payload }) };
  const current = harness('buscarDadosCNPJ', config), old = harness('buscarDadosCNPJ', { ...config, text: before });
  assert.deepEqual(await current.run('00000000000000'), await old.run('00000000000000'));
  assert.ok(!JSON.stringify(current.logs).includes(marker)); assert.ok(!JSON.stringify(current.logs).includes('synthetic-private-reason'));
  assert.ok(current.logs.some(row => row.at(-1) === 200));
});

test('GPS failure keeps address result and null coordinates without logging raw exception', async () => {
  const marker = 'synthetic-private-gps-error';
  function config() { let calls = 0; return { fetch: async () => { if (++calls === 2) throw Error(marker); return { ok: true, json: async () => ({ logradouro: 'Synthetic', bairro: 'Synthetic', localidade: 'Synthetic', uf: 'XX' }) }; } }; }
  const h = harness('buscarEnderecoCEP', config()), old = harness('buscarEnderecoCEP', { ...config(), text: before });
  const result = await h.run('00000000'); assert.deepEqual(result, await old.run('00000000'));
  assert.equal(result.sucesso, true); assert.equal(result.dados.latitude, null); assert.equal(result.dados.longitude, null);
  assert.ok(!JSON.stringify(h.logs).includes(marker)); assert.equal(h.logs.length, 1);
});

test('all remaining console arguments are fixed messages and the existing numeric response status only', () => {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let logs = 0, statuses = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && /^console\.(log|warn|error)$/.test(node.expression.getText(tree))) {
      logs++; assert.ok(ts.isStringLiteral(node.arguments[0]));
      if (node.arguments.length === 2) { statuses++; assert.equal(node.arguments[1].getText(tree), 'response.status'); }
      else assert.equal(node.arguments.length, 1);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.equal(logs, 14); assert.equal(statuses, 1);
});

test('five actual async declarations compile Promise consumers and reject synchronous-result access and numeric inputs', () => {
  const filename = path.resolve('tests/synthetic-public-lookups.js');
  const names = ['buscarDadosCNPJ', 'buscarDadosCPF', 'buscarEnderecoCEP', 'buscarDadosNCM', 'buscarDadosRNTRC'];
  const lines = [`import {${names.join(',')}} from '../src/components/lib/BuscaDadosPublicos';`];
  for (const [index, name] of names.entries()) lines.push(`const result${index}=${name}('synthetic'); result${index}.then(value=>value);`);
  const negatives = [];
  for (const [index, name] of names.entries()) {
    negatives.push(lines.length); lines.push(`result${index}.sucesso;`);
    negatives.push(lines.length); lines.push(`${name}(123);`);
  }
  const options = { allowJs: true, checkJs: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, baseUrl: process.cwd(), paths: { '@/*': ['./src/*'] } };
  const host = ts.createCompilerHost(options), original = host.readFile; host.readFile = file => path.resolve(file) === filename ? lines.join('\n') : original(file);
  const errors = ts.createProgram([filename], options, host).getSemanticDiagnostics().filter(error => error.file && path.resolve(error.file.fileName) === filename);
  assert.deepEqual(errors.map(error => error.file.getLineAndCharacterOfPosition(error.start).line), negatives, JSON.stringify(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))));
});
