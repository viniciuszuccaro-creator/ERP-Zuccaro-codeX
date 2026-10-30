/**
 * HistoricoOrigemCliente + HistoricoComprasCliente — HTTP fail-closed.
 * Reutiliza loadPedidosHistoricoHttp; erro ≠ canal/top vazio; sem catch→[].
 * Keep both: portal/HistoricoComprasCliente intacto; DetalhesCliente/#436 paralelo.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
import {
  consolidateTopProdutosFromPedidos,
  extractItensPedidoHistorico,
  resolveOrigemCanalComprovada,
  resolveValorItemHistorico,
  resolveValorPedidoHistorico,
} from '../src/components/comercial/historicoComprasClientePolicy.js';

function walk(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.children || []).flatMap(walk)];
}

function findByAction(tree, action) {
  return walk(tree).filter((n) => n?.props?.['data-action'] === action);
}

function textOf(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.children);
}

async function compileJsx(pathUrl) {
  const source = await readFile(pathUrl, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
}

function sourceContract(path) {
  return readFileSync(path, 'utf8');
}

test('contrato: Origem/Compras usam HTTP canônico e não engolem erro como []', () => {
  const origem = sourceContract('src/components/comercial/HistoricoOrigemCliente.jsx');
  const compras = sourceContract('src/components/comercial/HistoricoComprasCliente.jsx');
  for (const src of [origem, compras]) {
    assert.match(src, /loadPedidosHistoricoHttp/);
    assert.match(src, /resolveErpBackendMode/);
    assert.match(src, /historicoSessionCacheKey/);
    assert.match(src, /readErpHttpSession/);
    assert.match(src, /retry:\s*false/);
    assert.doesNotMatch(src, /catch\s*\([^)]*\)\s*\{[^}]*return\s*\[\s*\]/s);
    assert.doesNotMatch(src, /initialData:\s*\[\]/);
  }
  assert.match(origem, /historico-origem-http-indisponivel/);
  assert.match(compras, /historico-compras-http-indisponivel/);
  assert.match(compras, /historicoComprasClientePolicy/);
  assert.doesNotMatch(compras, /custo_aquisicao:\s*produto\.ultimo_preco\s*\*\s*0\.6/);
  assert.doesNotMatch(compras, /estoque_atual:\s*100/);
  const policy = sourceContract('src/components/comercial/historicoComprasClientePolicy.js');
  assert.match(policy, /extractItensPedidoHistorico/);
  assert.match(policy, /itens_revenda/);
});

test('extractItens + consolidate: HTTP itens e legado itens_revenda; sem inventar', () => {
  const pedidoHttp = {
    id: 'p1',
    itens: [{ produto_id: 'a', descricao: 'A', quantidade: 2, preco_unitario: 10, valor_item: 20 }],
    itens_revenda: [{ produto_id: 'b', descricao: 'B', quantidade: 1, preco_unitario: 5, valor_item: 5 }],
  };
  const lines = extractItensPedidoHistorico(pedidoHttp);
  assert.equal(lines.length, 2);
  const top = consolidateTopProdutosFromPedidos([pedidoHttp], { limit: 5 });
  assert.equal(top.length, 2);
  assert.equal(top[0].produto_id, 'a');
  assert.equal(top[0].valor_total, 20);
  assert.deepEqual(consolidateTopProdutosFromPedidos(null), []);
  assert.deepEqual(extractItensPedidoHistorico(null), []);
});

test('policy: canal ausente HTTP ≠ Manual; total canônico pedido/item', () => {
  assert.equal(resolveOrigemCanalComprovada({ id: '1', total: '90' }), null);
  assert.equal(resolveOrigemCanalComprovada({ origem_pedido: 'WhatsApp' }), 'WhatsApp');
  assert.equal(resolveValorPedidoHistorico({ total: '150.5', valor_total: 1 }), 150.5);
  assert.equal(resolveValorPedidoHistorico({ valor_total: 40 }), 40);
  // item.total líquido vence bruto preco×qty (Codex #4425419714)
  assert.equal(
    resolveValorItemHistorico({ quantidade: 10, preco_unitario: 20, total: 10 }),
    10,
  );
  const top = consolidateTopProdutosFromPedidos([
    {
      itens: [
        { produto_id: 'cheap-net', descricao: 'Net', quantidade: 10, preco_unitario: 20, total: 10 },
        { produto_id: 'mid', descricao: 'Mid', quantidade: 1, preco_unitario: 50, total: 50 },
      ],
    },
  ], { limit: 5 });
  assert.equal(top[0].produto_id, 'mid');
  assert.equal(top[0].valor_total, 50);
});

function buildOrigemSandbox({
  backendMode = 'http',
  session = { token: 'tok', actorId: 'u1', groupId: 'g1' },
  queryResult = {
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
  },
  loadHttp = async () => ({ data: [], meta: { limit: 200, offset: 0, total: 0, hasMore: false } }),
  filterInContext = async () => {
    throw new Error('filterInContext Pedido não deve rodar em HTTP');
  },
} = {}) {
  const queries = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
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
          return {
            data: queryResult.data,
            isError: queryResult.isError,
            isFetching: queryResult.isFetching,
            isLoading: queryResult.isLoading,
          };
        },
      },
      '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
      '@/components/ui/badge': { Badge: 'Badge' },
      '@/components/ui/button': { Button: 'Button' },
      '@/components/ui/alert': { Alert: 'Alert', AlertDescription: 'AlertDescription' },
      'recharts': {
        PieChart: 'PieChart', Pie: 'Pie', Cell: 'Cell', ResponsiveContainer: 'ResponsiveContainer', Tooltip: 'Tooltip',
      },
      'lucide-react': new Proxy({}, { get: () => 'Icon' }),
      './BadgeOrigemPedido': { __esModule: true, default: (p) => ({ type: 'BadgeOrigem', props: p || {}, children: [] }) },
      '@/components/lib/useContextoVisual': {
        useContextoVisual: () => ({
          filterInContext,
          empresaAtual: { id: 'e1', group_id: 'g1' },
          grupoAtual: { id: 'g1' },
          contexto: 'empresa',
        }),
      },
      '@/components/lib/usePermissions': {
        __esModule: true,
        default: () => ({
          hasPermission: () => true,
        }),
      },
      '@/api/runtimeBackend': { resolveErpBackendMode: () => backendMode },
      '@/api/erpHttpSession': { readErpHttpSession: () => session },
      './HistoricoProdutosCliente': {
        __esModule: true,
        loadPedidosHistoricoHttp: loadHttp,
        historicoSessionCacheKey: (s) => (s?.token && s?.actorId ? `${s.actorId}:fp` : null),
      },
      './historicoComprasClientePolicy': {
        __esModule: true,
        consolidateTopProdutosFromPedidos,
        extractItensPedidoHistorico,
        resolveOrigemCanalComprovada,
        resolveValorPedidoHistorico,
        resolveValorItemHistorico,
      },
      './historicoComprasClientePolicy.js': {
        __esModule: true,
        consolidateTopProdutosFromPedidos,
        extractItensPedidoHistorico,
        resolveOrigemCanalComprovada,
        resolveValorPedidoHistorico,
        resolveValorItemHistorico,
      },
    },
  };
  sandbox.queries = queries;
  return sandbox;
}

async function mountOrigem(sandbox, props = { clienteId: 'c1', compact: false }) {
  const code = await compileJsx(new URL('../src/components/comercial/HistoricoOrigemCliente.jsx', import.meta.url));
  vm.runInNewContext(code, sandbox);
  const Comp = sandbox.module.exports.default || sandbox.exports.default;
  return Comp(props);
}

async function mountCompras(sandbox, props = { clienteId: 'c1' }) {
  const code = await compileJsx(new URL('../src/components/comercial/HistoricoComprasCliente.jsx', import.meta.url));
  // Pure helpers already imported from source via node resolution may fail on JSX;
  // remount compiled module only for default export.
  const compiledSandbox = buildOrigemSandbox({
    backendMode: sandbox.__backendMode,
    session: sandbox.__session,
    queryResult: sandbox.__queryResult,
    loadHttp: sandbox.__loadHttp,
    filterInContext: sandbox.__filterInContext,
  });
  // Extra button module already present
  vm.runInNewContext(code, compiledSandbox);
  const Comp = compiledSandbox.module.exports.default || compiledSandbox.exports.default;
  compiledSandbox.queries = compiledSandbox.queries;
  const tree = Comp(props);
  return { tree, queries: compiledSandbox.queries, sandbox: compiledSandbox };
}

test('Origem HTTP: erro → banner indisponível (≠ pizza vazia / null silencioso)', async () => {
  const sandbox = buildOrigemSandbox({
    queryResult: { data: undefined, isError: true, isFetching: false, isLoading: false },
  });
  const tree = await mountOrigem(sandbox);
  assert.ok(findByAction(tree, 'historico-origem-http-indisponivel').length >= 1);
  assert.match(textOf(tree), /não foi possível|indispon/i);
  assert.equal(sandbox.queries.length, 1);
  assert.equal(sandbox.queries[0].enabled, true);
});

test('Origem HTTP: queryFn chama loadPedidosHistoricoHttp e não filterInContext', async () => {
  let httpCalls = 0;
  let filterCalls = 0;
  const sandbox = buildOrigemSandbox({
    loadHttp: async () => {
      httpCalls += 1;
      return {
        data: [{ id: '1', origem_pedido: 'WhatsApp', valor_total: 100 }],
        meta: { limit: 200, offset: 0, total: 1, hasMore: false },
      };
    },
    filterInContext: async () => {
      filterCalls += 1;
      return [];
    },
    queryResult: {
      data: {
        data: [{ id: '1', origem_pedido: 'WhatsApp', valor_total: 100 }],
        meta: { limit: 200, offset: 0, total: 1, hasMore: false },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
  });
  const tree = await mountOrigem(sandbox);
  assert.ok(sandbox.queries[0]);
  await sandbox.queries[0].queryFn({ signal: undefined });
  assert.equal(httpCalls, 1);
  assert.equal(filterCalls, 0);
  assert.match(textOf(tree), /WhatsApp|Canal Preferido/i);
});

test('Origem HTTP: página incompleta não inventa % no compact', async () => {
  const sandbox = buildOrigemSandbox({
    queryResult: {
      data: {
        data: [
          { id: '1', origem_pedido: 'WhatsApp', total: '10' },
          { id: '2', origem_pedido: 'WhatsApp', total: '10' },
        ],
        meta: { limit: 200, offset: 0, total: 50, hasMore: true },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
  });
  const tree = await mountOrigem(sandbox, { clienteId: 'c1', compact: true });
  assert.match(textOf(tree), /—/);
});

test('Origem HTTP: pedidos sem origem comprovada → canal indisponível (≠ Manual 100%)', async () => {
  const sandbox = buildOrigemSandbox({
    queryResult: {
      data: {
        data: [
          { id: '1', total: '90' },
          { id: '2', total: '10' },
        ],
        meta: { limit: 200, offset: 0, total: 2, hasMore: false },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
  });
  const tree = await mountOrigem(sandbox);
  assert.ok(findByAction(tree, 'historico-origem-canal-indisponivel').length >= 1);
  assert.equal(findByAction(tree, 'historico-origem-canal-indisponivel').length >= 1, true);
  // Banner explica a proibição; não há pizza/preferência "Manual" como canal.
  assert.doesNotMatch(textOf(tree), /Canal Preferido:\s*Manual|100%/);
});

test('Origem HTTP: total canônico no ticket (não valor_total legado ausente)', async () => {
  const sandbox = buildOrigemSandbox({
    queryResult: {
      data: {
        data: [
          { id: '1', origem_pedido: 'Portal', total: '100' },
          { id: '2', origem_pedido: 'Portal', total: '50' },
        ],
        meta: { limit: 200, offset: 0, total: 2, hasMore: false },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
  });
  const tree = await mountOrigem(sandbox);
  assert.match(textOf(tree), /R\$ 75\.00|Portal/);
});

test('Compras HTTP: erro → banner (não top vazio); queryFn HTTP real', async () => {
  let httpCalls = 0;
  const { tree, queries } = await mountCompras({
    __backendMode: 'http',
    __session: { token: 'tok', actorId: 'u1', groupId: 'g1' },
    __queryResult: { data: undefined, isError: true, isFetching: false, isLoading: false },
    __loadHttp: async () => {
      httpCalls += 1;
      return { data: [], meta: { limit: 200, offset: 0, total: 0, hasMore: false } };
    },
    __filterInContext: async () => {
      throw new Error('filter legado não deve rodar');
    },
  });
  assert.ok(findByAction(tree, 'historico-compras-http-indisponivel').length >= 1);
  assert.equal(queries.length, 1);
  await queries[0].queryFn({ signal: undefined });
  assert.equal(httpCalls, 1);
});

test('Compras HTTP: consolidação com itens canônicos; sem custo/estoque fictícios no payload', async () => {
  const src = sourceContract('src/components/comercial/HistoricoComprasCliente.jsx');
  assert.match(src, /itens/);
  assert.doesNotMatch(src, /estoque_atual:\s*100/);
  const { tree, queries } = await mountCompras({
    __backendMode: 'http',
    __session: { token: 'tok', actorId: 'u1', groupId: 'g1' },
    __queryResult: {
      data: {
        data: [{
          id: 'p1',
          itens: [{ produto_id: 'x', descricao: 'Cimento', quantidade: 3, preco_unitario: 20, valor_item: 60 }],
        }],
        meta: { limit: 200, offset: 0, total: 1, hasMore: false },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
    __loadHttp: async () => ({ data: [], meta: { limit: 200, offset: 0, total: 0, hasMore: false } }),
    __filterInContext: async () => [],
  });
  assert.match(textOf(tree), /Cimento/);
  assert.equal(queries.length, 1);
  assert.ok(queries[0].queryKey.includes('http'));
});
