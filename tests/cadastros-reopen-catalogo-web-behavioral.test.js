import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

const syncFlagsCatalogoProduto = (record = {}) => {
  const exibirSite = record.exibir_no_site === true || record.exibir_site === true
    || record.exibir_no_site === 'true' || record.exibir_site === 'true';
  const exibirMarketplace = record.exibir_no_marketplace === true || record.exibir_marketplace === true
    || record.exibir_no_marketplace === 'true' || record.exibir_marketplace === 'true';
  return {
    ...record,
    exibir_no_site: Boolean(exibirSite),
    exibir_site: Boolean(exibirSite),
    exibir_no_marketplace: Boolean(exibirMarketplace),
    exibir_marketplace: Boolean(exibirMarketplace),
  };
};

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
    '@/components/lib/siteOrigemPolicy': { syncFlagsCatalogoProduto },
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

test('defeito reproduzivel CatalogoWeb: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/CatalogoWebForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /catalogoBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /syncFlagsCatalogoProduto/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-purple-600/);
});

test('CatalogoWeb: updated_at reabre e preserva flags site/marketplace; submit ancora boundId', async () => {
  const initial = {
    id: 'cat-1',
    nome_catalogo: 'Cat A',
    produto_id: 'p1',
    exibir_site: true,
    exibir_marketplace: false,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CatalogoWebForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_catalogo: 'Cat B',
      produto_id: 'p2',
      exibir_site: false,
      exibir_marketplace: true,
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_catalogo, 'Cat B');
  assert.equal(h.getForm().exibir_site, false);
  assert.equal(h.getForm().exibir_marketplace, true);
  await h.submit();
  assert.equal(submitted[0].id, 'cat-1');
  assert.equal(submitted[0].exibir_marketplace, true);
  assert.equal(submitted[0].exibir_no_marketplace, true);
});

test('CatalogoWeb: HTTP omite produto_id — map preserva string vazia sem wipe de nome', async () => {
  const initial = {
    id: 'cat-2',
    nome_catalogo: 'Cat X',
    produto_id: 'px',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/CatalogoWebForm.jsx', { initial });
  h.render({
    item: {
      id: 'cat-2',
      nome_catalogo: 'Cat X2',
      // produto_id ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_catalogo, 'Cat X2');
  assert.equal(h.getForm().produto_id, '');
});

test('CatalogoWeb: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'cat-a',
    nome_catalogo: 'Draft',
    exibir_site: true,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CatalogoWebForm.jsx', { initial });
  h.setForm({ nome_catalogo: 'Local Draft', exibir_site: false });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome_catalogo: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_catalogo, 'Local Draft');
  assert.equal(h.getForm().exibir_site, false);
  await h.submit();
  assert.equal(submitted[0].id, 'cat-a');
  assert.equal(submitted[0].nome, 'Local Draft');
});

test('CatalogoWeb: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'cat-leg',
    nome_catalogo: 'Legado',
    exibir_marketplace: true,
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/CatalogoWebForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_catalogo: 'Legado 2',
      exibir_marketplace: false,
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_catalogo, 'Legado 2');
  assert.equal(h.getForm().exibir_marketplace, false);
});

test('CatalogoWeb: troca A→B aplica B no boundId', async () => {
  const a = { id: 'cat-a2', nome_catalogo: 'A', updated_at: '2026-01-01T00:00:00Z' };
  const b = { id: 'cat-b2', nome_catalogo: 'B', produto_id: 'pb', updated_at: '2026-01-01T00:00:00Z' };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CatalogoWebForm.jsx', { initial: a });
  h.render({ item: b, onSubmit: (p) => submitted.push(p) });
  assert.equal(h.getForm().nome_catalogo, 'B');
  await h.submit();
  assert.equal(submitted[0].id, 'cat-b2');
  assert.equal(submitted[0].produto_id, 'pb');
});
