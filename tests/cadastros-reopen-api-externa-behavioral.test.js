import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

async function mountForm(relPath, { initial, contextoVisual } = {}) {
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
  const visual = {
    empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
    grupoAtual: { id: 'grp-1' },
    contexto: 'empresa',
    ...(contextoVisual || {}),
  };
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
    alert() {},
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
      useContextoVisual: () => visual,
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
    setContexto(patch) { Object.assign(visual, patch); },
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

test('defeito reproduzivel ApiExterna: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/ApiExternaForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /apiExternaBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /headers_autenticacao/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-amber-600/);
  assert.doesNotMatch(src, /bg-purple-600/);
});

test('ApiExterna: updated_at reabre e preserva headers_autenticacao; submit ancora boundId', async () => {
  const initial = {
    id: 'api-1',
    nome_integracao: 'API A',
    tipo_api: 'REST',
    headers_autenticacao: { Authorization: 'Bearer a', X: '1' },
    api_key: 'key-a',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ApiExternaForm.jsx', { initial });
  assert.equal(h.getForm().headers_autenticacao.Authorization, 'Bearer a');
  h.render({
    item: {
      ...initial,
      nome_integracao: 'API B',
      headers_autenticacao: { Authorization: 'Bearer b', Y: '2' },
      api_key: 'key-b',
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_integracao, 'API B');
  assert.equal(h.getForm().headers_autenticacao.Authorization, 'Bearer b');
  assert.equal(h.getForm().headers_autenticacao.Y, '2');
  assert.equal(h.getForm().api_key, 'key-b');
  await h.submit();
  assert.equal(submitted[0].id, 'api-1');
  assert.equal(submitted[0].headers_autenticacao.Y, '2');
});

test('ApiExterna: HTTP omite headers_autenticacao — map preserva objeto vazio sem wipe de nome', async () => {
  const initial = {
    id: 'api-2',
    nome_integracao: 'API X',
    headers_autenticacao: { k: 1 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/ApiExternaForm.jsx', { initial });
  h.render({
    item: {
      id: 'api-2',
      nome_integracao: 'API X2',
      // headers_autenticacao ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_integracao, 'API X2');
  assert.ok(h.getForm().headers_autenticacao && typeof h.getForm().headers_autenticacao === 'object');
  assert.equal(Object.keys(h.getForm().headers_autenticacao).length, 0);
});

test('ApiExterna: dirty + updated_at recusa preserva rascunho headers e boundId', async () => {
  const initial = {
    id: 'api-a',
    nome_integracao: 'Draft',
    headers_autenticacao: { a: 1 },
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ApiExternaForm.jsx', { initial });
  h.setForm({
    nome_integracao: 'Local Draft',
    headers_autenticacao: { a: 9 },
  });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome_integracao: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_integracao, 'Local Draft');
  assert.equal(h.getForm().headers_autenticacao.a, 9);
  await h.submit();
  assert.equal(submitted[0].id, 'api-a');
  assert.equal(submitted[0].headers_autenticacao.a, 9);
});

test('ApiExterna: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'api-leg',
    nome_integracao: 'Legado',
    headers_autenticacao: { x: 1 },
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/ApiExternaForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_integracao: 'Legado 2',
      headers_autenticacao: { x: 2 },
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_integracao, 'Legado 2');
  assert.equal(h.getForm().headers_autenticacao.x, 2);
});

test('ApiExterna: troca A→B aplica B no boundId', async () => {
  const a = { id: 'api-a2', nome_integracao: 'A', headers_autenticacao: { a: 1 }, updated_at: '2026-01-01T00:00:00Z' };
  const b = { id: 'api-b2', nome_integracao: 'B', headers_autenticacao: { b: 2 }, updated_at: '2026-01-01T00:00:00Z' };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/ApiExternaForm.jsx', { initial: a });
  h.render({ item: b, onSubmit: (p) => submitted.push(p) });
  assert.equal(h.getForm().nome_integracao, 'B');
  await h.submit();
  assert.equal(submitted[0].id, 'api-b2');
});

test('ApiExterna: troca empresa invalida rascunho — não retargeta nome/headers de A em B', async () => {
  const src = await readFile(new URL('../src/components/cadastros/ApiExternaForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /tenantKey/);
  assert.match(src, /JSON\.stringify\(\[groupId/);

  const submitted = [];
  const h = await mountForm('src/components/cadastros/ApiExternaForm.jsx', {
    initial: null,
    contextoVisual: {
      empresaAtual: { id: 'emp-A', group_id: 'grp-1' },
      grupoAtual: { id: 'grp-1' },
      contexto: 'empresa',
    },
  });
  h.setForm({
    nome_integracao: 'Rascunho-A',
    headers_autenticacao: { leak: true },
    timeout_segundos: 77,
  });
  assert.equal(h.getForm().nome_integracao, 'Rascunho-A');

  h.setContexto({
    empresaAtual: { id: 'emp-B', group_id: 'grp-1' },
    grupoAtual: { id: 'grp-1' },
    contexto: 'empresa',
  });
  h.render({ item: null, onSubmit: (p) => submitted.push(p) });

  assert.equal(h.getForm().empresa_id, 'emp-B');
  assert.equal(h.getForm().nome_integracao, '', 'rascunho de A não sobrevive à troca de empresa');
  assert.equal(Object.keys(h.getForm().headers_autenticacao || {}).length, 0);
  assert.equal(h.getForm().headers_autenticacao?.leak, undefined);
  assert.equal(h.getForm().timeout_segundos, 30);
  // submit sem nome é bloqueado pelo formulário
  await h.submit();
  assert.equal(submitted.length, 0);
});
