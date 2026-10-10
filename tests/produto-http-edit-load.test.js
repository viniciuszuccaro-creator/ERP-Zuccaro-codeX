import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { isProdutoHttpEditReady, toProdutoHttpPayload } from '../src/components/cadastros/produto/produtoHttpPolicy.js';

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
    assert.equal(id, 'react'); return react;
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
    load: (id) => { calls.push(id); return calls.length === 1 ? Promise.reject(new Error('rede')) : Promise.resolve({ id, material: 'Aço', descricao_tecnica: 'ASTM sintético' }); },
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
  assert.deepEqual(toProdutoHttpPayload(current, { update: true }), { descricao: 'Peça sintética', material: 'Aço', descricao_tecnica: 'ASTM sintético' });
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
  second.resolve({ id: 'produto-cpa', material: 'Aço' }); await flush();
  view = hook.render({ ...props, scopeKey: 'grupo-cpa:empresa-3z' });
  assert.equal(calls, 2);
  assert.equal(view.readyId, null);
  assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), false);
  assert.deepEqual(loaded, []);
  assert.deepEqual(errors, ['falha']);
  hook.unmount();
});
