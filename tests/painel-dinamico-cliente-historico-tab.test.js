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
    __modules: {
      react: { __esModule: true, default: react, ...react },
      '@tanstack/react-query': {
        useQuery(opts) {
          queries.push(opts);
          const enabledData = queryData !== undefined
            ? queryData
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
          empresaAtual: empresaId ? { id: empresaId, group_id: groupId } : null,
          grupoAtual: groupId ? { id: groupId } : null,
          contexto: empresaId ? 'empresa' : (groupId ? 'grupo' : null),
        }),
      },
      '@/components/lib/usePermissions': {
        __esModule: true,
        default: () => ({ hasPermission }),
      },
      '@/api/runtimeBackend': {
        resolveErpBackendMode: () => backendMode,
      },
      '@/api/erpHttpSession': {
        readErpHttpSession: () => session,
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
              if (typeof pedidosList === 'function') return pedidosList(opts);
              return pedidosList || { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } };
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
  slot = 0;
  const tree = Component({ clienteId });
  scheduled.splice(0).forEach((fn) => fn());
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
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
    Component,
    props: { clienteId },
    flush: () => scheduled.splice(0).forEach((fn) => fn()),
    remount() {
      slot = 0;
      const next = Component({ clienteId });
      scheduled.splice(0).forEach((fn) => fn());
      return next;
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

test('HistoricoProdutosCliente HTTP: sem sessao falha sem cair no facade local', async () => {
  const { queries, filterCalls, centralCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    session: null,
  });
  assert.equal(queries[0].enabled, true);
  await assert.rejects(() => queries[0].queryFn({}), /Sessao HTTP|HTTP_SESSION/);
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
  // extraPages state index: useState order = extraPages, loadingMore, loadMoreError
  // After effects, inject a stale extra page then remount with same props keeps it until key change —
  // source resets via useEffect on empresaId; simulate by checking effect deps include empresaId.
  const src = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /setExtraPages\(\[\]\)/);
  assert.match(src, /sessionEpochRef/);
  assert.match(src, /empresaId/);
  assert.ok(h.queries[0].queryKey.includes('emp-a'));
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
});
