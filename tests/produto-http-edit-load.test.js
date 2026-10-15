import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { isProdutoHttpEditLoadComplete, isProdutoHttpEditReady, toProdutoHttpPayload } from '../src/components/cadastros/produto/produtoHttpPolicy.js';

const fullProduto = (id) => ({ id, descricao: 'Peça sintética', codigo: 'P-001',
  material: 'Aço', liga: null, norma_tecnica: null, descricao_tecnica: 'ASTM sintético',
  descricao_comercial: null, titulo_seo: null, descricao_seo: null, embalagem_tipo: null });

const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function mountRealLoadHook() {
  const source = await readFile(new URL('../src/components/cadastros/produto/useProdutoHttpEditLoad.js', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const state = []; const effects = []; let index = 0; const scheduled = [];
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], (value) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    },
    useEffect(effect, dependencies) {
      const slot = index++;
      const previous = effects[slot];
      if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
      previous?.cleanup?.();
      scheduled.push(() => { effects[slot] = { dependencies, cleanup: effect() }; });
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => {
    if (id === 'react') return react;
    if (id === './produtoHttpPolicy.js') return { isProdutoHttpEditLoadComplete };
    throw new Error(`Import inesperado: ${id}`);
  } });
  return {
    render(props) { index = 0; const result = exports.default(props); scheduled.splice(0).forEach((run) => run()); return result; },
    unmount() { effects.forEach((entry) => entry?.cleanup?.()); },
  };
}

test('GET real do Produto: falha, retry, carga completa, save e reabertura preservam PIM', async () => {
  const hook = await mountRealLoadHook();
  let current = { descricao: 'Peça sintética', material: '', descricao_tecnica: '' };
  const calls = [];
  const errors = [];
  const props = {
    enabled: true, produtoId: 'produto-cpa', scopeKey: 'grupo-cpa:empresa-cpa',
    isScopeCurrent: () => true,
    load: (id) => { calls.push(id); return calls.length === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(fullProduto(id)); },
    onLoaded: (row) => { current = { ...current, ...row }; },
    onError: (error) => errors.push(error.message),
  };
  let view = hook.render(props);
  await flush();
  view = hook.render(props);
  assert.equal(view.loadError, true);
  assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), false);
  assert.deepEqual(errors, ['rede']);
  view.retry();
  hook.render(props);
  await flush();
  view = hook.render(props);
  assert.equal(view.loadError, false);
  assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), true);
  assert.equal(calls.length, 2);
  const payload = toProdutoHttpPayload(current, { update: true });
  assert.equal(payload.descricao, 'Peça sintética');
  assert.equal(payload.material, 'Aço');
  assert.equal(payload.descricao_tecnica, 'ASTM sintético');
  assert.equal(hook.render({ ...props, scopeKey: 'grupo-cpa:empresa-3z', isScopeCurrent: () => false }).readyId, 'produto-cpa');
  assert.equal(hook.render({ ...props, scopeKey: 'grupo-cpa:empresa-3z', isScopeCurrent: () => false }).readyId, null);
  hook.unmount();

  const reopened = await mountRealLoadHook();
  const persisted = { ...current };
  const reopenedProps = { ...props, load: async () => persisted, onLoaded: (row) => { current = { ...row }; } };
  reopened.render(reopenedProps);
  await flush();
  assert.equal(reopened.render(reopenedProps).readyId, 'produto-cpa');
  assert.equal(current.material, 'Aço');
  reopened.unmount();
});

test('GET/retry antigo da CPA não preenche nem libera save após troca para 3Z', async () => {
  const hook = await mountRealLoadHook();
  let scopeCurrent = true;
  const first = deferred(); const second = deferred();
  const loaded = []; const errors = []; let calls = 0;
  const props = {
    enabled: true, produtoId: 'produto-cpa', scopeKey: 'grupo-cpa:empresa-cpa',
    isScopeCurrent: () => scopeCurrent,
    load: () => (++calls === 1 ? first.promise : second.promise),
    onLoaded: (row) => loaded.push(row), onError: (error) => errors.push(error.message),
  };
  hook.render(props); await flush();
  first.reject(new Error('falha')); await flush();
  let view = hook.render(props);
  assert.equal(view.loadError, true);
  view.retry(); hook.render(props); await flush();
  scopeCurrent = false;
  second.resolve(fullProduto('produto-cpa')); await flush();
  view = hook.render({ ...props, scopeKey: 'grupo-cpa:empresa-3z' });
  assert.equal(calls, 2);
  assert.equal(view.readyId, null);
  assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), false);
  assert.deepEqual(loaded, []);
  assert.deepEqual(errors, ['falha']);
  hook.unmount();
});

test('GET parcial {id} ou sem campo PIM não libera PATCH; retry completo preserva PIM', async () => {
  const hook = await mountRealLoadHook();
  const rows = [{ id: 'produto-cpa' }, { ...fullProduto('produto-cpa'), material: undefined }, fullProduto('produto-cpa')];
  const loaded = []; const errors = [];
  const props = { enabled: true, produtoId: 'produto-cpa', scopeKey: 'grupo-cpa:empresa-cpa',
    isScopeCurrent: () => true, load: async () => rows.shift(),
    onLoaded: (row) => loaded.push(row), onError: (error) => errors.push(error.message) };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let view = hook.render(props);
    await flush(); view = hook.render(props);
    assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), attempt === 2);
    if (attempt < 2) { assert.equal(view.loadError, true); view.retry(); }
  }
  assert.equal(errors.length, 2);
  assert.equal(loaded.length, 1);
  assert.equal(toProdutoHttpPayload(loaded[0], { update: true }).material, 'Aço');
  hook.unmount();
});
