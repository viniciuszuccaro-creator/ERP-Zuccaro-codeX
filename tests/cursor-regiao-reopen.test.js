import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/components/cadastros/RegiaoAtendimentoForm.jsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('region.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') callback = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
function harness(props = {}) {
  const values = { open: true, windowMode: false, dadosIniciaisProps: undefined, regiaoId: 'synthetic-a', ...props };
  let current = true, formData, loading, failed, queries = 0, errors = 0, pending;
  const prevIdRef = { current: values.dadosIniciaisProps?.id || null };
  const bindings = {
    prevIdRef, isFormScopeCurrent: () => current,
    setFormData: data => { formData = data; }, setLoading: value => { loading = value; },
    setLoadFailed: value => { failed = value; }, toast: { error: () => { errors++; } },
    getInContext: (entity, id) => {
      assert.equal(entity, 'RegiaoAtendimento'); assert.equal(id, values.regiaoId); queries++;
      return new Promise((resolve, reject) => { pending = { resolve, reject }; });
    },
  };
  return {
    run(next) {
      Object.assign(values, next);
      const env = { ...bindings, ...values };
      return new Function(...Object.keys(env), `return (${callback})();`)(...Object.values(env));
    },
    resolve: data => pending.resolve(data), reject: () => pending.reject(Error('synthetic query failure')),
    changeScope: () => { current = false; },
    state: () => ({ formData, loading, failed, queries, errors, id: prevIdRef.current }),
  };
}
test('actual region effect loads first ID-only mount and keeps dirty data on same ID', async () => {
  const h = harness(); h.run();
  assert.equal(h.state().queries, 1); assert.equal(h.state().loading, true);
  h.resolve({ id: 'synthetic-a', nome_regiao: 'Synthetic' }); await flush();
  assert.equal(h.state().id, 'synthetic-a'); assert.equal(h.state().loading, false);
  h.run(); assert.equal(h.state().queries, 1);
});
test('actual region effect supports window mode, record change and reset without writing data', async () => {
  const h = harness({ open: false, windowMode: true }); h.run();
  h.resolve({ id: 'synthetic-a', nome_regiao: 'A' }); await flush();
  h.run({ regiaoId: undefined, dadosIniciaisProps: { id: 'synthetic-b', nome_regiao: 'B' } });
  assert.equal(h.state().formData.nome_regiao, 'B');
  h.run({ dadosIniciaisProps: { id: 'synthetic-b', nome_regiao: 'Must not overwrite dirty' } });
  assert.equal(h.state().formData.nome_regiao, 'B');
  h.run({ dadosIniciaisProps: undefined }); assert.equal(h.state().formData.nome_regiao, '');
});
test('actual region effect drops responses after close, switch of record or tenant', async () => {
  for (const action of ['cleanup', 'tenant']) {
    const h = harness(), cleanup = h.run();
    if (action === 'cleanup') cleanup(); else h.changeScope();
    h.resolve({ id: 'synthetic-a', nome_regiao: 'Do not paint' }); await flush();
    assert.equal(h.state().formData, undefined); assert.equal(h.state().id, null);
  }
});
test('actual region effect fails closed on query failure, missing or wrong identity and retries on reopen', async () => {
  for (const result of [null, { id: 'synthetic-wrong', nome_regiao: 'Wrong' }, { id: 'synthetic-a' }, 'error']) {
    const h = harness(), cleanup = h.run();
    if (result === 'error') h.reject(); else h.resolve(result);
    await flush();
    assert.equal(h.state().failed, true); assert.equal(h.state().id, null);
    assert.equal(h.state().formData, undefined); assert.equal(h.state().errors, 1);
    cleanup(); h.run({ open: true }); assert.equal(h.state().queries, 2);
    h.resolve(null); await flush();
  }
  assert.match(source, /loadReady = !loading && !loadFailed && prevIdRef.current === requestedId/);
  assert.match(source, /if \(!podeSalvar \|\| !isFormScopeCurrent\(\)\)/);
  assert.doesNotMatch(source, /RegiaoAtendimento\.list\(/);
});
