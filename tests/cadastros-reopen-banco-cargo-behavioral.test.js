import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

/**
 * Monta BancoForm / CargoForm reais (não Representante).
 * Contraprova P1: dirty refresh, switch-reject e submit pelo boundId.
 */
async function mountForm(relPath, { initial, namePlaceholder, getValue }) {
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
      default: () => ({
        canCreate: () => true,
        canEdit: () => true,
        canDelete: () => true,
        hasPermission: () => true,
      }),
    },
    '@/components/lib/useContextoVisual': {
      __esModule: true,
      useContextoVisual: () => ({ empresaAtual: { id: 'e1', group_id: 'g1' }, grupoAtual: { id: 'g1' }, contexto: 'empresa' }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p, children: [] }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': {
      __esModule: true,
      default: typeof hookFn === 'function' ? hookFn : hookFn.default,
    },
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
  };
  vm.runInNewContext(compile(formSource), sandbox);

  let tree;
  const Component = formExports.default || sandbox.module.exports.default || formExports;
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  const render = (nextProps) => {
    if (nextProps) props = { ...props, ...nextProps };
    slot = 0;
    tree = Component(props);
    scheduled.splice(0).forEach((fn) => fn());
    return tree;
  };
  const findInput = (placeholder) => walk(tree).find((n) => n.type === 'Input' && n.props?.placeholder === placeholder);
  render();
  render();
  return {
    render,
    findInput,
    confirms,
    setConfirm(result) { sandbox.__confirmResult = result; },
    getName: () => getValue(findInput(namePlaceholder)),
    walk: () => walk(tree),
  };
}

const bancoInitial = {
  id: 'b1', codigo: '000001', nome_banco: 'Banco Alpha', agencia: '1234', conta: '12345-6',
  updated_date: '2026-01-01T00:00:00Z', ativo: true, tipo_conta: 'Corrente', tipo_chave_pix: 'CNPJ',
};
const cargoInitial = {
  id: 'c1', codigo: '000001', nome_cargo: 'Cargo Alpha', updated_date: '2026-01-01T00:00:00Z',
  ativo: true, nivel_hierarquico: 'Operacional', salario_base: 0,
};

test('BancoForm: render sem ReferenceError e abre com campos preenchidos', async () => {
  const h = await mountForm('src/components/cadastros/BancoForm.jsx', {
    initial: bancoInitial,
    namePlaceholder: 'Ex: Banco do Brasil',
    getValue: (input) => input?.props?.value,
  });
  assert.equal(h.getName(), 'Banco Alpha');
  assert.ok(h.findInput('1234')?.props?.value === '1234');
  assert.ok(h.findInput('12345-6')?.props?.value === '12345-6');
});

test('BancoForm: mesmo id sem updated_date novo preserva rascunho sujo', async () => {
  const h = await mountForm('src/components/cadastros/BancoForm.jsx', {
    initial: bancoInitial,
    namePlaceholder: 'Ex: Banco do Brasil',
    getValue: (input) => input?.props?.value,
  });
  h.findInput('Ex: Banco do Brasil').props.onChange({ target: { value: 'Rascunho Banco' } });
  h.render({ item: { ...bancoInitial } });
  h.render();
  assert.equal(h.getName(), 'Rascunho Banco');
  assert.equal(h.confirms.length, 0);
});

test('BancoForm: switch-reject — submit usa boundId A, não id B das props', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/BancoForm.jsx', {
    initial: bancoInitial,
    namePlaceholder: 'Ex: Banco do Brasil',
    getValue: (input) => input?.props?.value,
  });
  h.findInput('Ex: Banco do Brasil').props.onChange({ target: { value: 'Rascunho A' } });
  h.setConfirm(false);
  h.render({
    item: {
      id: 'b2', codigo: '000002', nome_banco: 'Banco Beta', agencia: '9999', conta: '99999-9',
      updated_date: '2026-01-02T00:00:00Z', ativo: true, tipo_conta: 'Corrente', tipo_chave_pix: 'CNPJ',
    },
    onSubmit: (payload) => submitted.push(payload),
  });
  h.render();
  assert.equal(h.getName(), 'Rascunho A');
  const form = h.walk().find((n) => n.props?.onSubmit && typeof n.props.onSubmit === 'function');
  assert.ok(form?.props?.onSubmit);
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'b1');
  assert.equal(submitted[0].nome_banco, 'Rascunho A');
  assert.notEqual(submitted[0].id, 'b2');
});

test('CargoForm: render sem ReferenceError e abre com nome', async () => {
  const h = await mountForm('src/components/cadastros/CargoForm.jsx', {
    initial: cargoInitial,
    namePlaceholder: 'Ex: Analista Financeiro, Operador de Produção',
    getValue: (input) => input?.props?.value,
  });
  assert.equal(h.getName(), 'Cargo Alpha');
});

test('CargoForm: updated_date externo com rascunho sujo exige confirmação', async () => {
  const h = await mountForm('src/components/cadastros/CargoForm.jsx', {
    initial: cargoInitial,
    namePlaceholder: 'Ex: Analista Financeiro, Operador de Produção',
    getValue: (input) => input?.props?.value,
  });
  h.findInput('Ex: Analista Financeiro, Operador de Produção').props.onChange({ target: { value: 'Rascunho Cargo' } });
  h.setConfirm(false);
  h.render({
    item: { ...cargoInitial, nome_cargo: 'Externo', updated_date: '2026-01-03T12:00:00Z' },
  });
  h.render();
  assert.equal(h.getName(), 'Rascunho Cargo');
  assert.equal(h.confirms.length, 1);
});

test('CargoForm: switch-reject — submit usa boundId A', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CargoForm.jsx', {
    initial: cargoInitial,
    namePlaceholder: 'Ex: Analista Financeiro, Operador de Produção',
    getValue: (input) => input?.props?.value,
  });
  h.findInput('Ex: Analista Financeiro, Operador de Produção').props.onChange({ target: { value: 'Rascunho A' } });
  h.setConfirm(false);
  h.render({
    item: {
      id: 'c2', codigo: '000002', nome_cargo: 'Cargo Beta', updated_date: '2026-01-02T00:00:00Z',
      ativo: true, nivel_hierarquico: 'Operacional', salario_base: 0,
    },
    onSubmit: (payload) => submitted.push(payload),
  });
  h.render();
  const form = h.walk().find((n) => n.props?.onSubmit && typeof n.props.onSubmit === 'function');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'c1');
  assert.equal(submitted[0].nome_cargo, 'Rascunho A');
  assert.notEqual(submitted[0].id, 'c2');
});


const deptInitial = {
  id: 'd1', codigo: '000001', nome: 'Dept Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
};
const unidadeInitial = {
  id: 'u1', codigo: '000001', sigla: 'KG', nome_completo: 'Quilograma', updated_date: '2026-01-01T00:00:00Z', ativo: true,
};

test('DepartamentoForm: switch-reject — submit usa boundId A', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/DepartamentoForm.jsx', {
    initial: deptInitial,
    namePlaceholder: 'Comercial, TI, RH...',
    getValue: (input) => input?.props?.value,
  });
  // Departamento may use nome field - find first text input with value
  const nomeInput = h.findInput('Comercial, TI, RH...');
  assert.ok(nomeInput, 'campo nome departamento');
  nomeInput.props.onChange({ target: { value: 'Rascunho A' } });
  h.setConfirm(false);
  h.render({
    item: { id: 'd2', codigo: '000002', nome: 'Dept Beta', updated_date: '2026-01-02T00:00:00Z', ativo: true },
    onSubmit: (payload) => submitted.push(payload),
  });
  h.render();
  const form = h.walk().find((n) => n.props?.onSubmit && typeof n.props.onSubmit === 'function');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'd1');
  assert.notEqual(submitted[0].id, 'd2');
});

test('UnidadeMedidaForm: render + switch-reject boundId', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/UnidadeMedidaForm.jsx', {
    initial: unidadeInitial,
    namePlaceholder: 'Quilograma, Metro, Unidade...',
    getValue: (input) => input?.props?.value,
  });
  assert.equal(h.getName(), 'Quilograma');
  h.findInput('Quilograma, Metro, Unidade...').props.onChange({ target: { value: 'Rascunho A' } });
  h.setConfirm(false);
  h.render({
    item: { id: 'u2', codigo: '000002', sigla: 'MT', nome_completo: 'Metro', updated_date: '2026-01-02T00:00:00Z', ativo: true },
    onSubmit: (payload) => submitted.push(payload),
  });
  h.render();
  const form = h.walk().find((n) => n.props?.onSubmit && typeof n.props.onSubmit === 'function');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted[0].id, 'u1');
  assert.notEqual(submitted[0].id, 'u2');
});
