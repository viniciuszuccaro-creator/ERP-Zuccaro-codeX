import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { httpMirrorAnnotationRemainder } from './helpers/httpMirrorAnnotationRemainder.js';
import {consolidation81Remainder, clienteConferenciaRemainder} from './helpers/consolidation81Remainder.js';
import { createHttpApiClient, isHttpApiError, readHttpErrorBodyCode } from '../src/api/httpApiClient.js';
import { validarSugestoesProdutosIA, validarRespostaFiscalIA } from '../src/components/lib/iaResponsePolicy.js';
import { validarAnaliseAtendimentoIA, validarIntentAtendimentoIA } from '../src/components/lib/atendimentoIaResponsePolicy.js';

const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const head = path => execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${path}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
function declaration(source, name) {
  const tree = ts.createSourceFile('contract.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) result = node.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(result, `Missing existing contract ${name}`);
  return result;
}

test('remote Expedicao CRM and Central HTTP contracts retain emitted behavior', () => {
  const path = 'src/api/httpApiClient.js';
  for (const name of ['expedicao', 'oportunidades', 'clientes', 'entityRoutes', 'pedidos', 'orcamentos']) {
    const emit = text => ts.transpileModule(`const ${text};`, { compilerOptions: { target: ts.ScriptTarget.ESNext, removeComments: true } }).outputText;
    assert.equal(emit(declaration(clienteConferenciaRemainder(path,read(path)), name)), emit(declaration(head(path), name)));
  }
  const facade = 'src/api/base44Client.js';
  for (const name of ['isHttpExpedicaoEnabled', 'isHttpExpedicaoMode']) {
    assert.equal(declaration(read(facade), name), declaration(head(facade), name));
  }
  assert.equal(httpMirrorAnnotationRemainder(read('src/api/localBase44Client.js')), head('src/api/localBase44Client.js'));
});

test('existing Base44 facade statements and imports remain intact outside new IA entry', () => {
  const path = 'src/api/base44Client.js';
  function existing(source) {
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports = [], statements = [];
    for (const node of tree.statements) {
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier.text !== './erpHttpSession.js') imports.push(node.getText(tree));
      } else if (!(ts.isFunctionDeclaration(node) && node.name?.text === 'invokeErpIa')) {
        statements.push(ts.transpileModule(node.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText);
      }
    }
    return { imports, statements };
  }
  assert.deepEqual(existing(consolidation81Remainder(path,read(path))), existing(head(path)));
});

test('operational router app and migration executor remain unchanged', () => {
  for (const path of ['server/src/app.ts', 'server/src/api/router.ts']) assert.equal(clienteConferenciaRemainder(path, read(path)), head(path));
  assert.ok(!read('server/src/api/router.ts').includes('mountIaContextualRoutes'));
});

const scope = () => ({ groupId: 'SYNTHETIC-GROUP', empresaId: 'SYNTHETIC-COMPANY', actorId: 'SYNTHETIC-ACTOR', token: 'synthetic-session' });
const input = { purpose: 'fiscal_validacao', prompt: 'SYNTHETIC', group_id: 'SYNTHETIC-GROUP', empresa_id: 'SYNTHETIC-COMPANY' };

test('IA transport snapshots primitive tenant and token before request dispatch', async () => {
  let reads = 0;
  const expected = scope();
  const client = createHttpApiClient({ getScope: () => ++reads === 1 ? expected : { ...expected, groupId: 'OTHER' },
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers['X-Group-Id'], expected.groupId);
      assert.equal(init.headers.Authorization, 'Bearer synthetic-session');
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    } });
  await assert.rejects(client.invokeIaContextual(input), error => error.code === 'IA_STALE_CONTEXT');
});

test('IA late success and failure after token rotation never release prior context', async () => {
  for (const status of [200, 503]) {
    const current = scope();
    const client = createHttpApiClient({ getScope: () => current, fetchImpl: async () => {
      current.token = 'synthetic-rotated-session';
      return new Response(JSON.stringify({ data: {}, error: { code: 'IA_PROVIDER_UNAVAILABLE', message: 'SYNTHETIC_PRIVATE_DETAIL' } }), { status });
    } });
    await assert.rejects(client.invokeIaContextual(input), error => error.code === 'IA_STALE_CONTEXT' && !JSON.stringify(error).includes('SYNTHETIC_PRIVATE_DETAIL'));
  }
});

test('IA provider error retains status and code without raw body or private detail', async () => {
  const client = createHttpApiClient({ getScope: scope, fetchImpl: async () => new Response(JSON.stringify({
    error: { code: 'IA_PROVIDER_NOT_CONFIGURED', message: 'SYNTHETIC_PRIVATE_DETAIL' }, raw: 'SYNTHETIC_PRIVATE_DETAIL',
  }), { status: 503 }) });
  await assert.rejects(client.invokeIaContextual(input), error => isHttpApiError(error)
    && error.status === 503 && error.code === 'IA_PROVIDER_NOT_CONFIGURED'
    && !String(error).includes('SYNTHETIC_PRIVATE_DETAIL') && !JSON.stringify(error).includes('SYNTHETIC_PRIVATE_DETAIL'));
});

test('IA missing auth mismatched scope and pre-abort do not send requests', async () => {
  let calls = 0;
  const client = createHttpApiClient({ getScope: () => ({}), fetchImpl: async () => { calls++; assert.fail('No request allowed'); } });
  await assert.rejects(client.invokeIaContextual(input), error => error.code === 'AUTH_REQUIRED');
  const authenticated = createHttpApiClient({ getScope: scope, fetchImpl: async () => { calls++; assert.fail('No request allowed'); } });
  await assert.rejects(authenticated.invokeIaContextual({ ...input, empresa_id: 'OTHER' }), error => error.code === 'IA_SCOPE_MISMATCH');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(authenticated.invokeIaContextual({ ...input, signal: controller.signal }), error => error.code === 'IA_STALE_CONTEXT');
  assert.equal(calls, 0);
});

test('shared HTTP error readers never coerce untrusted error codes', () => {
  for (const value of [null, 'secret', [], { error: null }, { error: { code: 42 } }, { error: { code: {} } }]) {
    assert.equal(readHttpErrorBodyCode(value), undefined);
  }
  assert.equal(readHttpErrorBodyCode({ error: { code: 'EXPECTED' } }), 'EXPECTED');
  assert.equal(isHttpApiError({ name: 'HttpApiError', status: 403, code: 'DENIED' }), false);
});

test('IA schemas preserve exact IDs zero unknown fields and reject ambiguous suggestions', () => {
  const response = { sugestoes: [{ produto_codigo: '0007', motivo_sugestao: 'Synthetic', score_confianca: 0 }], extra: 'preserved' };
  assert.deepEqual(validarSugestoesProdutosIA(JSON.stringify(response), [{ codigo: '0007' }]), response);
  for (const products of [[{ codigo: 7 }], [{ codigo: '0007' }, { codigo: '0007' }], []]) {
    assert.throws(() => validarSugestoesProdutosIA(response, products), /invalida/);
  }
  assert.throws(() => validarSugestoesProdutosIA({ sugestoes: [...response.sugestoes, ...response.sugestoes] }, [{ codigo: '0007' }]), /invalida/);
  assert.deepEqual(validarRespostaFiscalIA({ valido: false, alertas: [], id: '0007' }), { valido: false, alertas: [], id: '0007' });
  assert.deepEqual(validarIntentAtendimentoIA({ intent: 'synthetic', confianca: 0, necessita_atendente: false }), { intent: 'synthetic', confianca: 0, necessita_atendente: false });
  assert.deepEqual(validarAnaliseAtendimentoIA({ sentimento: { intensidade: 0 }, oportunidade_venda: { valor_estimado: 0 } }), { sentimento: { intensidade: 0 }, oportunidade_venda: { valor_estimado: 0 } });
  for (const validate of [validarRespostaFiscalIA, validarAnaliseAtendimentoIA, validarIntentAtendimentoIA]) {
    for (const value of [null, [], false, 'SYNTHETIC_INVALID']) assert.throws(() => validate(value), /invalida/);
  }
});
