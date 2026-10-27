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
    '@/components/ui/select': {
      Select: 'Select',
      SelectContent: 'SelectContent',
      SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger',
      SelectValue: 'SelectValue',
    },
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
    '@/components/cadastros/useCadastroReopenOnIdentity': { __esModule: true, default: hookFn },
    '@/api/base44Client': {
      base44: {
        entities: {
          Empresa: { list: async () => [{ id: 'mat-1', razao_social: 'Matriz', tipo: 'Matriz', group_id: 'grp-1' }] },
        },
      },
    },
    '@tanstack/react-query': {
      useQuery: () => ({
        data: [{ id: 'mat-1', razao_social: 'Matriz', tipo: 'Matriz', group_id: 'grp-1' }],
        isLoading: false,
      }),
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

test('defeito reproduzivel Filial: RecordState so via updated_date ignorava updated_at', async () => {
  const src = await readFile(new URL('../src/components/cadastros/FilialForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /filialBoundId/);
  assert.doesNotMatch(src, /useCadastroRecordState/);
  assert.match(src, /matriz_id/);
  assert.match(src, /bg-sky-600/);
  assert.doesNotMatch(src, /bg-purple-600/);
});

test('Filial: updated_at reabre e preserva CNPJ/IE/matriz; submit ancora boundId', async () => {
  const initial = {
    id: 'fil-1',
    razao_social: 'Filial A',
    nome_fantasia: 'FA',
    cnpj: '11.111.111/0001-11',
    inscricao_estadual: '111',
    matriz_id: 'mat-1',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/FilialForm.jsx', { initial });
  assert.equal(h.getForm().cnpj, '11.111.111/0001-11');
  h.render({
    item: {
      ...initial,
      razao_social: 'Filial B',
      cnpj: '22.222.222/0001-22',
      inscricao_estadual: '222',
      matriz_id: 'mat-2',
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().razao_social, 'Filial B');
  assert.equal(h.getForm().cnpj, '22.222.222/0001-22');
  assert.equal(h.getForm().inscricao_estadual, '222');
  assert.equal(h.getForm().matriz_id, 'mat-2');
  await h.submit();
  assert.equal(submitted[0].id, 'fil-1');
  assert.equal(submitted[0].cnpj, '22.222.222/0001-22');
  assert.equal(submitted[0].matriz_id, 'mat-2');
});

test('Filial: HTTP omite inscricao_estadual — map preserva string vazia sem wipe de razao', async () => {
  const initial = {
    id: 'fil-2',
    razao_social: 'Filial X',
    cnpj: '33.333.333/0001-33',
    inscricao_estadual: '333',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/FilialForm.jsx', { initial });
  h.render({
    item: {
      id: 'fil-2',
      razao_social: 'Filial X2',
      cnpj: '33.333.333/0001-33',
      // inscricao_estadual ausente
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().razao_social, 'Filial X2');
  assert.equal(h.getForm().inscricao_estadual, '');
});

test('Filial: dirty + updated_at recusa preserva rascunho e boundId', async () => {
  const initial = {
    id: 'fil-a',
    razao_social: 'Draft',
    cnpj: '44.444.444/0001-44',
    matriz_id: 'mat-1',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/FilialForm.jsx', { initial });
  h.setForm({
    razao_social: 'Local Draft',
    cnpj: '55.555.555/0001-55',
  });
  h.setConfirm(false);
  h.render({
    item: { ...initial, razao_social: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().razao_social, 'Local Draft');
  assert.equal(h.getForm().cnpj, '55.555.555/0001-55');
  await h.submit();
  assert.equal(submitted[0].id, 'fil-a');
  assert.equal(submitted[0].cnpj, '55.555.555/0001-55');
});

test('Filial: updated_date legado reabre sem updated_at', async () => {
  const initial = {
    id: 'fil-leg',
    razao_social: 'Legado',
    cnpj: '66.666.666/0001-66',
    matriz_id: 'mat-1',
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/FilialForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      razao_social: 'Legado 2',
      cnpj: '77.777.777/0001-77',
      matriz_id: 'mat-9',
      updated_date: '2026-01-04T00:00:00Z',
    },
  });
  assert.equal(h.getForm().razao_social, 'Legado 2');
  assert.equal(h.getForm().cnpj, '77.777.777/0001-77');
  assert.equal(h.getForm().matriz_id, 'mat-9');
});

test('Filial: troca de identidade A→B aplica B; resposta tardia nao reescreve', async () => {
  const a = {
    id: 'fil-a2',
    razao_social: 'A',
    cnpj: '11.111.111/0001-11',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const b = {
    id: 'fil-b2',
    razao_social: 'B',
    cnpj: '22.222.222/0001-22',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/FilialForm.jsx', { initial: a });
  h.render({ item: b, onSubmit: (p) => submitted.push(p) });
  assert.equal(h.getForm().razao_social, 'B');
  assert.equal(h.getForm().cnpj, '22.222.222/0001-22');
  await h.submit();
  assert.equal(submitted[0].id, 'fil-b2');
});
