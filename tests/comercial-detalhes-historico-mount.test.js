/**
 * #397 — montagem real de HistoricoProdutosCliente em DetalhesCliente e PedidoTabsContainer.
 * Não basta presença no texto-fonte: a árvore renderizada deve incluir o componente.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

function walk(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.children || []).flatMap(walk)];
}

function findByAction(tree, action) {
  return walk(tree).filter((n) => n?.props?.['data-action'] === action);
}

function findHistoricoProdutos(tree) {
  return walk(tree).filter((n) => {
    const t = n?.type;
    if (t === 'HistoricoProdutosCliente') return true;
    if (typeof t === 'function' && (t.name === 'HistoricoProdutosCliente' || t.displayName === 'HistoricoProdutosCliente')) return true;
    return false;
  });
}

async function compileJsx(pathUrl) {
  const source = await readFile(pathUrl, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
}

test('DetalhesCliente (montagem): renderiza HistoricoProdutosCliente com clienteId', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url));
  const state = [];
  let slot = 0;
  const queries = [];
  const HistoricoProdutosCliente = function HistoricoProdutosCliente() {
    return { type: 'HistoricoProdutosCliente', props: arguments[0] || {}, children: [] };
  };

  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = slot++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (v) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }];
    },
  };

  const sandbox = {
    exports: {},
    module: { exports: {} },
    React: react,
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    __modules: {
      react: { __esModule: true, default: react, ...react },
      '@tanstack/react-query': {
        useQuery(opts) {
          queries.push(opts);
          return { data: opts.enabled ? [] : undefined, isLoading: false, isError: false };
        },
      },
      '@/components/ui/tabs': { Tabs: 'Tabs' },
      '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
      '@/components/ui/badge': { Badge: 'Badge' },
      '@/components/ui/button': { Button: 'Button' },
      '@/components/ui/alert': { Alert: 'Alert', AlertDescription: 'AlertDescription' },
      'lucide-react': new Proxy({}, { get: () => 'Icon' }),
      'framer-motion': { motion: { div: 'motion.div' } },
      './HistoricoOrigemCliente': { __esModule: true, default: () => ({ type: 'HistoricoOrigemCliente', props: {}, children: [] }) },
      './HistoricoProdutosCliente': { __esModule: true, default: HistoricoProdutosCliente },
      './HistoricoComprasCliente': { __esModule: true, default: () => ({ type: 'HistoricoComprasCliente', props: {}, children: [] }) },
      './Top10ProdutosCliente': { __esModule: true, default: () => ({ type: 'Top10ProdutosCliente', props: {}, children: [] }) },
      './CentralCliente360Panel': { __esModule: true, default: () => ({ type: 'CentralCliente360Panel', props: {}, children: [] }) },
      '@/components/lib/useContextoVisual': {
        useContextoVisual: () => ({
          filterInContext: async () => [],
          empresaAtual: { id: 'e1', group_id: 'g1' },
          grupoAtual: { id: 'g1' },
          contexto: 'empresa',
        }),
      },
      '@/components/lib/usePermissions': {
        __esModule: true,
        default: () => ({
          hasPermission: () => true,
          user: { id: 'u1', email: 'synthetic@example.invalid' },
        }),
      },
      '@/api/httpApiClient': { resolveErpAuthSessionToken: () => 'sess-synthetic' },
      '@/lib/app-params': { appParams: { token: null } },
    },
  };

  // DetalhesCliente importa só { useState }; JSX clássico exige React no escopo.
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const DetalhesCliente = sandbox.exports.default || sandbox.module.exports.default;
  slot = 0;
  const tree = DetalhesCliente({
    cliente: { id: 'cli-real-1', nome: 'Cliente Sintetico', status: 'Ativo', codigo: 42 },
    windowMode: true,
  });
  const blocks = findByAction(tree, 'cliente-360-historico-produtos');
  assert.equal(blocks.length, 1, 'bloco data-action cliente-360-historico-produtos deve existir na árvore');
  assert.equal(findByAction(tree, 'cliente-360-historico-compras').length, 1);
  assert.equal(findByAction(tree, 'cliente-360-top10-produtos').length, 1);
  const hist = findHistoricoProdutos(tree);
  assert.equal(hist.length, 1, 'HistoricoProdutosCliente deve montar uma vez');
  assert.equal(hist[0].props.clienteId, 'cli-real-1');
  assert.ok(queries.some((q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'pedidos-cliente-contexto'));
});

test('PedidoTabsContainer (montagem): aba historico inclui HistoricoProdutosCliente quando há cliente', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url));
  const HistoricoProdutosCliente = function HistoricoProdutosCliente() {
    return { type: 'HistoricoProdutosCliente', props: arguments[0] || {}, children: [] };
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}]; },
    useEffect() {},
    useRef(v) { return { current: v }; },
    lazy: (fn) => { fn(); return function LazyStub() { return { type: 'LazyStub', props: {}, children: [] }; }; },
  };
  const Suspense = ({ children }) => ({ type: 'Suspense', props: {}, children: [].concat(children) });

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    __modules: {
      react: { __esModule: true, default: react, ...react, Suspense },
      '@/components/ui/tabs': { Tabs: 'Tabs', TabsContent: 'TabsContent' },
      './PedidoTabsNav': { __esModule: true, default: () => ({ type: 'PedidoTabsNav', props: {}, children: [] }) },
      '@/components/security/ProtectedSection': { __esModule: true, default: ({ children }) => children },
      '@/components/comercial/HistoricoProdutosCliente': { __esModule: true, default: HistoricoProdutosCliente },
      '@/components/comercial/HistoricoComprasCliente': {
        __esModule: true,
        default: () => ({ type: 'HistoricoComprasCliente', props: {}, children: [] }),
      },
      '@/components/comercial/SugestoesProdutos': {
        __esModule: true,
        default: () => ({ type: 'SugestoesProdutos', props: {}, children: [] }),
      },
      '@/components/comercial/Top10ProdutosCliente': {
        __esModule: true,
        default: () => ({ type: 'Top10ProdutosCliente', props: {}, children: [] }),
      },
      '@/components/comercial/AdicionarItemRevendaModal': {
        __esModule: true,
        default: (props) => ({ type: 'AdicionarItemRevendaModal', props: props || {}, children: [] }),
      },
      '@/components/comercial/historicoComprasClientePolicy': {
        seedProdutoFromHistorico: (p) => (p?.id || p?.produto_id ? { id: p.id || p.produto_id } : null),
        pedidoItensBloqueadosPorStatus: () => false,
        buildHistoricoModalGeracao: () => '["cli","e","g","u"]',
        buildSessionFingerprint: () => null,
        numeroComprovado: (v) => (v == null || v === '' ? null : Number(v)),
      },
      '@/api/base44Client': { base44: { functions: { invoke: async () => ({}) } } },
      '@/api/erpHttpSession': { readErpHttpSession: () => null },
      sonner: { toast: { success: () => {}, error: () => {}, message: () => {} } },
      '@/components/lib/useContextoVisual': {
        __esModule: true,
        default: () => ({
          createInContext: async () => ({}),
          filterInContext: async () => [],
          empresaAtual: { id: 'e1' },
          grupoAtual: { id: 'g1' },
        }),
      },
      '@/components/lib/UserContext': { useUser: () => ({ user: { id: 'u1' } }) },
      '../wizard/WizardEtapa1Cliente': { __esModule: true, default: () => null },
      '../ItensRevendaTab': { __esModule: true, default: () => null },
      '../ArmadoPadraoTab': { __esModule: true, default: () => null },
      '../CorteDobraIATab': { __esModule: true, default: () => null },
      '../HistoricoClienteTab': { __esModule: true, default: () => ({ type: 'HistoricoClienteTab', props: {}, children: [] }) },
      '../LogisticaEntregaTab': { __esModule: true, default: () => null },
      '../FechamentoFinanceiroTab': { __esModule: true, default: () => null },
      '../ArquivosProjetosTab': { __esModule: true, default: () => null },
      '../AuditoriaAprovacaoTab': { __esModule: true, default: () => null },
    },
  };

  vm.runInNewContext(compiled, sandbox);
  const PedidoTabsContainer = sandbox.exports.default || sandbox.module.exports.default;

  const withCliente = PedidoTabsContainer({
    activeTab: 'historico',
    setActiveTab: () => {},
    formData: { cliente_id: 'cli-pedido-1', itens_revenda: [] },
    setFormData: () => {},
    clientes: [],
    bloquearEdicao: false,
    validacoes: {},
    errors: {},
    pedido: null,
  });
  const blocks = findByAction(withCliente, 'pedido-historico-produtos');
  assert.equal(blocks.length, 1);
  assert.equal(findByAction(withCliente, 'pedido-historico-compras').length, 1);
  assert.equal(findByAction(withCliente, 'pedido-sugestoes-historico').length, 1);
  assert.equal(findByAction(withCliente, 'pedido-top10-produtos').length, 1);
  const hist = findHistoricoProdutos(withCliente);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].props.clienteId, 'cli-pedido-1');

  const semCliente = PedidoTabsContainer({
    activeTab: 'historico',
    setActiveTab: () => {},
    formData: { itens_revenda: [] },
    setFormData: () => {},
    clientes: [],
    bloquearEdicao: false,
    validacoes: {},
    errors: {},
    pedido: null,
  });
  assert.equal(findByAction(semCliente, 'pedido-historico-produtos').length, 0);
  assert.equal(findByAction(semCliente, 'pedido-historico-compras').length, 0);
  assert.equal(findByAction(semCliente, 'pedido-historico-produtos-sem-cliente').length, 1);
  assert.equal(findHistoricoProdutos(semCliente).length, 0);
});
