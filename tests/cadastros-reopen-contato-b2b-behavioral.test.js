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

  let props = { item: initial, onSubmit: () => {}, isSubmitting: false };
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
    '@/components/ui/select': {
      Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
    },
    '@/components/ui/switch': { Switch: 'Switch' },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({ canCreate: () => true, canEdit: () => true }),
    },
    '@/components/lib/useContextoVisual': {
      useContextoVisual: () => ({
        empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
        grupoAtual: { id: 'grp-1' },
        contexto: 'empresa',
        filterInContext: async () => [],
      }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': { __esModule: true, default: hookFn },
    '@tanstack/react-query': {
      useQuery: () => ({ data: [{ id: 'cli-1', nome: 'Cliente' }], isLoading: false }),
    },
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

test('defeito reproduzivel ContatoB2B: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/ContatoB2BForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /contatoBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.doesNotMatch(src, /prevIdRef/);
  assert.match(src, /preferencias_comunicacao/);
  assert.match(src, /bg-sky-600/);
});

test('ContatoB2B: updated_at reabre e preserva preferencias_comunicacao; submit ancora boundId', async () => {
  const initial = {
    id: 'cb-1',
    cliente_id: 'cli-1',
    nome_contato: 'Ana',
    email: 'ana@ex.com',
    preferencias_comunicacao: {
      receber_transacionais: true,
      receber_marketing: true,
      canal_preferencial: 'WhatsApp',
    },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ContatoB2BForm.jsx', { initial });
  assert.equal(h.getForm().preferencias_comunicacao.canal_preferencial, 'WhatsApp');
  h.render({
    item: {
      ...initial,
      nome_contato: 'Ana Silva',
      preferencias_comunicacao: {
        receber_transacionais: false,
        receber_marketing: true,
        canal_preferencial: 'Email',
      },
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_contato, 'Ana Silva');
  assert.equal(h.getForm().preferencias_comunicacao.receber_transacionais, false);
  assert.equal(h.getForm().preferencias_comunicacao.canal_preferencial, 'Email');
  await h.submit();
  assert.equal(submitted[0].id, 'cb-1');
  assert.equal(submitted[0].preferencias_comunicacao.canal_preferencial, 'Email');
});

test('ContatoB2B: HTTP omite preferencias — map preserva defaults sem wipe total', async () => {
  const initial = {
    id: 'cb-2',
    cliente_id: 'cli-1',
    nome_contato: 'Bruno',
    email: 'b@ex.com',
    preferencias_comunicacao: {
      receber_transacionais: true,
      receber_marketing: false,
      canal_preferencial: 'Email',
    },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/ContatoB2BForm.jsx', { initial });
  h.render({
    item: {
      id: 'cb-2',
      cliente_id: 'cli-1',
      nome_contato: 'Bruno N',
      email: 'b@ex.com',
      // preferencias ausentes na resposta parcial
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_contato, 'Bruno N');
  assert.ok(h.getForm().preferencias_comunicacao);
  assert.equal(h.getForm().preferencias_comunicacao.canal_preferencial, 'Email');
  assert.equal(h.getForm().preferencias_comunicacao.receber_transacionais, true);
});

test('ContatoB2B: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'cb-a',
    cliente_id: 'cli-1',
    nome_contato: 'Carla',
    email: 'c@ex.com',
    preferencias_comunicacao: {
      receber_transacionais: true,
      receber_marketing: false,
      canal_preferencial: 'Email',
    },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ContatoB2BForm.jsx', { initial });
  h.setForm({ nome_contato: 'Draft Carla' });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome_contato: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_contato, 'Draft Carla');
  await h.submit();
  assert.equal(submitted[0].id, 'cb-a');
  assert.equal(submitted[0].nome_contato, 'Draft Carla');
});

test('ContatoB2B: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'cb-leg',
    cliente_id: 'cli-1',
    nome_contato: 'Diego',
    email: 'd@ex.com',
    preferencias_comunicacao: {
      receber_transacionais: true,
      receber_marketing: false,
      canal_preferencial: 'Telefone',
    },
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/ContatoB2BForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_contato: 'Diego L',
      preferencias_comunicacao: {
        receber_transacionais: true,
        receber_marketing: true,
        canal_preferencial: 'WhatsApp',
      },
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_contato, 'Diego L');
  assert.equal(h.getForm().preferencias_comunicacao.canal_preferencial, 'WhatsApp');
});
