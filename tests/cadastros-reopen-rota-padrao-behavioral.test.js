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
    '@/components/ui/textarea': { Textarea: 'Textarea' },
    '@/components/ui/switch': { Switch: 'Switch' },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({ hasPermission: () => true }),
    },
    '@/components/lib/useContextoVisual': {
      useContextoVisual: () => ({
        empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
        grupoAtual: { id: 'grp-1' },
        contexto: 'empresa',
      }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p }),
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

test('defeito reproduzivel RotaPadrao: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/RotaPadraoForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /rotaBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /CadastroCodigoRegistroField/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-orange-600/);
  assert.doesNotMatch(src, /bg-purple-600/);
});

test('RotaPadrao: updated_at reabre e preserva origem/destino/distancia; submit ancora boundId', async () => {
  const initial = {
    id: 'rota-1',
    nome_rota: 'Rota A',
    origem: 'SP',
    destino: 'RJ',
    distancia_km: 400,
    tempo_medio_horas: 5,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/RotaPadraoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_rota: 'Rota B',
      origem: 'BH',
      destino: 'VIX',
      distancia_km: 500,
      tempo_medio_horas: 6,
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_rota, 'Rota B');
  assert.equal(h.getForm().origem, 'BH');
  assert.equal(h.getForm().destino, 'VIX');
  assert.equal(h.getForm().distancia_km, 500);
  await h.submit();
  assert.equal(submitted[0].id, 'rota-1');
  assert.equal(submitted[0].destino, 'VIX');
});

test('RotaPadrao: HTTP omite destino — map preserva string vazia sem wipe de nome', async () => {
  const initial = {
    id: 'rota-2',
    nome_rota: 'Rota X',
    origem: 'A',
    destino: 'B',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/RotaPadraoForm.jsx', { initial });
  h.render({
    item: {
      id: 'rota-2',
      nome_rota: 'Rota X2',
      origem: 'A2',
      // destino ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_rota, 'Rota X2');
  assert.equal(h.getForm().destino, '');
});

test('RotaPadrao: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'rota-a',
    nome_rota: 'Draft',
    origem: 'O1',
    destino: 'D1',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/RotaPadraoForm.jsx', { initial });
  h.setForm({ nome_rota: 'Local Draft', destino: 'Local D' });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome_rota: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_rota, 'Local Draft');
  assert.equal(h.getForm().destino, 'Local D');
  await h.submit();
  assert.equal(submitted[0].id, 'rota-a');
  assert.equal(submitted[0].destino, 'Local D');
});

test('RotaPadrao: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'rota-leg',
    nome_rota: 'Legado',
    origem: 'L1',
    destino: 'L2',
    distancia_km: 10,
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/RotaPadraoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_rota: 'Legado 2',
      origem: 'L3',
      destino: 'L4',
      distancia_km: 20,
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_rota, 'Legado 2');
  assert.equal(h.getForm().origem, 'L3');
  assert.equal(h.getForm().distancia_km, 20);
});

test('RotaPadrao: troca A→B aplica B no boundId', async () => {
  const a = { id: 'rota-a2', nome_rota: 'A', origem: 'A1', updated_at: '2026-01-01T00:00:00Z' };
  const b = { id: 'rota-b2', nome_rota: 'B', origem: 'B1', destino: 'B2', updated_at: '2026-01-01T00:00:00Z' };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/RotaPadraoForm.jsx', { initial: a });
  h.render({ item: b, onSubmit: (p) => submitted.push(p) });
  assert.equal(h.getForm().nome_rota, 'B');
  await h.submit();
  assert.equal(submitted[0].id, 'rota-b2');
  assert.equal(submitted[0].destino, 'B2');
});
