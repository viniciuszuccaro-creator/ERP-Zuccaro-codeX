import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

/**
 * Contraprovas comportamentais dos formulários COMPLETOS (não Representante/Banco).
 * Cobre: carregar, editar, updated_date externo com rascunho sujo, trocar registro,
 * cancelar troca, salvar pelo boundId e reabrir.
 *
 * esbuild (não tsc): CadastroClienteCompleto mistura `import React, {..}` com React.lazy
 * e o transpile CJS do tsc colide em `react_1`.
 */

const compile = (source) => transformSync(source, {
  loader: 'jsx',
  format: 'cjs',
  jsx: 'transform',
  target: 'es2022',
}).code;

function makeReact() {
  const state = [];
  const effects = [];
  const scheduled = [];
  let slot = 0;
  const react = {
    createElement: (type, props, ...children) => {
      const flat = children.flat(Infinity);
      const merged = { ...(props || {}), children: flat };
      if (typeof type === 'function') {
        try {
          return type(merged);
        } catch {
          return { type: type.name || 'Fn', props: merged, children: flat };
        }
      }
      if (type && type === react.Fragment) return { type: 'Fragment', props: merged, children: flat };
      return { type, props: props || {}, children: flat };
    },
    Fragment: 'Fragment',
    Suspense: 'Suspense',
    lazy: () => 'Lazy',
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
    useCallback(fn) { return fn; },
  };
  return {
    react,
    flush() { scheduled.splice(0).forEach((fn) => fn()); },
    resetSlot() { slot = 0; },
  };
}

function walk(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.children || []).flatMap(walk)];
}

async function loadHook(react) {
  const hookSource = await readFile(new URL('../src/components/cadastros/useCadastroReopenOnIdentity.js', import.meta.url), 'utf8');
  const hookExports = {};
  const confirms = [];
  const hookSandbox = {
    exports: hookExports,
    module: { exports: hookExports },
    require(id) {
      if (!hookSandbox.__modules[id]) throw new Error(`Import inesperado no hook: ${id}`);
      return hookSandbox.__modules[id];
    },
    window: {
      confirm(message) {
        confirms.push(message);
        return hookSandbox.__confirmResult !== false;
      },
    },
    __confirmResult: true,
    __modules: {
      react: { __esModule: true, default: react, ...react },
      './cadastroReopenPolicy': policy,
      './cadastroReopenPolicy.js': policy,
    },
  };
  // Contexto isolado: evita colisão de `var react_1` com o form no mesmo vm.
  vm.runInNewContext(compile(hookSource), hookSandbox);
  const resolved = hookSandbox.module.exports;
  const hookFn = typeof resolved === 'function' ? resolved : (resolved.default || hookExports.default || resolved);
  return {
    hookFn,
    confirms,
    setConfirm(result) { hookSandbox.__confirmResult = result !== false; },
    getConfirm() { return hookSandbox.__confirmResult !== false; },
  };
}

function stubUi() {
  return {
    Input: 'Input',
    Label: 'Label',
    Button: 'Button',
    Textarea: 'Textarea',
    Badge: 'Badge',
    Card: 'Card',
    CardContent: 'CardContent',
    Alert: 'Alert',
    AlertDescription: 'AlertDescription',
    ScrollArea: 'ScrollArea',
    Dialog: 'Dialog',
    DialogContent: 'DialogContent',
    DialogHeader: 'DialogHeader',
    DialogTitle: 'DialogTitle',
    Tabs: 'Tabs',
    TabsList: 'TabsList',
    TabsTrigger: 'TabsTrigger',
    TabsContent: 'TabsContent',
    Select: 'Select',
    SelectContent: 'SelectContent',
    SelectItem: 'SelectItem',
    SelectTrigger: 'SelectTrigger',
    SelectValue: 'SelectValue',
    Switch: 'Switch',
  };
}

async function mountCompleto(relPath, {
  propName,
  initial,
  extraModules = {},
}) {
  const formSource = await readFile(new URL(`../${relPath}`, import.meta.url), 'utf8');
  const { react, flush, resetSlot } = makeReact();
  const updates = [];
  const creates = [];
  const toasts = [];

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    window: {
      confirm() {
        return true;
      },
    },
    console,
    __react: react,
    __modules: {},
  };

  const hookCtl = await loadHook(react);
  const hookFn = hookCtl.hookFn;
  assert.equal(typeof hookFn, 'function', 'hook useCadastroReopenOnIdentity deve resolver como função');
  const confirms = hookCtl.confirms;
  sandbox.window.confirm = (message) => {
    confirms.push(message);
    return hookCtl.getConfirm();
  };
  const ui = stubUi();

  const formExports = {};
  sandbox.exports = formExports;
  sandbox.module = { exports: formExports };
  sandbox.__modules = {
    react: { __esModule: true, default: react, ...react },
    '@tanstack/react-query': {
      useMutation(opts) {
        return {
          mutate(data, extra) {
            Promise.resolve()
              .then(() => opts.mutationFn(data))
              .then((result) => {
                opts.onSuccess?.(result, data);
                extra?.onSettled?.();
              })
              .catch((error) => {
                opts.onError?.(error);
                extra?.onSettled?.();
              });
          },
          isPending: false,
        };
      },
      useQuery: () => ({ data: undefined, isLoading: false }),
      useQueryClient: () => ({ invalidateQueries() {} }),
    },
    '@/api/base44Client': { base44: { auth: { me: async () => null }, entities: {} }, isHttpBackendMode: false },
    '@/api/httpApiClient': { createHttpApiClient: () => ({}) },
    '@/api/erpHttpSession': { readErpHttpSession: () => null },
    '@/api/localCadastroMasterPolicy': {
      normalizeFornecedorCadastro: (payload) => ({ ...payload, normalized: true }),
    },
    '@/components/ui/input': { Input: ui.Input },
    '@/components/ui/label': { Label: ui.Label },
    '@/components/ui/button': { Button: ui.Button },
    '@/components/ui/textarea': { Textarea: ui.Textarea },
    '@/components/ui/badge': { Badge: ui.Badge },
    '@/components/ui/card': { Card: ui.Card, CardContent: ui.CardContent },
    '@/components/ui/alert': { Alert: ui.Alert, AlertDescription: ui.AlertDescription },
    '@/components/ui/scroll-area': { ScrollArea: ui.ScrollArea },
    '@/components/ui/dialog': {
      Dialog: ui.Dialog, DialogContent: ui.DialogContent,
      DialogHeader: ui.DialogHeader, DialogTitle: ui.DialogTitle,
    },
    '@/components/ui/tabs': {
      Tabs: ui.Tabs, TabsList: ui.TabsList, TabsTrigger: ui.TabsTrigger, TabsContent: ui.TabsContent,
    },
    '@/components/ui/select': {
      Select: ui.Select, SelectContent: ui.SelectContent, SelectItem: ui.SelectItem,
      SelectTrigger: ui.SelectTrigger, SelectValue: ui.SelectValue,
    },
    '@/components/ui/switch': { Switch: ui.Switch },
    '@/components/ui/use-toast': {
      useToast: () => ({ toast: (msg) => toasts.push(msg) }),
    },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({
        canCreate: () => true,
        canEdit: () => true,
        canDelete: () => true,
        hasPermission: () => true,
        hasFieldPermission: () => true,
        isAdmin: () => true,
      }),
    },
    '@/components/lib/useContextoVisual': {
      __esModule: true,
      default: () => ({
        empresaAtual: { id: 'e1', group_id: 'g1' },
        grupoAtual: { id: 'g1' },
        contexto: 'empresa',
        filterInContext: async () => [],
        createInContext: async (entity, payload, ownership) => {
          creates.push({ entity, payload, ownership });
          return { id: 'new-id', ...payload };
        },
        updateInContext: async (entity, id, payload, ownership) => {
          updates.push({ entity, id, payload, ownership });
          return { id, ...payload };
        },
        deleteInContext: async () => ({}),
      }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p, children: [] }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': {
      __esModule: true,
      default: typeof hookFn === 'function' ? hookFn : hookFn.default,
    },
    './hooks/useCadastroFormScopeGuard': {
      __esModule: true,
      default: () => ({ isCurrent: () => true, assertCurrent() {} }),
    },
    './GerenciarContatosClienteForm': {
      __esModule: true,
      default: (p) => ({ type: 'GerenciarContatosClienteForm', props: p, children: [] }),
    },
    './GerenciarEnderecosClienteForm': {
      __esModule: true,
      default: (p) => ({ type: 'GerenciarEnderecosClienteForm', props: p, children: [] }),
    },
    './clienteSugestaoVinculoUi': {
      buildClienteSugestaoVinculoBanner: () => ({ visible: false }),
      buildClienteSugestaoVinculoRaceKey: () => '',
      documentoProntoParaSugestao: () => null,
      shouldApplyClienteSugestaoVinculoBanner: () => false,
    },
    '@/components/lib/BuscaDadosPublicos': {
      BotaoBuscaAutomatica: () => ({ type: 'BotaoBuscaAutomatica', props: {}, children: [] }),
    },
    '@/components/cadastros/fornecedor/FornecedorFormSections': {
      FornecedorDadosGeraisSection: ({ formData, setFormData }) => ({
        type: 'FornecedorDadosGeraisSection',
        props: { formData, setFormData },
        children: [{
          type: 'Input',
          props: {
            id: 'nome',
            value: formData?.nome || '',
            onChange: (e) => setFormData({ ...formData, nome: e.target.value }),
          },
          children: [],
        }],
      }),
      FornecedorContatoEnderecoSection: () => ({ type: 'FornecedorContatoEnderecoSection', props: {}, children: [] }),
      FornecedorFiscalFinanceiroSection: () => ({ type: 'FornecedorFiscalFinanceiroSection', props: {}, children: [] }),
    },
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
    ...extraModules,
  };
  assert.equal(
    typeof sandbox.__modules['@/components/cadastros/useCadastroReopenOnIdentity'].default,
    'function',
    'módulo mock do hook deve expor default função',
  );
  vm.runInNewContext(compile(formSource), sandbox);

  let tree;
  const Component = sandbox.module.exports?.default || formExports.default || sandbox.module.exports;
  assert.equal(typeof Component, 'function', 'form completo deve exportar componente');
  let props = {
    [propName]: initial,
    item: initial,
    windowMode: true,
    isOpen: true,
    onClose() {},
    onSuccess() {},
  };

  const render = (nextProps) => {
    if (nextProps) props = { ...props, ...nextProps };
    resetSlot();
    tree = Component(props);
    flush();
    return tree;
  };
  render();
  render(); // segundo pass: efeitos de reopen estabilizam

  const findNome = () => walk(tree).find((n) => n.type === 'Input' && n.props?.id === 'nome');
  const findSave = () => walk(tree).find((n) => n.type === 'Button' && (
    String(n.props?.['data-action'] || '').includes('.salvar')
    || String(n.props?.['data-permission'] || '').includes('.salvar')
    || (typeof n.props?.onClick === 'function' && Array.isArray(n.children) && n.children.some((c) => /Salvar/i.test(String(c?.children || c || ''))))
  ));
  const getNome = () => findNome()?.props?.value;

  return {
    render,
    findNome,
    findSave,
    getNome,
    walk: () => walk(tree),
    confirms,
    updates,
    creates,
    toasts,
    setConfirm(result) { hookCtl.setConfirm(result); },
    async save() {
      const btn = findSave();
      assert.ok(btn?.props?.onClick, 'botão salvar deve existir');
      btn.props.onClick();
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    },
  };
}

const clienteA = {
  id: 'cli-a',
  codigo: '000001',
  nome: 'Cliente Alpha',
  tipo: 'Pessoa Física',
  status: 'Ativo',
  cpf: '11144477735',
  updated_date: '2026-01-01T00:00:00Z',
  contatos: [{ nome: 'A', tipo: 'Telefone', valor: '11', principal: true }],
  locais_entrega: [],
  condicao_comercial: {},
  configuracao_fiscal: {},
  documentos: [],
  empresa_id: 'e1',
  group_id: 'g1',
};

const clienteB = {
  id: 'cli-b',
  codigo: '000002',
  nome: 'Cliente Beta',
  tipo: 'Pessoa Física',
  status: 'Ativo',
  cpf: '39053344705',
  updated_date: '2026-01-02T00:00:00Z',
  contatos: [],
  locais_entrega: [],
  condicao_comercial: {},
  configuracao_fiscal: {},
  documentos: [],
  empresa_id: 'e1',
  group_id: 'g1',
};

const fornecedorA = {
  id: 'for-a',
  codigo: '000001',
  nome: 'Fornecedor Alpha',
  tipo_pessoa: 'Pessoa Juridica',
  status: 'Ativo',
  cnpj: '11222333000181',
  updated_date: '2026-01-01T00:00:00Z',
  empresa_id: 'e1',
  empresa_dona_id: 'e1',
  group_id: 'g1',
  avaliacoes: [],
};

const fornecedorB = {
  id: 'for-b',
  codigo: '000002',
  nome: 'Fornecedor Beta',
  tipo_pessoa: 'Pessoa Juridica',
  status: 'Ativo',
  cnpj: '00000000000191',
  updated_date: '2026-01-02T00:00:00Z',
  empresa_id: 'e1',
  empresa_dona_id: 'e1',
  group_id: 'g1',
  avaliacoes: [],
};

test('CadastroClienteCompleto: carrega registro e edita nome no componente real', async () => {
  const h = await mountCompleto('src/components/cadastros/CadastroClienteCompleto.jsx', {
    propName: 'cliente',
    initial: clienteA,
  });
  assert.equal(h.getNome(), 'Cliente Alpha');
  h.findNome().props.onChange({ target: { value: 'Rascunho Cliente' } });
  h.render();
  assert.equal(h.getNome(), 'Rascunho Cliente');
});

test('CadastroClienteCompleto: updated_date externo com rascunho sujo exige confirmação e cancela preserva', async () => {
  const h = await mountCompleto('src/components/cadastros/CadastroClienteCompleto.jsx', {
    propName: 'cliente',
    initial: clienteA,
  });
  h.findNome().props.onChange({ target: { value: 'Rascunho Sujo' } });
  h.setConfirm(false);
  h.render({
    cliente: { ...clienteA, nome: 'Externo', updated_date: '2026-01-03T12:00:00Z' },
    item: { ...clienteA, nome: 'Externo', updated_date: '2026-01-03T12:00:00Z' },
  });
  h.render();
  assert.equal(h.getNome(), 'Rascunho Sujo');
  assert.equal(h.confirms.length, 1);
});

test('CadastroClienteCompleto: troca cancelada — salvar usa boundId A, não id B das props', async () => {
  const h = await mountCompleto('src/components/cadastros/CadastroClienteCompleto.jsx', {
    propName: 'cliente',
    initial: clienteA,
  });
  h.findNome().props.onChange({ target: { value: 'Rascunho A' } });
  h.setConfirm(false);
  h.render({ cliente: clienteB, item: clienteB });
  h.render();
  assert.equal(h.getNome(), 'Rascunho A');
  await h.save();
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].entity, 'Cliente');
  assert.equal(h.updates[0].id, 'cli-a');
  assert.notEqual(h.updates[0].id, 'cli-b');
  assert.equal(h.updates[0].payload.nome, 'Rascunho A');
});

test('CadastroClienteCompleto: troca aceita reidrata B; salvar pelo boundId B', async () => {
  const h = await mountCompleto('src/components/cadastros/CadastroClienteCompleto.jsx', {
    propName: 'cliente',
    initial: clienteA,
  });
  h.findNome().props.onChange({ target: { value: 'Rascunho A' } });
  h.setConfirm(true);
  h.render({ cliente: clienteB, item: clienteB });
  h.render();
  assert.equal(h.getNome(), 'Cliente Beta');
  h.findNome().props.onChange({ target: { value: 'Editado B' } });
  h.render();
  await h.save();
  assert.equal(h.updates.at(-1).id, 'cli-b');
  assert.equal(h.updates.at(-1).payload.nome, 'Editado B');
});

test('CadastroClienteCompleto: passa assertScopeCurrent real aos gerenciadores de contatos/endereços', async () => {
  const h = await mountCompleto('src/components/cadastros/CadastroClienteCompleto.jsx', {
    propName: 'cliente',
    initial: clienteA,
  });
  const contatos = h.walk().find((n) => n.type === 'GerenciarContatosClienteForm');
  const enderecos = h.walk().find((n) => n.type === 'GerenciarEnderecosClienteForm');
  assert.equal(typeof contatos?.props?.assertScopeCurrent, 'function');
  assert.equal(typeof enderecos?.props?.assertScopeCurrent, 'function');
});

test('CadastroFornecedorCompleto: carrega, edita e switch-reject salva boundId A', async () => {
  const h = await mountCompleto('src/components/cadastros/CadastroFornecedorCompleto.jsx', {
    propName: 'fornecedor',
    initial: fornecedorA,
  });
  assert.equal(h.getNome(), 'Fornecedor Alpha');
  h.findNome().props.onChange({ target: { value: 'Rascunho Forn' } });
  h.setConfirm(false);
  h.render({ fornecedor: fornecedorB, item: fornecedorB });
  h.render();
  assert.equal(h.getNome(), 'Rascunho Forn');
  await h.save();
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].entity, 'Fornecedor');
  assert.equal(h.updates[0].id, 'for-a');
  assert.notEqual(h.updates[0].id, 'for-b');
  assert.equal(h.updates[0].ownership, 'empresa_dona_id');
  assert.match(String(h.updates[0].payload.nome), /Rascunho Forn/);
});

test('CadastroFornecedorCompleto: updated_date externo com rascunho sujo cancela e reabre limpo após aceitar', async () => {
  const h = await mountCompleto('src/components/cadastros/CadastroFornecedorCompleto.jsx', {
    propName: 'fornecedor',
    initial: fornecedorA,
  });
  h.findNome().props.onChange({ target: { value: 'Sujo' } });
  h.setConfirm(false);
  h.render({
    fornecedor: { ...fornecedorA, nome: 'Externo', updated_date: '2026-01-04T00:00:00Z' },
    item: { ...fornecedorA, nome: 'Externo', updated_date: '2026-01-04T00:00:00Z' },
  });
  h.render();
  assert.equal(h.getNome(), 'Sujo');
  assert.ok(h.confirms.length >= 1);

  h.setConfirm(true);
  h.render({
    fornecedor: { ...fornecedorA, nome: 'Externo Aceito', updated_date: '2026-01-05T00:00:00Z' },
    item: { ...fornecedorA, nome: 'Externo Aceito', updated_date: '2026-01-05T00:00:00Z' },
  });
  h.render();
  assert.equal(h.getNome(), 'Externo Aceito');
});
