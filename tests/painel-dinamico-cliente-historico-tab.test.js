import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

test('PainelDinamicoCliente monta TabsContent historico_produtos (não órfão)', async () => {
  const src = await readFile(new URL('../src/components/cadastros/PainelDinamicoCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /TabsTrigger value="historico_produtos"/);
  assert.match(src, /TabsContent value="historico_produtos"/);
  assert.match(src, /HistoricoProdutosCliente/);
  assert.doesNotMatch(src, /activeTab === ['"]historico_produtos['"]/);
  assert.equal((src.match(/<HistoricoProdutosCliente\b/g) || []).length, 1);
});

test('PainelDinamicoCliente recupera aba Contatos (GerenciarContatosClienteForm existente)', async () => {
  const src = await readFile(new URL('../src/components/cadastros/PainelDinamicoCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /TabsTrigger value="contatos"/);
  assert.match(src, /TabsContent value="contatos"/);
  assert.match(src, /GerenciarContatosClienteForm/);
  assert.match(src, /updateInContext\("Cliente"/);
  assert.match(src, /data-action="painel-cliente-contatos"/);
  assert.equal((src.match(/<GerenciarContatosClienteForm\b/g) || []).length, 1);
  // Sem módulo paralelo: reutiliza form do cadastro completo.
  assert.doesNotMatch(src, /GerenciarContatosCliente[^F]/);
});

async function mountHistoricoCliente({
  clienteId = 'cli-1',
  hasPermission = () => true,
  groupId = 'g1',
  empresaId = 'e1',
  backendMode = 'local',
  session = null,
  pedidosList = null,
  queryData = undefined,
} = {}) {
  const source = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  const state = [];
  const effects = [];
  const scheduled = [];
  let slot = 0;
  const queries = [];
  const filterCalls = [];
  const centralCalls = [];
  const listCalls = [];
  // Contexto mutável na MESMA instância (não remonta o componente).
  const live = {
    clienteId,
    groupId,
    empresaId,
    session,
    backendMode,
    pedidosList,
    queryData,
    hasPermission,
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
    AbortController: class {
      constructor() { this.signal = { aborted: false }; }
      abort() { this.signal.aborted = true; }
    },
    JSON,
    __modules: {
      react: { __esModule: true, default: react, ...react },
      '@tanstack/react-query': {
        useQuery(opts) {
          queries.push(opts);
          const qd = live.queryData;
          const enabledData = qd !== undefined
            ? qd
            : (opts.enabled ? { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } } : undefined);
          return {
            data: enabledData,
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
          };
        },
      },
      '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
      '@/components/ui/table': {
        Table: 'Table', TableBody: 'TableBody', TableCell: 'TableCell',
        TableHead: 'TableHead', TableHeader: 'TableHeader', TableRow: 'TableRow',
      },
      '@/components/ui/badge': { Badge: 'Badge' },
      '@/components/ui/alert': { Alert: 'Alert', AlertDescription: 'AlertDescription' },
      '@/components/ui/button': { Button: 'Button' },
      'lucide-react': new Proxy({}, { get: () => 'Icon' }),
      '@/components/lib/useContextoVisual': {
        useContextoVisual: () => ({
          filterInContext: async (entity, filter, ...rest) => {
            filterCalls.push({ entity, filter, rest });
            return [];
          },
          empresaAtual: live.empresaId ? { id: live.empresaId, group_id: live.groupId } : null,
          grupoAtual: live.groupId ? { id: live.groupId } : null,
          contexto: live.empresaId ? 'empresa' : (live.groupId ? 'grupo' : null),
        }),
      },
      '@/components/lib/usePermissions': {
        __esModule: true,
        default: () => ({ hasPermission: (...args) => live.hasPermission(...args) }),
      },
      '@/api/runtimeBackend': {
        resolveErpBackendMode: () => live.backendMode,
      },
      '@/api/erpHttpSession': {
        readErpHttpSession: () => live.session,
      },
      '@/api/httpApiClient': {
        createHttpApiClient: () => ({
          clientes: {
            central360: async (id, opts) => {
              centralCalls.push({ id, opts });
              throw new Error('central360 nao deve ser chamado pelo historico');
            },
          },
          pedidos: {
            list: async (opts) => {
              listCalls.push(opts);
              if (typeof live.pedidosList === 'function') return live.pedidosList(opts);
              return live.pedidosList || { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } };
            },
          },
        }),
      },
    },
  };

  vm.runInNewContext(compiled, sandbox);
  const Component = sandbox.exports.default || sandbox.module.exports.default;
  const mapFn = sandbox.exports.mapPedidosToHistoricoLinhas
    || sandbox.module.exports.mapPedidosToHistoricoLinhas;
  const loadFn = sandbox.exports.loadPedidosHistoricoHttp
    || sandbox.module.exports.loadPedidosHistoricoHttp;
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  const render = ({ flushEffects = true } = {}) => {
    slot = 0;
    const next = Component({ clienteId: live.clienteId });
    if (flushEffects) scheduled.splice(0).forEach((fn) => fn());
    return next;
  };
  const tree = render({ flushEffects: true });
  return {
    tree,
    walk: () => walk(tree),
    queries,
    filterCalls,
    centralCalls,
    listCalls,
    mapFn,
    loadFn,
    state,
    live,
    Component,
    props: { get clienteId() { return live.clienteId; } },
    flush: () => scheduled.splice(0).forEach((fn) => fn()),
    /** Render na mesma instância; flushEffects=false = 1º paint antes dos effects. */
    render,
    remount({ flushEffects = true } = {}) {
      return render({ flushEffects });
    },
    setContext(patch) {
      Object.assign(live, patch);
    },
    findCard(node) {
      return walk(node).find((n) => n.props && n.props['data-historico-fonte']);
    },
  };
}

test('HistoricoProdutosCliente: sem permissão não consulta Pedido (aba montada ≠ carga)', async () => {
  const { queries, filterCalls } = await mountHistoricoCliente({
    hasPermission: () => false,
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].enabled, false);
  assert.equal(filterCalls.length, 0);
});

test('HistoricoProdutosCliente legado: com permissão consulta filterInContext Pedido até 200', async () => {
  const { queries, filterCalls } = await mountHistoricoCliente({
    backendMode: 'local',
    hasPermission: (key) => key === 'Comercial.Pedido.visualizar',
  });
  assert.equal(queries[0].enabled, true);
  assert.ok(queries[0].queryKey.includes('legado'));
  const page = await queries[0].queryFn({});
  assert.equal(filterCalls.length, 1);
  assert.equal(filterCalls[0].entity, 'Pedido');
  assert.equal(filterCalls[0].filter.cliente_id, 'cli-1');
  assert.equal(filterCalls[0].rest[1], 200);
  assert.equal(page.meta.limit, 200);
  assert.equal(page.meta.offset, 0);
  assert.equal(page.meta.total, 0);
  assert.equal(page.meta.hasMore, false);
});

test('HistoricoProdutosCliente HTTP: lista por clienteId sem Central360 nem cliente_empresa', async () => {
  const { queries, filterCalls, centralCalls, listCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    session: {
      token: 'tok',
      actorId: '11111111-1111-1111-1111-111111111111',
      groupId: 'g1',
      email: 'a@b.c',
    },
    pedidosList: {
      data: [{
        id: 'p1',
        numero: 'P-1',
        created_at: '2026-01-10T12:00:00Z',
        itens: [{
          produto_id: 'prod-1',
          descricao: 'Barra 3/8',
          unidade_sigla: 'KG',
          quantidade: '10',
          total: '100.00',
        }],
      }],
      meta: { limit: 50, offset: 0, total: 1, hasMore: false },
    },
  });
  assert.equal(queries[0].enabled, true);
  assert.ok(queries[0].queryKey.includes('http'));
  assert.ok(queries[0].queryKey.includes('11111111-1111-1111-1111-111111111111'));
  assert.ok(queries[0].queryKey.some((k) => typeof k === 'string' && /^11111111-1111-1111-1111-111111111111:\d+:[0-9a-z]+$/.test(k)));
  const page = await queries[0].queryFn({});
  assert.equal(filterCalls.length, 0);
  assert.equal(centralCalls.length, 0);
  assert.equal(listCalls.length, 1);
  assert.equal(listCalls[0].clienteId, 'cli-1');
  assert.equal(listCalls[0].clienteEmpresaId, undefined);
  assert.equal(listCalls[0].limit, 50);
  assert.equal(listCalls[0].offset, 0);
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0].itens[0].descricao, 'Barra 3/8');
  assert.equal(page.meta.total, 1);
});

test('HistoricoProdutosCliente HTTP: sem empresa no contexto nao consulta (fail-closed)', async () => {
  const { queries, filterCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    empresaId: null,
    groupId: 'g1',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
  });
  assert.equal(queries[0].enabled, false);
  assert.equal(filterCalls.length, 0);
});

test('HistoricoProdutosCliente HTTP: sem sessao nao habilita consulta (fail-closed, sem facade)', async () => {
  const { queries, filterCalls, centralCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    session: null,
  });
  // Sem actor/token a query fica disabled — não dispara facade local.
  assert.equal(queries[0].enabled, false);
  assert.equal(filterCalls.length, 0);
  assert.equal(centralCalls.length, 0);
});

test('HistoricoProdutosCliente: sem contexto não consulta mesmo com permissão', async () => {
  const { queries, filterCalls } = await mountHistoricoCliente({
    groupId: null,
    empresaId: null,
    hasPermission: () => true,
  });
  assert.equal(queries[0].enabled, false);
  assert.equal(filterCalls.length, 0);
});

test('HistoricoProdutosCliente HTTP: sem vinculo retorna vazio via pedidos.list (sem Central360)', async () => {
  const { queries, filterCalls, listCalls, centralCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    session: {
      token: 'tok',
      actorId: '11111111-1111-1111-1111-111111111111',
      groupId: 'g1',
    },
    pedidosList: { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } },
  });
  const page = await queries[0].queryFn({});
  assert.equal(filterCalls.length, 0);
  assert.equal(centralCalls.length, 0);
  assert.equal(listCalls.length, 1);
  assert.equal(listCalls[0].clienteId, 'cli-1');
  assert.deepEqual(page.data, []);
  assert.equal(page.meta.total, 0);
});

test('HistoricoProdutosCliente HTTP: lista vazia nao inventa linhas; queryKey isola empresa', async () => {
  const a = await mountHistoricoCliente({
    backendMode: 'http',
    empresaId: 'emp-a',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
    pedidosList: { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } },
  });
  assert.ok(a.queries[0].queryKey.includes('emp-a'));
  assert.ok(a.queries[0].queryKey.includes('http'));
  const empty = await a.queries[0].queryFn({});
  assert.deepEqual(empty.data, []);
  const linhas = a.mapFn(empty.data);
  assert.equal(linhas.length, 0);

  const b = await mountHistoricoCliente({
    backendMode: 'http',
    empresaId: 'emp-b',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
    pedidosList: { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } },
  });
  assert.ok(b.queries[0].queryKey.includes('emp-b'));
  assert.notEqual(a.queries[0].queryKey.join('|'), b.queries[0].queryKey.join('|'));
});

test('HistoricoProdutosCliente HTTP: paginação acessa pedidos além dos primeiros 50', async () => {
  const first = Array.from({ length: 50 }, (_, i) => ({
    id: `p-${i + 1}`,
    numero: String(i + 1).padStart(8, '0'),
    created_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`,
    itens: [{ produto_id: 'prod-common', descricao: 'Comum', quantidade: 1, total: 1 }],
  }));
  const second = [{
    id: 'p-51',
    numero: '00000051',
    created_at: '2025-12-01T12:00:00Z',
    itens: [{ produto_id: 'prod-only-page2', descricao: 'Somente pagina 2', quantidade: 3, total: 30 }],
  }];

  const h = await mountHistoricoCliente({
    backendMode: 'http',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
    pedidosList: (opts) => {
      if (opts.offset === 0) {
        return { data: first, meta: { limit: 50, offset: 0, total: 51, hasMore: true } };
      }
      return { data: second, meta: { limit: 50, offset: 50, total: 51, hasMore: false } };
    },
    queryData: { data: first, meta: { limit: 50, offset: 0, total: 51, hasMore: true } },
  });

  const page0 = await h.queries[0].queryFn({});
  assert.equal(page0.data.length, 50);
  assert.equal(page0.meta.hasMore, true);
  assert.equal(page0.meta.total, 51);
  assert.equal(h.listCalls[0].offset, 0);

  // Carregar mais via botão da UI (consumidor real do offset seguinte)
  const beforeMore = h.listCalls.length;
  const tree = h.remount();
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  const btn = walk(tree).find((n) => n.props && n.props['data-action'] === 'historico-produtos-carregar-mais');
  assert.ok(btn, 'botão Carregar mais');
  await btn.props.onClick();
  assert.equal(h.listCalls.length, beforeMore + 1);
  const moreCall = h.listCalls[h.listCalls.length - 1];
  assert.equal(moreCall.offset, 50);
  assert.equal(moreCall.clienteId, 'cli-1');
  assert.equal(moreCall.limit, 50);

  // Após append, produto da página 2 entra nas linhas mapeadas
  const allPedidos = [...first, ...second];
  const linhas = h.mapFn(allPedidos);
  assert.ok(linhas.some((l) => l.produto_id === 'prod-only-page2'));
  assert.equal(linhas.filter((l) => l.produto_id === 'prod-common').length, 50);
});

test('HistoricoProdutosCliente HTTP: troca de contexto descarta página extra anterior', async () => {
  const h = await mountHistoricoCliente({
    backendMode: 'http',
    empresaId: 'emp-a',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
    pedidosList: {
      data: [{ id: 'p1', numero: '1', itens: [] }],
      meta: { limit: 50, offset: 0, total: 60, hasMore: true },
    },
    queryData: {
      data: [{ id: 'p1', numero: '1', itens: [] }],
      meta: { limit: 50, offset: 0, total: 60, hasMore: true },
    },
  });
  // P2 Codex: resetPaginationSession limpa extras + loadingMore e aborta request antiga.
  const src = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /resetPaginationSession/);
  assert.match(src, /setLoadingMore\(false\)/);
  assert.match(src, /loadMoreAbortRef/);
  assert.match(src, /firstPageFingerprint/);
  assert.match(src, /sessionEpochRef/);
  assert.match(src, /empresaId/);
  assert.match(src, /historicoOwnerKey/);
  assert.match(src, /extraSession/);
  assert.match(src, /ownerMatches/);
  assert.ok(h.queries[0].queryKey.includes('emp-a'));
});

test('P2 #397: mesma instância A→B — 1º render (sem flush) sem pedidos/meta de A', async () => {
  const pageA0 = {
    data: [{
      id: 'p-a1',
      numero: 'A1',
      created_at: '2026-01-01T12:00:00Z',
      itens: [{ produto_id: 'prod-A', descricao: 'Produto A', quantidade: 1, total: 10 }],
    }],
    meta: { limit: 50, offset: 0, total: 90, hasMore: true },
  };
  const pageA1 = {
    data: [{
      id: 'p-a51',
      numero: 'A51',
      created_at: '2025-12-01T12:00:00Z',
      itens: [{ produto_id: 'prod-A-extra', descricao: 'Extra A', quantidade: 2, total: 20 }],
    }],
    meta: { limit: 50, offset: 50, total: 90, hasMore: true },
  };
  const pageB0 = {
    data: [{
      id: 'p-b1',
      numero: 'B1',
      created_at: '2026-02-01T12:00:00Z',
      itens: [{ produto_id: 'prod-B', descricao: 'Produto B', quantidade: 1, total: 5 }],
    }],
    meta: { limit: 50, offset: 0, total: 1, hasMore: false },
  };

  const h = await mountHistoricoCliente({
    backendMode: 'http',
    clienteId: 'cli-A',
    empresaId: 'emp-A',
    groupId: 'g1',
    session: { token: 'tok-A', actorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', groupId: 'g1' },
    pedidosList: (opts) => (opts.offset === 0 ? pageA0 : pageA1),
    queryData: pageA0,
  });

  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  let tree = h.remount({ flushEffects: true });
  let card = walk(tree).find((n) => n.props && n.props['data-historico-fonte']);
  assert.equal(card.props['data-historico-pedidos-carregados'], 1);
  assert.equal(card.props['data-historico-pedidos-total'], 90);

  const btn = walk(tree).find((n) => n.props && n.props['data-action'] === 'historico-produtos-carregar-mais');
  assert.ok(btn, 'load-more em A');
  await btn.props.onClick();
  tree = h.remount({ flushEffects: true });
  card = walk(tree).find((n) => n.props && n.props['data-historico-fonte']);
  assert.equal(card.props['data-historico-pedidos-carregados'], 2, 'A com extra page');
  assert.ok(
    h.state.some((s) => s && typeof s === 'object' && s.ownerKey && Array.isArray(s.pages) && s.pages.length === 1),
    'extraSession de A permanece no state até effect',
  );

  // Contraprova do defeito antigo: sem filtro de owner no render, extras de A vazariam.
  const staleExtra = h.state.find((s) => s && s.ownerKey && Array.isArray(s.pages));
  assert.equal(staleExtra.pages[0].data[0].id, 'p-a51');
  const leakedIfUnfiltered = [...pageB0.data, ...staleExtra.pages.flatMap((p) => p.data)];
  assert.equal(leakedIfUnfiltered.length, 2, 'antes: 1º render misturaria A+B');

  // Troca cliente/empresa/ator/sessão na MESMA instância — sem remontar artificialmente.
  h.setContext({
    clienteId: 'cli-B',
    empresaId: 'emp-B',
    session: { token: 'tok-B', actorId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', groupId: 'g1' },
    queryData: pageB0,
    pedidosList: pageB0,
  });

  // 1º render de B SEM executar effects (resetPaginationSession ainda não rodou).
  tree = h.remount({ flushEffects: false });
  card = walk(tree).find((n) => n.props && n.props['data-historico-fonte']);
  assert.ok(card, 'card de B no 1º render');
  assert.equal(card.props['data-historico-pedidos-carregados'], 1, 'só 1ª página de B');
  assert.equal(card.props['data-historico-pedidos-total'], 1, 'meta de B, não total 90 de A');
  assert.equal(card.props['data-historico-linhas-carregadas'], 1);
  // Serializa árvore: nenhum vestígio de A no 1º paint de B
  const blob = JSON.stringify(tree);
  assert.equal(blob.includes('p-a51') || blob.includes('prod-A-extra') || blob.includes('Extra A'), false);
  assert.equal(blob.includes('prod-A"') || blob.includes('Produto A'), false);
  assert.ok(blob.includes('B1') || blob.includes('prod-B') || blob.includes('Produto B'));
  assert.equal(
    walk(tree).some((n) => n.props && n.props['data-historico-produtos-error'] === 'load-more'),
    false,
  );

  // State bruto ainda pode ter owner A até o effect — mas UI já está limpa.
  assert.equal(staleExtra.pages[0].data[0].id, 'p-a51');
});

test('P2 #397: 1º load-more pendente — double-click não repete offset; erro visível; retry', async () => {
  const page0 = {
    data: Array.from({ length: 50 }, (_, i) => ({
      id: `p-${i + 1}`,
      numero: String(i + 1),
      created_at: '2026-01-01T12:00:00Z',
      itens: [{ produto_id: 'prod', descricao: 'X', quantidade: 1, total: 1 }],
    })),
    meta: { limit: 50, offset: 0, total: 60, hasMore: true },
  };
  const page1 = {
    data: [{
      id: 'p-51',
      numero: '51',
      created_at: '2025-12-01T12:00:00Z',
      itens: [{ produto_id: 'prod-extra', descricao: 'Extra', quantidade: 1, total: 1 }],
    }],
    meta: { limit: 50, offset: 50, total: 60, hasMore: false },
  };

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let failOnce = true;
  const offsets = [];

  const h = await mountHistoricoCliente({
    backendMode: 'http',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
    queryData: page0,
    pedidosList: async (opts) => {
      offsets.push(opts.offset);
      if (opts.offset === 0) return page0;
      await gate;
      if (failOnce) {
        failOnce = false;
        throw Object.assign(new Error('rede load-more'), { name: 'NetworkError' });
      }
      return page1;
    },
  });

  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  let tree = h.remount({ flushEffects: true });
  const findBtn = (n) => walk(n).find((x) => x.props && x.props['data-action'] === 'historico-produtos-carregar-mais');
  const btn = findBtn(tree);
  assert.ok(btn);

  // Dois acionamentos imediatos com Promise pendente — uma chamada/offset.
  const p1 = btn.props.onClick();
  const p2 = btn.props.onClick();
  assert.equal(offsets.filter((o) => o === 50).length, 1, 'só um offset 50 enquanto pendente');

  // Owner já associado: loading scoped visível no re-render
  tree = h.remount({ flushEffects: false });
  const btnBusy = findBtn(tree);
  assert.ok(btnBusy?.props?.disabled, 'loading scoped com owner ligado');
  assert.ok(
    h.state.some((s) => s && s.ownerKey && Array.isArray(s.pages)),
    'extraSession.ownerKey definido antes do sucesso',
  );

  release();
  await Promise.all([p1, p2]);
  tree = h.remount({ flushEffects: true });
  const errNode = walk(tree).find((n) => n.props && n.props['data-historico-produtos-error'] === 'load-more');
  assert.ok(errNode, 'primeiro erro de load-more visível (não oculto por owner null)');
  let card = walk(tree).find((n) => n.props && n.props['data-historico-fonte']);
  assert.equal(card.props['data-historico-pedidos-carregados'], 50, 'falha preserva 1ª página; sem anexar');

  // Retry mesmo offset após falha
  const beforeRetry = offsets.filter((o) => o === 50).length;
  await findBtn(tree).props.onClick();
  assert.equal(offsets.filter((o) => o === 50).length, beforeRetry + 1);
  tree = h.remount({ flushEffects: true });
  card = walk(tree).find((n) => n.props && n.props['data-historico-fonte']);
  assert.equal(card.props['data-historico-pedidos-carregados'], 51, 'retry anexa uma vez sem duplicar');
  assert.equal(
    walk(tree).some((n) => n.props && n.props['data-historico-produtos-error'] === 'load-more'),
    false,
  );
});

test('P2 #397: load-more pendente + troca de contexto — resposta tardia descartada; B sem loading/erro de A', async () => {
  const pageA0 = {
    data: [{ id: 'a1', numero: 'A1', created_at: '2026-01-01T12:00:00Z', itens: [{ descricao: 'A', quantidade: 1, total: 1 }] }],
    meta: { limit: 50, offset: 0, total: 80, hasMore: true },
  };
  const pageA1 = {
    data: [{ id: 'a51', numero: 'A51', created_at: '2025-12-01T12:00:00Z', itens: [{ descricao: 'A-extra', quantidade: 1, total: 1 }] }],
    meta: { limit: 50, offset: 50, total: 80, hasMore: false },
  };
  const pageB0 = {
    data: [{ id: 'b1', numero: 'B1', created_at: '2026-02-01T12:00:00Z', itens: [{ descricao: 'B', quantidade: 1, total: 1 }] }],
    meta: { limit: 50, offset: 0, total: 1, hasMore: false },
  };

  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const h = await mountHistoricoCliente({
    backendMode: 'http',
    clienteId: 'cli-A',
    empresaId: 'emp-A',
    groupId: 'g1',
    session: { token: 'tok-A', actorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', groupId: 'g1' },
    queryData: pageA0,
    pedidosList: async (opts) => {
      if (opts.offset === 0) return pageA0;
      await gate;
      return pageA1;
    },
  });

  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  let tree = h.remount({ flushEffects: true });
  const pending = walk(tree).find((n) => n.props?.['data-action'] === 'historico-produtos-carregar-mais').props.onClick();

  h.setContext({
    clienteId: 'cli-B',
    empresaId: 'emp-B',
    session: { token: 'tok-B', actorId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', groupId: 'g1' },
    queryData: pageB0,
    pedidosList: pageB0,
  });
  // Effect de troca reseta sessão (epoch++) e aborta
  tree = h.remount({ flushEffects: true });
  release();
  await pending;

  tree = h.remount({ flushEffects: true });
  const card = walk(tree).find((n) => n.props && n.props['data-historico-fonte']);
  assert.equal(card.props['data-historico-pedidos-carregados'], 1);
  assert.equal(card.props['data-historico-pedidos-total'], 1);
  const blob = JSON.stringify(tree);
  assert.equal(blob.includes('a51') || blob.includes('A-extra'), false);
  assert.equal(
    walk(tree).some((n) => n.props && n.props['data-historico-produtos-error'] === 'load-more'),
    false,
  );
  const btnB = walk(tree).find((n) => n.props?.['data-action'] === 'historico-produtos-carregar-mais');
  assert.equal(btnB, undefined, 'B sem hasMore — sem botão; loading de A não preso');
});

test('fonte #397: loadMoreInFlightRef e ownerKey antes da rede', async () => {
  const src = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /loadMoreInFlightRef/);
  assert.match(src, /intentOwnerKey/);
  assert.match(src, /prev\.ownerKey === intentOwnerKey/);
  const idxHandler = src.indexOf('const handleLoadMore = async');
  const idxIntent = src.indexOf('const intentOwnerKey = historicoOwnerKey', idxHandler);
  const idxAwait = src.indexOf('await loadPedidosHistoricoHttp', idxHandler);
  assert.ok(idxHandler > 0 && idxIntent > idxHandler && idxAwait > idxIntent, 'owner ligado antes do await load-more');
  const idxRef = src.indexOf('loadMoreInFlightRef.current = true', idxHandler);
  assert.ok(idxRef > idxHandler && idxRef < idxAwait, 'ref síncrono antes do await');
});

test('mapPedidosToHistoricoLinhas: ordena por data e preserva produto repetido em pedidos distintos', async () => {
  const { mapFn } = await mountHistoricoCliente({ hasPermission: () => false });
  const rows = mapFn([
    {
      id: 'p-old',
      numero: 'P-OLD',
      created_at: '2026-01-01T00:00:00Z',
      itens: [{ produto_id: 'prod-x', descricao: 'Mesmo', quantidade: 1, total: 10 }],
    },
    {
      id: 'p-new',
      numero: 'P-NEW',
      created_at: '2026-02-01T00:00:00Z',
      itens: [
        { produto_id: 'prod-x', descricao: 'Mesmo', quantidade: 2, total: 20 },
        { produto_id: 'prod-y', descricao: 'Outro', quantidade: 1, total: 5 },
      ],
    },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].numero_pedido, 'P-NEW');
  assert.equal(rows[0].descricao, 'Mesmo');
  assert.equal(rows[1].numero_pedido, 'P-NEW');
  assert.equal(rows[2].numero_pedido, 'P-OLD');
  assert.equal(rows.filter((r) => r.produto_id === 'prod-x').length, 2);
});

test('mapPedidosToHistoricoLinhas: legado itens_* e canônico itens', async () => {
  const { mapFn } = await mountHistoricoCliente({ hasPermission: () => false });
  assert.equal(typeof mapFn, 'function');
  const legado = mapFn([{
    numero_pedido: 'L-1',
    data_pedido: '2026-01-01',
    itens_revenda: [{ descricao: 'Aço', quantidade: 2, unidade: 'KG', valor_total: 20 }],
  }]);
  assert.equal(legado.length, 1);
  assert.equal(legado[0].tipo, 'Revenda');
  assert.equal(legado[0].descricao, 'Aço');

  const canon = mapFn([{
    id: 'p2',
    numero: 'C-2',
    created_at: '2026-02-01T00:00:00Z',
    itens: [{ descricao: 'Vergalhao', unidade_sigla: 'UN', quantidade: '3', total: '30' }],
  }]);
  assert.equal(canon.length, 1);
  assert.equal(canon[0].numero_pedido, 'C-2');
  assert.equal(canon[0].unidade, 'UN');
  assert.equal(canon[0].valor, 30);
});

test('fonte HTTP nao referencia central360; contrato clienteId no pedidos.list', async () => {
  const src = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /central360/);
  assert.match(src, /clienteId/);
  assert.match(src, /hasMore/);
  assert.match(src, /historico-produtos-carregar-mais/);
  assert.match(src, /LEGADO_PEDIDOS_LIMIT = 200/);
  assert.match(src, /LINHAS_UI_LIMIT/);
  assert.match(src, /data-historico-linhas-truncadas/);
  assert.match(src, /data-historico-linhas-carregadas/);
  assert.match(src, /data-historico-linhas-exibidas/);
  // Teto de UI é honesto: não esconde linhas carregadas sem sinalizar.
  assert.match(src, /linhasTruncadas/);
  // Isolamento sessão/usuário + revalidação de contexto na execução.
  assert.match(src, /historicoSessionCacheKey/);
  assert.match(src, /assertHistoricoHttpScope/);
  assert.match(src, /SESSION_ACTOR_CHANGED|expectedActorId/);
  assert.match(src, /HISTORICO_CONTEXT_DENIED|CONTEXT_CHANGED/);
});

test('assertHistoricoHttpScope: troca de actor ou rotacao de sessao falha fechado', async () => {
  const h = await mountHistoricoCliente({
    backendMode: 'http',
    session: { token: 'tok-aaaa', actorId: 'actor-a', groupId: 'g1' },
  });
  // Reusa o módulo montado: exporta helpers via source re-exec
  const source = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  let sessionLive = { token: 'tok-aaaa', actorId: 'actor-a', groupId: 'g1' };
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === 'react') {
        return {
          __esModule: true,
          default: { createElement: () => null },
          createElement: () => null,
          useState: (v) => [v, () => {}],
          useRef: (v) => ({ current: v }),
          useMemo: (f) => f(),
          useEffect: () => {},
        };
      }
      if (id === '@tanstack/react-query') return { useQuery: () => ({}) };
      if (id === '@/components/lib/useContextoVisual') return { useContextoVisual: () => ({}) };
      if (id === '@/components/lib/usePermissions') return { __esModule: true, default: () => ({ hasPermission: () => true }) };
      if (id === '@/api/runtimeBackend') return { resolveErpBackendMode: () => 'http' };
      if (id === '@/api/erpHttpSession') return { readErpHttpSession: () => sessionLive };
      if (id === '@/api/httpApiClient') return { createHttpApiClient: () => ({ pedidos: { list: async () => ({ data: [] }) } }) };
      if (id.startsWith('@/components/ui/')) return new Proxy({}, { get: () => 'UI' });
      if (id === 'lucide-react') return new Proxy({}, { get: () => 'Icon' });
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(compiled, sandbox);
  const assertHistoricoHttpScope = sandbox.exports.assertHistoricoHttpScope || sandbox.module.exports.assertHistoricoHttpScope;
  const historicoSessionCacheKey = sandbox.exports.historicoSessionCacheKey || sandbox.module.exports.historicoSessionCacheKey;
  assert.equal(typeof assertHistoricoHttpScope, 'function');
  const historicoTokenFingerprint = sandbox.exports.historicoTokenFingerprint || sandbox.module.exports.historicoTokenFingerprint;
  const keyA = historicoSessionCacheKey(sessionLive);
  assert.match(keyA, /^actor-a:\d+:[0-9a-z]+$/);
  assert.equal(keyA, `actor-a:${historicoTokenFingerprint('tok-aaaa')}`);
  assert.throws(
    () => assertHistoricoHttpScope({
      session: { ...sessionLive, actorId: 'actor-b' },
      groupId: 'g1',
      empresaId: 'e1',
      expectedActorId: 'actor-a',
      expectedSessionKey: keyA,
    }),
    /usuario|SESSION_ACTOR/i,
  );
  assert.throws(
    () => assertHistoricoHttpScope({
      session: { ...sessionLive, token: 'tok-bbbb' },
      groupId: 'g1',
      empresaId: 'e1',
      expectedActorId: 'actor-a',
      expectedSessionKey: keyA,
    }),
    /rotacion|SESSION_ROTATED/i,
  );
  // P1 Codex: JWTs distintos com mesmo prefixo de 16 chars NÃO compartilham cacheKey.
  const samePrefixA = `${'eyJhbGciOiJIUzI1NiJ9'}.payload-one.sig-aaaa`;
  const samePrefixB = `${'eyJhbGciOiJIUzI1NiJ9'}.payload-two.sig-bbbb`;
  assert.equal(samePrefixA.slice(0, 16), samePrefixB.slice(0, 16));
  assert.notEqual(
    historicoSessionCacheKey({ token: samePrefixA, actorId: 'actor-a' }),
    historicoSessionCacheKey({ token: samePrefixB, actorId: 'actor-a' }),
  );
  assert.ok(h.queries[0].queryKey.includes('actor-a'));
});

test('Histórico resetPaginationSession: zera loadingMore e limpa extras (P2 Codex)', async () => {
  const src = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /const resetPaginationSession = \(\) => \{/);
  assert.match(src, /setLoadingMore\(false\)/);
  assert.match(src, /setExtraSession\(\{\s*ownerKey:\s*null,\s*pages:\s*\[\]\s*\}\)/);
  assert.match(src, /firstPageFingerprint/);
  assert.match(src, /historicoTokenFingerprint/);
  // finally da load-more só zera loading quando o controller ainda é o vigente
  assert.match(src, /if \(loadMoreAbortRef\.current === controller\)/);
});
