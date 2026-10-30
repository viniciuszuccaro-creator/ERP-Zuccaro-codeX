/**
 * CopiarUltimoPedido — HTTP fail-closed (≠ base44; ≠ ocultar erro como “sem pedido”).
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
  loadHttp = async () => ({ data: [], meta: { limit: 5, offset: 0, total: 0, hasMore: false } }),
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
            error: queryResult.error,
          };
        },
      },
      '@/components/ui/button': { Button: 'Button' },
      '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent' },
      '@/components/ui/badge': { Badge: 'Badge' },
      '@/components/ui/alert': { Alert: 'Alert', AlertDescription: 'AlertDescription' },
      '@/components/ui/dialog': {
        Dialog: 'Dialog',
        DialogContent: 'DialogContent',
        DialogHeader: 'DialogHeader',
        DialogTitle: 'DialogTitle',
        DialogTrigger: 'DialogTrigger',
      },
      'lucide-react': new Proxy({}, { get: () => 'Icon' }),
      '@/components/ui/use-toast': { useToast: () => ({ toast: () => {} }) },
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
        default: () => ({ hasPermission: () => true }),
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

test('helpers: pick ignora cancelado; itens HTTP → revenda; pagina além de cancelados', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/CopiarUltimoPedido.jsx', import.meta.url));
  const { sandbox } = buildSandbox();
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const {
    pickUltimoPedidoNaoCancelado,
    findUltimoPedidoNaoCanceladoPaginado,
    resolveCopiarPedidoItensRevenda,
    copiarPedidoValorTotal,
    isCopiarPedidoCancelado,
  } = sandbox.exports;
  assert.equal(isCopiarPedidoCancelado({ status: 'CANCELADO' }), true);
  const picked = pickUltimoPedidoNaoCancelado([
    { id: 'c', status: 'CANCELADO', total: 1 },
    { id: 'ok', status: 'FINALIZADO', total: 90, itens: [{ descricao: 'A', quantidade: 2, total: 90 }] },
  ]);
  assert.equal(picked.id, 'ok');
  assert.equal(copiarPedidoValorTotal(picked), 90);
  const itens = resolveCopiarPedidoItensRevenda(picked);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].descricao, 'A');
  assert.equal(itens[0].valor_item, 90);

  let pages = 0;
  const found = await findUltimoPedidoNaoCanceladoPaginado({
    limit: 5,
    maxPages: 10,
    loadPage: async ({ offset }) => {
      pages += 1;
      if (offset === 0) {
        return {
          data: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, status: 'CANCELADO' })),
          meta: { hasMore: true, limit: 5, offset: 0 },
        };
      }
      return {
        data: [{ id: 'elegivel', status: 'FINALIZADO', total: 10 }],
        meta: { hasMore: false, limit: 5, offset: 5 },
      };
    },
  });
  assert.equal(found?.id, 'elegivel');
  assert.equal(pages, 2);
});

test('HTTP sem sessão: banner indisponível (≠ return null silencioso)', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/CopiarUltimoPedido.jsx', import.meta.url));
  const { sandbox, queries } = buildSandbox({
    session: null,
    queryResult: { data: undefined, isError: false, isFetching: false },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const Comp = sandbox.exports.default;
  const tree = Comp({ clienteId: 'c1' });
  assert.ok(findByAction(tree, 'copiar-ultimo-pedido-http-indisponivel').length >= 1);
  const q = queries.find((x) => x.queryKey?.[0] === 'copiar-ultimo-pedido');
  assert.equal(q.enabled, false);
});

test('HTTP erro: banner; queryFn chama loadHttp', async () => {
  let loadCalls = 0;
  const compiled = await compileJsx(new URL('../src/components/comercial/CopiarUltimoPedido.jsx', import.meta.url));
  const { sandbox, queries } = buildSandbox({
    loadHttp: async () => {
      loadCalls += 1;
      throw Object.assign(new Error('boom'), { code: 'HTTP_FAIL' });
    },
    queryResult: {
      data: undefined,
      isError: true,
      isFetching: false,
      error: { message: 'boom', code: 'HTTP_FAIL' },
    },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const Comp = sandbox.exports.default;
  const tree = Comp({ clienteId: 'c1' });
  assert.ok(findByAction(tree, 'copiar-ultimo-pedido-http-indisponivel').length >= 1);
  const q = queries.find((x) => x.queryKey?.[0] === 'copiar-ultimo-pedido');
  assert.equal(q.enabled, true);
  await assert.rejects(() => q.queryFn({ signal: undefined }), (err) => err?.code === 'HTTP_FAIL');
  assert.equal(loadCalls, 1);
});

test('HTTP sucesso: cartão copiar; duas montagens mesma queryKey', async () => {
  const compiled = await compileJsx(new URL('../src/components/comercial/CopiarUltimoPedido.jsx', import.meta.url));
  const pedido = {
    id: 'p1',
    status: 'FINALIZADO',
    numero: '100',
    total: 50,
    created_at: '2026-01-01',
    itens: [{ descricao: 'Parafuso', quantidade: 1, unidade_sigla: 'UN', preco_unitario: 50, total: 50 }],
  };
  const { sandbox, queries } = buildSandbox({
    queryResult: { data: pedido, isError: false, isFetching: false },
  });
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const Comp = sandbox.exports.default;
  const tree = Comp({ clienteId: 'c1' });
  Comp({ clienteId: 'c1' });
  assert.ok(findByAction(tree, 'copiar-ultimo-pedido').length >= 1);
  const qs = queries.filter((x) => x.queryKey?.[0] === 'copiar-ultimo-pedido');
  assert.equal(qs.length, 2);
  assert.deepEqual(qs[0].queryKey, qs[1].queryKey);
});
