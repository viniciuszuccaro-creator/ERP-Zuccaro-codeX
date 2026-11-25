import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

async function mountForm(relPath, { initial, initialProp = 'item' }) {
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

  let props = { item: initial, [initialProp]: initial, onSubmit: () => {}, isSubmitting: false };
  const confirms = [];
  const updates = [];
  const creates = [];
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
    '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
    '@/components/ui/checkbox': { Checkbox: 'Checkbox' },
    '@/components/ui/badge': { Badge: 'Badge' },
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
      useContextoVisual: () => ({
        empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
        grupoAtual: { id: 'grp-1' },
        contexto: 'empresa',
        filterInContext: async () => [],
        createInContext: async (entity, payload) => { creates.push({ entity, payload }); return payload; },
        updateInContext: async (entity, id, payload) => { updates.push({ entity, id, payload }); return payload; },
      }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': { __esModule: true, default: hookFn },
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
    sonner: { toast: { success: () => {}, error: () => {} } },
    '@tanstack/react-query': {
      useQuery: () => ({ data: [], isLoading: false }),
    },
  };
  vm.runInNewContext(compile(formSource), sandbox);
  const Component = formExports.default || formExports;

  const flush = () => { const batch = scheduled.splice(0); batch.forEach((fn) => fn()); };
  const render = (next = {}) => {
    Object.assign(props, next);
    if (next.item !== undefined) props.item = next.item;
    if (next[initialProp] !== undefined) props[initialProp] = next[initialProp];
    slot = 0;
    const tree = Component(props);
    flush();
    const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
    return { tree, walk: () => walk(tree) };
  };

  render();
  return {
    render,
    confirms: () => confirms,
    updates: () => updates,
    creates: () => creates,
    setConfirm(v) { sandbox.__confirmResult = v; },
    getForm() {
      // formData is first useState in both forms
      return state[0];
    },
    setForm(patch) {
      const cur = state[0];
      state[0] = { ...cur, ...patch };
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

test('defeito reproduzivel OperadorCaixa: sem reopen canônico perdia updated_at e salvava props.id', async () => {
  // Antes: apenas prevIdRef + operador?.id. Agora: hook + boundId.
  const src = await readFile(new URL('../src/components/cadastros/OperadorCaixaForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /operadorBoundId/);
  assert.match(src, /updateInContext\('OperadorCaixa', operadorBoundId/);
  assert.doesNotMatch(src, /if \(operador\?\.id\)/);
});

test('OperadorCaixa: updated_at reabre e preserva permissoes_especiais', async () => {
  const initial = {
    id: 'op-1',
    codigo_operador: 'OP001',
    nome_caixa: 'Caixa A',
    permissoes_especiais: ['Sangria', 'Abrir Gaveta'],
    limite_desconto_percentual: 5,
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/OperadorCaixaForm.jsx', { initial });
  assert.deepEqual(h.getForm().permissoes_especiais, ['Sangria', 'Abrir Gaveta']);
  h.render({
    item: {
      ...initial,
      nome_caixa: 'Caixa B',
      permissoes_especiais: ['Sangria'],
      updated_at: '2026-01-02T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_caixa, 'Caixa B');
  assert.deepEqual(h.getForm().permissoes_especiais, ['Sangria']);
});

test('OperadorCaixa: dirty + updated_at recusa preserva rascunho; submit usa boundId A', async () => {
  const initial = {
    id: 'op-a',
    codigo_operador: 'OPA',
    nome_caixa: 'Original',
    permissoes_especiais: ['Sangria'],
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/OperadorCaixaForm.jsx', { initial });
  h.setForm({ nome_caixa: 'Rascunho Local' });
  h.setConfirm(false);
  h.render({
    item: {
      ...initial,
      nome_caixa: 'Servidor',
      updated_at: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_caixa, 'Rascunho Local');
  assert.ok(h.confirms().length >= 1);
  await h.submit();
  assert.equal(h.updates().length, 1);
  assert.equal(h.updates()[0].id, 'op-a');
  assert.equal(h.updates()[0].payload.id, 'op-a');
  assert.equal(h.updates()[0].payload.nome_caixa, 'Rascunho Local');
});

test('OperadorCaixa: troca de registro dirty recusada nao aplica B', async () => {
  const a = {
    id: 'op-a',
    codigo_operador: 'OPA',
    nome_caixa: 'A',
    permissoes_especiais: [],
    updated_at: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/OperadorCaixaForm.jsx', { initial: a });
  h.setForm({ nome_caixa: 'Draft A' });
  h.setConfirm(false);
  h.render({
    item: {
      id: 'op-b',
      codigo_operador: 'OPB',
      nome_caixa: 'B',
      permissoes_especiais: ['Fechamento Caixa'],
      updated_at: '2026-02-01T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_caixa, 'Draft A');
  await h.submit();
  assert.equal(h.updates().at(-1).id, 'op-a');
});

test('CondicaoComercialForm: updated_at reabre parcelas/desconto; submit ancora boundId', async () => {
  const initial = {
    id: 'cc-1',
    nome_condicao: '30/60',
    forma_pagamento: 'Parcelado',
    numero_parcelas: 2,
    intervalo_parcelas_dias: 30,
    desconto_percentual: 1.5,
    tipo_frete: 'CIF',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const h = await mountForm('src/components/cadastros/CondicaoComercialForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_condicao: '30/60/90',
      numero_parcelas: 3,
      desconto_percentual: 2,
      updated_at: '2026-01-02T00:00:00Z',
    },
    onSubmit: (payload) => submitted.push(payload),
  });
  assert.equal(h.getForm().nome_condicao, '30/60/90');
  assert.equal(h.getForm().numero_parcelas, 3);
  assert.equal(h.getForm().desconto_percentual, 2);
  await h.submit();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'cc-1');
  assert.equal(submitted[0].nome_condicao, '30/60/90');
  assert.equal(submitted[0].numero_parcelas, 3);
});

test('OperadorCaixa: updated_date legado reabre permissoes sem updated_at', async () => {
  const initial = {
    id: 'op-leg',
    codigo_operador: 'OPL',
    nome_caixa: 'Legado',
    permissoes_especiais: ['Sangria'],
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/OperadorCaixaForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_caixa: 'Legado Novo',
      permissoes_especiais: ['Sangria', 'Abrir Gaveta'],
      updated_date: '2026-01-02T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_caixa, 'Legado Novo');
  assert.deepEqual(h.getForm().permissoes_especiais, ['Sangria', 'Abrir Gaveta']);
});

test('CondicaoComercialForm: updated_date legado reabre parcelas sem updated_at', async () => {
  const initial = {
    id: 'cc-leg',
    nome_condicao: 'Legado',
    forma_pagamento: 'Parcelado',
    numero_parcelas: 2,
    desconto_percentual: 1,
    tipo_frete: 'CIF',
    updated_date: '2026-01-01T00:00:00Z',
  };
  const h = await mountForm('src/components/cadastros/CondicaoComercialForm.jsx', { initial });
  h.render({
    item: {
      ...initial,
      nome_condicao: 'Legado Novo',
      numero_parcelas: 4,
      updated_date: '2026-01-03T00:00:00Z',
    },
  });
  assert.equal(h.getForm().nome_condicao, 'Legado Novo');
  assert.equal(h.getForm().numero_parcelas, 4);
});

test('CondicaoComercialForm: dirty recusa updated_at e submit mantem id aberto', async () => {
  const initial = {
    id: 'cc-a',
    nome_condicao: 'Vista',
    forma_pagamento: 'À Vista',
    numero_parcelas: 1,
    desconto_percentual: 0,
    tipo_frete: 'FOB',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const submitted = [];
  const formSource = await readFile(new URL('../src/components/cadastros/CondicaoComercialForm.jsx', import.meta.url), 'utf8');
  assert.match(formSource, /useCadastroReopenOnIdentity/);
  assert.match(formSource, /condicaoBoundId/);
  assert.match(formSource, /bg-sky-600/);

  const h = await mountForm('src/components/cadastros/CondicaoComercialForm.jsx', { initial });
  h.setForm({ nome_condicao: 'Draft Vista' });
  h.setConfirm(false);
  h.render({
    item: { ...initial, nome_condicao: 'Server', updated_at: '2026-01-05T00:00:00Z' },
    onSubmit: (p) => submitted.push(p),
  });
  assert.equal(h.getForm().nome_condicao, 'Draft Vista');
  await h.submit();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].id, 'cc-a');
  assert.equal(submitted[0].nome_condicao, 'Draft Vista');
});
