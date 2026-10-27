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
  central360 = null,
  pedidosList = null,
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
    __modules: {
      react: { __esModule: true, default: react, ...react },
      '@tanstack/react-query': {
        useQuery(opts) {
          queries.push(opts);
          let data = opts.enabled ? [] : undefined;
          let isError = false;
          let error = null;
          return {
            data: data ?? [],
            isLoading: false,
            isFetching: false,
            isError,
            error,
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
              if (typeof central360 === 'function') return central360(id, opts);
              return central360;
            },
          },
          pedidos: {
            list: async (opts) => {
              listCalls.push(opts);
              if (typeof pedidosList === 'function') return pedidosList(opts);
              return pedidosList || { data: [] };
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
  slot = 0;
  const tree = Component({ clienteId });
  scheduled.splice(0).forEach((fn) => fn());
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  return { tree, walk: () => walk(tree), queries, filterCalls, centralCalls, listCalls, mapFn };
}

test('HistoricoProdutosCliente: sem permissão não consulta Pedido (aba montada ≠ carga)', async () => {
  const { queries, filterCalls } = await mountHistoricoCliente({
    hasPermission: () => false,
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].enabled, false);
  assert.equal(filterCalls.length, 0);
});

test('HistoricoProdutosCliente legado: com permissão consulta filterInContext Pedido', async () => {
  const { queries, filterCalls } = await mountHistoricoCliente({
    backendMode: 'local',
    hasPermission: (key) => key === 'Comercial.Pedido.visualizar',
  });
  assert.equal(queries[0].enabled, true);
  assert.ok(queries[0].queryKey.includes('legado'));
  await queries[0].queryFn({});
  assert.equal(filterCalls.length, 1);
  assert.equal(filterCalls[0].entity, 'Pedido');
  assert.equal(filterCalls[0].filter.cliente_id, 'cli-1');
});

test('HistoricoProdutosCliente HTTP: nao usa filterInContext; lista por clienteEmpresaId', async () => {
  const { queries, filterCalls, centralCalls, listCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    session: {
      token: 'tok',
      actorId: '11111111-1111-1111-1111-111111111111',
      groupId: 'g1',
      email: 'a@b.c',
    },
    central360: {
      data: {
        meta: { clienteEmpresaId: 'ce-1' },
        empresaLink: { id: 'ce-1' },
        blocks: { pedidos: { status: 'ok', data: [] } },
      },
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
    },
  });
  assert.equal(queries[0].enabled, true);
  assert.ok(queries[0].queryKey.includes('http'));
  const pedidos = await queries[0].queryFn({});
  assert.equal(filterCalls.length, 0);
  assert.equal(centralCalls.length, 1);
  assert.equal(centralCalls[0].id, 'cli-1');
  assert.equal(listCalls.length, 1);
  assert.equal(listCalls[0].clienteEmpresaId, 'ce-1');
  assert.equal(listCalls[0].limit, 50);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].itens[0].descricao, 'Barra 3/8');
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
  const { queries, filterCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    session: null,
  });
  assert.equal(queries[0].enabled, true);
  await assert.rejects(() => queries[0].queryFn({}), /Sessao HTTP|HTTP_SESSION/);
  assert.equal(filterCalls.length, 0);
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

test('HistoricoProdutosCliente HTTP: sem vinculo ClienteEmpresa falha sem facade', async () => {
  const { queries, filterCalls, listCalls } = await mountHistoricoCliente({
    backendMode: 'http',
    session: {
      token: 'tok',
      actorId: '11111111-1111-1111-1111-111111111111',
      groupId: 'g1',
    },
    central360: { data: { meta: {}, empresaLink: null, blocks: {} } },
  });
  await assert.rejects(() => queries[0].queryFn({}), /ClienteEmpresa|CLIENTE_EMPRESA/);
  assert.equal(filterCalls.length, 0);
  assert.equal(listCalls.length, 0);
});

test('HistoricoProdutosCliente HTTP: lista vazia nao inventa linhas; queryKey isola empresa', async () => {
  const a = await mountHistoricoCliente({
    backendMode: 'http',
    empresaId: 'emp-a',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
    central360: { data: { meta: { clienteEmpresaId: 'ce-a' } } },
    pedidosList: { data: [] },
  });
  assert.ok(a.queries[0].queryKey.includes('emp-a'));
  assert.ok(a.queries[0].queryKey.includes('http'));
  const empty = await a.queries[0].queryFn({});
  assert.deepEqual(empty, []);
  const linhas = a.mapFn(empty);
  assert.equal(linhas.length, 0);

  const b = await mountHistoricoCliente({
    backendMode: 'http',
    empresaId: 'emp-b',
    session: { token: 'tok', actorId: '11111111-1111-1111-1111-111111111111', groupId: 'g1' },
    central360: { data: { meta: { clienteEmpresaId: 'ce-b' } } },
    pedidosList: { data: [] },
  });
  assert.ok(b.queries[0].queryKey.includes('emp-b'));
  assert.notEqual(a.queries[0].queryKey.join('|'), b.queries[0].queryKey.join('|'));
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
