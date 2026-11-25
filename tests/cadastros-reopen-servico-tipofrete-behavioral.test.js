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
    '@/components/ui/textarea': { Textarea: 'Textarea' },
    '@/components/ui/select': {
      Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
    },
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

test('defeito reproduzivel Servico: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/ServicoForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /servicoBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /bg-sky-600/);
});

test('Servico: updated_at reabre e preserva preco/unidade; submit ancora boundId', async () => {
  const initial = {
    id: 'sv-1',
    descricao: 'Corte',
    codigo_servico: 'SRV-1',
    unidade: 'HORA',
    preco_servico: 120,
    observacoes: 'Obs A',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ServicoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      descricao: 'Corte Laser',
      preco_servico: 150,
      unidade: 'PEÇA',
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().descricao, 'Corte Laser');
  assert.equal(h.getForm().preco_servico, 150);
  assert.equal(h.getForm().unidade, 'PEÇA');
  assert.equal(h.getForm().observacoes, 'Obs A');
  await h.submit();
  assert.equal(submitted[0].id, 'sv-1');
  assert.equal(submitted[0].preco_servico, 150);
});

test('Servico: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'sv-a',
    descricao: 'Solda',
    preco_servico: 80,
    unidade: 'HORA',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ServicoForm.jsx', { initial });
  h.setForm({ descricao: 'Draft Solda', preco_servico: 99 });
  h.setConfirm(false);
  h.render({
    item: { ...initial, descricao: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().descricao, 'Draft Solda');
  await h.submit();
  assert.equal(submitted[0].id, 'sv-a');
  assert.equal(submitted[0].preco_servico, 99);
});

test('Servico: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'sv-leg',
    descricao: 'Dobra',
    preco_servico: 50,
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/ServicoForm.jsx', { initial });
  h.render({
    item: { ...initial, descricao: 'Dobra CNC', preco_servico: 70, updated_date: '2026-01-04T00:00:00Z' },
  });
  assert.equal(h.getForm().descricao, 'Dobra CNC');
  assert.equal(h.getForm().preco_servico, 70);
});

test('defeito reproduzivel TipoFrete: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/TipoFreteForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /tipoFreteBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /bg-sky-600/);
});

test('TipoFrete: updated_at reabre e preserva modalidade/formula/km; submit ancora boundId', async () => {
  const initial = {
    id: 'tf-1',
    descricao: 'Frete SP',
    modalidade: 'CIF',
    cobra_frete: true,
    formula_calculo: 'Por KM',
    valor_base_km: 2.5,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/TipoFreteForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      descricao: 'Frete Expresso',
      modalidade: 'FOB',
      valor_base_km: 4.1,
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().descricao, 'Frete Expresso');
  assert.equal(h.getForm().modalidade, 'FOB');
  assert.equal(h.getForm().valor_base_km, 4.1);
  assert.equal(h.getForm().formula_calculo, 'Por KM');
  await h.submit();
  assert.equal(submitted[0].id, 'tf-1');
  assert.equal(submitted[0].valor_base_km, 4.1);
});

test('TipoFrete: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'tf-a',
    descricao: 'Frete A',
    modalidade: 'CIF',
    cobra_frete: true,
    formula_calculo: 'Por KM',
    valor_base_km: 1,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/TipoFreteForm.jsx', { initial });
  h.setForm({ descricao: 'Draft A', valor_base_km: 9 });
  h.setConfirm(false);
  h.render({
    item: { ...initial, descricao: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().descricao, 'Draft A');
  await h.submit();
  assert.equal(submitted[0].id, 'tf-a');
  assert.equal(submitted[0].valor_base_km, 9);
});

test('TipoFrete: troca dirty recusada nao aplica B', async () => {
  const a = {
    id: 'tf-ra',
    descricao: 'A',
    modalidade: 'CIF',
    cobra_frete: true,
    formula_calculo: 'Por KM',
    valor_base_km: 3,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/TipoFreteForm.jsx', { initial: a });
  h.setForm({ descricao: 'DRAFT A' });
  h.setConfirm(false);
  h.render({
    item: {
      id: 'tf-rb',
      descricao: 'B',
      modalidade: 'FOB',
      cobra_frete: false,
      updated_at: '2026-02-01T00:00:00Z',
    },
  });
  assert.equal(h.confirms().length, 1);
  assert.equal(h.getForm().descricao, 'DRAFT A');
  assert.equal(h.getForm().valor_base_km, 3);
});
