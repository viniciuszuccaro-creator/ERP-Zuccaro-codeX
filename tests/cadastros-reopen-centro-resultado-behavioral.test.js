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
      default: () => ({
        canCreate: () => true,
        canEdit: () => true,
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

test('defeito reproduzivel CentroResultado: RecordState so updated_date + useEffect wipe por id', async () => {
  const src = await readFile(new URL('../src/components/cadastros/CentroResultadoForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /centroBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.doesNotMatch(src, /useEffect\(\(\) => \{\s*if \(dadosIniciais\?\.id\) setFormData/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-teal-600/);
  assert.doesNotMatch(src, /bg-purple-600/);
});

test('CentroResultado: updated_at reabre e preserva nome/descricao; submit ancora boundId', async () => {
  const initial = {
    id: 'cr-1',
    codigo: 'CR01',
    nome: 'Centro A',
    descricao: 'Desc A',
    ativo: true,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CentroResultadoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome: 'Centro B',
      descricao: 'Desc B',
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome, 'Centro B');
  assert.equal(h.getForm().descricao, 'Desc B');
  await h.submit();
  assert.equal(submitted[0].id, 'cr-1');
  assert.equal(submitted[0].nome, 'Centro B');
});

test('CentroResultado: HTTP omite descricao — map preserva string vazia sem wipe de nome', async () => {
  const initial = {
    id: 'cr-2',
    nome: 'Centro X',
    descricao: 'Tem desc',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/CentroResultadoForm.jsx', { initial });
  h.render({
    item: {
      id: 'cr-2',
      nome: 'Centro X2',
      // descricao ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome, 'Centro X2');
  assert.equal(h.getForm().descricao, '');
});

test('CentroResultado: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'cr-a',
    nome: 'Draft',
    descricao: 'local',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CentroResultadoForm.jsx', { initial });
  h.setForm({ nome: 'Local Draft', descricao: 'editado' });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome, 'Local Draft');
  assert.equal(h.getForm().descricao, 'editado');
  await h.submit();
  assert.equal(submitted[0].id, 'cr-a');
  assert.equal(submitted[0].nome, 'Local Draft');
});

test('CentroResultado: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'cr-leg',
    nome: 'Legado',
    descricao: 'd1',
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/CentroResultadoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome: 'Legado 2',
      descricao: 'd2',
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome, 'Legado 2');
  assert.equal(h.getForm().descricao, 'd2');
});

test('CentroResultado: troca A→B aplica B no boundId', async () => {
  const a = { id: 'cr-a2', nome: 'A', updated_at: '2026-01-01T00:00:00Z' };
  const b = { id: 'cr-b2', nome: 'B', descricao: 'bb', updated_at: '2026-01-01T00:00:00Z' };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CentroResultadoForm.jsx', { initial: a });
  h.render({ item: b, onSubmit: (p) => submitted.push(p) });
  assert.equal(h.getForm().nome, 'B');
  await h.submit();
  assert.equal(submitted[0].id, 'cr-b2');
});
