import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { parseA1CertificateMetadata } from '../src/api/a1CertificateContract.js';

// Reviewed synthetic-only fixtures: File bytes are NOT PKCS12, labels are NOT credentials or Auth accounts.
const expected = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222',
  actorId: '33333333-3333-4333-8333-333333333333' };
const metadata = { id: '44444444-4444-4444-8444-444444444444', fingerprint: 'a'.repeat(64),
  validFrom: '2026-01-01T00:00:00Z', validTo: '2027-01-01T00:00:00Z', state: 'ACTIVE', revision: '1', trustStoreVersion: 'SYNTHETIC' };
const input = () => ({ file: new File(['SYNTHETIC-NOT-PKCS12'], 'fixture.pfx'), password: 'synthetic-test-only',
  operationId: '55555555-5555-4555-8555-555555555555' });
const response = value => new Response(JSON.stringify(value), { status: 200 });

test('A1 envia multipart ao endpoint canonico, Bearer/tenant e CAS sem JSON ou Content-Type manual', async () => {
  const scope = { ...expected, token: 'synthetic-bearer' }, data = input();
  let captured;
  const api = createHttpApiClient({ baseUrl: '', getScope: () => scope, fetchImpl: async (url, options) => {
    assert.equal(url, '/api/v1/fiscal/certificados-a1');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-bearer');
    assert.equal(options.headers['X-Group-Id'], expected.groupId);
    assert.equal(options.headers['X-Empresa-Id'], expected.empresaId);
    assert.equal(options.headers['Content-Type'], undefined);
    assert.ok(options.body instanceof FormData);
    captured = options.body;
    assert.equal(await options.body.get('certificate').text(), 'SYNTHETIC-NOT-PKCS12');
    assert.equal(options.body.get('password'), data.password);
    assert.deepEqual(JSON.parse(options.body.get('replaces')), { id: metadata.id, revision: '1' });
    return response(metadata);
  } }).a1Certificates;
  assert.deepEqual(await api.upload(expected, { ...data, replaces: { id: metadata.id, revision: '1' } }), metadata);
  assert.deepEqual([...captured.keys()], []);
});

test('A1 nega ausencia de Bearer/contexto e uploads invalidos antes da rede', async () => {
  let calls = 0;
  for (const scope of [{}, { ...expected }, { ...expected, token: 'x', empresaId: 'other' }]) {
    const api = createHttpApiClient({ getScope: () => scope, fetchImpl: async () => { calls++; return response(metadata); } }).a1Certificates;
    await assert.rejects(api.metadata(expected), error => error.status === 401);
  }
  const api = createHttpApiClient({ getScope: () => ({ ...expected, token: 'x' }),
    fetchImpl: async () => { calls++; return response(metadata); } }).a1Certificates;
  for (const change of [{ file: new File(['x'], 'x.txt') }, { file: new File([], 'x.pfx') },
    { password: 'é'.repeat(2049) }, { operationId: 'invalid' }, { file: new File([new Uint8Array(5000001)], 'x.pfx') }]) {
    await assert.rejects(api.upload(expected, { ...input(), ...change }), error => error.status === 422);
  }
  assert.equal(calls, 0);
});

test('A1 rejeita token/tenant/actor mutados in-place enquanto aguarda resposta', async () => {
  for (const [key, value] of [['token', 'changed'], ['groupId', 'other'], ['empresaId', 'other'], ['actorId', 'other']]) {
    const scope = { ...expected, token: 'x' };
    const api = createHttpApiClient({ getScope: () => scope, fetchImpl: async () => { scope[key] = value; return response(metadata); } }).a1Certificates;
    await assert.rejects(api.metadata(expected), error => error.status === 409 && !('body' in error));
  }
});

test('A1 propaga cancelamento e erros genericos sem segredo do servidor/arquivo/senha', async () => {
  for (const status of [401, 403, 409, 503]) {
    const api = createHttpApiClient({ getScope: () => ({ ...expected, token: 'x' }), fetchImpl: async () =>
      new Response(JSON.stringify({ error: { message: 'SECRET-DO-NOT-EXPOSE' } }), { status }) }).a1Certificates;
    await assert.rejects(api.upload(expected, input()), error => error.status === status
      && !JSON.stringify(error).includes('SECRET') && !error.message.includes('SECRET') && !('body' in error));
  }
  const controller = new AbortController(); controller.abort();
  const api = createHttpApiClient({ getScope: () => ({ ...expected, token: 'x' }), fetchImpl: async (_url, options) => {
    assert.equal(options.signal, controller.signal); throw new DOMException('secret', 'AbortError');
  } }).a1Certificates;
  await assert.rejects(api.metadata(expected, { signal: controller.signal }), error => !error.message.includes('secret'));
});

test('somente metadados publicos validados entram no estado', () => {
  assert.equal(parseA1CertificateMetadata(null), null);
  assert.deepEqual(parseA1CertificateMetadata(metadata), metadata);
  for (const change of [{ password: 'private' }, { encrypted_envelope: {} }, { revision: '0' }, { state: 'REVOKED_LOCAL' },
    { validTo: 'bad' }, { validTo: metadata.validFrom }]) {
    assert.throws(() => parseA1CertificateMetadata({ ...metadata, ...change }), /invalida/);
  }
});

test('request A1 usa snapshot do contexto autenticado, nao segunda leitura para headers', async () => {
  let reads = 0;
  const api = createHttpApiClient({ getScope: () => ++reads === 1 ? { ...expected, token: 'original' }
    : { ...expected, token: 'changed', empresaId: 'other' }, fetchImpl: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer original');
    assert.equal(options.headers['X-Empresa-Id'], expected.empresaId);
    return response(metadata);
  } }).a1Certificates;
  await assert.rejects(api.metadata(expected), error => error.status === 409);
  assert.equal(reads, 2);
});

test('formulario fiscal usa validade backend e nao serializa senha/arquivo em configuracao ou novo historico', async () => {
  const path = 'src/components/fiscal/ConfigFiscalAutomatica.jsx';
  const source = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let initial, derived, mutation;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === '[fiscalFormData, setFormData]') initial = node.initializer.arguments[0].getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'formData') derived = node.initializer.getText(ast);
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'mutationFn') mutation = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(initial && derived && mutation);
  const config = { id: 'fixture', senha_certificado: 'SYNTHETIC_PASSWORD_NOT_OPERATIONAL', api_key: 'SYNTHETIC_API_KEY_NOT_OPERATIONAL', data_validade_certificado: '2000-01-01' };
  const state = new Function('config', `return (${initial});`)(config);
  assert.equal(Object.hasOwn(state, 'senha_certificado'), false);
  assert.equal(Object.hasOwn(state, 'arquivo_certificado'), false);
  const formData = new Function('fiscalFormData', 'certificate', `return (${derived});`)(state, metadata);
  assert.equal(formData.data_validade_certificado, metadata.validTo);
  const exports = {};
  new Function('exports', ts.transpileModule(readFileSync('src/components/lib/sanitizeOnWrite.jsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exports);
  let saved;
  const env = { formData, certificate: metadata, certificateQuery: { isSuccess: true, isFetching: false },
    config, empresaId: expected.empresaId, groupId: expected.groupId, empresa: {}, sanitizeAuditPayload: exports.sanitizeAuditPayload,
    base44: { entities: { ConfigFiscalEmpresa: { update: async (_id, data) => { saved = data; return { id: 'fixture' }; } } } } };
  const run = new Function(...Object.keys(env), `return (${mutation});`)(...Object.values(env));
  await run();
  assert.equal(Object.hasOwn(saved, 'senha_certificado'), false);
  assert.equal(Object.hasOwn(saved, 'arquivo_certificado'), false);
  const history = JSON.stringify(saved.historico_alteracoes.at(-1));
  assert.equal(history.includes('SYNTHETIC_PASSWORD_NOT_OPERATIONAL'), false);
  assert.equal(history.includes('SYNTHETIC_API_KEY_NOT_OPERATIONAL'), false);
});

function panelUpload(env) {
  const path = 'src/components/fiscal/CertificadoA1Panel.jsx';
  const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let fn;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'upload') fn = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(fn);
  return new Function(...Object.keys(env), `${fn}; return upload;`)(...Object.values(env));
}

test('callback real do painel: duplo clique, commit antes refresh, falha e limpeza de campos', async () => {
  for (const reject of [false, true]) {
    const file = { current: { files: [input().file], value: 'fixture.pfx' } }, password = { current: { value: 'synthetic-only' } };
    const busy = { current: false }, alive = { current: true }, operation = { current: null };
    let finish, calls = 0, refreshed = 0;
    const errors = [];
    const run = panelUpload({ file, password, busy, alive, operation, allowed: true, ready: true,
      scope: expected, metadata, setPending() {}, setError: value => errors.push(value), crypto,
      onUploaded: async () => { refreshed++; }, a1CertificateApi: { upload: async () => { calls++; await new Promise(resolve => { finish = resolve; });
        if (reject) throw Error('SECRET'); return metadata; } } });
    const pending = run(); await run();
    assert.equal(calls, 1); assert.equal(refreshed, 0);
    finish(); await pending;
    assert.equal(refreshed, reject ? 0 : 1);
    assert.equal(file.current.value, ''); assert.equal(password.current.value, '');
    assert.equal(busy.current, false); assert.equal(operation.current, null);
    assert.equal(errors.some(value => value.includes('SECRET')), false);
  }
});
