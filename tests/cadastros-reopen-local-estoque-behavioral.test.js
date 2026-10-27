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
    '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
    '@/components/ui/select': {
      Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
    },
    '@/components/ui/switch': { Switch: 'Switch' },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({
        hasPermission: () => true,
      }),
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
    sonner: { toast: { error() {}, success() {} } },
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

test('defeito reproduzivel LocalEstoque: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/LocalEstoqueForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /localBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.doesNotMatch(src, /prevUpdatedRef/);
  assert.match(src, /estrutura_fisica/);
  assert.match(src, /bg-sky-600/);
});

test('LocalEstoque: updated_at reabre e preserva estrutura_fisica; submit ancora boundId', async () => {
  const initial = {
    id: 'le-1',
    nome: 'Almox A',
    codigo: '000101',
    tipo: 'Almoxarifado',
    estrutura_fisica: {
      tem_corredores: true,
      tem_prateleiras: true,
      quantidade_corredores: 4,
    },
    controla_temperatura: true,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/LocalEstoqueForm.jsx', { initial });
  assert.equal(h.getForm().estrutura_fisica.quantidade_corredores, 4);
  h.render({
    item: {
      ...initial,
      nome: 'Almox B',
      estrutura_fisica: {
        tem_corredores: true,
        tem_prateleiras: false,
        quantidade_corredores: 8,
      },
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome, 'Almox B');
  assert.equal(h.getForm().estrutura_fisica.quantidade_corredores, 8);
  assert.equal(h.getForm().estrutura_fisica.tem_prateleiras, false);
  assert.equal(h.getForm().controla_temperatura, true);
  await h.submit();
  assert.equal(submitted[0].id, 'le-1');
  assert.equal(submitted[0].estrutura_fisica.quantidade_corredores, 8);
});

test('LocalEstoque: HTTP omite estrutura_fisica — map preserva defaults sem wipe total', async () => {
  const initial = {
    id: 'le-2',
    nome: 'Depósito',
    codigo: '000102',
    estrutura_fisica: {
      tem_corredores: true,
      quantidade_corredores: 3,
    },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/LocalEstoqueForm.jsx', { initial });
  h.render({
    item: {
      id: 'le-2',
      nome: 'Depósito Norte',
      codigo: '000102',
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome, 'Depósito Norte');
  assert.ok(h.getForm().estrutura_fisica);
  assert.equal(h.getForm().estrutura_fisica.tem_corredores, false);
  assert.equal(h.getForm().estrutura_fisica.quantidade_corredores, 0);
});

test('LocalEstoque: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'le-a',
    nome: 'Local A',
    codigo: 'A001',
    estrutura_fisica: { tem_corredores: true, quantidade_corredores: 2 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/LocalEstoqueForm.jsx', { initial });
  h.setForm({
    nome: 'Draft A',
    estrutura_fisica: { ...h.getForm().estrutura_fisica, quantidade_corredores: 9 },
  });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome, 'Draft A');
  assert.equal(h.getForm().estrutura_fisica.quantidade_corredores, 9);
  await h.submit();
  assert.equal(submitted[0].id, 'le-a');
  assert.equal(submitted[0].nome, 'Draft A');
});

test('LocalEstoque: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'le-leg',
    nome: 'Legado',
    codigo: 'L001',
    estrutura_fisica: { tem_prateleiras: true },
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/LocalEstoqueForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome: 'Legado 2',
      estrutura_fisica: { tem_prateleiras: true, tem_corredores: true, quantidade_corredores: 5 },
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome, 'Legado 2');
  assert.equal(h.getForm().estrutura_fisica.quantidade_corredores, 5);
});

test('LocalEstoque: troca de registro dirty recusada nao aplica B', async () => {
  const a = {
    id: 'le-ra',
    nome: 'LOCAL A',
    codigo: 'RA01',
    estrutura_fisica: { tem_corredores: true, quantidade_corredores: 1 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/LocalEstoqueForm.jsx', { initial: a });
  h.setForm({ nome: 'DRAFT A' });
  h.setConfirm(false);
  h.render({
    item: {
      id: 'le-rb',
      nome: 'LOCAL B',
      codigo: 'RB01',
      estrutura_fisica: { tem_corredores: false },
      updated_at: '2026-02-01T00:00:00Z',
    },
  });
  assert.equal(h.confirms().length, 1);
  assert.equal(h.getForm().nome, 'DRAFT A');
  assert.equal(h.getForm().estrutura_fisica.quantidade_corredores, 1);
});
