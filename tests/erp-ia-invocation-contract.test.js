import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { validarPrevisaoEntregaIA, validarSugestoesProdutosIA } from '../src/components/lib/iaResponsePolicy.js';

const facade = readFileSync('src/api/base44Client.js', 'utf8');
const ast = ts.createSourceFile('facade.js', facade, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'invokeErpIa');
const body = declaration.getText(ast).replace('export async', 'async');
const build = (client, host = new EventTarget(), enabled = true) => new Function('httpHybridClient', 'window',
  'isHttpBackendMode', 'HTTP_CONTEXT_CHANGED', `${body}; return invokeErpIa;`)(client, host, enabled, 'erp-http-context-changed');
const input = { group_id: 'G', empresa_id: 'E', prompt: 'SYNTHETIC', response_json_schema: { type: 'object' } };

test('delivery response validates finite confidence/lists and preserves zero/unknown/extra IDs', () => {
  const valid = { data_prevista: '2026-10-20', confianca_percentual: 0, prazo_dias: 0, id: '0007' };
  assert.deepEqual(validarPrevisaoEntregaIA(JSON.stringify(valid)), valid);
  assert.equal('prazo_dias' in validarPrevisaoEntregaIA({ data_prevista: '2026-10-20', confianca_percentual: 1 }), false);
  for (const value of [null, {}, { ...valid, confianca_percentual: NaN }, { ...valid, confianca_percentual: 101 },
    { ...valid, fatores_risco: [{}] }, { ...valid, prazo_dias: -1 }]) assert.throws(() => validarPrevisaoEntregaIA(value), /invalida/);
});

test('facade uses existing HTTP transport and never local/remote provider fallback', async () => {
  let calls = 0;
  const client = createHttpApiClient({ baseUrl: 'https://erp.synthetic.test',
    getScope: () => ({ groupId: 'G', empresaId: 'E', actorId: 'P', token: 'synthetic-session' }),
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(new URL(url).pathname, '/api/v1/ia/invocations');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-session');
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload, { ...input, purpose: 'comercial_produtos' });
      return new Response(JSON.stringify({ data: { sugestoes: [] } }), { status: 200 });
    } });
  assert.deepEqual(await build(client)('comercial_produtos', input), { sugestoes: [] });
  await assert.rejects(build(client, new EventTarget(), false)('comercial_produtos', input), error => error.code === 'IA_ERP_API_REQUIRED');
  assert.equal(calls, 1);
});

test('context mismatch, logout/actor change and even in-place scope mutation block stale response', async () => {
  const scope = { groupId: 'G', empresaId: 'E', actorId: 'P', token: 'synthetic-session' };
  const client = createHttpApiClient({ getScope: () => scope, fetchImpl: async () => {
    scope.actorId = 'OTHER';
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  } });
  await assert.rejects(build(client)('comercial_produtos', { ...input, group_id: 'OTHER' }), error => error.code === 'IA_SCOPE_MISMATCH');
  await assert.rejects(build(client)('comercial_produtos', input), error => error.code === 'IA_STALE_CONTEXT');
});

test('A-B-A event cancels response even when scope values return; listener cleaned on every result', async () => {
  const host = new EventTarget();
  let resolve;
  let signal;
  const client = { invokeIaContextual: request => { signal = request.signal; return new Promise(done => { resolve = done; }); } };
  const pending = build(client, host)('comercial_produtos', input);
  host.dispatchEvent(new Event('erp-http-context-changed'));
  assert.equal(signal.aborted, true);
  resolve({ sugestoes: [] });
  await assert.rejects(pending, error => error.code === 'IA_STALE_CONTEXT');
  const success = await build({ invokeIaContextual: async () => ({ ok: true }) }, host)('fiscal_validacao', input);
  assert.deepEqual(success, { ok: true });
  for (const value of [null, [], false, undefined]) {
    await assert.rejects(build({ invokeIaContextual: async () => value }, host)('fiscal_validacao', input), error => error.code === 'IA_RESPONSE_INVALID');
  }
});

test('provider unavailable remains an error without success fabrication; all five callers migrated only', async () => {
  const client = createHttpApiClient({ getScope: () => ({ groupId: 'G', empresaId: 'E', actorId: 'P', token: 'synthetic-session' }),
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'IA_PROVIDER_NOT_CONFIGURED', message: 'Provider not configured' } }), { status: 503 }) });
  await assert.rejects(build(client)('entrega_previsao', input), error => error.code === 'IA_PROVIDER_NOT_CONFIGURED');
  for (const [path, purpose] of [['chatbot/IAConversacional', 'atendimento_analise'], ['chatbot/IntentEngine', 'atendimento_intencao'],
    ['comercial/Top10ProdutosCliente', 'comercial_produtos'], ['fiscal/MotorFiscalInteligente', 'fiscal_validacao'], ['logistica/IAPrevisaoEntrega', 'entrega_previsao']]) {
    const source = readFileSync(`src/components/${path}.jsx`, 'utf8');
    assert.ok(source.includes(`invokeErpIa('${purpose}', {`));
    assert.ok(!source.includes('integrations.Core.InvokeLLM('));
  }
  const conversation = readFileSync('src/components/chatbot/IAConversacional.jsx', 'utf8');
  assert.ok(!conversation.includes('intensidade: 0.5'));
  assert.match(conversation, /retry: false/);
  assert.match(conversation, /user\?\.id, groupId, empresaId/);
});

function actualCallback(path, name, environment) {
  const source = readFileSync(path, 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(expression);
  return new Function(...Object.keys(environment), `return (${expression});`)(...Object.values(environment));
}

test('actual Top10 callback discards prior client response even A-B-A within same tenant', async () => {
  let complete;
  const writes = [], iaRequestScope = { current: { key: 'A', pending: false } };
  const run = actualCallback('src/components/comercial/Top10ProdutosCliente.jsx', 'buscarSugestoesIA', {
    iaRequestScope, iaResultScope: { current: null }, podeUsarIA: true, clienteId: 'A', groupId: 'G', empresaId: 'E', scopeType: 'empresa',
    produtos: [{ id: 'P', codigo: '0007' }], pedidos: [{}], assertIaUiContext() {}, validarSugestoesProdutosIA,
    invokeErpIa: () => new Promise(resolve => { complete = resolve; }), setUsandoIA() {},
    setSugestoesIA: value => writes.push(value), toast() {}, console: { error() {} },
  });
  const pending = run();
  const count = writes.length;
  iaRequestScope.current = { key: 'B', pending: false };
  iaRequestScope.current = { key: 'A', pending: false };
  complete({ sugestoes: [{ produto_codigo: '0007', motivo_sugestao: 'Synthetic', score_confianca: 0 }] });
  await pending;
  assert.equal(writes.length, count);
});

test('actual delivery callback discards prior order response within same tenant', async () => {
  let complete;
  const writes = [], iaRequestScope = { current: { key: 'ORDER-A', pending: false } };
  const run = actualCallback('src/components/logistica/IAPrevisaoEntrega.jsx', 'calcularPrevisaoIA', {
    iaRequestScope, iaResultScope: { current: null }, groupId: 'G', empresaId: 'E', scopeType: 'empresa', pedido: { id: 'ORDER-A' }, historico: [],
    canExecutar: true, assertIaUiContext() {}, sanitizeIaPrompt: value => value, validarPrevisaoEntregaIA,
    invokeErpIa: () => new Promise(resolve => { complete = resolve; }), setCarregando() {},
    setPrevisao: value => writes.push(value), toast: { success() {}, error() {} },
  });
  const pending = run();
  iaRequestScope.current = { key: 'ORDER-B', pending: false };
  complete({ data_prevista: '2026-10-20', confianca_percentual: 0 });
  await pending;
  assert.deepEqual(writes, []);
});

test('actual identity producers replace scopes, hide old results and invalidate unmounted scope', () => {
  for (const [path, visible, result] of [
    ['src/components/comercial/Top10ProdutosCliente.jsx', 'sugestoesVisiveis', 'sugestoesIA'],
    ['src/components/logistica/IAPrevisaoEntrega.jsx', 'previsao', 'previsaoResult'],
  ]) {
    const source = readFileSync(path, 'utf8');
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
    const parts = [];
    function visit(node) {
      if (ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => ['iaIdentityKey', 'iaRequestScope', 'iaResultScope', visible].includes(decl.name.getText(tree)))) {
        parts.push(node.getText(tree)); return;
      }
      if (ts.isIfStatement(node) && node.expression.getText(tree) === 'iaRequestScope.current.key !== iaIdentityKey') {
        parts.push(node.getText(tree)); return;
      }
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(tree) === 'React.useEffect' && node.getText(tree).includes('iaRequestScope')) {
        parts.push(node.getText(tree)); return;
      }
      ts.forEachChild(node, visit);
    }
    visit(tree); assert.equal(parts.length, 6);
    const refs = []; let index = 0, effect;
    const hooks = { useRef(value) { const current = index++; return refs[current] ||= { current: value }; }, useEffect(callback) { effect = callback; } };
    const render = new Function('React', 'user', 'clienteId', 'pedido', 'groupId', 'empresaId', 'scopeType', result,
      'setSugestoesIA', 'setUsandoIA', 'setPrevisao', 'setCarregando', `${parts.join('\n')} return {scope:iaRequestScope.current,result:iaResultScope,visible:${visible}};`);
    function run(identity) {
      index = 0;
      return render(hooks, { id: 'ACTOR' }, identity, { id: identity }, 'G', 'E', 'empresa', ['old'], () => {}, () => {}, () => {}, () => {});
    }
    const first = run('A');
    first.result.current = first.scope;
    assert.deepEqual(run('A').visible, ['old']);
    const cleanup = effect(); cleanup();
    assert.equal(first.scope.active, false);
    const next = run('B');
    assert.notEqual(next.scope, first.scope);
    assert.ok(next.visible === null || next.visible.length === 0);
    assert.notEqual(run('A').scope, first.scope);
  }
});
