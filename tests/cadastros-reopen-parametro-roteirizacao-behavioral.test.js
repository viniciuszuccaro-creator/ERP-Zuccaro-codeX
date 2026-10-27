import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

async function mountForm(relPath, { initial }) {
  const formSource = await readFile(new URL(`../${relPath}`, import.meta.url), 'utf8');
  const hookSource = await readFile(new URL('../src/components/cadastros/useCadastroReopenOnIdentity.js', import.meta.url), 'utf8');
  const compile = (source) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  const state = [];
  const effects = [];
  const scheduled = [];
  let slot = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initialValue) {
      const i = slot++;
      if (!(i in state)) state[i] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
    },
    useRef(initialValue) {
      const i = slot++;
      if (!(i in state)) state[i] = { current: initialValue };
      return state[i];
    },
    useCallback(fn) { return fn; },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) {
      const i = slot++;
      const prev = effects[i];
      if (prev && deps && prev.deps && deps.every((v, k) => Object.is(v, prev.deps[k]))) return;
      prev?.cleanup?.();
      scheduled.push(() => { effects[i] = { deps, cleanup: fn() }; });
    },
  };

  let props = { item: initial, onSubmit: () => {} };
  const confirms = [];
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    window: {
      confirm(message) {
        confirms.push(message);
        return sandbox.__confirmResult !== false;
      },
      alert() {},
    },
    __confirmResult: true,
    __modules: {},
  };

  const hookExports = {};
  sandbox.exports = hookExports;
  sandbox.module = { exports: hookExports };
  sandbox.__modules = {
    react: { __esModule: true, default: react, ...react },
    './cadastroReopenPolicy': policy,
    './cadastroReopenPolicy.js': policy,
  };
  vm.runInNewContext(compile(hookSource), sandbox);
  const hookFn = hookExports.default || hookExports;

  const formExports = {};
  sandbox.exports = formExports;
  sandbox.module = { exports: formExports };
  sandbox.__modules = {
    react: { __esModule: true, default: react, ...react },
    '@/components/ui/input': { Input: 'Input' },
    '@/components/ui/label': { Label: 'Label' },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/switch': { Switch: 'Switch' },
    '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({ canCreate: () => true, canEdit: () => true, hasPermission: () => true }),
    },
    '@/components/lib/useContextoVisual': {
      useContextoVisual: () => ({
        empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
        grupoAtual: { id: 'grp-1' },
        contexto: 'empresa',
      }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': { __esModule: true, default: hookFn },
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
  };
  vm.runInNewContext(compile(formSource), sandbox);
  const Component = formExports.default || formExports;

  const flush = () => { scheduled.splice(0).forEach((fn) => fn()); };
  const render = (next = {}) => {
    Object.assign(props, next);
    if (next.item !== undefined) props.item = next.item;
    slot = 0;
    const tree = Component(props);
    flush();
    return tree;
  };

  render();
  return {
    render,
    confirms: () => confirms,
    setConfirm(v) { sandbox.__confirmResult = v; },
    getForm() { return state[0]; },
    setForm(patch) {
      const cur = state[0];
      state[0] = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
    },
    async submit() {
      slot = 0;
      const tree = Component(props);
      flush();
      const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
      const form = walk(tree).find((n) => n.type === 'form' || (n.props && n.props.onSubmit));
      assert.ok(form, 'form element');
      await form.props.onSubmit({ preventDefault() {} });
    },
  };
}

test('defeito reproduzivel ParametroRoteirizacao: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/ParametroRoteirizacaoForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /roteirizacaoBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /distancia_maxima_km/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-orange-600/);
  assert.doesNotMatch(src, /bg-amber-600/);
});

test('ParametroRoteirizacao: updated_at reabre flags/números; submit ancora boundId', async () => {
  const initial = {
    id: 'rot-1',
    usar_ia_otimizacao: true,
    distancia_maxima_km: 100,
    tempo_medio_entrega_minutos: 30,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ParametroRoteirizacaoForm.jsx', { initial });
  assert.equal(h.getForm().distancia_maxima_km, 100);
  h.render({
    item: {
      ...initial,
      usar_ia_otimizacao: false,
      distancia_maxima_km: 250,
      tempo_medio_entrega_minutos: 45,
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().usar_ia_otimizacao, false);
  assert.equal(h.getForm().distancia_maxima_km, 250);
  assert.equal(h.getForm().tempo_medio_entrega_minutos, 45);
  await h.submit();
  assert.equal(submitted[0].id, 'rot-1');
  assert.equal(submitted[0].distancia_maxima_km, 250);
});

test('ParametroRoteirizacao: HTTP omite distancia — map usa default sem wipe de flag', async () => {
  const initial = {
    id: 'rot-2',
    usar_ia_otimizacao: false,
    distancia_maxima_km: 80,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/ParametroRoteirizacaoForm.jsx', { initial });
  h.render({
    item: {
      id: 'rot-2',
      usar_ia_otimizacao: true,
      // distancia_maxima_km ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().usar_ia_otimizacao, true);
  assert.equal(h.getForm().distancia_maxima_km, 100);
});

test('ParametroRoteirizacao: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'rot-a',
    usar_ia_otimizacao: true,
    distancia_maxima_km: 50,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ParametroRoteirizacaoForm.jsx', { initial });
  h.setForm({ usar_ia_otimizacao: false, distancia_maxima_km: 999 });
  h.setConfirm(false);
  h.render({
    item: { ...initial, distancia_maxima_km: 10, updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().usar_ia_otimizacao, false);
  assert.equal(h.getForm().distancia_maxima_km, 999);
  await h.submit();
  assert.equal(submitted[0].id, 'rot-a');
  assert.equal(submitted[0].distancia_maxima_km, 999);
});

test('ParametroRoteirizacao: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'rot-leg',
    distancia_maxima_km: 40,
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/ParametroRoteirizacaoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      distancia_maxima_km: 60,
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().distancia_maxima_km, 60);
});

test('ParametroRoteirizacao: troca A→B aplica B no boundId', async () => {
  const a = { id: 'rot-a2', distancia_maxima_km: 11, updated_at: '2026-01-01T00:00:00Z' };
  const b = { id: 'rot-b2', distancia_maxima_km: 22, updated_at: '2026-01-01T00:00:00Z' };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ParametroRoteirizacaoForm.jsx', { initial: a });
  h.render({ item: b, onSubmit: (p) => submitted.push(p) });
  assert.equal(h.getForm().distancia_maxima_km, 22);
  await h.submit();
  assert.equal(submitted[0].id, 'rot-b2');
});
