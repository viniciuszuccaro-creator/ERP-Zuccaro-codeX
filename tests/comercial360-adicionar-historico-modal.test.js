/**
 * ETAPA A #446 — Adicionar do histórico via modal canônico (não toast-only).
 * Fluxo: seed comprovado → modal → onAddItem → rascunho itens_revenda → qty editável.
 * Frequência histórica ≠ demanda; ausente ≠ UN/zero; bloquearEdicao(origem) ≠ lock itens.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
import {
  buildHistoricoModalGeracao,
  numeroComprovado,
  pedidoItensBloqueadosPorStatus,
  seedProdutoFromHistorico,
} from '../src/components/comercial/historicoComprasClientePolicy.js';

const read = (p) => readFileSync(p, 'utf8');

test('buildHistoricoModalGeracao + numeroComprovado: pedido≠visual; zero comprovado', () => {
  assert.equal(
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoEmpresaId: 'pe', pedidoGroupId: 'pg',
      visualEmpresaId: 've', visualGroupId: 'vg', actorId: 'u1',
    }),
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoEmpresaId: 'pe', pedidoGroupId: 'pg',
      visualEmpresaId: 've', visualGroupId: 'vg', actorId: 'u1',
    }),
  );
  assert.notEqual(
    buildHistoricoModalGeracao({ clienteId: 'c1', pedidoEmpresaId: 'e1', visualEmpresaId: 'v1', actorId: 'u1' }),
    buildHistoricoModalGeracao({ clienteId: 'c2', pedidoEmpresaId: 'e1', visualEmpresaId: 'v1', actorId: 'u1' }),
  );
  // Pedido fixo + troca só do visual → gerações distintas (Codex P1).
  assert.notEqual(
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoEmpresaId: 'pedido-A', pedidoGroupId: 'g1',
      visualEmpresaId: 'visual-A', visualGroupId: 'g1', actorId: 'u1',
    }),
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoEmpresaId: 'pedido-A', pedidoGroupId: 'g1',
      visualEmpresaId: 'visual-B', visualGroupId: 'g1', actorId: 'u1',
    }),
  );
  assert.equal(numeroComprovado(0), 0);
  assert.equal(numeroComprovado(''), null);
  assert.equal(numeroComprovado(undefined), null);
  assert.equal(numeroComprovado(12.5), 12.5);
});

test('seedProdutoFromHistorico: comprovados só; frequência/qty histórica omitidas; zero ok; ausente omitido; preco_medio≠unitário', () => {
  assert.equal(seedProdutoFromHistorico(null), null);
  assert.equal(seedProdutoFromHistorico({ descricao: 'x' }), null);

  const kg = seedProdutoFromHistorico({
    produto_id: 'p1',
    descricao: 'Cimento',
    unidade: 'KG',
    ultimo_preco: 0,
    frequencia: 99,
    quantidade_total: 500,
    preco_medio: 7.7,
  });
  assert.equal(kg.id, 'p1');
  assert.equal(kg.unidade_medida, 'KG');
  assert.equal(kg.preco_venda, 0);
  assert.equal(Object.hasOwn(kg, 'frequencia'), false);
  assert.equal(Object.hasOwn(kg, 'quantidade_total'), false);
  assert.equal(Object.hasOwn(kg, 'preco_medio'), false);

  const soMedia = seedProdutoFromHistorico({
    id: 'p3',
    descricao: 'Só média',
    preco_medio: 12,
  });
  assert.equal(soMedia.id, 'p3');
  assert.equal(Object.hasOwn(soMedia, 'preco_venda'), false);

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

test('pedidoItensBloqueadosPorStatus: Faturado/transfer/Cancelado; origem≠itens', () => {
  assert.equal(pedidoItensBloqueadosPorStatus({}), false);
  assert.equal(pedidoItensBloqueadosPorStatus({ status: 'Rascunho' }), false);
  assert.equal(pedidoItensBloqueadosPorStatus({ status: 'Faturado' }), true);
  assert.equal(pedidoItensBloqueadosPorStatus({ status: 'Cancelado' }), true);
  assert.equal(pedidoItensBloqueadosPorStatus({ status: 'Pronto para Faturar' }), true);
  assert.equal(pedidoItensBloqueadosPorStatus({ status: 'Pronto para Faturar', __liberado_gerencia: true }), false);
  assert.equal(pedidoItensBloqueadosPorStatus({ status: 'Em Expedição' }), true);
});

test('PedidoTabsContainer: Adicionar abre modal canônico; lock por status; geracao contexto', () => {
  const src = read('src/components/comercial/pedido/PedidoTabsContainer.jsx');
  assert.match(src, /AdicionarItemRevendaModal/);
  assert.match(src, /produtoInicial=\{produtoSeedHistorico\}/);
  assert.match(src, /abrirAdicionarDoHistorico/);
  assert.match(src, /confirmarItemRevendaDoHistorico/);
  assert.match(src, /seedProdutoFromHistorico/);
  assert.match(src, /pedidoItensBloqueadosPorStatus/);
  assert.match(src, /buildHistoricoModalGeracao/);
  assert.match(src, /modalHistoricoGeracao/);
  assert.match(src, /pedidoEmpresaId/);
  assert.match(src, /visualEmpresaId/);
  assert.match(src, /Contexto alterado/);
  assert.match(src, /onAdicionarHistorico/);
  assert.match(src, /confirmandoHistoricoRef/);
  assert.doesNotMatch(src, /buildItemRevendaFromHistorico/);
  assert.doesNotMatch(src, /onAdicionarProduto=\{bloquearEdicao \? undefined/);
});

test('Modal: qty=1; preço/custo/estoque/margem fail-closed; ausente≠UN/zero/SobEncomenda', () => {
  const src = read('src/components/comercial/AdicionarItemRevendaModal.jsx');
  assert.match(src, /produtoInicial\s*=\s*null/);
  assert.match(src, /setQuantidade\(1\)/);
  assert.match(src, /unidadeComprovada/);
  assert.match(src, /ausente ≠ inventar UN/);
  assert.match(src, /precoComprovadoDisponivel/);
  assert.match(src, /custoComprovado/);
  assert.match(src, /estoqueComprovado/);
  assert.match(src, /margemVioladaEfetiva/);
  assert.match(src, /Custo\/estoque\/margem\/Sob Encomenda só com fonte/);
  assert.match(src, /Justificativa de margem NÃO autoriza fabricar preço/);
  assert.doesNotMatch(src, /estoque_disponivel:\s*produtoSelecionado\.estoque_disponivel \|\| .* \|\| 0/);
  // Confirm/UI não usam margem_violada crua do calculador (custo 0 inventado).
  assert.doesNotMatch(src, /disabled=\{[^}]*calculo\?\.margem_violada && !justificativaDesconto/);
});

test('Top10 e HistoricoClienteTab: leitura sem callback — botão ausente/disabled', () => {
  const top10 = read('src/components/comercial/Top10ProdutosCliente.jsx');
  const histTab = read('src/components/comercial/HistoricoClienteTab.jsx');
  assert.match(top10, /podeAcionarSelecao/);
  assert.match(top10, /typeof onSelecionarProduto === "function"/);
  assert.match(top10, /disabled=\{!sug\.produto \|\| !podeAcionarSelecao\}/);
  assert.match(histTab, /typeof onAdicionarItemAoPedido === "function"/);
});

test('SugestoesProdutos: array vazio estável (anti-loop)', () => {
  const src = read('src/components/comercial/SugestoesProdutos.jsx');
  assert.match(src, /PEDIDOS_VAZIOS/);
  assert.match(src, /Object\.freeze\(\[\]\)/);
  assert.match(src, /prev\.length === 0 \? prev/);
});

test('fluxo montado: Adicionar→modal→onAddItem preserva itens; Faturado sem callback; duplo clique sem append', async () => {
  const source = await readFile(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  let formData = {
    cliente_id: 'cli-1',
    status: 'Rascunho',
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
  const pendingEffects = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = slot++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], (n) => { states[i] = typeof n === 'function' ? n(states[i]) : n; }];
    },
    useEffect(fn) {
      if (typeof fn === 'function') pendingEffects.push(fn);
    },
    useRef(v) { return { current: v }; },
    lazy: () => function LazyStub() { return { type: 'Lazy', props: {}, children: [] }; },
  };

  function HistoricoComprasCliente(props) {
    return { type: 'HistoricoComprasCliente', props, children: [] };
  }
  function AdicionarItemRevendaModal(props) {
    return { type: 'AdicionarItemRevendaModal', props, children: [] };
  }

  const sandbox = {
    exports: {},
    module: { exports: {} },
    Promise,
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
        pedidoItensBloqueadosPorStatus,
        buildHistoricoModalGeracao,
        numeroComprovado,
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
    pendingEffects.length = 0;
    PedidoTabsContainer({
      activeTab: 'historico',
      setActiveTab,
      formData,
      setFormData,
      clientes: [{ id: 'cli-1', nome: 'Cliente' }],
      bloquearEdicao: true, // origem sempre true — NÃO deve remover Adicionar
      validacoes: {},
      errors: {},
      pedido: null,
    });
    // Flush sync effects (contexto → fecha modal obsoleto); async conformidade ignora-se.
    const queued = pendingEffects.splice(0, pendingEffects.length);
    for (const fn of queued) {
      try { fn(); } catch { /* conformidade async / cancel */ }
    }
    slot = 0;
    return PedidoTabsContainer({
      activeTab: 'historico',
      setActiveTab,
      formData,
      setFormData,
      clientes: [{ id: 'cli-1', nome: 'Cliente' }],
      bloquearEdicao: true,
      validacoes: {},
      errors: {},
      pedido: null,
    });
  }

  let tree = render();
  let compras = findType(tree, 'HistoricoComprasCliente');
  assert.ok(compras.length >= 1, 'HistoricoCompras montado');
  assert.equal(typeof compras[0].props.onAdicionarProduto, 'function', 'origem bloqueada ≠ sem Adicionar');

  // Rejeição sem id
  compras[0].props.onAdicionarProduto({ descricao: 'sem-id', frequencia: 9 });
  assert.ok(toasts.some((t) => t[0] === 'err'));

  // Duplo clique Adicionar → só abre/reabre modal; sem mutar rascunho
  const beforeLen = formData.itens_revenda.length;
  const payload = {
    produto_id: 'novo-kg',
    descricao: 'CimentoKG',
    unidade: 'KG',
    ultimo_preco: 12.5,
    frequencia: 40,
    quantidade_total: 999,
  };
  compras[0].props.onAdicionarProduto(payload);
  compras[0].props.onAdicionarProduto(payload);
  assert.equal(formData.itens_revenda.length, beforeLen);

  tree = render();
  const modals = findType(tree, 'AdicionarItemRevendaModal');
  assert.equal(modals.length, 1);
  assert.equal(modals[0].props.isOpen, true);
  assert.equal(modals[0].props.produtoInicial?.id, 'novo-kg');
  assert.equal(modals[0].props.produtoInicial?.unidade_medida, 'KG');
  assert.equal(modals[0].props.produtoInicial?.preco_venda, 12.5);
  assert.equal(Object.hasOwn(modals[0].props.produtoInicial || {}, 'frequencia'), false);

  // Confirmar qty=3 → preserva existente (rascunho ≠ banco)
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

  // Preço ausente rejeitado (≠ inventar 0)
  toasts.length = 0;
  formData = { ...formData, status: 'Rascunho' };
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'sem-preco',
    descricao: 'SemPreco',
    unidade: 'KG',
  });
  tree = render();
  const beforeReject = formData.itens_revenda.length;
  findType(tree, 'AdicionarItemRevendaModal')[0].props.onAddItem({
    produto_id: 'sem-preco',
    descricao: 'SemPreco',
    quantidade: 1,
  });
  assert.equal(formData.itens_revenda.length, beforeReject);
  assert.ok(toasts.some((t) => t[0] === 'err' && /preço/i.test(String(t[1]))));

  // Troca empresa com modal aberto → confirm rejeita; effect fecha; rascunho preservado
  toasts.length = 0;
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'ctx-old',
    descricao: 'CtxOld',
    unidade: 'KG',
    ultimo_preco: 9,
  });
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1);
  const lenBeforeCtx = formData.itens_revenda.length;
  formData = { ...formData, empresa_id: 'empresa-B-nova' };
  // Paint com contexto novo sem flush: confirm usa geracao atual ≠ modal → rejeita
  slot = 0;
  pendingEffects.length = 0;
  tree = PedidoTabsContainer({
    activeTab: 'historico',
    setActiveTab,
    formData,
    setFormData,
    clientes: [{ id: 'cli-1', nome: 'Cliente' }],
    bloquearEdicao: true,
    validacoes: {},
    errors: {},
    pedido: null,
  });
  findType(tree, 'AdicionarItemRevendaModal')[0].props.onAddItem({
    produto_id: 'ctx-old',
    descricao: 'CtxOld',
    quantidade: 1,
    preco_unitario: 9,
  });
  assert.equal(formData.itens_revenda.length, lenBeforeCtx);
  assert.ok(toasts.some((t) => t[0] === 'err' && /Contexto alterado/i.test(String(t[1]))));
  // Flush effect + re-render → modal obsoleto some
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0);
  assert.equal(formData.itens_revenda.length, lenBeforeCtx);

  // Duplicidade legítima: avisa, reabre modal, não funde
  toasts.length = 0;
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'existente',
    descricao: 'Já no rascunho',
    unidade: 'PC',
  });
  assert.ok(toasts.some((t) => t[0] === 'msg'));

  // Faturado → callback ausente
  formData = { ...formData, status: 'Faturado' };
  tree = render();
  assert.equal(findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto, undefined);
});
