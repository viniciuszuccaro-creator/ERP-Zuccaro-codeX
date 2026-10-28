/**
 * #353 P1 — OperadorCaixa: um único responsável pela persistência no percurso
 * tile Cadastros/Financeiro → VisualizadorUniversalEntidadeV24 → OperadorCaixaForm.
 *
 * Antes: form salvava + onSubmit(payload) → handlePersistSubmit → 2ª gravação.
 * Depois: isSelfManagedCadastro → onSubmit = handleCloseForm; form notifica conclusão sem regravar.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';
import { assertCadastroFormScopeCurrent } from '../src/components/lib/contextoMultiempresaPolicy.js';
import { buildCadastroEditSavePayload } from '../src/components/cadastros/cadastroEditLoadPolicy.js';

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
}

function extractViewerOwnerHelpers(source) {
  const ast = ts.createSourceFile('viewer.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const nodes = [];
  const visit = (node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(ast);
  const variable = (name) => nodes.find((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === name);
  const classifier = nodes.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'isSelfManagedCadastroForm');
  const classify = new Function(
    `const ${variable('SELF_MANAGED_NAMES').getText(ast)}; ${classifier.getText(ast)}; return isSelfManagedCadastroForm;`,
  )();
  const handlePersistSrc = variable('handlePersistSubmit').initializer.arguments[0].getText(ast);
  return { classify, handlePersistSrc };
}

async function mountOperador({ onSubmit, canCreate = true, canEdit = true, initial = null, contextoVisual } = {}) {
  const formSource = await readFile(new URL('../src/components/cadastros/OperadorCaixaForm.jsx', import.meta.url), 'utf8');
  const hookSource = await readFile(new URL('../src/components/cadastros/useCadastroReopenOnIdentity.js', import.meta.url), 'utf8');

  const state = [];
  const effects = [];
  const scheduled = [];
  let slot = 0;
  const creates = [];
  const updates = [];
  const completions = [];
  const toasts = { success: [], error: [] };
  const visual = {
    empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
    grupoAtual: { id: 'grp-1' },
    contexto: 'empresa',
    ...(contextoVisual || {}),
  };

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

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    window: { confirm: () => true },
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
    '@/components/ui/checkbox': { Checkbox: 'Checkbox' },
    '@/components/ui/badge': { Badge: 'Badge' },
    '@/components/ui/select': {
      Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
    },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({
        canCreate: () => canCreate,
        canEdit: () => canEdit,
        canDelete: () => true,
        hasPermission: () => true,
      }),
    },
    '@/components/lib/useContextoVisual': {
      useContextoVisual: () => ({
        ...visual,
        filterInContext: async () => [],
        createInContext: async (entity, payload) => {
          creates.push({ entity, payload });
          return { ...payload, id: payload.id || `created-${creates.length}` };
        },
        updateInContext: async (entity, id, payload) => {
          updates.push({ entity, id, payload });
          return { ...payload, id };
        },
      }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': { __esModule: true, default: hookFn },
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
    sonner: {
      toast: {
        success: (m) => toasts.success.push(m),
        error: (m) => toasts.error.push(m),
      },
    },
    '@tanstack/react-query': {
      useQuery: () => ({ data: [], isLoading: false }),
    },
  };
  vm.runInNewContext(compile(formSource), sandbox);
  const Component = formExports.default || formExports;

  const props = {
    item: initial,
    onSubmit: onSubmit || ((arg) => { completions.push({ via: 'onSubmit', arg }); }),
    onClose: (arg) => { completions.push({ via: 'onClose', arg }); },
  };

  const flush = () => { const batch = scheduled.splice(0); batch.forEach((fn) => fn()); };
  const render = () => {
    slot = 0;
    const tree = Component(props);
    flush();
    const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
    return { tree, walk: () => walk(tree) };
  };
  render();

  return {
    Component,
    creates: () => creates,
    updates: () => updates,
    completions: () => completions,
    toasts,
    getForm: () => state[0],
    setForm(patch) { state[0] = { ...state[0], ...patch }; },
    setContexto(patch) { Object.assign(visual, patch); },
    render,
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

function viewerPersistSubmit(record, overrides = {}) {
  return (async () => {
    const source = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
    const { handlePersistSrc } = extractViewerOwnerHelpers(source);
    const writes = [];
    const closed = [];
    const audits = [];
    const alerts = [];
    const scope = { groupId: 'grp-1', empresaId: 'emp-1' };
    const bindings = {
      ENTITY: 'OperadorCaixa',
      editItem: record,
      canDeleteCadastro: false,
      canEditCadastro: true,
      canCreateCadastro: true,
      isLoadingEdit: false,
      editLoadBlocked: false,
      formScopeRef: { current: scope },
      scopeKey: scope,
      activeScopeRef: { current: scope },
      assertCadastroFormScopeCurrent,
      groupId: scope.groupId,
      empresaId: scope.empresaId,
      ENTITY_CONTEXT_FIELD: {},
      setIsSaving: () => {},
      cadastroPerm: (action) => `Cadastros.OperadorCaixa.${action}`,
      buildCadastroEditSavePayload,
      handleCloseForm: (value) => closed.push(value),
      updateInContext: async (entity, id, payload) => { writes.push({ op: 'update', entity, id, payload }); },
      createInContext: async (entity, payload) => {
        writes.push({ op: 'create', entity, payload });
        return { ...payload, id: 'viz-created' };
      },
      deleteInContext: async () => {},
      auditCadastroEvent: async (...args) => { audits.push(args); },
      alert: (text) => alerts.push(text),
    };
    Object.assign(bindings, overrides);
    const save = new Function(...Object.keys(bindings), `return (${handlePersistSrc});`)(...Object.values(bindings));
    return { save, writes, closed, audits, alerts };
  })();
}

test('OperadorCaixaForm declara self-managed minify-safe (V24 não usa handlePersistSubmit)', async () => {
  const formSource = await readFile(new URL('../src/components/cadastros/OperadorCaixaForm.jsx', import.meta.url), 'utf8');
  assert.match(formSource, /isSelfManagedCadastro\s*=\s*true/);
  assert.match(formSource, /displayName\s*=\s*["']OperadorCaixaForm["']/);
  assert.match(formSource, /notifyCompletion|onSubmit\(true\)/);

  const viewerSource = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  const { classify } = extractViewerOwnerHelpers(viewerSource);
  const Form = (await mountOperador({})).Component;
  assert.equal(Form.isSelfManagedCadastro, true);
  assert.equal(classify(Form), true);
  assert.equal(classify({ isSelfManagedCadastro: true }), true);
  function OperadorCaixaFormAnon() {}
  assert.equal(classify(OperadorCaixaFormAnon), false);
});

test('percurso visualizador self-managed: criação = 1 createInContext + conclusão sem 2ª persistência', async () => {
  const closed = [];
  const h = await mountOperador({
    initial: null,
    onSubmit: (wasSaved) => { closed.push(wasSaved); },
  });
  h.setForm({
    colaborador_id: 'col-1',
    usuario_nome: 'Ana',
    nome_caixa: 'Caixa 1',
    empresa_id: 'emp-1',
    codigo_operador: 'OP10',
  });
  await h.submit();
  assert.equal(h.creates().length, 1);
  assert.equal(h.creates()[0].entity, 'OperadorCaixa');
  assert.equal(h.updates().length, 0);
  assert.deepEqual(closed, [true]);
  // Conclusão não reenvia payload ao writer
  assert.equal(typeof closed[0], 'boolean');
});

test('percurso visualizador self-managed: edição = 1 updateInContext + conclusão', async () => {
  const closed = [];
  const h = await mountOperador({
    initial: {
      id: 'op-1',
      nome_caixa: 'Caixa A',
      codigo_operador: 'OP01',
      permissoes_especiais: ['Sangria'],
      updated_at: '2026-01-01T00:00:00Z',
    },
    onSubmit: (wasSaved) => { closed.push(wasSaved); },
  });
  h.setForm({ nome_caixa: 'Caixa A editado' });
  await h.submit();
  assert.equal(h.updates().length, 1);
  assert.equal(h.updates()[0].id, 'op-1');
  assert.equal(h.creates().length, 0);
  assert.deepEqual(closed, [true]);
});

test('contraprova do defeito: onSubmit=handlePersistSubmit + payload duplicaria gravação', async () => {
  const owner = await viewerPersistSubmit(null);
  const h = await mountOperador({
    initial: null,
    // Simula o wiring antigo (não self-managed): form salva e ainda chama o writer do visualizador.
    onSubmit: async (payload) => {
      if (payload && typeof payload === 'object') await owner.save(payload);
    },
  });
  // Forçar o caminho quebrado: chamar writer com payload após create interno.
  // O form corrigido passa `true`, não o payload — esta contraprova monta o cenário antigo manualmente.
  h.setForm({ nome_caixa: 'Dup', empresa_id: 'emp-1', colaborador_id: 'c1' });
  await h.submit();
  assert.equal(h.creates().length, 1, 'form já persistiu');
  // Com form corrigido, onSubmit recebe true → handlePersistSubmit antigo quebraria se recebesse objeto.
  // Demonstra que handlePersistSubmit COM payload gera segunda escrita:
  await owner.save({
    nome: 'Dup',
    nome_caixa: 'Dup',
    empresa_id: 'emp-1',
    group_id: 'grp-1',
    ativo: true,
  });
  assert.equal(owner.writes.length, 1);
  assert.equal(owner.writes[0].op, 'create');
  // Total de persistências se o wiring antigo existisse: form(1) + viewer(1) = 2
  assert.equal(h.creates().length + owner.writes.length, 2);
});

test('erro de persistência preserva rascunho e não notifica conclusão', async () => {
  const formSource = await readFile(new URL('../src/components/cadastros/OperadorCaixaForm.jsx', import.meta.url), 'utf8');
  // Montagem com create que falha
  const formSourcePath = new URL('../src/components/cadastros/OperadorCaixaForm.jsx', import.meta.url);
  const hookSource = await readFile(new URL('../src/components/cadastros/useCadastroReopenOnIdentity.js', import.meta.url), 'utf8');
  const state = [];
  const effects = [];
  const scheduled = [];
  let slot = 0;
  const completions = [];
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
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    window: { confirm: () => true },
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
    '@/components/ui/checkbox': { Checkbox: 'Checkbox' },
    '@/components/ui/badge': { Badge: 'Badge' },
    '@/components/ui/select': {
      Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
    },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({ canCreate: () => true, canEdit: () => true, canDelete: () => true, hasPermission: () => true }),
    },
    '@/components/lib/useContextoVisual': {
      useContextoVisual: () => ({
        empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
        grupoAtual: { id: 'grp-1' },
        contexto: 'empresa',
        filterInContext: async () => [],
        createInContext: async () => { throw new Error('storage unavailable'); },
        updateInContext: async () => { throw new Error('storage unavailable'); },
      }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': { __esModule: true, default: hookFn },
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
    sonner: { toast: { success: () => {}, error: () => {} } },
    '@tanstack/react-query': { useQuery: () => ({ data: [], isLoading: false }) },
  };
  vm.runInNewContext(compile(await readFile(formSourcePath, 'utf8')), sandbox);
  const Component = formExports.default || formExports;
  const props = {
    item: null,
    onSubmit: (arg) => { completions.push(arg); },
    onClose: (arg) => { completions.push(arg); },
  };
  slot = 0;
  let tree = Component(props);
  scheduled.splice(0).forEach((fn) => fn());
  state[0] = { ...state[0], nome_caixa: 'Rascunho', empresa_id: 'emp-1', colaborador_id: 'c1' };
  slot = 0;
  tree = Component(props);
  scheduled.splice(0).forEach((fn) => fn());
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  const form = walk(tree).find((n) => n.type === 'form' || (n.props && n.props.onSubmit));
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(completions.length, 0);
  assert.equal(state[0].nome_caixa, 'Rascunho');
  assert.match(formSource, /Erro:|toast\.error/);
});

test('sem permissão: não persiste nem notifica', async () => {
  const h = await mountOperador({ canCreate: false, canEdit: false, initial: null });
  h.setForm({ nome_caixa: 'X', empresa_id: 'emp-1' });
  await h.submit();
  assert.equal(h.creates().length, 0);
  assert.equal(h.updates().length, 0);
  assert.equal(h.completions().length, 0);
});

test('OperadorCaixa tenant: troca empresa invalida rascunho — não retargeta nome de A em B', async () => {
  const src = await readFile(new URL('../src/components/cadastros/OperadorCaixaForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /tenantKey/);
  assert.match(src, /JSON\.stringify\(\[groupId/);
  const hook = await readFile(new URL('../src/components/cadastros/useCadastroReopenOnIdentity.js', import.meta.url), 'utf8');
  assert.match(hook, /tenantKey\s*=\s*null/);

  const h = await mountOperador({
    initial: null,
    contextoVisual: {
      empresaAtual: { id: 'emp-A', group_id: 'grp-1' },
      grupoAtual: { id: 'grp-1' },
      contexto: 'empresa',
    },
  });
  h.setForm({ nome_caixa: 'Operador-A', empresa_id: 'emp-A' });
  assert.equal(h.getForm().nome_caixa, 'Operador-A');

  h.setContexto({
    empresaAtual: { id: 'emp-B', group_id: 'grp-1' },
    grupoAtual: { id: 'grp-1' },
    contexto: 'empresa',
  });
  h.render();

  assert.equal(h.getForm().empresa_id, 'emp-B');
  assert.notEqual(h.getForm().nome_caixa, 'Operador-A', 'rascunho de A não sobrevive à troca de empresa');
  await h.submit();
  // emptyForm após troca: nome vazio — create pode ocorrer com nome '' ou ser bloqueado por validação
  // Critério: payload NÃO carrega nome_caixa Operador-A
  if (h.creates().length) {
    assert.notEqual(h.creates()[0].payload.nome_caixa, 'Operador-A');
  }
});
