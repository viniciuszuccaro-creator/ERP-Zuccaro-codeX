/**
 * ETAPA A #446 — Adicionar do histórico via modal canônico (não toast-only).
 * Fluxo: seed comprovado → modal → onAddItem → rascunho itens_revenda → qty editável.
 * Frequência histórica ≠ demanda; ausente ≠ UN/zero.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
import { seedProdutoFromHistorico } from '../src/components/comercial/historicoComprasClientePolicy.js';

const read = (p) => readFileSync(p, 'utf8');

test('seedProdutoFromHistorico: comprovados só; frequência/qty histórica omitidas; zero ok; ausente omitido', () => {
  assert.equal(seedProdutoFromHistorico(null), null);
  assert.equal(seedProdutoFromHistorico({ descricao: 'x' }), null);

  const kg = seedProdutoFromHistorico({
    produto_id: 'p1',
    descricao: 'Cimento',
    unidade: 'KG',
    ultimo_preco: 0,
    frequencia: 99,
    quantidade_total: 500,
  });
  assert.equal(kg.id, 'p1');
  assert.equal(kg.unidade_medida, 'KG');
  assert.equal(kg.preco_venda, 0);
  assert.equal(Object.hasOwn(kg, 'frequencia'), false);
  assert.equal(Object.hasOwn(kg, 'quantidade_total'), false);
  assert.equal(Object.hasOwn(kg, 'quantidade'), false);

  const sem = seedProdutoFromHistorico({
    id: 'p2',
    descricao: 'SemUnPreco',
    frequencia: 3,
  });
  assert.equal(sem.id, 'p2');
  assert.equal(Object.hasOwn(sem, 'unidade_medida'), false);
  assert.equal(Object.hasOwn(sem, 'preco_venda'), false);
  assert.doesNotMatch(JSON.stringify(sem), /"UN"/);
});

test('PedidoTabsContainer: Adicionar abre modal canônico (não append direto + toast)', () => {
  const src = read('src/components/comercial/pedido/PedidoTabsContainer.jsx');
  assert.match(src, /AdicionarItemRevendaModal/);
  assert.match(src, /produtoInicial=\{produtoSeedHistorico\}/);
  assert.match(src, /abrirAdicionarDoHistorico/);
  assert.match(src, /confirmarItemRevendaDoHistorico/);
  assert.match(src, /seedProdutoFromHistorico/);
  assert.doesNotMatch(src, /buildItemRevendaFromHistorico/);
  assert.match(src, /bloquearEdicao \? undefined/);
});

test('Modal: produtoInicial pré-seleciona qty=1; unidade só se comprovada no item', () => {
  const src = read('src/components/comercial/AdicionarItemRevendaModal.jsx');
  assert.match(src, /produtoInicial\s*=\s*null/);
  assert.match(src, /setQuantidade\(1\)/);
  assert.match(src, /unidadeComprovada/);
  assert.match(src, /ausente ≠ inventar UN/);
});

test('fluxo montado: Adicionar→modal→onAddItem preserva itens e aplica qty do modal', async () => {
  const source = await readFile(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  let formData = {
    cliente_id: 'cli-1',
    itens_revenda: [
      { produto_id: 'existente', descricao: 'Já no rascunho', quantidade: 7, unidade_medida: 'PC' },
    ],
  };
  const setFormData = (updater) => {
    formData = typeof updater === 'function' ? updater(formData) : updater;
  };
  let activeTab = 'historico';
  const setActiveTab = (t) => { activeTab = t; };
  const toasts = [];

  const states = [];
  let slot = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = slot++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], (n) => { states[i] = typeof n === 'function' ? n(states[i]) : n; }];
    },
    useEffect() {},
    lazy: () => function LazyStub() { return { type: 'Lazy', props: {}, children: [] }; },
  };

  // Nome da função = type.name no createElement stub (findType usa name).
  function HistoricoComprasCliente(props) {
    return { type: 'HistoricoComprasCliente', props, children: [] };
  }
  function AdicionarItemRevendaModal(props) {
    return { type: 'AdicionarItemRevendaModal', props, children: [] };
  }

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    __modules: {
      react: { __esModule: true, default: react, ...react, Suspense: ({ children }) => children },
      '@/components/ui/tabs': { Tabs: 'Tabs', TabsContent: 'TabsContent' },
      './PedidoTabsNav': { __esModule: true, default: () => null },
      '@/components/security/ProtectedSection': { __esModule: true, default: ({ children }) => children },
      '@/components/comercial/HistoricoProdutosCliente': { __esModule: true, default: () => null },
      '@/components/comercial/HistoricoComprasCliente': { __esModule: true, default: HistoricoComprasCliente },
      '@/components/comercial/SugestoesProdutos': { __esModule: true, default: () => null },
      '@/components/comercial/Top10ProdutosCliente': { __esModule: true, default: () => null },
      '@/components/comercial/AdicionarItemRevendaModal': { __esModule: true, default: AdicionarItemRevendaModal },
      '@/components/comercial/historicoComprasClientePolicy': {
        seedProdutoFromHistorico,
      },
      '@/api/base44Client': { base44: { functions: { invoke: async () => ({}) } } },
      sonner: {
        toast: {
          success: (m) => toasts.push(['ok', m]),
          error: (m) => toasts.push(['err', m]),
          message: (m) => toasts.push(['msg', m]),
        },
      },
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
      '../HistoricoClienteTab': { __esModule: true, default: () => null },
      '../LogisticaEntregaTab': { __esModule: true, default: () => null },
      '../FechamentoFinanceiroTab': { __esModule: true, default: () => null },
      '../ArquivosProjetosTab': { __esModule: true, default: () => null },
      '../AuditoriaAprovacaoTab': { __esModule: true, default: () => null },
    },
  };

  vm.runInNewContext(compiled, sandbox);
  const PedidoTabsContainer = sandbox.exports.default || sandbox.module.exports.default;

  function walk(n) {
    if (!n || typeof n !== 'object') return [];
    return [n, ...(n.children || []).flatMap(walk)];
  }
  function findType(tree, name) {
    return walk(tree).filter((n) => n?.type === name || n?.type?.name === name);
  }
  function render() {
    slot = 0;
    return PedidoTabsContainer({
      activeTab: 'historico',
      setActiveTab,
      formData,
      setFormData,
      clientes: [{ id: 'cli-1', nome: 'Cliente' }],
      bloquearEdicao: false,
      validacoes: {},
      errors: {},
      pedido: null,
    });
  }

  let tree = render();
  let compras = findType(tree, 'HistoricoComprasCliente');
  assert.ok(compras.length >= 1, 'HistoricoCompras montado');
  assert.equal(typeof compras[0].props.onAdicionarProduto, 'function');

  // Rejeição sem id
  compras[0].props.onAdicionarProduto({ descricao: 'sem-id', frequencia: 9 });
  assert.ok(toasts.some((t) => t[0] === 'err'));

  // Adicionar KG → abre modal sem mutar ainda
  const beforeLen = formData.itens_revenda.length;
  compras[0].props.onAdicionarProduto({
    produto_id: 'novo-kg',
    descricao: 'CimentoKG',
    unidade: 'KG',
    ultimo_preco: 12.5,
    frequencia: 40,
    quantidade_total: 999,
  });
  assert.equal(formData.itens_revenda.length, beforeLen);

  tree = render();
  const modals = findType(tree, 'AdicionarItemRevendaModal');
  assert.equal(modals.length, 1);
  assert.equal(modals[0].props.isOpen, true);
  assert.equal(modals[0].props.produtoInicial?.id, 'novo-kg');
  assert.equal(modals[0].props.produtoInicial?.unidade_medida, 'KG');
  assert.equal(modals[0].props.produtoInicial?.preco_venda, 12.5);
  assert.equal(Object.hasOwn(modals[0].props.produtoInicial || {}, 'frequencia'), false);

  // Confirmar qty=3 → preserva existente
  modals[0].props.onAddItem({
    produto_id: 'novo-kg',
    descricao: 'CimentoKG',
    unidade_medida: 'KG',
    quantidade: 3,
    preco_unitario: 12.5,
    valor_item: 37.5,
  });
  assert.equal(formData.itens_revenda.length, 2);
  assert.equal(formData.itens_revenda[0].produto_id, 'existente');
  assert.equal(formData.itens_revenda[0].quantidade, 7);
  assert.equal(formData.itens_revenda[1].produto_id, 'novo-kg');
  assert.equal(formData.itens_revenda[1].quantidade, 3);
  assert.equal(formData.itens_revenda[1].unidade_medida, 'KG');
  assert.equal(activeTab, 'revenda');

  // Duplicidade
  toasts.length = 0;
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'existente',
    descricao: 'Já no rascunho',
    unidade: 'PC',
  });
  assert.ok(toasts.some((t) => t[0] === 'msg'));

  // bloquearEdicao
  slot = 0;
  tree = PedidoTabsContainer({
    activeTab: 'historico', setActiveTab, formData, setFormData,
    clientes: [{ id: 'cli-1' }], bloquearEdicao: true, validacoes: {}, errors: {}, pedido: null,
  });
  assert.equal(findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto, undefined);
});
