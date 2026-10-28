import { portalReadRemainder } from './helpers/portalReadRemainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';
import { isHttpApiError, readHttpErrorBodyCode } from '../src/api/httpApiClient.js';
import { growCentral360BlockLimit, INITIAL_CENTRAL360_BLOCK_LIMITS } from '../src/components/comercial/centralCliente360Pagination.js';
import { readBoundaryHunks, readBoundaryRemainder } from './helpers/readBoundaryRemainder.js';

const read = file => portalReadRemainder(file, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
const parse = (file, source = read(file)) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function nodes(ast, predicate) {
  const out = []; const visit = node => { if (predicate(node)) out.push(node); ts.forEachChild(node, visit); };
  visit(ast); return out;
}
const bind = (text, env) => new Function(...Object.keys(env), `return (${text});`)(...Object.values(env));
const hashes = {
  'src/lib/utils.js': '4f592359765d69c32c3617700fa111af9a6a9cac8f18cb1987c25503a343c203',
  'src/components/chatbot/ChatbotFilaEspera.jsx': '7604bbea158ca7869022b1669f5b41bd4fe79d79edd989abec3d5575e9f7911f',
  'src/pages/OrcamentoSite.jsx': 'cd58f224d9fd5322b6a172dfa0ca4a0e9ce8172bdf3eaafdd37e94c46d9d3cf4',
  'src/components/lib/UserContext.jsx': '82b878e87f47c26ba13828c4ff91cc18156367c3eb8064220a8c302fdab6ffc2',
  // #397: create path Novo orçamento/pedido (hash atualizado de propósito; hunks read-boundary intactos).
  'src/components/comercial/CentralCliente360Panel.jsx': '60938489876851fb8128f899ac2c8a3d6dab863473b9424f4062ed06b6891744',
  'src/components/comercial/centralCliente360Pagination.js': '7b145f34bb94590472286238105fa619912c24cf7653f9467d4a728f2829fcc7',
  'src/components/lib/useOrigemPedido.jsx': '70d8f7b0fb44893989359e3d1b7cc527cc33ea80731de52fb64a805587bdba0e',
};
for (const [file, expected] of Object.entries(hashes)) test(`${file}: whole stage51 source retained outside exact read-boundary hunks`, () => {
  const digest = text => createHash('sha256').update(text).digest('hex');
  assert.equal(digest(readBoundaryRemainder(file, read(file))), expected);
  const [current, previous] = readBoundaryHunks[file][0];
  assert.throws(() => readBoundaryRemainder(file, read(file).replace(current, previous)));
  assert.throws(() => readBoundaryRemainder(file, read(file).replace(current, current + '\n' + current)));
  assert.notEqual(digest(readBoundaryRemainder(file, '// unintended edit\n' + read(file))), expected);
});

const utility = parse('src/lib/utils.js');
const scalarDeclaration = utility.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'displayScalar');
const displayScalar = bind(scalarDeclaration.getText(utility).replace('export ', ''), {});
test('actual shared scalar boundary retains textual/numeric values and rejects objects without calling coercion hooks', () => {
  for (const value of ['', '000001', 'Synthetic label', 0, 12.5, -1]) assert.equal(displayScalar(value), value);
  const coercion = { toString() { throw Error('Must never coerce'); }, [Symbol.toPrimitive]() { throw Error('Must never coerce'); } };
  for (const value of [undefined, null, true, false, {}, [], coercion, Symbol('synthetic'), 1n, NaN, Infinity, -Infinity]) assert.equal(displayScalar(value), null);
  assert.equal(renderToStaticMarkup(React.createElement('span', null, displayScalar('<script>synthetic</script>'))), '<span>&lt;script&gt;synthetic&lt;/script&gt;</span>');
});

for (const [file, object, field, fallback] of [
  ['src/components/chatbot/ChatbotFilaEspera.jsx', 'conversa', 'cliente_nome', 'Cliente Anônimo'],
  ['src/components/chatbot/ChatbotFilaEspera.jsx', 'conversa', 'prioridade', 'Normal'],
  ['src/components/chatbot/ChatbotFilaEspera.jsx', 'conversa', 'canal', ''],
  ['src/components/chatbot/ChatbotFilaEspera.jsx', 'conversa', 'status', ''],
  ['src/components/chatbot/ChatbotFilaEspera.jsx', 'conversa', 'sentimento_geral', ''],
  ['src/pages/OrcamentoSite.jsx', 'p', 'descricao', ''],
  ['src/pages/OrcamentoSite.jsx', 'p', 'codigo', ''],
]) test(`${object}.${field}: actual JSX object counterproof fails before and renders safely after`, () => {
  const afterTree = parse(file), beforeTree = parse(file, readBoundaryRemainder(file, read(file)));
  const matches = (ast, expression) => nodes(ast, node => ts.isJsxExpression(node) && node.expression
    && node.expression.getText(ast).startsWith(expression) && !node.expression.getText(ast).includes('&&'))[0].expression.getText(ast);
  const before = matches(beforeTree, `${object}.${field}`), after = matches(afterTree, `displayScalar(${object}.${field})`);
  const input = { [field]: { synthetic: true } };
  assert.throws(() => renderToStaticMarkup(React.createElement('span', null, bind(before, { [object]: input }))), /Objects are not valid/);
  assert.equal(renderToStaticMarkup(React.createElement('span', null, bind(after, { [object]: input, displayScalar }))), `<span>${fallback}</span>`);
  for (const value of ['Synthetic label', 10]) {
    assert.equal(bind(after, { [object]: { [field]: value }, displayScalar }), bind(before, { [object]: { [field]: value } }));
  }
});

test('site code retains leading zeros and falls back to actual textual slug when code has unsupported shape', () => {
  const ast = parse('src/pages/OrcamentoSite.jsx');
  const expression = nodes(ast, node => ts.isJsxExpression(node) && node.expression?.getText(ast).startsWith('displayScalar(p.codigo)'))[0].expression.getText(ast);
  assert.equal(bind(expression, { p: { codigo: '000012', slug_site: 'synthetic-slug' }, displayScalar }), '000012');
  assert.equal(bind(expression, { p: { codigo: {}, slug_site: 'synthetic-slug' }, displayScalar }), 'synthetic-slug');
  assert.equal(bind(expression, { p: { codigo: {}, slug_site: {} }, displayScalar }), '');
});

async function boot({ session = null, user = null, refreshError = null, mirrorError = null } = {}) {
  const file = 'src/components/lib/UserContext.jsx', ast = parse(file), calls = [];
  const declaration = nodes(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === 'resolveBootUser')[0];
  const expression = declaration.initializer.getText(ast).replace("import('@/api/erpHttpSession')", 'Promise.resolve(sessionModule)');
  const env = {
    isHttpBackendMode: true, isApiKeyMode: false, isLocalOnlyMode: false, localApiUser: null, base44: {},
    console: { warn: () => calls.push('warn') },
    sessionModule: {
      refreshErpHttpSessionFromServer: async () => { calls.push('refresh'); if (refreshError) throw refreshError; return session; },
      ensureHttpTenantLocalMirror: async () => { calls.push('mirror'); if (mirrorError) throw mirrorError; },
      buildHttpSessionUser: () => { calls.push('user'); return user; },
    },
  };
  return { run: bind(expression, env), calls };
}
for (const scenario of ['no-session', 'missing-token', 'invalid-user']) test(`actual HTTP boot/${scenario}: same Error and enumerable 401/auth_required contract without fallback`, async () => {
  const h = await boot({ session: scenario === 'no-session' ? null : scenario === 'missing-token' ? {} : { token: 'synthetic' } });
  await assert.rejects(h.run(), error => {
    assert.ok(error instanceof Error); assert.equal(error.message, 'Authentication required');
    assert.equal(error.status, 401); assert.equal(error.authType, 'auth_required');
    assert.deepEqual(Object.keys(error).sort(), ['authType', 'status']); return true;
  });
  if (scenario !== 'invalid-user') assert.deepEqual(h.calls, ['refresh']);
});
test('actual HTTP boot preserves valid server user and refresh failures; mirror warning behavior unchanged', async () => {
  const user = { id: 'synthetic-user' }, session = { token: 'synthetic', actorId: user.id };
  const h = await boot({ user, session }); assert.equal(await h.run(), user); assert.deepEqual(h.calls, ['refresh', 'mirror', 'user']);
  const failure = Error('Synthetic refresh failure'), failed = await boot({ refreshError: failure });
  await assert.rejects(failed.run(), error => error === failure); assert.deepEqual(failed.calls, ['refresh']);
  const warned = await boot({ user, session, mirrorError: Error('Synthetic mirror failure') });
  assert.equal(await warned.run(), user); assert.deepEqual(warned.calls, ['refresh', 'mirror', 'warn', 'user']);
});

test('Central uses existing HTTP error guards: canonical status/code survive; untrusted object metadata is not rendered', () => {
  const ast = parse('src/components/comercial/CentralCliente360Panel.jsx');
  const declaration = key => nodes(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === key
    && node.initializer?.getText(ast).includes('isHttpApiError(query.error)'))[0].initializer.getText(ast);
  const evaluate = error => Object.fromEntries(['status', 'code'].map(key => [key, bind(declaration(key), { query: { error }, isHttpApiError, readHttpErrorBodyCode })]));
  for (const status of [401, 403, 404, 409, 503]) {
    const error = Object.assign(Error('Synthetic error'), { name: 'HttpApiError', status, code: 'SYNTHETIC_CODE' });
    assert.deepEqual(evaluate(error), { status, code: 'SYNTHETIC_CODE' });
  }
  const fallback = Object.assign(Error('Synthetic error'), { name: 'HttpApiError', status: 422, code: '', body: { error: { code: 'SYNTHETIC_BODY_CODE', unrelated: 'must-not-render' } } });
  assert.equal(evaluate(fallback).code, 'SYNTHETIC_BODY_CODE');
  for (const error of [Error('Synthetic generic'), { status: 403, code: {} }, Object.assign(Error('Synthetic error'), { name: 'HttpApiError', status: 403, code: { synthetic: true } })]) assert.deepEqual(evaluate(error), { status: undefined, code: undefined });
});

test('pagination retains six numeric block keys, immutable grow and old dynamic-key behavior', () => {
  const initial = { ...INITIAL_CENTRAL360_BLOCK_LIMITS };
  const grown = growCentral360BlockLimit(initial, 'crm');
  assert.equal(grown.crm, 10); assert.equal(initial.crm, 5);
  for (const field of ['empresas', 'locais', 'obras', 'orcamentos', 'pedidos']) assert.equal(grown[field], initial[field]);
  assert.equal(growCentral360BlockLimit(initial, 'synthetic-extra', 3)['synthetic-extra'], 6);
});
test('actual TypeScript checks preserve concrete numeric pagination shape without a cast', () => {
  const file = path.resolve('__read_boundary_virtual.ts');
  function diagnostics(wrong = false) {
    const content = `import {growCentral360BlockLimit} from './src/components/comercial/centralCliente360Pagination.js';\nconst value=growCentral360BlockLimit({crm:5,empresas:5,locais:5,obras:5,orcamentos:5,pedidos:5},'crm');\nconst result: {crm:number,empresas:number,locais:number,obras:number,orcamentos:number,pedidos:number}=value;\n${wrong ? 'const wrong:string=value.crm;' : 'void result;'}`;
    const options = { allowJs: true, checkJs: true, noEmit: true, strict: true, types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
    const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
    host.getSourceFile = (name, version, ...rest) => path.resolve(name) === file ? ts.createSourceFile(name, content, version, true) : original(name, version, ...rest);
    return ts.getPreEmitDiagnostics(ts.createProgram([file], options, host));
  }
  assert.deepEqual(diagnostics().map(error => error.code), []);
  assert.deepEqual(diagnostics(true).map(error => error.code), [2322]);
});

test('installed QueryClient: actual origin query has ten-minute gcTime, not ignored cacheTime; query/URL logic otherwise frozen', () => {
  const file = 'src/components/lib/useOrigemPedido.jsx', ast = parse(file);
  const query = nodes(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useQuery')[0];
  const options = bind(query.arguments[0].getText(ast), { base44: { entities: { ParametroOrigemPedido: { list: () => [] } } } });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 300000 } } });
  try {
    const legacy = { ...options, queryKey: ['synthetic-legacy'], cacheTime: options.gcTime }; delete legacy.gcTime;
    assert.equal(client.getQueryCache().build(client, legacy).gcTime, 300000);
    assert.equal(client.getQueryCache().build(client, options).gcTime, 600000);
    assert.equal(options.staleTime, 300000); assert.deepEqual(options.initialData, []);
  } finally { client.clear(); }
});
