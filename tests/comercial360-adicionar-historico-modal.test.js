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
  buildSessionFingerprint,
  bumpSessionEpoch,
  numeroComprovado,
  pedidoItensBloqueadosPorStatus,
  pedidoVisualCompativel,
  pickTabelaPrecoExata,
  produtoElegivelRevendaNoCatalogo,
  seedProdutoFromHistorico,
} from '../src/components/comercial/historicoComprasClientePolicy.js';

const read = (p) => readFileSync(p, 'utf8');
const vendavelStub = (t) => t === 'Revenda' || t === 'Acabado';

test('buildHistoricoModalGeracao + session + elegibilidade: pedido≠visual; zero; renew', () => {
  assert.equal(
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoId: 'ped-1', pedidoEmpresaId: 'pe', pedidoGroupId: 'pg',
      visualEmpresaId: 've', visualGroupId: 'vg', actorId: 'u1', sessionKey: 's1', sessionEpoch: 0,
    }),
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoId: 'ped-1', pedidoEmpresaId: 'pe', pedidoGroupId: 'pg',
      visualEmpresaId: 've', visualGroupId: 'vg', actorId: 'u1', sessionKey: 's1', sessionEpoch: 0,
    }),
  );
  assert.notEqual(
    buildHistoricoModalGeracao({ clienteId: 'c1', pedidoEmpresaId: 'e1', visualEmpresaId: 'v1', actorId: 'u1' }),
    buildHistoricoModalGeracao({ clienteId: 'c2', pedidoEmpresaId: 'e1', visualEmpresaId: 'v1', actorId: 'u1' }),
  );
  // Pedido id A→B (mesmo visual) → gerações distintas.
  assert.notEqual(
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoId: 'pedido-A', pedidoEmpresaId: 'e1',
      visualEmpresaId: 'e1', visualGroupId: 'g1', actorId: 'u1',
    }),
    buildHistoricoModalGeracao({
      clienteId: 'c1', pedidoId: 'pedido-B', pedidoEmpresaId: 'e1',
      visualEmpresaId: 'e1', visualGroupId: 'g1', actorId: 'u1',
    }),
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
  // Renew token (mesmo ator) → sessionKey distinta.
  assert.notEqual(
    buildHistoricoModalGeracao({ actorId: 'u1', sessionKey: buildSessionFingerprint('token-AAA') }),
    buildHistoricoModalGeracao({ actorId: 'u1', sessionKey: buildSessionFingerprint('token-BBB') }),
  );
  // Sessão A→B→A: epoch monotônico (não rematch da geração da 1ª visita a A).
  const fpA = buildSessionFingerprint('token-A');
  const fpB = buildSessionFingerprint('token-B');
  let sess = bumpSessionEpoch(0, null, fpA);
  assert.equal(sess.epoch, 1);
  assert.equal(sess.fingerprint, fpA);
  sess = bumpSessionEpoch(sess.epoch, sess.fingerprint, fpB);
  assert.equal(sess.epoch, 2);
  sess = bumpSessionEpoch(sess.epoch, sess.fingerprint, fpA);
  assert.equal(sess.epoch, 3);
  assert.equal(sess.fingerprint, fpA);
  assert.notEqual(
    buildHistoricoModalGeracao({ actorId: 'u1', sessionKey: fpA, sessionEpoch: 1 }),
    buildHistoricoModalGeracao({ actorId: 'u1', sessionKey: fpA, sessionEpoch: 3 }),
  );
  // Mesmo fp → epoch estável.
  assert.deepEqual(bumpSessionEpoch(3, fpA, fpA), { epoch: 3, fingerprint: fpA });
  // Pedido ≠ visual explícito → incompatível; um lado vazio → compatível (não inventar).
  assert.equal(pedidoVisualCompativel({
    pedidoEmpresaId: 'e-A', visualEmpresaId: 'e-B', pedidoGroupId: 'g1', visualGroupId: 'g1',
  }), false);
  assert.equal(pedidoVisualCompativel({
    pedidoEmpresaId: 'e-A', visualEmpresaId: 'e-A', pedidoGroupId: 'g1', visualGroupId: 'g1',
  }), true);
  assert.equal(pedidoVisualCompativel({
    pedidoEmpresaId: 'e-A', visualEmpresaId: null, pedidoGroupId: 'g1', visualGroupId: 'g1',
  }), true);
  assert.equal(buildSessionFingerprint(''), null);
  assert.equal(numeroComprovado(0), 0);
  assert.equal(numeroComprovado(''), null);
  assert.equal(numeroComprovado(undefined), null);
  assert.equal(numeroComprovado(12.5), 12.5);
  assert.equal(
    produtoElegivelRevendaNoCatalogo(
      [{ id: 'p1', status: 'Ativo', tipo_item: 'Revenda' }],
      'p1',
      vendavelStub,
    ),
    true,
  );
  assert.equal(
    produtoElegivelRevendaNoCatalogo(
      [{ id: 'p1', status: 'Inativo', tipo_item: 'Revenda' }],
      'p1',
      vendavelStub,
    ),
    false,
  );
  // Ausente na página limitada ≠ inativo (null; só false rejeita).
  assert.equal(
    produtoElegivelRevendaNoCatalogo(
      [{ id: 'outro', status: 'Ativo', tipo_item: 'Revenda' }],
      'p1',
      vendavelStub,
    ),
    null,
  );
  assert.equal(produtoElegivelRevendaNoCatalogo([], 'p1', vendavelStub), null);
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
  assert.match(src, /pedidoId:/);
  assert.match(src, /bumpSessionEpoch/);
  assert.match(src, /pedidoVisualCompativel/);
  assert.match(src, /sessionEpoch/);
  assert.match(src, /sessionFingerprintObservado/);
  assert.match(src, /readSessionFingerprintCanonical/);
  assert.match(src, /buildSessionFingerprint/);
  assert.match(src, /sessionKey/);
  // Effect observa sessão canônica (Codex P1: RenderB captura B; A→B→A sem rematch).
  assert.match(src, /sessionFingerprintObservado,/);
  // Abertura/confirm releem sessão (filho muta sem re-render do pai).
  assert.match(src, /Sempre releia/);
  // P2/P1: resolve TabelaPreco+itens só com ID exato (nunca tabelas[0] / WRONG).
  assert.match(src, /tabelaPrecoResolvida/);
  assert.match(src, /TabelaPrecoItem/);
  assert.match(src, /tabela_preco_id/);
  assert.match(src, /tabelaPreco=\{tabelaPrecoResolvida\}/);
  assert.match(src, /pickTabelaPrecoExata/);
  assert.doesNotMatch(src, /\|\| tabelas\[0\]/);
  assert.match(src, /Fail-closed imediato/);
  assert.match(src, /tabelaResolveTokenRef/);
  assert.match(src, /formData\?\.id/);
  assert.match(src, /aindaVigente/);
  assert.match(src, /Contexto alterado/);
  assert.match(src, /Contexto visual diverge/);
  assert.match(src, /onAdicionarHistorico/);
  assert.match(src, /confirmandoHistoricoRef/);
  assert.doesNotMatch(src, /buildItemRevendaFromHistorico/);
  assert.doesNotMatch(src, /onAdicionarProduto=\{bloquearEdicao \? undefined/);
  // Codex P1: filterInContext instável → ref; set []/null com bail-out Object.is (sem ciclo de render).
  assert.match(src, /filterInContextRef/);
  assert.match(src, /filterInContextRef\.current/);
  assert.match(src, /Array\.isArray\(prev\) && prev\.length === 0 \? prev : \[\]/);
  assert.doesNotMatch(src, /sessionFingerprintObservado,\s*filterInContext,/);
});

test('resolução tabela: clear vazio preserva referência (bail-out Object.is)', () => {
  // Espelha o updater do painel: []→[] e null→null não reagendam render.
  const clearItens = (prev) => (Array.isArray(prev) && prev.length === 0 ? prev : []);
  const clearTabela = (prev) => (prev == null ? prev : null);
  const empty = [];
  assert.equal(clearItens(empty), empty);
  assert.notEqual(clearItens([{ id: 1 }]), empty);
  assert.equal(clearItens([{ id: 1 }]).length, 0);
  assert.equal(clearTabela(null), null);
  assert.equal(clearTabela(undefined), undefined);
  assert.equal(clearTabela({ id: 't' }), null);
});

test('Modal: qty=1; preço/custo/estoque/margem fail-closed; elegibilidade; ausente≠UN/zero/SobEncomenda', () => {
  const src = read('src/components/comercial/AdicionarItemRevendaModal.jsx');
  assert.match(src, /produtoInicial\s*=\s*null/);
  assert.match(src, /setQuantidade\(1\)/);
  assert.match(src, /unidadeComprovada/);
  assert.match(src, /ausente ≠ inventar UN/);
  assert.match(src, /precoComprovadoDisponivel/);
  assert.match(src, /podeConfirmarPreco/);
  assert.match(src, /custoComprovado/);
  assert.match(src, /estoqueComprovado/);
  assert.match(src, /margemVioladaEfetiva/);
  assert.match(src, /produtoElegivelRevendaNoCatalogo/);
  assert.match(src, /Produto inativo ou não vendável/);
  assert.match(src, /elegivel === false/);
  assert.doesNotMatch(src, /elegivel == null && produtos\.length > 0/);
  assert.match(src, /!podeConfirmarPreco/);
  assert.match(src, /Custo\/estoque\/margem\/Sob Encomenda só com fonte/);
  assert.match(src, /Justificativa de margem NÃO autoriza fabricar preço/);
  assert.doesNotMatch(src, /estoque_disponivel:\s*produtoSelecionado\.estoque_disponivel \|\| .* \|\| 0/);
  // Confirm/UI não usam margem_violada crua do calculador (custo 0 inventado).
  assert.doesNotMatch(src, /disabled=\{[^}]*calculo\?\.margem_violada && !justificativaDesconto/);
  // Botão e handler compartilham podeConfirmarPreco (preço ausente).
  assert.match(src, /disabled=\{[^}]*!podeConfirmarPreco/);
});

test('CalculadorPrecoItem: custo zero comprovado → margem 100%; ausente → margem 0', async () => {
  const src = read('src/components/comercial/CalculadorPrecoItem.jsx');
  assert.match(src, /custoMedioRaw/);
  assert.match(src, /custoComprovadoNoCalc/);
  assert.match(src, /Number\.isFinite\(Number\(custoMedioRaw\)\)/);
  assert.doesNotMatch(src, /produto\.custo_medio \|\| produto\.custo_aquisicao \|\| 0/);
  assert.match(src, /custoComprovadoNoCalc && custoUnitario === 0/);

  const source = await readFile(new URL('../src/components/comercial/CalculadorPrecoItem.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === 'react') return { __esModule: true, default: {}, createElement: () => null };
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(compiled, sandbox);
  const { calcularPrecoItem } = sandbox.exports;
  const zero = calcularPrecoItem({
    produto: { id: 'p', preco_venda: 20, custo_medio: 0, custo_aquisicao: 10, margem_minima_percentual: 10 },
    quantidade: 1,
    margemMinimaSistema: 10,
  });
  assert.equal(zero.custo_unitario, 0);
  assert.equal(zero.margem_percentual, 100);
  assert.equal(zero.margem_violada, false);
  const ausente = calcularPrecoItem({
    produto: { id: 'p', preco_venda: 20, margem_minima_percentual: 10 },
    quantidade: 1,
    margemMinimaSistema: 10,
  });
  assert.equal(ausente.custo_unitario, 0);
  assert.equal(ausente.margem_percentual, 0);
});

test('Modal merge: preço histórico só com unidade compatível (KG≠UN)', () => {
  const src = read('src/components/comercial/AdicionarItemRevendaModal.jsx');
  assert.match(src, /unidadesCompativeis/);
  assert.match(src, /delete merged\.preco_venda/);
  assert.match(src, /Preço histórico só com unidade efetiva compatível/);
});

test('Top10 e HistoricoClienteTab: leitura sem callback — cartão não interativo', () => {
  const top10 = read('src/components/comercial/Top10ProdutosCliente.jsx');
  const histTab = read('src/components/comercial/HistoricoClienteTab.jsx');
  assert.match(top10, /podeAcionarSelecao/);
  assert.match(top10, /typeof onSelecionarProduto === "function"/);
  assert.match(top10, /top10-produto-leitura/);
  assert.match(top10, /if \(!podeAcionarSelecao\)/);
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
  let sessionToken = 'token-sessao-A';
  const visualCtx = { empresaAtual: { id: 'visual-A', group_id: 'g1' }, grupoAtual: { id: 'g1' } };

  const states = [];
  let slot = 0;
  const pendingEffects = [];
  // Deps estáveis como React: só reexecuta efeito quando deps mudam (prova sessão observada).
  const effectDepsPrev = [];
  let effectSlot = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = slot++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], (n) => { states[i] = typeof n === 'function' ? n(states[i]) : n; }];
    },
    useEffect(fn, deps) {
      const i = effectSlot++;
      const key = deps === undefined ? `__nodeps_${i}` : JSON.stringify(deps);
      if (effectDepsPrev[i] === key) return;
      effectDepsPrev[i] = key;
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
        buildSessionFingerprint,
        bumpSessionEpoch,
        pedidoVisualCompativel,
        numeroComprovado,
        pickTabelaPrecoExata,
      },
      '@/api/base44Client': { base44: { functions: { invoke: async () => ({}) } } },
      '@/api/erpHttpSession': {
        readErpHttpSession: () => (sessionToken ? { token: sessionToken } : null),
      },
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
          empresaAtual: visualCtx.empresaAtual,
          grupoAtual: visualCtx.grupoAtual,
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
    effectSlot = 0;
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
    // Flush sync effects (contexto/sessão → fecha modal obsoleto); async conformidade ignora-se.
    const queued = pendingEffects.splice(0, pendingEffects.length);
    for (const fn of queued) {
      try { fn(); } catch { /* conformidade async / cancel */ }
    }
    slot = 0;
    effectSlot = 0;
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

  // Preço ausente rejeitado (≠ inventar 0); modal e rascunho preservados
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
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1, 'rejeição preserva modal');

  // Preço zero comprovado aceito
  toasts.length = 0;
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'zero-ok',
    descricao: 'ZeroOk',
    unidade: 'UN',
    ultimo_preco: 0,
  });
  tree = render();
  const beforeZero = formData.itens_revenda.length;
  findType(tree, 'AdicionarItemRevendaModal')[0].props.onAddItem({
    produto_id: 'zero-ok',
    descricao: 'ZeroOk',
    quantidade: 1,
    preco_unitario: 0,
    valor_item: 0,
  });
  assert.equal(formData.itens_revenda.length, beforeZero + 1);
  assert.equal(formData.itens_revenda[beforeZero].preco_unitario, 0);

  // Visual A→B: confirm rejeita; effect fecha; A→B→A não reabre modal antigo; rascunho intacto
  toasts.length = 0;
  visualCtx.empresaAtual = { id: 'visual-A', group_id: 'g1' };
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
  visualCtx.empresaAtual = { id: 'visual-B', group_id: 'g1' };
  slot = 0;
  effectSlot = 0;
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
  // Flush effect (visual nas deps) antes do confirm — modal pode já fechar.
  for (const fn of pendingEffects.splice(0, pendingEffects.length)) {
    try { fn(); } catch { /* ignore */ }
  }
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0);
  assert.equal(formData.itens_revenda.length, lenBeforeCtx);
  assert.ok(toasts.some((t) => t[0] === 'msg' && /Contexto alterado/i.test(String(t[1]))));
  // Volta visual A — modal antigo permanece fechado (exige novo Adicionar)
  visualCtx.empresaAtual = { id: 'visual-A', group_id: 'g1' };
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0);
  assert.equal(formData.itens_revenda.length, lenBeforeCtx);

  // Renew sessão (token) com modal aberto → effect observa fp e fecha; confirm 0 writes
  toasts.length = 0;
  sessionToken = 'token-sessao-A';
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'sess-old',
    descricao: 'SessOld',
    unidade: 'KG',
    ultimo_preco: 5,
  });
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1);
  const lenBeforeSess = formData.itens_revenda.length;
  sessionToken = 'token-sessao-RENEW';
  // RenderB comprometido: só token muda; deps de sessão disparam efeito (Codex P1).
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0, 'RenderB com sessão B fecha modal');
  assert.equal(formData.itens_revenda.length, lenBeforeSess);

  // Sessão A→B→A no PedidoTabsContainer real (effect deps + fingerprint canônico).
  // Espelha montagem Codex: RenderB com flush de efeitos → modalAfterB=false; volta A → 0 writes.
  // Harness: useEffect só reexecuta quando deps mudam (sessionFingerprintObservado incluso).
  toasts.length = 0;
  sessionToken = 'token-sessao-A';
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'sess-aba',
    descricao: 'SessABA',
    unidade: 'KG',
    ultimo_preco: 4,
  });
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1, 'modal aberto sob sessão A');
  const lenBeforeABA = formData.itens_revenda.length;
  // Isolar mudança de sessão: nenhum outro dep (cliente/empresa/pedido) muda.
  sessionToken = 'token-sessao-B';
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0, 'modalAfterB=false (effect observou B)');
  assert.equal(formData.itens_revenda.length, lenBeforeABA, 'RenderB = 0 writes');
  assert.ok(toasts.some((t) => t[0] === 'msg' && /Contexto alterado/i.test(String(t[1]))));
  sessionToken = 'token-sessao-A';
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0, 'volta A: modal antigo não rematch');
  assert.equal(formData.itens_revenda.length, lenBeforeABA, 'A→B→A = 0 writes / 0 success');
  // Novo Adicionar após ABA: abre com geração nova (rascunho preservado)
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'sess-aba-novo',
    descricao: 'SessABANovo',
    unidade: 'KG',
    ultimo_preco: 4,
  });
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1);
  findType(tree, 'AdicionarItemRevendaModal')[0].props.onAddItem({
    produto_id: 'sess-aba-novo',
    descricao: 'SessABANovo',
    quantidade: 1,
    preco_unitario: 4,
  });
  assert.equal(formData.itens_revenda.length, lenBeforeABA + 1);

  // Confirm releia sessão sem re-render do pai (Codex P1): token some → 0 writes
  toasts.length = 0;
  sessionToken = 'token-sessao-A';
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'sess-expire',
    descricao: 'SessExpire',
    unidade: 'KG',
    ultimo_preco: 6,
  });
  tree = render();
  const lenBeforeExpire = formData.itens_revenda.length;
  const modalAntesExpire = findType(tree, 'AdicionarItemRevendaModal')[0];
  assert.ok(modalAntesExpire);
  sessionToken = null; // sessão removida; filho muta sem re-render do pai
  modalAntesExpire.props.onAddItem({
    produto_id: 'sess-expire',
    descricao: 'SessExpire',
    quantidade: 1,
    preco_unitario: 6,
  });
  assert.equal(formData.itens_revenda.length, lenBeforeExpire, 'confirm com sessão expirada = 0 writes');
  assert.ok(toasts.some((t) => t[0] === 'err' && /Contexto alterado/i.test(String(t[1]))));

  // PedidoA→PedidoB (mesmo visual/cliente): modal da geração A não confirma em B
  toasts.length = 0;
  formData = {
    ...formData,
    id: 'pedido-A',
    empresa_id: 'e1',
    group_id: 'g1',
    status: 'Rascunho',
  };
  visualCtx.empresaAtual = { id: 'e1', group_id: 'g1' };
  visualCtx.grupoAtual = { id: 'g1' };
  sessionToken = 'token-sessao-stable';
  tree = render();
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'ped-switch',
    descricao: 'PedSwitch',
    unidade: 'KG',
    ultimo_preco: 8,
  });
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1);
  const lenBeforePed = formData.itens_revenda.length;
  formData = { ...formData, id: 'pedido-B' };
  tree = render(); // effect observa pedidoId → fecha
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0);
  assert.equal(formData.itens_revenda.length, lenBeforePed);
  assert.ok(toasts.some((t) => t[0] === 'msg' && /Contexto alterado/i.test(String(t[1]))));

  // Pedido vs visual divergentes → abrir bloqueado
  toasts.length = 0;
  formData = { ...formData, id: 'pedido-C', empresa_id: 'e-pedido', group_id: 'g1', status: 'Rascunho' };
  visualCtx.empresaAtual = { id: 'e-visual', group_id: 'g1' };
  tree = render();
  const beforeDiverg = formData.itens_revenda.length;
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'div-ctx',
    descricao: 'DivCtx',
    unidade: 'KG',
    ultimo_preco: 3,
  });
  assert.equal(formData.itens_revenda.length, beforeDiverg);
  assert.ok(toasts.some((t) => t[0] === 'err' && /visual diverge/i.test(String(t[1]))));
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0);

  // Duplicidade legítima: avisa, reabre modal, não funde
  toasts.length = 0;
  formData = { ...formData, empresa_id: 'e1', group_id: 'g1', status: 'Rascunho' };
  visualCtx.empresaAtual = { id: 'e1', group_id: 'g1' };
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

test('pickTabelaPrecoExata: WRONG≠EXPECTED → null; nunca tabelas[0]', () => {
  assert.equal(pickTabelaPrecoExata([{ id: 'WRONG', nome: 'x' }], 'EXPECTED'), null);
  assert.equal(pickTabelaPrecoExata([{ id: 'WRONG' }, { id: 'EXPECTED', nome: 'ok' }], 'EXPECTED')?.id, 'EXPECTED');
  assert.equal(pickTabelaPrecoExata([{ id: 'OTHER' }], 'EXPECTED'), null);
  assert.equal(pickTabelaPrecoExata(null, 'EXPECTED'), null);
  assert.equal(pickTabelaPrecoExata([{ id: 'EXPECTED' }], ''), null);
});

test('React harness: filterInContext WRONG id ≠ tabela escolhida; preço 11≠99; late response cancelada', async () => {
  const calcSource = await readFile(new URL('../src/components/comercial/CalculadorPrecoItem.jsx', import.meta.url), 'utf8');
  const calcCompiled = ts.transpileModule(calcSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const calcSandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === 'react') return { __esModule: true, default: {}, createElement: () => null };
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(calcCompiled, calcSandbox);
  const { calcularPrecoItem } = calcSandbox.exports;

  const source = await readFile(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  const EXPECTED = 'EXPECTED';
  const WRONG = 'WRONG';
  let formData = {
    cliente_id: 'cli-1',
    status: 'Rascunho',
    tabela_preco_id: EXPECTED,
    empresa_id: 'e1',
    group_id: 'g1',
    itens_revenda: [],
  };
  const setFormData = (updater) => {
    formData = typeof updater === 'function' ? updater(formData) : updater;
  };
  const setActiveTab = () => {};
  let sessionToken = 'token-A';
  const visualCtx = { empresaAtual: { id: 'e1', group_id: 'g1' }, grupoAtual: { id: 'g1' } };
  const filterCalls = [];
  let resolveTabelaGate;
  const tabelaGate = new Promise((r) => { resolveTabelaGate = r; });

  const states = [];
  let slot = 0;
  const pendingEffects = [];
  const effectDepsPrev = [];
  let effectSlot = 0;
  const effectCleanups = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = slot++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], (n) => { states[i] = typeof n === 'function' ? n(states[i]) : n; }];
    },
    useEffect(fn, deps) {
      const i = effectSlot++;
      const key = deps === undefined ? `__nodeps_${i}` : JSON.stringify(deps);
      if (effectDepsPrev[i] === key) return;
      if (typeof effectCleanups[i] === 'function') {
        try { effectCleanups[i](); } catch { /* ignore */ }
        effectCleanups[i] = null;
      }
      effectDepsPrev[i] = key;
      if (typeof fn === 'function') pendingEffects.push({ i, fn });
    },
    useRef(v) { return { current: v }; },
    lazy: () => function LazyStub() { return { type: 'Lazy', props: {}, children: [] }; },
  };

  const sandbox = {
    exports: {},
    module: { exports: {} },
    Promise,
    console,
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
      '@/components/comercial/HistoricoComprasCliente': {
        __esModule: true,
        default: function HistoricoComprasCliente(props) {
          return { type: 'HistoricoComprasCliente', props, children: [] };
        },
      },
      '@/components/comercial/SugestoesProdutos': { __esModule: true, default: () => null },
      '@/components/comercial/Top10ProdutosCliente': { __esModule: true, default: () => null },
      '@/components/comercial/AdicionarItemRevendaModal': {
        __esModule: true,
        default: function AdicionarItemRevendaModal(props) {
          return { type: 'AdicionarItemRevendaModal', props, children: [] };
        },
      },
      '@/components/comercial/historicoComprasClientePolicy': {
        seedProdutoFromHistorico,
        pedidoItensBloqueadosPorStatus,
        buildHistoricoModalGeracao,
        buildSessionFingerprint,
        bumpSessionEpoch,
        pedidoVisualCompativel,
        numeroComprovado,
        pickTabelaPrecoExata,
      },
      '@/api/base44Client': { base44: { functions: { invoke: async () => ({}) } } },
      '@/api/erpHttpSession': {
        readErpHttpSession: () => (sessionToken ? { token: sessionToken } : null),
      },
      sonner: { toast: { success: () => {}, error: () => {}, message: () => {} } },
      '@/components/lib/useContextoVisual': {
        __esModule: true,
        default: () => ({
          createInContext: async () => ({}),
          filterInContext: async (entity, filter) => {
            filterCalls.push({ entity, filter: { ...filter } });
            if (entity === 'TabelaPreco') {
              await tabelaGate;
              // Fronteira sintética: consulta EXPECTED, devolve WRONG (≠ inventar aceite).
              return [{ id: WRONG, nome: 'Tabela errada', preco_hint: 99 }];
            }
            if (entity === 'TabelaPrecoItem') {
              return [{
                produto_id: 'prod-1',
                tabela_preco_id: WRONG,
                preco_com_desconto: 99,
              }];
            }
            return [];
          },
          empresaAtual: visualCtx.empresaAtual,
          grupoAtual: visualCtx.grupoAtual,
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
    effectSlot = 0;
    pendingEffects.length = 0;
    PedidoTabsContainer({
      activeTab: 'historico',
      setActiveTab,
      formData,
      setFormData,
      clientes: [{ id: 'cli-1' }],
      bloquearEdicao: true,
      validacoes: {},
      errors: {},
      pedido: null,
    });
    const queued = pendingEffects.splice(0, pendingEffects.length);
    for (const { i, fn } of queued) {
      try {
        const cleanup = fn();
        if (typeof cleanup === 'function') effectCleanups[i] = cleanup;
      } catch { /* async */ }
    }
    slot = 0;
    effectSlot = 0;
    return PedidoTabsContainer({
      activeTab: 'historico',
      setActiveTab,
      formData,
      setFormData,
      clientes: [{ id: 'cli-1' }],
      bloquearEdicao: true,
      validacoes: {},
      errors: {},
      pedido: null,
    });
  }

  let tree = render();
  // Abre modal com seed preço comprovado 11.
  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'prod-1',
    descricao: 'Item',
    unidade: 'UN',
    ultimo_preco: 11,
  });
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1);

  resolveTabelaGate();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  tree = render();

  const modal = findType(tree, 'AdicionarItemRevendaModal')[0];
  assert.ok(modal, 'modal montado');
  assert.equal(modal.props.tabelaPreco, null, 'WRONG≠EXPECTED → tabela null');
  // Itens via realm do vm — comparar por length (≠ deepEqual cross-context).
  assert.ok(Array.isArray(modal.props.tabelaPrecoItens) && modal.props.tabelaPrecoItens.length === 0);
  assert.equal(states.find((s) => s && typeof s === 'object' && s.id === WRONG), undefined);

  const produto = {
    id: 'prod-1',
    preco_venda: 11,
    custo_medio: 5,
    descricao: 'Item',
  };
  const calcSemTabela = calcularPrecoItem({
    produto,
    tabelaPreco: modal.props.tabelaPreco,
    tabelaPrecoItens: modal.props.tabelaPrecoItens || [],
    quantidade: 1,
  });
  assert.equal(calcSemTabela.preco_unitario_bruto, 11);
  assert.equal(calcSemTabela.origem_preco, 'produto_base');
  assert.notEqual(calcSemTabela.preco_unitario_bruto, 99);

  const calcSeAceitasseWrong = calcularPrecoItem({
    produto,
    tabelaPreco: { id: WRONG, nome: 'errada' },
    tabelaPrecoItens: [{ produto_id: 'prod-1', preco_com_desconto: 99 }],
    quantidade: 1,
  });
  assert.equal(calcSeAceitasseWrong.preco_unitario_bruto, 99);

  // Confirm canônico com props fail-closed: 1 write com 11, nunca preco_tabela 99.
  let writes = 0;
  modal.props.onAddItem({
    produto_id: 'prod-1',
    preco_unitario: calcSemTabela.preco_unitario,
    ...(calcSemTabela.origem_preco === 'tabela_preco'
      ? { preco_tabela: calcSemTabela.preco_unitario_bruto }
      : {}),
  });
  // onAddItem do container confirma no rascunho
  writes = formData.itens_revenda.length;
  assert.equal(writes, 1);
  assert.equal(formData.itens_revenda[0].preco_unitario, 11);
  assert.notEqual(formData.itens_revenda[0].preco_tabela, 99);
  assert.ok(filterCalls.some((c) => c.entity === 'TabelaPreco' && String(c.filter.id) === EXPECTED));

  // Late response: limpa sync na troca de ID — estado anterior não confirmável.
  formData = { ...formData, tabela_preco_id: 'OTHER', itens_revenda: [...formData.itens_revenda] };
  tree = render();
  const modalAposTroca = findType(tree, 'AdicionarItemRevendaModal')[0];
  // Modal pode fechar por geracao/contexto; se aberto, tabela deve ser null.
  if (modalAposTroca) {
    assert.equal(modalAposTroca.props.tabelaPreco, null);
    assert.ok(Array.isArray(modalAposTroca.props.tabelaPrecoItens)
      && modalAposTroca.props.tabelaPrecoItens.length === 0);
  }
  assert.equal(states.find((s) => s && typeof s === 'object' && (s.id === WRONG || s.id === EXPECTED)), undefined);
});

test('React harness: PedidoA→B cancela resolução tardia (mesma tabelaT); B sem preco_tabela 99', async () => {
  const calcSource = await readFile(new URL('../src/components/comercial/CalculadorPrecoItem.jsx', import.meta.url), 'utf8');
  const calcCompiled = ts.transpileModule(calcSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const calcSandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === 'react') return { __esModule: true, default: {}, createElement: () => null };
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(calcCompiled, calcSandbox);
  const { calcularPrecoItem } = calcSandbox.exports;

  const source = await readFile(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  const TABELA_T = 'tabela-T';
  let formData = {
    id: 'pedido-A',
    cliente_id: 'cli-1',
    status: 'Rascunho',
    tabela_preco_id: TABELA_T,
    empresa_id: 'e1',
    group_id: 'g1',
    itens_revenda: [],
  };
  const setFormData = (updater) => {
    formData = typeof updater === 'function' ? updater(formData) : updater;
  };
  const setActiveTab = () => {};
  let sessionToken = 'token-A';
  const visualCtx = { empresaAtual: { id: 'e1', group_id: 'g1' }, grupoAtual: { id: 'g1' } };
  let resolveA;
  const gateA = new Promise((r) => { resolveA = r; });
  let gateBResolve;
  const gateB = new Promise((r) => { gateBResolve = r; });
  let tabelaFetchCount = 0;

  const states = [];
  let slot = 0;
  const pendingEffects = [];
  const effectDepsPrev = [];
  let effectSlot = 0;
  const effectCleanups = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = slot++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], (n) => { states[i] = typeof n === 'function' ? n(states[i]) : n; }];
    },
    useEffect(fn, deps) {
      const i = effectSlot++;
      const key = deps === undefined ? `__nodeps_${i}` : JSON.stringify(deps);
      if (effectDepsPrev[i] === key) return;
      if (typeof effectCleanups[i] === 'function') {
        try { effectCleanups[i](); } catch { /* ignore */ }
        effectCleanups[i] = null;
      }
      effectDepsPrev[i] = key;
      if (typeof fn === 'function') pendingEffects.push({ i, fn });
    },
    useRef(v) { return { current: v }; },
    lazy: () => function LazyStub() { return { type: 'Lazy', props: {}, children: [] }; },
  };

  const sandbox = {
    exports: {},
    module: { exports: {} },
    Promise,
    console,
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
      '@/components/comercial/HistoricoComprasCliente': {
        __esModule: true,
        default: function HistoricoComprasCliente(props) {
          return { type: 'HistoricoComprasCliente', props, children: [] };
        },
      },
      '@/components/comercial/SugestoesProdutos': { __esModule: true, default: () => null },
      '@/components/comercial/Top10ProdutosCliente': { __esModule: true, default: () => null },
      '@/components/comercial/AdicionarItemRevendaModal': {
        __esModule: true,
        default: function AdicionarItemRevendaModal(props) {
          return { type: 'AdicionarItemRevendaModal', props, children: [] };
        },
      },
      '@/components/comercial/historicoComprasClientePolicy': {
        seedProdutoFromHistorico,
        pedidoItensBloqueadosPorStatus,
        buildHistoricoModalGeracao,
        buildSessionFingerprint,
        bumpSessionEpoch,
        pedidoVisualCompativel,
        numeroComprovado,
        pickTabelaPrecoExata,
      },
      '@/api/base44Client': { base44: { functions: { invoke: async () => ({}) } } },
      '@/api/erpHttpSession': {
        readErpHttpSession: () => (sessionToken ? { token: sessionToken } : null),
      },
      sonner: { toast: { success: () => {}, error: () => {}, message: () => {} } },
      '@/components/lib/useContextoVisual': {
        __esModule: true,
        default: () => ({
          createInContext: async () => ({}),
          filterInContext: async (entity) => {
            if (entity === 'TabelaPreco') {
              tabelaFetchCount += 1;
              const n = tabelaFetchCount;
              if (n === 1) await gateA;
              else await gateB;
              return [{ id: TABELA_T, nome: 'T' }];
            }
            if (entity === 'TabelaPrecoItem') {
              return [{
                produto_id: 'prod-1',
                tabela_preco_id: TABELA_T,
                preco_com_desconto: 99,
              }];
            }
            return [];
          },
          empresaAtual: visualCtx.empresaAtual,
          grupoAtual: visualCtx.grupoAtual,
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
    effectSlot = 0;
    pendingEffects.length = 0;
    PedidoTabsContainer({
      activeTab: 'historico',
      setActiveTab,
      formData,
      setFormData,
      clientes: [{ id: 'cli-1' }],
      bloquearEdicao: true,
      validacoes: {},
      errors: {},
      pedido: { id: formData.id },
    });
    const queued = pendingEffects.splice(0, pendingEffects.length);
    for (const { i, fn } of queued) {
      try {
        const cleanup = fn();
        if (typeof cleanup === 'function') effectCleanups[i] = cleanup;
      } catch { /* async */ }
    }
    slot = 0;
    effectSlot = 0;
    return PedidoTabsContainer({
      activeTab: 'historico',
      setActiveTab,
      formData,
      setFormData,
      clientes: [{ id: 'cli-1' }],
      bloquearEdicao: true,
      validacoes: {},
      errors: {},
      pedido: { id: formData.id },
    });
  }

  // PedidoA: inicia fetch pendente (gateA).
  let tree = render();
  assert.equal(tabelaFetchCount, 1);

  // PedidoB comprometido (mesmo cliente/grupo/empresa/ator/tabelaT) — deve cancelar A.
  formData = { ...formData, id: 'pedido-B', itens_revenda: [] };
  tree = render();
  assert.ok(tabelaFetchCount >= 2, 'B inicia resolução própria');

  // Libera resposta A (T+item99) — deve ser descartada.
  resolveA();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  tree = render();

  findType(tree, 'HistoricoComprasCliente')[0].props.onAdicionarProduto({
    produto_id: 'prod-1',
    descricao: 'Item',
    unidade: 'UN',
    ultimo_preco: 11,
  });
  tree = render();
  const modalAntesB = findType(tree, 'AdicionarItemRevendaModal')[0];
  assert.ok(modalAntesB);
  // Enquanto B não resolveu: tabela null — fail-closed (≠ preco_tabela 99 de A).
  assert.equal(modalAntesB.props.tabelaPreco, null, 'late A não grava tabela em B');
  assert.ok(Array.isArray(modalAntesB.props.tabelaPrecoItens) && modalAntesB.props.tabelaPrecoItens.length === 0);

  const calc = calcularPrecoItem({
    produto: { id: 'prod-1', preco_venda: 11, custo_medio: 5 },
    tabelaPreco: modalAntesB.props.tabelaPreco,
    tabelaPrecoItens: modalAntesB.props.tabelaPrecoItens || [],
    quantidade: 1,
  });
  assert.equal(calc.preco_unitario_bruto, 11);
  assert.equal(calc.origem_preco, 'produto_base');

  modalAntesB.props.onAddItem({
    produto_id: 'prod-1',
    preco_unitario: calc.preco_unitario,
  });
  assert.equal(formData.itens_revenda.length, 1);
  assert.equal(formData.itens_revenda[0].preco_unitario, 11);
  assert.notEqual(formData.itens_revenda[0].preco_tabela, 99);

  // Cleanup: libera gate B para não deixar promise órfã.
  gateBResolve();
  await Promise.resolve();
});
