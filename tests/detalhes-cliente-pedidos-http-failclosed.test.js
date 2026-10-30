/**
 * DetalhesCliente — KPIs/Últimos Pedidos fail-closed em HTTP.
 * Reutiliza loadPedidosHistoricoHttp; sem filterInContext Pedido em HTTP;
 * erro/ausência ≠ R$ 0,00 / 0 pedidos.
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

function buildSandbox({
  backendMode = 'http',
  session = { token: 'tok', actorId: 'u1', groupId: 'g1', email: 'a@b.invalid' },
  queryResult = { data: undefined, isError: false, isFetching: false, error: null },
  loadHttp = async () => ({ data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } }),
  filterInContext = async () => {
    throw new Error('filterInContext Pedido não deve rodar em HTTP');
  },
} = {}) {
  const queries = [];
  const state = [];
  let slot = 0;
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
          return {
            data: queryResult.data,
            isError: queryResult.isError,
            isFetching: queryResult.isFetching,
            error: queryResult.error,
          };
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
      './HistoricoProdutosCliente': {
        __esModule: true,
        default: function HistoricoProdutosCliente() {
          return { type: 'HistoricoProdutosCliente', props: arguments[0] || {}, children: [] };
        },
        loadPedidosHistoricoHttp: loadHttp,
        historicoSessionCacheKey: (s) => (s?.token && s?.actorId ? `${s.actorId}:fp` : null),
      },
      './CentralCliente360Panel': { __esModule: true, default: () => ({ type: 'CentralCliente360Panel', props: {}, children: [] }) },
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
          user: { id: 'u1', email: 'synthetic@example.invalid' },
        }),
      },
      '@/api/httpApiClient': { resolveErpAuthSessionToken: () => 'sess-synthetic' },
      '@/api/erpHttpSession': { readErpHttpSession: () => session },
      '@/api/runtimeBackend': { resolveErpBackendMode: () => backendMode },
      '@/lib/app-params': { appParams: { token: null } },
    },
  };
  return { sandbox, queries, resetSlot: () => { slot = 0; } };
}

test('helpers: KPIs distinguem cancelado e usam total HTTP', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url));
  const { sandbox } = buildSandbox();
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const { computeDetalhesClientePedidosKpis, pedidoValorTotal, isPedidoCancelado } =
    sandbox.exports;
  assert.equal(pedidoValorTotal({ total: 10 }), 10);
  assert.equal(pedidoValorTotal({ valor_total: 20 }), 20);
  assert.equal(isPedidoCancelado({ status: 'Cancelado' }), true);
  assert.equal(isPedidoCancelado({ status: 'CANCELADO' }), true);
  const k = computeDetalhesClientePedidosKpis([
    { status: 'Confirmado', total: 100 },
    { status: 'Cancelado', valor_total: 50 },
  ]);
  assert.equal(k.totalCompras, 100);
  assert.equal(k.qtdPedidos, 2);
  assert.equal(k.qtdAtivos, 1);
  assert.equal(k.ticketMedio, 100);
});

test('HTTP sem sessão: consulta desabilitada; KPIs — (não R$ 0,00)', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url));
  const { sandbox, queries, resetSlot } = buildSandbox({
    backendMode: 'http',
    session: null,
    queryResult: { data: undefined, isError: false, isFetching: false, error: null },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const DetalhesCliente = sandbox.exports.default;
  resetSlot();
  const tree = DetalhesCliente({
    cliente: { id: 'cli-1', nome: 'Cli', status: 'Ativo', codigo: 1 },
    windowMode: true,
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].enabled, false);
  assert.equal(queries[0].queryKey.includes('http'), true);
  const banner = findByAction(tree, 'detalhes-cliente-pedidos-http-indisponivel');
  assert.equal(banner.length, 1);
  const total = findByAction(tree, 'kpi-total-compras');
  assert.equal(total.length, 1);
  assert.equal(textOf(total[0]).trim(), '—');
  const qtd = findByAction(tree, 'kpi-qtd-pedidos');
  assert.equal(textOf(qtd[0]).trim(), '—');
});

test('HTTP com erro: KPIs — e banner; não inventa zero', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url));
  const { sandbox, resetSlot } = buildSandbox({
    backendMode: 'http',
    queryResult: {
      data: undefined,
      isError: true,
      isFetching: false,
      error: Object.assign(new Error('rede'), { code: 'NETWORK' }),
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const DetalhesCliente = sandbox.exports.default;
  resetSlot();
  const tree = DetalhesCliente({
    cliente: { id: 'cli-1', nome: 'Cli', status: 'Ativo' },
    windowMode: true,
  });
  assert.equal(findByAction(tree, 'detalhes-cliente-pedidos-http-indisponivel').length, 1);
  assert.equal(textOf(findByAction(tree, 'kpi-total-compras')[0]).trim(), '—');
  assert.equal(textOf(findByAction(tree, 'kpi-ticket-medio')[0]).trim(), '—');
  assert.equal(textOf(findByAction(tree, 'kpi-qtd-pedidos')[0]).trim(), '—');
});

test('HTTP queryFn chama loadPedidosHistoricoHttp (não filterInContext)', async () => {
  let httpCalls = 0;
  let legadoCalls = 0;
  const compiled = await compileJsx(new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url));
  const { sandbox, queries, resetSlot } = buildSandbox({
    backendMode: 'http',
    loadHttp: async () => {
      httpCalls += 1;
      return {
        data: [{ id: 'p1', numero: 'P-1', total: 80, status: 'CONFIRMADO', created_at: '2026-10-01' }],
        meta: { limit: 50, offset: 0, total: 1, hasMore: false },
      };
    },
    filterInContext: async () => {
      legadoCalls += 1;
      return [];
    },
    queryResult: {
      data: {
        data: [{ id: 'p1', numero: 'P-1', total: 80, status: 'CONFIRMADO', created_at: '2026-10-01' }],
        meta: { limit: 50, offset: 0, total: 1, hasMore: false },
      },
      isError: false,
      isFetching: false,
      error: null,
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const DetalhesCliente = sandbox.exports.default;
  resetSlot();
  const tree = DetalhesCliente({
    cliente: { id: 'cli-1', nome: 'Cli', status: 'Ativo' },
    windowMode: true,
  });
  assert.equal(queries[0].enabled, true);
  await queries[0].queryFn({ signal: undefined });
  assert.equal(httpCalls, 1);
  assert.equal(legadoCalls, 0);
  assert.match(textOf(findByAction(tree, 'kpi-total-compras')[0]), /80/);
  assert.equal(textOf(findByAction(tree, 'kpi-qtd-pedidos')[0]).trim(), '1');
  assert.equal(findByAction(tree, 'detalhes-cliente-pedidos-http-indisponivel').length, 0);
});

test('legado: queryFn usa filterInContext; HTTP loader não roda', async () => {
  let httpCalls = 0;
  let legadoCalls = 0;
  const compiled = await compileJsx(new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url));
  const { sandbox, queries, resetSlot } = buildSandbox({
    backendMode: 'local',
    session: null,
    loadHttp: async () => {
      httpCalls += 1;
      return { data: [], meta: {} };
    },
    filterInContext: async () => {
      legadoCalls += 1;
      return [{ id: 'p2', numero_pedido: 'L-1', valor_total: 40, status: 'Ativo', data_pedido: '2026-09-01' }];
    },
    queryResult: {
      data: {
        data: [{ id: 'p2', numero_pedido: 'L-1', valor_total: 40, status: 'Ativo', data_pedido: '2026-09-01' }],
        meta: { limit: 50, offset: 0, total: 1, hasMore: false },
      },
      isError: false,
      isFetching: false,
      error: null,
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const DetalhesCliente = sandbox.exports.default;
  resetSlot();
  DetalhesCliente({
    cliente: { id: 'cli-1', nome: 'Cli', status: 'Ativo' },
    windowMode: true,
  });
  assert.equal(queries[0].queryKey.includes('legado'), true);
  await queries[0].queryFn({ signal: undefined });
  assert.equal(legadoCalls, 1);
  assert.equal(httpCalls, 0);
});
