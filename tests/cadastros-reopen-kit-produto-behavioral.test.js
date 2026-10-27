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

test('defeito reproduzivel KitProduto: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/KitProdutoForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /kitBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /itens_kit/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-purple-600/);
});

test('KitProduto: updated_at reabre e preserva itens_kit; submit ancora boundId', async () => {
  const initial = {
    id: 'kit-1',
    nome_kit: 'Kit A',
    codigo_kit: 'K1',
    itens_kit: [{ produto_id: 'p1', quantidade: 2 }],
    preco_kit: 100,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/KitProdutoForm.jsx', { initial });
  assert.equal(h.getForm().itens_kit.length, 1);
  h.render({
    item: {
      ...initial,
      nome_kit: 'Kit B',
      itens_kit: [
        { produto_id: 'p1', quantidade: 3 },
        { produto_id: 'p2', quantidade: 1 },
      ],
      preco_kit: 150,
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_kit, 'Kit B');
  assert.equal(h.getForm().itens_kit.length, 2);
  assert.equal(h.getForm().itens_kit[1].produto_id, 'p2');
  await h.submit();
  assert.equal(submitted[0].id, 'kit-1');
  assert.equal(submitted[0].itens_kit.length, 2);
});

test('KitProduto: HTTP omite itens_kit — map preserva array vazio sem wipe de nome', async () => {
  const initial = {
    id: 'kit-2',
    nome_kit: 'Kit X',
    itens_kit: [{ produto_id: 'px', quantidade: 5 }],
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/KitProdutoForm.jsx', { initial });
  h.render({
    item: {
      id: 'kit-2',
      nome_kit: 'Kit X2',
      // itens_kit ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_kit, 'Kit X2');
  assert.ok(Array.isArray(h.getForm().itens_kit));
  assert.equal(h.getForm().itens_kit.length, 0);
});

test('KitProduto: dirty + updated_at recusa preserva rascunho itens e boundId', async () => {
  const initial = {
    id: 'kit-a',
    nome_kit: 'Kit Draft',
    itens_kit: [{ produto_id: 'pa', quantidade: 1 }],
    preco_kit: 10,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/KitProdutoForm.jsx', { initial });
  h.setForm({
    nome_kit: 'Local Draft',
    itens_kit: [{ produto_id: 'pa', quantidade: 9 }],
  });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome_kit: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_kit, 'Local Draft');
  assert.equal(h.getForm().itens_kit[0].quantidade, 9);
  await h.submit();
  assert.equal(submitted[0].id, 'kit-a');
  assert.equal(submitted[0].itens_kit[0].quantidade, 9);
});

test('KitProduto: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'kit-leg',
    nome_kit: 'Legado',
    itens_kit: [{ produto_id: 'pl', quantidade: 2 }],
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/KitProdutoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_kit: 'Legado 2',
      itens_kit: [{ produto_id: 'pl', quantidade: 4 }],
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_kit, 'Legado 2');
  assert.equal(h.getForm().itens_kit[0].quantidade, 4);
});
