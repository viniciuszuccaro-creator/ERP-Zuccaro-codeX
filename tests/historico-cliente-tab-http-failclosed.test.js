/**
 * HistoricoClienteTab — pedidos HTTP fail-closed (≠ R$ 0,00 / Top20 falso).
 * Reutiliza loadPedidosHistoricoHttp; keep both ≠ HistoricoProdutosCliente / DetalhesCliente.
 * Auxiliares (NF/entrega/CR) em HTTP: indisponível, não lista vazia.
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
  queryResults = {},
  loadHttp = async () => ({ data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } }),
  filterInContext = async () => {
    throw new Error('filterInContext não deve rodar em HTTP para Pedido');
  },
} = {}) {
  const queries = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useMemo(fn) { return fn(); },
  };
  let queryIdx = 0;
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
          const key = JSON.stringify(opts.queryKey || []);
          queries.push(opts);
          const slot = queryResults[key] || queryResults[opts.queryKey?.[0]] || {
            data: undefined,
            isError: false,
            isFetching: false,
            error: null,
          };
          queryIdx += 1;
          return {
            data: slot.data,
            isError: Boolean(slot.isError),
            isFetching: Boolean(slot.isFetching),
            error: slot.error || null,
          };
        },
      },
      '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
      '@/components/ui/button': { Button: 'Button' },
      '@/components/ui/badge': { Badge: 'Badge' },
      '@/components/ui/alert': { Alert: 'Alert', AlertDescription: 'AlertDescription' },
      'lucide-react': new Proxy({}, { get: () => 'Icon' }),
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
      '@/api/erpHttpSession': { readErpHttpSession: () => session },
      '@/api/runtimeBackend': { resolveErpBackendMode: () => backendMode },
      './HistoricoProdutosCliente': {
        __esModule: true,
        loadPedidosHistoricoHttp: loadHttp,
        historicoSessionCacheKey: (s) => (s?.token && s?.actorId ? `${s.actorId}:fp` : null),
      },
    },
  };
  return { sandbox, queries };
}

test('helpers: página incompleta não publica ticket/top', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/HistoricoClienteTab.jsx', import.meta.url));
  const { sandbox } = buildSandbox();
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const { resolveHistoricoClienteKpisFromPage, computeHistoricoClienteTopProdutos } = sandbox.exports;
  const incomplete = resolveHistoricoClienteKpisFromPage({
    pedidos: [{ id: '1', status: 'FATURADO', total: 100 }],
    meta: { total: 80, hasMore: true, limit: 50, offset: 0 },
  });
  assert.equal(incomplete.moneyIncomplete, true);
  assert.equal(incomplete.totalPedidos, 80);
  assert.equal(incomplete.ticketMedio, null);
  assert.equal(incomplete.valorTotalHistorico, null);

  const top = computeHistoricoClienteTopProdutos([
    {
      id: 'p1',
      data_pedido: '2026-01-01',
      itens: [{ produto_id: 'x', descricao: 'Parafuso', quantidade: 2, total: 20 }],
    },
  ]);
  assert.equal(top.length, 1);
  assert.equal(top[0].descricao, 'Parafuso');
  assert.equal(top[0].quantidade_total, 2);
});

test('HTTP sem sessão: banner pedidos + auxiliares; KPIs "—"; sem filterInContext Pedido', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/HistoricoClienteTab.jsx', import.meta.url));
  let filterCalls = 0;
  const { sandbox, queries } = buildSandbox({
    session: null,
    filterInContext: async () => {
      filterCalls += 1;
      return [];
    },
    queryResults: {
      'historico-cliente-tab-pedidos': { data: undefined, isError: false, isFetching: false },
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const Comp = sandbox.exports.default;
  const tree = Comp({ formData: { cliente_id: 'c1', empresa_id: 'e1', group_id: 'g1' } });
  assert.ok(findByAction(tree, 'historico-cliente-tab-pedidos-http-indisponivel').length >= 1);
  assert.ok(findByAction(tree, 'historico-cliente-tab-auxiliar-http-indisponivel').length >= 1);
  const kpiText = textOf(findByAction(tree, 'historico-cliente-tab-kpis')[0] || tree);
  assert.ok(!kpiText.includes('R$ 0'), `KPI não deve inventar R$ 0: ${kpiText.slice(0, 200)}`);
  assert.equal(filterCalls, 0);
  const pedidosQ = queries.find((q) => q.queryKey?.[0] === 'historico-cliente-tab-pedidos');
  assert.ok(pedidosQ);
  assert.equal(pedidosQ.enabled, false);
});

test('HTTP erro: banner + top indisponível; enabled true chama loadHttp', async () => {
  let loadCalls = 0;
  const compiled = await compileJsx(new URL('../src/components/comercial/HistoricoClienteTab.jsx', import.meta.url));
  const { sandbox, queries } = buildSandbox({
    loadHttp: async () => {
      loadCalls += 1;
      throw Object.assign(new Error('boom'), { code: 'HTTP_FAIL' });
    },
    queryResults: {
      'historico-cliente-tab-pedidos': {
        data: undefined,
        isError: true,
        isFetching: false,
        error: { message: 'boom', code: 'HTTP_FAIL' },
      },
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const Comp = sandbox.exports.default;
  const tree = Comp({ formData: { cliente_id: 'c1', empresa_id: 'e1', group_id: 'g1' } });
  assert.ok(findByAction(tree, 'historico-cliente-tab-pedidos-http-indisponivel').length >= 1);
  assert.ok(findByAction(tree, 'historico-cliente-tab-top-indisponivel').length >= 1);
  assert.ok(findByAction(tree, 'historico-cliente-tab-nfe-indisponivel').length >= 1);

  const pedidosQ = queries.find((q) => q.queryKey?.[0] === 'historico-cliente-tab-pedidos');
  assert.equal(pedidosQ.enabled, true);
  await assert.rejects(() => pedidosQ.queryFn({ signal: undefined }), (err) => {
    assert.equal(err?.code, 'HTTP_FAIL');
    return true;
  });
  assert.equal(loadCalls, 1);
});

test('HTTP hasMore: contagem meta; ticket "—"; top incompleto; auxiliares fail-closed', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/HistoricoClienteTab.jsx', import.meta.url));
  const { sandbox } = buildSandbox({
    queryResults: {
      'historico-cliente-tab-pedidos': {
        data: {
          data: [
            { id: '1', status: 'FATURADO', total: 50, itens: [{ produto_id: 'a', descricao: 'A', quantidade: 1, total: 50 }] },
          ],
          meta: { limit: 50, offset: 0, total: 120, hasMore: true },
        },
        isError: false,
        isFetching: false,
      },
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const Comp = sandbox.exports.default;
  const tree = Comp({ formData: { cliente_id: 'c1', empresa_id: 'e1', group_id: 'g1' } });
  const kpiText = textOf(findByAction(tree, 'historico-cliente-tab-kpis')[0]);
  assert.ok(kpiText.includes('120'), 'qtd deve usar meta.total');
  assert.ok(kpiText.includes('—'), 'ticket deve ser em-dash quando incompleto');
  assert.ok(!/\$\s*50/.test(kpiText) && !kpiText.includes('R$ 50'), 'não publicar ticket da 1ª página');
  assert.ok(findByAction(tree, 'historico-cliente-tab-kpi-incompleto').length >= 1);
  assert.ok(findByAction(tree, 'historico-cliente-tab-top-incompleto').length >= 1);
  assert.ok(findByAction(tree, 'historico-cliente-tab-auxiliar-http-indisponivel').length >= 1);
});

test('duas leituras do mesmo queryFn HTTP produzem uma chamada loadHttp por invocação controlada', async () => {
  let loadCalls = 0;
  const compiled = await compileJsx(new URL('../src/components/comercial/HistoricoClienteTab.jsx', import.meta.url));
  const { sandbox, queries } = buildSandbox({
    loadHttp: async () => {
      loadCalls += 1;
      return { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } };
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const Comp = sandbox.exports.default;
  Comp({ formData: { cliente_id: 'c1', empresa_id: 'e1', group_id: 'g1' } });
  Comp({ formData: { cliente_id: 'c1', empresa_id: 'e1', group_id: 'g1' } });
  const pedidosQueries = queries.filter((q) => q.queryKey?.[0] === 'historico-cliente-tab-pedidos');
  assert.equal(pedidosQueries.length, 2);
  // React Query dedupe é runtime; aqui garantimos a mesma queryKey estável (uma identidade de cache).
  assert.deepEqual(pedidosQueries[0].queryKey, pedidosQueries[1].queryKey);
  await pedidosQueries[0].queryFn({ signal: undefined });
  assert.equal(loadCalls, 1);
});
