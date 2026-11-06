import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { assertCadastroFormScopeCurrent } from '../src/components/lib/contextoMultiempresaPolicy.js';
import { buildCadastroEditSavePayload } from '../src/components/cadastros/cadastroEditLoadPolicy.js';
import * as produtoTipoPolicy from '../src/components/cadastros/produto/produtoTipoPolicy.js';
import { z } from 'zod';
const { normalizeProdutoTipoItem } = produtoTipoPolicy;

// Execute the real wrapper, shared identity hook and input handlers without SDK/network.
function mount() {
  let index = 0;
  const state = [], effects = [], scheduled = [], errors = [];
  const scope = { empresaAtual: { id: 'company-a' }, grupoAtual: { id: 'group-a' }, contexto: 'empresa' };
  const permissions = { canCreate: () => true, canEdit: () => true, user: { id: 'actor-a' } };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    lazy: loader => String(loader).match(/(?:import|require)\(["']\.\/([^"']+)/)?.[1], Suspense: 'Suspense',
    useRef(initial) { const slot = index++; return state[slot] ||= { current: initial }; },
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], next => { state[slot] = typeof next === 'function' ? next(state[slot]) : next; }];
    },
    useMemo(factory, deps) {
      const slot = index++;
      if (!state[slot] || !deps.every((v, i) => Object.is(v, state[slot].deps[i]))) state[slot] = { deps, value: factory() };
      return state[slot].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const slot = index++;
      if (effects[slot] && deps.every((value, i) => Object.is(value, effects[slot][i]))) return;
      effects[slot] = deps;
      scheduled.push(effect);
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const compiled = ts.transpileModule(fs.readFileSync(`src/components/cadastros/${file}`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    new Function('exports', 'require', 'setTimeout', 'clearTimeout', compiled)(exports, id => {
      if (id === 'react') return { ...react, default: react };
      if (id === './useCadastroRecordState') return { default: load('useCadastroRecordState.js') };
      if (id === './produto/produtoTipoPolicy') return produtoTipoPolicy;
      if (id === 'zod') return { z };
      if (id.endsWith('/CalculadoraUnidades')) return load('../lib/CalculadoraUnidades.jsx');
      if (id.endsWith('/usePermissions')) return { default: () => permissions };
      if (id.endsWith('/useContextoVisual')) return { useContextoVisual: () => scope };
      if (id === 'sonner') return { toast: { error: text => errors.push(text) } };
      if (id.endsWith('/base44Client')) return { base44: new Proxy({}, { get() { throw new Error('SDK must not be called'); } }) };
      return new Proxy({ default: id.split('/').pop() }, { get: (object, key) => object[key] || String(key) });
    }, () => 0, () => {});
    cache.set(file, exports.default);
    return exports.default;
  }
  let generalKey;
  const component = load('ProdutoFormCompleto.jsx');
  return {
    scope, permissions, errors,
    render(props) {
      index = 0;
      const tree = component(props);
      scheduled.splice(0).forEach(run => run());
      return tree;
    },
    preview(props) { return load('AbaConversoesProduto.jsx')(props); },
    generalInputs(props) {
      if (generalKey !== props.key) {
        state.splice(100); effects.splice(100); generalKey = props.key;
      }
      index = 100;
      const tree = load('ProdutoForm.jsx')(props);
      scheduled.splice(0).forEach(run => run());
      return tree;
    },
    inputs(props) {
      // A separate component hook frame; only local AI loading state is used here.
      index = 40;
      return load('AbaEcommerceProduto.jsx')(props);
    },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  for (const child of (tree.props?.children || []).flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
const general = tree => find(tree, node => node.type === 'ProdutoForm');
const ecommerce = tree => find(tree, node => Boolean(node.props?.setFormData) && node.type === 'AbaEcommerceProduto');
const input = (tree, placeholder) => find(tree, node => node.props?.placeholder === placeholder);
const row = { id: 'product-a', updated_date: 'v1', codigo: '000123', descricao: 'Produto sintético',
  descricao_seo: 'SEO anterior', slug_site: 'produto-anterior', exibir_no_site: true,
  unidades_secundarias: ['KG'], legado: { origem: 'fixture' }, empresa_id: 'company-a', group_id: 'group-a' };
function editManual(h, props, seo = 'SEO manual', slug = 'PRODUTO NOVO') {
  let tree = h.render(props);
  let fields = h.inputs(ecommerce(tree).props);
  input(fields, 'Descrição detalhada para SEO (150-250 palavras)...').props.onChange({ target: { value: seo } });
  tree = h.render(props); fields = h.inputs(ecommerce(tree).props);
  input(fields, 'vergalhao-8mm-ca50').props.onChange({ target: { value: slug } });
  return h.render(props);
}

test('manual SEO/slug: one owner save, edited general data and legacy identity preserved, reopen and clear', async () => {
  const h = mount(), calls = [];
  const props = { produto: row, onSubmit: async payload => { calls.push(payload); } };
  const tree = editManual(h, props);
  assert.equal(calls.length, 0);
  const generalTab = find(tree, node => node.props?.value === 'dados-gerais' && node.props?.forceMount);
  assert.ok(generalTab);
  assert.match(generalTab.props.className, /inactive.*hidden/);
  await general(tree).props.onSubmit({ ...row, descricao: 'Dados gerais editados', preco_venda: 42 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].descricao, 'Dados gerais editados');
  assert.equal(calls[0].preco_venda, 42);
  assert.equal(calls[0].descricao_seo, 'SEO manual');
  assert.equal(calls[0].slug_site, 'produto-novo');
  assert.equal(calls[0].id, row.id);
  assert.equal(calls[0].codigo, row.codigo);
  assert.deepEqual(calls[0].legado, row.legado);
  const reopened = mount();
  const reopenedProps = { produto: calls[0], onSubmit: props.onSubmit };
  const fields = reopened.inputs(ecommerce(reopened.render(reopenedProps)).props);
  assert.equal(input(fields, 'vergalhao-8mm-ca50').props.value, 'produto-novo');
  const cleared = editManual(reopened, reopenedProps, '', '');
  await general(cleared).props.onSubmit(calls[0]);
  assert.equal(calls[1].descricao_seo, '');
  assert.equal(calls[1].slug_site, '');
});

test('cancel does not write; failure keeps draft and reports error; duplicate save is blocked until settlement', async () => {
  const cancelled = mount(); let calls = 0;
  editManual(cancelled, { produto: row, onSubmit: () => calls++ });
  assert.equal(calls, 0);
  const h = mount(); let reject;
  const props = { produto: row, onSubmit: () => { calls++; return new Promise((_, no) => { reject = no; }); } };
  const tree = editManual(h, props), save = general(tree).props.onSubmit;
  const first = save(row); await save(row);
  assert.equal(calls, 1);
  reject(new Error('synthetic failure')); await first;
  assert.equal(h.errors.length, 1);
  assert.equal(ecommerce(h.render(props)).props.formData.slug_site, 'produto-novo');
  props.onSubmit = async () => { calls++; };
  await general(h.render(props)).props.onSubmit(row);
  assert.equal(calls, 2);
});

for (const change of ['record', 'version', 'company', 'group', 'actor']) {
  test(`identity ${change}: draft reset, old input/save callbacks cannot write into new context`, async () => {
    const h = mount(), calls = [];
    let props = { produto: row, onSubmit: payload => calls.push(payload) };
    const old = editManual(h, props);
    if (change === 'record') props = { ...props, produto: { ...row, id: 'product-b' } };
    if (change === 'version') props = { ...props, produto: { ...row, updated_date: 'v2' } };
    if (change === 'company') h.scope.empresaAtual = { id: 'company-b' };
    if (change === 'group') h.scope.grupoAtual = { id: 'group-b' };
    if (change === 'actor') h.permissions.user = { id: 'actor-b' };
    let tree = h.render(props);
    assert.notEqual(general(tree).props.key, general(old).props.key);
    ecommerce(old).props.setFormData(previous => ({ ...previous, descricao_seo: 'late response' }));
    await general(old).props.onSubmit(row);
    tree = h.render(props);
    assert.equal(calls.length, 0);
    assert.equal(ecommerce(tree).props.formData.descricao_seo, 'SEO anterior');
  });
}

test('read-only or submitting form neither changes draft nor calls persistence owner', async () => {
  for (const submitting of [false, true]) {
    const h = mount(), calls = [];
    if (!submitting) { h.permissions.canCreate = () => false; h.permissions.canEdit = () => false; }
    const props = { produto: row, isSubmitting: submitting, onSubmit: payload => calls.push(payload) };
    const tree = editManual(h, props);
    assert.equal(find(tree, node => node.type === 'fieldset').props.disabled, true);
    await general(tree).props.onSubmit(row);
    assert.equal(calls.length, 0);
    assert.equal(ecommerce(h.render(props)).props.formData.descricao_seo, 'SEO anterior');
  }
});

// Exercise the existing V24 writer itself, including its scope/RBAC/load gates and audit.
function viewerOwner(record, overrides = {}) {
  const source = fs.readFileSync('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', 'utf8');
  const ast = ts.createSourceFile('viewer.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const nodes = [];
  const visit = node => { nodes.push(node); ts.forEachChild(node, visit); }; visit(ast);
  const variable = name => nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name);
  const classifier = nodes.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'isSelfManagedCadastroForm');
  const classify = new Function(`const ${variable('SELF_MANAGED_NAMES').getText(ast)}; ${classifier.getText(ast)}; return isSelfManagedCadastroForm;`)();
  const writes = [], audits = [], closed = [], alerts = [];
  const scope = { groupId: 'group-a', empresaId: 'company-a' };
  const bindings = {
    ENTITY: 'Produto', editItem: record, canDeleteCadastro: false, canEditCadastro: true,
    canCreateCadastro: true, isLoadingEdit: false, editLoadBlocked: false,
    formScopeRef: { current: scope }, scopeKey: scope, activeScopeRef: { current: scope },
    assertCadastroFormScopeCurrent,
    groupId: scope.groupId, empresaId: scope.empresaId,
    ENTITY_CONTEXT_FIELD: {}, setIsSaving: () => {},
    cadastroPerm: action => `Cadastros.Produto.${action}`,
    buildCadastroEditSavePayload, handleCloseForm: value => closed.push(value),
    updateInContext: async (entity, id, payload) => { writes.push({ entity, id, payload }); },
    createInContext: async () => { throw new Error('Unexpected create for edit'); },
    auditCadastroEvent: async (...args) => { audits.push(args); },
    alert: text => alerts.push(text),
  };
  Object.assign(bindings, overrides);
  const save = new Function(...Object.keys(bindings), `return (${variable('handlePersistSubmit').initializer.arguments[0].getText(ast)});`)(...Object.values(bindings));
  return { classify, save, writes, audits, closed, alerts };
}

test('V24 actual writer owns callback Product forms, V22 still owns itself; one write plus audit and reopen', async () => {
  const owner = viewerOwner(row);
  function ProdutoFormCompleto() {} function ProdutoForm() {} function ProdutoFormV22_Completo() {}
  assert.equal(owner.classify(ProdutoFormCompleto), false);
  assert.equal(owner.classify(ProdutoForm), false);
  assert.equal(owner.classify(ProdutoFormV22_Completo), true);
  assert.equal(owner.classify({ isSelfManagedCadastro: true }), true);
  const h = mount(), props = { produto: row, onSubmit: owner.save };
  await general(editManual(h, props)).props.onSubmit({ ...row, descricao: 'Descrição editada' });
  assert.equal(owner.writes.length, 1);
  assert.equal(owner.writes[0].entity, 'Produto');
  assert.equal(owner.writes[0].id, row.id);
  assert.equal(owner.writes[0].payload.slug_site, 'produto-novo');
  assert.equal(owner.audits.length, 1);
  assert.equal(owner.audits[0][0], 'Edicao');
  assert.equal(owner.audits[0][2].depois.descricao_seo, 'SEO manual');
  assert.deepEqual(owner.closed, [true]);
  assert.deepEqual(owner.alerts, []);
  const reopened = mount();
  assert.equal(ecommerce(reopened.render({ produto: owner.writes[0].payload, onSubmit: owner.save })).props.formData.slug_site, 'produto-novo');
});

test('actual writer denies permission/incomplete load and never closes on persistence failure', async () => {
  for (const overrides of [{ canEditCadastro: false }, { editLoadBlocked: true }]) {
    const owner = viewerOwner(row, overrides);
    await assert.rejects(owner.save(row));
    assert.equal(owner.writes.length, 0);
    assert.equal(owner.audits[0][0], 'Bloqueio');
    assert.equal(owner.closed.length, 0);
  }
  const owner = viewerOwner(row, { updateInContext: async () => { throw new Error('Synthetic storage unavailable'); } });
  const h = mount(), props = { produto: row, onSubmit: owner.save };
  await general(editManual(h, props)).props.onSubmit(row);
  assert.equal(owner.audits.length, 1);
  assert.equal(owner.audits[0][0], 'Falha');
  assert.equal(owner.closed.length, 0);
  assert.equal(owner.alerts.length, 1);
  assert.equal(ecommerce(h.render(props)).props.formData.slug_site, 'produto-novo');
});


test('revoked access blocks already captured input and save callbacks', async () => {
  const h = mount(), calls = [];
  const props = { produto: row, onSubmit: payload => calls.push(payload) };
  const old = editManual(h, props);
  h.permissions.canEdit = () => false;
  h.permissions.canCreate = () => false;
  h.render(props);
  ecommerce(old).props.setFormData(previous => ({ ...previous, descricao_seo: 'late' }));
  await general(old).props.onSubmit(row);
  assert.equal(calls.length, 0);
  assert.equal(ecommerce(h.render(props)).props.formData.descricao_seo, 'SEO manual');
});


function visibleText(node) {
  if (Array.isArray(node)) return node.map(visibleText).join('');
  if (node == null || node === false) return '';
  return typeof node === 'object' ? visibleText(node.props.children) : String(node);
}
const conversions = tree => find(tree, node => node.type === 'AbaConversoesProduto');
function settleDraft(h, props) {
  let tree, form;
  for (let i = 0; i < 4; i++) {
    tree = h.render(props);
    form = h.generalInputs(general(tree).props);
  }
  return { tree: h.render(props), form };
}
const bar = { ...row, eh_bitola: true, peso_teorico_kg_m: 2, comprimento_barra_padrao_m: 10,
  fatores_conversao: { kg_por_metro: 2, kg_por_peca: 20, metros_por_peca: 10, peca_por_ton: 50, kg_por_ton: 1000 } };

test('345 real general handlers update conversion preview before saving; cancel preserves original and one save retains SEO', async () => {
  const h = mount(), calls = [], original = structuredClone(bar);
  const props = { produto: bar, onSubmit: async payload => calls.push(payload) };
  let { tree, form } = settleDraft(h, props);
  input(form, '0.395').props.onChange({ target: { value: '2.5' } });
  ({ tree, form } = settleDraft(h, props));
  assert.equal(conversions(tree).props.formData.fatores_conversao.kg_por_metro, 2.5);
  assert.equal(conversions(tree).props.formData.fatores_conversao.kg_por_peca, 25);
  assert.ok(visibleText(h.preview(conversions(tree).props)).includes('40.000 PÇ'));
  const length = find(form, node => node.props?.type === 'number' && node.props?.value === 10 && node.props?.onChange);
  assert.ok(length); length.props.onChange({ target: { value: '8' } });
  ({ tree, form } = settleDraft(h, props));
  assert.equal(conversions(tree).props.formData.fatores_conversao.kg_por_peca, 20);
  assert.ok(visibleText(h.preview(conversions(tree).props)).includes('50.000 PÇ'));
  const unit = find(form, node => node.props?.onClick && node.props?.children?.includes('MT'));
  assert.ok(unit); unit.props.onClick();
  ({ tree, form } = settleDraft(h, props));
  assert.ok(conversions(tree).props.formData.unidades_secundarias.includes('MT'));
  find(tree, node => node.type === 'Tabs').props.onValueChange('conversoes');
  ({ tree, form } = settleDraft(h, props));
  assert.equal(find(tree, node => node.type === 'Tabs').props.value, 'conversoes');

  assert.equal(calls.length, 0);
  assert.deepEqual(bar, original);
  tree = editManual(h, props);
  ({ tree, form } = settleDraft(h, props));
  await form.props.onSubmit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fatores_conversao.kg_por_metro, 2.5);
  assert.equal(calls[0].fatores_conversao.metros_por_peca, 8);
  assert.equal(calls[0].descricao_seo, 'SEO manual');
  assert.equal(calls[0].slug_site, 'produto-novo');
  assert.equal(calls[0].id, bar.id);
  const reopened = settleDraft(mount(), { produto: calls[0] });
  assert.equal(conversions(reopened.tree).props.formData.fatores_conversao.kg_por_peca, 20);
  const cancelled = settleDraft(mount(), props);
  assert.equal(conversions(cancelled.tree).props.formData.fatores_conversao.kg_por_metro, 2);
});

for (const change of ['record', 'version', 'company', 'group', 'actor']) {
  test(`345 conversion draft rejects stale ${change} callbacks and resets preview`, () => {
    const h = mount(); let props = { produto: bar };
    let { form } = settleDraft(h, props);
    input(form, '0.395').props.onChange({ target: { value: '3' } });
    const old = settleDraft(h, props).tree;
    assert.equal(conversions(old).props.formData.fatores_conversao.kg_por_metro, 3);
    if (change === 'record') props = { produto: { ...bar, id: 'product-b' } };
    if (change === 'version') props = { produto: { ...bar, updated_date: 'v2' } };
    if (change === 'company') h.scope.empresaAtual = { id: 'company-b' };
    if (change === 'group') h.scope.grupoAtual = { id: 'group-b' };
    if (change === 'actor') h.permissions.user = { id: 'actor-b' };
    h.render(props);
    general(old).props.onConversionDraft?.({ fatores_conversao: { kg_por_metro: 999 } });
    const next = settleDraft(h, props).tree;
    assert.equal(conversions(next).props.formData.fatores_conversao.kg_por_metro, 2);
  });
}
