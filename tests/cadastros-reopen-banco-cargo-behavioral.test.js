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
async function mountForm(relPath, { initial, namePlaceholder, getValue, initialProp = 'item' }) {
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
    useEffect(fn, deps) {
      const i = slot++;
      const prev = effects[i];
      if (prev && deps && prev.deps && deps.every((v, k) => Object.is(v, prev.deps[k]))) return;
      prev?.cleanup?.();
      scheduled.push(() => { effects[i] = { deps, cleanup: fn() }; });
    },
  };

  let props = { item: initial, [initialProp]: initial, onSubmit: () => {}, isSubmitting: false };
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

  const recordStateSource = await readFile(new URL('../src/components/cadastros/useCadastroRecordState.js', import.meta.url), 'utf8');
  const recordExports = {};
  sandbox.exports = recordExports;
  sandbox.module = { exports: recordExports };
  sandbox.__modules = {
    react: { __esModule: true, default: react, ...react },
  };
  vm.runInNewContext(compile(recordStateSource), sandbox);
  const recordStateFn = recordExports.default || recordExports;

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
    '@/components/common/FormWrapper': {
      __esModule: true,
      default: (p) => ({ type: 'FormWrapper', props: p, children: p?.children || [] }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': {
      __esModule: true,
      default: typeof hookFn === 'function' ? hookFn : hookFn.default,
    },
    './useCadastroRecordState': {
      __esModule: true,
      default: typeof recordStateFn === 'function' ? recordStateFn : recordStateFn.default,
    },
    zod: {
      z: {
        object: () => ({ safeParse: () => ({ success: true, data: {} }) }),
        string: () => ({ min: () => ({}) }),
      },
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

const formaInitial = {
  id: 'fp1', codigo: '000001', descricao: 'PIX Vista', tipo: 'PIX',
  updated_date: '2026-01-01T00:00:00Z', ativa: true,
  percentual_desconto_padrao: 0, percentual_acrescimo_padrao: 0,
  prazo_compensacao_dias: 0, maximo_parcelas: 1, intervalo_parcelas_dias: 30,
};
const setorInitial = {
  id: 's1', codigo: '000001', nome: 'Revenda Alpha', descricao: 'Setor teste',
  tipo_operacao: 'Revenda', updated_date: '2026-01-01T00:00:00Z', ativo: true,
};

test('FormaPagamentoForm: load + dirty refresh + switch-reject boundId (prova própria)', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/FormaPagamentoForm.jsx', {
    initial: formaInitial,
    namePlaceholder: 'Ex: PIX, Boleto 30 dias',
    getValue: (input) => input?.props?.value,
  });
  assert.equal(h.getName(), 'PIX Vista');
  h.findInput('Ex: PIX, Boleto 30 dias').props.onChange({ target: { value: 'Rascunho PIX' } });
  h.setConfirm(false);
  h.render({
    item: {
      ...formaInitial, id: 'fp2', codigo: '000002', descricao: 'Boleto Beta',
      updated_date: '2026-01-02T00:00:00Z',
    },
    onSubmit: (payload) => submitted.push(payload),
  });
  h.render();
  assert.equal(h.getName(), 'Rascunho PIX');
  assert.equal(h.confirms.length, 1);
  // createElement não invoca o componente: type é a função FormWrapper importada.
  const wrapper = h.walk().find((n) => n.props?.schema && typeof n.props?.onSubmit === 'function');
  assert.ok(wrapper, 'FormWrapper.onSubmit (schema+onSubmit)');
  await wrapper.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'fp1');
  assert.equal(submitted[0].descricao, 'Rascunho PIX');
  assert.notEqual(submitted[0].id, 'fp2');
});

test('SetorAtividadeForm: load + switch-reject boundId (prova própria, não generalizar coorte)', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/SetorAtividadeForm.jsx', {
    initial: setorInitial,
    namePlaceholder: 'Ex: Revenda, Almoxarifado, Fábrica',
    getValue: (input) => input?.props?.value,
  });
  assert.equal(h.getName(), 'Revenda Alpha');
  h.findInput('Ex: Revenda, Almoxarifado, Fábrica').props.onChange({ target: { value: 'Rascunho Setor' } });
  h.setConfirm(false);
  h.render({
    item: {
      id: 's2', codigo: '000002', nome: 'Fábrica Beta', updated_date: '2026-01-02T00:00:00Z', ativo: true,
      tipo_operacao: 'Indústria',
    },
    onSubmit: (payload) => submitted.push(payload),
  });
  h.render();
  assert.equal(h.getName(), 'Rascunho Setor');
  const form = h.walk().find((n) => n.props?.onSubmit && typeof n.props.onSubmit === 'function')
    || h.walk().find((n) => n.type === 'Button' && /Salvar|salvar/i.test(String(n.children || [])));
  assert.ok(form, 'submit path');
  if (form.props?.onSubmit) form.props.onSubmit({ preventDefault() {} });
  else await form.props.onClick();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 's1');
  assert.notEqual(submitted[0].id, 's2');
});

const marcaInitial = {
  id: 'm1',
  codigo: '000042',
  nome_marca: 'Gerdau Alpha',
  descricao: 'Aço longo',
  cnpj: '11.111.111/0001-11',
  pais_origem: 'Brasil',
  site: 'https://exemplo.local',
  categoria: 'Aço',
  ativo: true,
  updated_date: '2026-01-01T00:00:00Z',
  group_id: 'g1',
  empresa_id: 'e1',
};

/** Fluxo real sintético: abrir → editar → salvar → fechar → reabrir (campos + boundId). */
test('MarcaForm: abrir→editar→salvar→fechar→reabrir preserva campos e boundId', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/MarcaForm.jsx', {
    initial: marcaInitial,
    namePlaceholder: 'Ex: Gerdau, ArcelorMittal',
    getValue: (input) => input?.props?.value,
  });
  // Abrir — type do createElement é a função mock; localizar pelo action pinado.
  assert.equal(h.getName(), 'Gerdau Alpha');
  const findCodigo = (walk) => walk().find((n) => n.props?.action === 'codigo-registro-marca');
  const codigoField = findCodigo(h.walk);
  assert.equal(codigoField?.props?.entityId, 'm1');
  assert.equal(codigoField?.props?.value, '000042');
  assert.equal(codigoField?.props?.hasId, true);

  // Editar (rascunho sujo) + wire save — re-render entre campos (handlers fecham formData).
  h.render({ onSubmit: (payload) => submitted.push(payload) });
  h.render();
  h.findInput('Ex: Gerdau, ArcelorMittal').props.onChange({ target: { value: 'Gerdau Editada' } });
  h.render();
  assert.equal(h.getName(), 'Gerdau Editada');
  const desc = h.walk().find((n) => n.type === 'Textarea' && n.props?.['data-action'] === 'editar-descricao-marca');
  assert.ok(desc);
  desc.props.onChange({ target: { value: 'Desc persistida' } });
  h.render();
  assert.equal(h.getName(), 'Gerdau Editada');
  assert.equal(
    h.walk().find((n) => n.props?.['data-action'] === 'editar-descricao-marca')?.props?.value,
    'Desc persistida',
  );

  // Salvar com boundId
  const form = h.walk().find((n) => n.props?.onSubmit && typeof n.props.onSubmit === 'function');
  assert.ok(form, 'form submit Marca');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'm1');
  assert.equal(submitted[0].nome_marca, 'Gerdau Editada');
  assert.equal(submitted[0].descricao, 'Desc persistida');
  assert.equal(submitted[0].codigo, '000042');
  assert.equal(submitted[0].group_id, 'g1');
  assert.equal(submitted[0].empresa_id, 'e1');

  // Fechar → reabrir mesmo registro (props limpas pós-save simuladas)
  const saved = {
    ...marcaInitial,
    nome_marca: submitted[0].nome_marca,
    descricao: submitted[0].descricao,
    updated_date: '2026-01-01T01:00:00Z',
  };
  const h2 = await mountForm('src/components/cadastros/MarcaForm.jsx', {
    initial: saved,
    namePlaceholder: 'Ex: Gerdau, ArcelorMittal',
    getValue: (input) => input?.props?.value,
  });
  assert.equal(h2.getName(), 'Gerdau Editada');
  const desc2 = h2.walk().find((n) => n.type === 'Textarea' && n.props?.['data-action'] === 'editar-descricao-marca');
  assert.equal(desc2?.props?.value, 'Desc persistida');
  const codigo2 = h2.walk().find((n) => n.props?.action === 'codigo-registro-marca');
  assert.equal(codigo2?.props?.entityId, 'm1');
  assert.equal(codigo2?.props?.value, '000042');
});

test('MarcaForm: switch-reject — submit usa boundId A (não id B das props)', async () => {
  const submitted = [];
  const h = await mountForm('src/components/cadastros/MarcaForm.jsx', {
    initial: marcaInitial,
    namePlaceholder: 'Ex: Gerdau, ArcelorMittal',
    getValue: (input) => input?.props?.value,
  });
  h.findInput('Ex: Gerdau, ArcelorMittal').props.onChange({ target: { value: 'Rascunho Marca A' } });
  h.setConfirm(false);
  h.render({
    item: {
      ...marcaInitial,
      id: 'm2',
      codigo: '000099',
      nome_marca: 'Marca Beta',
      updated_date: '2026-01-02T00:00:00Z',
    },
    onSubmit: (payload) => submitted.push(payload),
  });
  h.render();
  assert.equal(h.getName(), 'Rascunho Marca A');
  const form = h.walk().find((n) => n.props?.onSubmit && typeof n.props.onSubmit === 'function');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'm1');
  assert.equal(submitted[0].nome_marca, 'Rascunho Marca A');
  assert.notEqual(submitted[0].id, 'm2');
});

test('MarcaForm HTTP: updated_at canonico reabre mesmo ID sem depender do alias legado', async () => {
  const initial = { id: 'http-m1', codigo: '000321', nome_marca: 'SYNTHETIC BEFORE',
    descricao: 'preserved', ativo: true, updated_at: '2026-01-01T00:00:00Z',
    updated_date: 'legacy-version-unchanged' };
  const h = await mountForm('src/components/cadastros/MarcaForm.jsx', {
    initial, namePlaceholder: 'Ex: Gerdau, ArcelorMittal', getValue: n => n.props.value,
  });
  h.render({ item: { ...initial, nome_marca: 'SYNTHETIC AFTER', updated_at: '2026-01-02T00:00:00Z' } });
  h.render();
  assert.equal(h.getName(), 'SYNTHETIC AFTER');
  const code = h.walk().find(n => n.props?.action === 'codigo-registro-marca');
  assert.equal(code.props.entityId, initial.id);
  assert.equal(code.props.value, initial.codigo);
});

test('MarcaForm HTTP: updated_at exige confirmacao sem apagar rascunho e preserva identidade', async () => {
  const initial = { id: 'http-m2', codigo: '000322', nome_marca: 'SYNTHETIC ORIGINAL',
    descricao: 'preserved', ativo: true, updated_at: '2026-01-01T00:00:00Z' };
  const h = await mountForm('src/components/cadastros/MarcaForm.jsx', {
    initial, namePlaceholder: 'Ex: Gerdau, ArcelorMittal', getValue: n => n.props.value,
  });
  h.findInput('Ex: Gerdau, ArcelorMittal').props.onChange({ target: { value: 'SYNTHETIC DIRTY' } });
  h.render(); h.setConfirm(false);
  h.render({ item: { ...initial, nome_marca: 'SERVER VERSION 2', updated_at: '2026-01-02T00:00:00Z' } });
  h.render();
  assert.equal(h.getName(), 'SYNTHETIC DIRTY');
  assert.equal(h.confirms.length, 1);
  h.setConfirm(true);
  h.render({ item: { ...initial, nome_marca: 'SERVER VERSION 3', updated_at: '2026-01-03T00:00:00Z' } });
  h.render();
  assert.equal(h.getName(), 'SERVER VERSION 3');
  const code = h.walk().find(n => n.props?.action === 'codigo-registro-marca');
  assert.equal(code.props.entityId, initial.id);
  assert.equal(code.props.value, initial.codigo);
});
