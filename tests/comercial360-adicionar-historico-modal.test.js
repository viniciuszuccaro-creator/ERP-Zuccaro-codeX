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
  assert.match(src, /buildSessionFingerprint/);
  assert.match(src, /sessionKey/);
  // Effect observa sessão canônica (Codex P1: RenderB captura B; A→B→A sem rematch).
  assert.match(src, /sessionFingerprintObservado,/);
  assert.match(src, /Contexto alterado/);
  assert.match(src, /Contexto visual diverge/);
  assert.match(src, /onAdicionarHistorico/);
  assert.match(src, /confirmandoHistoricoRef/);
  assert.doesNotMatch(src, /buildItemRevendaFromHistorico/);
  assert.doesNotMatch(src, /onAdicionarProduto=\{bloquearEdicao \? undefined/);
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

test('CalculadorPrecoItem: custo_medio zero comprovado não cai em custo_aquisicao via ||', () => {
  const src = read('src/components/comercial/CalculadorPrecoItem.jsx');
  assert.match(src, /custoMedioRaw/);
  assert.match(src, /Number\.isFinite\(Number\(custoMedioRaw\)\)/);
  assert.doesNotMatch(src, /produto\.custo_medio \|\| produto\.custo_aquisicao \|\| 0/);
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

  // Sessão A→B→A (Codex P1): RenderB observa fp B nas deps → fecha; volta A sem rematch
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
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 1);
  const lenBeforeABA = formData.itens_revenda.length;
  sessionToken = 'token-sessao-B';
  // RenderB comprometido (só token); effect com sessionFingerprintObservado → epoch↑ e fecha
  tree = render();
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0, 'modalAfterB deve ser false');
  assert.equal(formData.itens_revenda.length, lenBeforeABA, 'RenderB = 0 writes');
  sessionToken = 'token-sessao-A';
  tree = render(); // volta A — modal permanece fechado (epoch monotônico; sem rematch)
  assert.equal(findType(tree, 'AdicionarItemRevendaModal').length, 0);
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
