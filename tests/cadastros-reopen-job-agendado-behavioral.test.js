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
    '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
    '@/components/ui/select': {
      Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
    },
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

test('defeito reproduzivel JobAgendado: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/JobAgendadoForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /jobBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /parametros_execucao/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-amber-600/);
  assert.doesNotMatch(src, /bg-purple-600/);
});

test('JobAgendado: updated_at reabre e preserva parametros_execucao; submit ancora boundId', async () => {
  const initial = {
    id: 'job-1',
    nome_job: 'Job A',
    tipo_job: 'IA_Fiscal',
    parametros_execucao: { janela: 'noite', limite: 10 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/JobAgendadoForm.jsx', { initial });
  assert.equal(h.getForm().parametros_execucao.janela, 'noite');
  h.render({
    item: {
      ...initial,
      nome_job: 'Job B',
      parametros_execucao: { janela: 'manha', limite: 20, extra: true },
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_job, 'Job B');
  assert.equal(h.getForm().parametros_execucao.janela, 'manha');
  assert.equal(h.getForm().parametros_execucao.extra, true);
  await h.submit();
  assert.equal(submitted[0].id, 'job-1');
  assert.equal(submitted[0].parametros_execucao.limite, 20);
});

test('JobAgendado: HTTP omite parametros_execucao — map preserva objeto vazio sem wipe de nome', async () => {
  const initial = {
    id: 'job-2',
    nome_job: 'Job X',
    parametros_execucao: { k: 1 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/JobAgendadoForm.jsx', { initial });
  h.render({
    item: {
      id: 'job-2',
      nome_job: 'Job X2',
      // parametros_execucao ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_job, 'Job X2');
  assert.ok(h.getForm().parametros_execucao && typeof h.getForm().parametros_execucao === 'object');
  assert.equal(Object.keys(h.getForm().parametros_execucao).length, 0);
});

test('JobAgendado: dirty + updated_at recusa preserva rascunho parametros e boundId', async () => {
  const initial = {
    id: 'job-a',
    nome_job: 'Draft',
    parametros_execucao: { a: 1 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/JobAgendadoForm.jsx', { initial });
  h.setForm({
    nome_job: 'Local Draft',
    parametros_execucao: { a: 9 },
  });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome_job: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_job, 'Local Draft');
  assert.equal(h.getForm().parametros_execucao.a, 9);
  await h.submit();
  assert.equal(submitted[0].id, 'job-a');
  assert.equal(submitted[0].parametros_execucao.a, 9);
});

test('JobAgendado: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'job-leg',
    nome_job: 'Legado',
    parametros_execucao: { x: 1 },
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/JobAgendadoForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_job: 'Legado 2',
      parametros_execucao: { x: 2 },
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_job, 'Legado 2');
  assert.equal(h.getForm().parametros_execucao.x, 2);
});

test('JobAgendado: troca A→B aplica B no boundId', async () => {
  const a = { id: 'job-a2', nome_job: 'A', parametros_execucao: { a: 1 }, updated_at: '2026-01-01T00:00:00Z' };
  const b = { id: 'job-b2', nome_job: 'B', parametros_execucao: { b: 2 }, updated_at: '2026-01-01T00:00:00Z' };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/JobAgendadoForm.jsx', { initial: a });
  h.render({ item: b, onSubmit: (p) => submitted.push(p) });
  assert.equal(h.getForm().nome_job, 'B');
  await h.submit();
  assert.equal(submitted[0].id, 'job-b2');
  assert.equal(submitted[0].parametros_execucao.b, 2);
});
