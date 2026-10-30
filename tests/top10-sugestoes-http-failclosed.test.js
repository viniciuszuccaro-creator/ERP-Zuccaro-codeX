/**
 * Top10ProdutosCliente + SugestoesProdutos — HTTP fail-closed.
 * Reutiliza loadPedidosHistoricoHttp + historicoComprasClientePolicy.
 * Keep both: HistoricoComprasCliente / HistoricoOrigemCliente (#441) — capacidades distintas.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
import {
  consolidateTopProdutosFromPedidos,
  resolveValorItemHistorico,
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

test('contrato: Top10/Sugestoes usam HTTP canônico e não engolem erro como vazio', () => {
  const top10 = sourceContract('src/components/comercial/Top10ProdutosCliente.jsx');
  const sug = sourceContract('src/components/comercial/SugestoesProdutos.jsx');
  for (const src of [top10, sug]) {
    assert.match(src, /loadPedidosHistoricoHttp/);
    assert.match(src, /resolveErpBackendMode/);
    assert.match(src, /historicoSessionCacheKey/);
    assert.match(src, /readErpHttpSession/);
    assert.match(src, /retry:\s*false/);
    assert.match(src, /historicoComprasClientePolicy/);
    assert.doesNotMatch(src, /catch\s*\([^)]*\)\s*\{[^}]*return\s*\[\s*\]/s);
    assert.doesNotMatch(src, /initialData:\s*\[\]/);
  }
  assert.match(top10, /top10-produtos-http-indisponivel/);
  assert.match(sug, /sugestoes-produtos-http-indisponivel/);
  assert.doesNotMatch(top10, /itens_revenda\?\.map/);
});

test('policy: Top10 consolida itens HTTP + unidade/ultima_compra; item.total líquido', () => {
  const top = consolidateTopProdutosFromPedidos([
    {
      data_pedido: '2026-01-10',
      itens: [
        { produto_id: 'a', descricao: 'A', quantidade: 10, preco_unitario: 20, total: 5, unidade: 'CX' },
        { produto_id: 'b', descricao: 'B', quantidade: 1, preco_unitario: 40, total: 40 },
      ],
    },
  ], { limit: 10 });
  assert.equal(top[0].produto_id, 'b');
  assert.equal(top[0].valor_total, 40);
  assert.equal(top.find((r) => r.produto_id === 'a')?.unidade, 'CX');
  assert.equal(top.find((r) => r.produto_id === 'a')?.ultima_compra, '2026-01-10');
  assert.equal(resolveValorItemHistorico({ quantidade: 10, preco_unitario: 20, total: 5 }), 5);
});

function buildReact() {
  const React = {
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useEffect() {},
    useRef(v) {
      return { current: v };
    },
    useMemo(fn) {
      return fn();
    },
    createElement(type, props, ...children) {
      const flat = children.flat(Infinity).filter((c) => c != null && c !== false);
      return { type, props: props || {}, children: flat };
    },
    Fragment: Symbol('Fragment'),
  };
  React.default = React;
  return React;
}

async function mountTop10(overrides = {}) {
  const React = buildReact();
  const queries = [];
  const loadCalls = [];
  const filterCalls = [];
  const {
    backendMode = 'http',
    session = { token: 'tok', actorId: 'u1', groupId: 'g1' },
    empresaId = 'e1',
    groupId = 'g1',
    hasPermission = () => true,
    queryResults = {},
    loadHttp = async () => ({ data: [], meta: { limit: 200, offset: 0, total: 0, hasMore: false } }),
    filterInContext = async () => [],
    clienteId = 'cli-1',
  } = overrides;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === 'react' || id === 'React') return React;
      if (id === '@tanstack/react-query') {
        return {
          useQuery(opts) {
            queries.push(opts);
            const key0 = Array.isArray(opts.queryKey) ? opts.queryKey[0] : '';
            const preset = queryResults[key0];
            if (preset) return preset;
            if (String(key0).includes('produtos')) {
              return { data: [], isLoading: false, isError: false, isFetching: false };
            }
            return {
              data: undefined,
              isLoading: false,
              isError: false,
              isFetching: false,
            };
          },
        };
      }
      if (id === '@/components/ui/button') {
        return { Button: (p) => React.createElement('button', p, p.children) };
      }
      if (id === '@/components/ui/badge') {
        return { Badge: (p) => React.createElement('span', p, p.children) };
      }
      if (id === '@/components/ui/alert') {
        return {
          Alert: (p) => React.createElement('div', p, p.children),
          AlertDescription: (p) => React.createElement('div', p, p.children),
        };
      }
      if (id === '@/components/ui/card') {
        return {
          Card: (p) => React.createElement('div', p, p.children),
          CardHeader: (p) => React.createElement('div', p, p.children),
          CardTitle: (p) => React.createElement('div', p, p.children),
          CardContent: (p) => React.createElement('div', p, p.children),
        };
      }
      if (id === '@/components/ui/use-toast') {
        return { useToast: () => ({ toast: () => {} }) };
      }
      if (id === 'lucide-react') {
        const I = (p) => React.createElement('i', p);
        return { Package: I, ShieldAlert: I, TrendingUp: I, Plus: I, Zap: I };
      }
      if (id === '@/components/lib/useContextoVisual') {
        return {
          useContextoVisual: () => ({
            filterInContext: (...args) => {
              filterCalls.push(args);
              return filterInContext(...args);
            },
            empresaAtual: empresaId ? { id: empresaId, group_id: groupId } : null,
            grupoAtual: groupId ? { id: groupId } : null,
            contexto: 'empresa',
            estaNoGrupo: false,
          }),
        };
      }
      if (id === '@/components/lib/usePermissions') {
        return {
          __esModule: true,
          default: () => ({ hasPermission, user: { id: 'u1' } }),
        };
      }
      if (id === '@/components/lib/iaTransversalPolicy') {
        return {
          assertIaUiContext: ({ groupId: g, empresaId: e }) => {
            if (!g || !e) throw new Error('ia context');
          },
        };
      }
      if (id === '@/components/lib/iaResponsePolicy.js' || id === '@/components/lib/iaResponsePolicy') {
        return { validarSugestoesProdutosIA: (r) => r };
      }
      if (id === '@/api/base44Client') {
        return { invokeErpIa: async () => ({ sugestoes: [] }) };
      }
      if (id === '@/api/runtimeBackend') {
        return { resolveErpBackendMode: () => backendMode };
      }
      if (id === '@/api/erpHttpSession') {
        return { readErpHttpSession: () => session };
      }
      if (id === './HistoricoProdutosCliente' || id.endsWith('/HistoricoProdutosCliente')) {
        return {
          historicoSessionCacheKey: (s) => (s?.token && s?.actorId ? `${s.actorId}:fp` : null),
          loadPedidosHistoricoHttp: async (args) => {
            loadCalls.push(args);
            return loadHttp(args);
          },
        };
      }
      if (id === './historicoComprasClientePolicy' || id.endsWith('/historicoComprasClientePolicy')) {
        return {
          consolidateTopProdutosFromPedidos,
          extractItensPedidoHistorico: (p) => {
            const out = [];
            for (const b of [p?.itens, p?.itens_revenda, p?.itens_producao, p?.itens_servico]) {
              if (Array.isArray(b)) out.push(...b.filter((i) => i && typeof i === 'object'));
            }
            return out;
          },
          resolveValorPedidoHistorico: (p) => Number(p?.total ?? p?.valor_total) || 0,
          resolveValorItemHistorico,
        };
      }
      throw new Error(`unexpected require: ${id}`);
    },
    console,
  };

  const code = await compileJsx(
    new URL('../src/components/comercial/Top10ProdutosCliente.jsx', import.meta.url).pathname,
  );
  vm.runInNewContext(code, sandbox, { filename: 'Top10ProdutosCliente.jsx' });
  const Comp = sandbox.module.exports.default || sandbox.exports.default;
  const tree = Comp({ clienteId });
  return { tree, queries, loadCalls, filterCalls };
}

async function mountSugestoes(overrides = {}) {
  const React = buildReact();
  const queries = [];
  const {
    backendMode = 'http',
    session = { token: 'tok', actorId: 'u1', groupId: 'g1' },
    empresaId = 'e1',
    groupId = 'g1',
    hasPermission = () => true,
    queryResults = {},
    loadHttp = async () => ({ data: [], meta: { limit: 100, offset: 0, total: 0, hasMore: false } }),
    filterInContext = async () => [],
    clienteId = 'cli-1',
    itensAtuais = [],
  } = overrides;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === 'react' || id === 'React') return React;
      if (id === '@tanstack/react-query') {
        return {
          useQuery(opts) {
            queries.push(opts);
            const key0 = Array.isArray(opts.queryKey) ? opts.queryKey[0] : '';
            const preset = queryResults[key0];
            if (preset) return preset;
            if (String(key0).includes('produtos') || String(key0).includes('Produtos')) {
              return { data: [], isLoading: false, isError: false, isFetching: false };
            }
            return { data: undefined, isLoading: false, isError: false, isFetching: false };
          },
        };
      }
      if (id === '@/components/ui/button') {
        return { Button: (p) => React.createElement('button', p, p.children) };
      }
      if (id === '@/components/ui/badge') {
        return { Badge: (p) => React.createElement('span', p, p.children) };
      }
      if (id === '@/components/ui/alert') {
        return {
          Alert: (p) => React.createElement('div', p, p.children),
          AlertDescription: (p) => React.createElement('div', p, p.children),
        };
      }
      if (id === '@/components/ui/card') {
        return {
          Card: (p) => React.createElement('div', p, p.children),
          CardHeader: (p) => React.createElement('div', p, p.children),
          CardTitle: (p) => React.createElement('div', p, p.children),
          CardContent: (p) => React.createElement('div', p, p.children),
        };
      }
      if (id === 'lucide-react') {
        const I = (p) => React.createElement('i', p);
        return { Package: I, ShieldAlert: I, TrendingUp: I, Plus: I, Zap: I };
      }
      if (id === '@/components/lib/useContextoVisual') {
        return {
          useContextoVisual: () => ({
            filterInContext,
            empresaAtual: empresaId ? { id: empresaId, group_id: groupId } : null,
            grupoAtual: groupId ? { id: groupId } : null,
            contexto: 'empresa',
          }),
        };
      }
      if (id === '@/components/lib/usePermissions') {
        return { __esModule: true, default: () => ({ hasPermission }) };
      }
      if (id === '@/api/runtimeBackend') {
        return { resolveErpBackendMode: () => backendMode };
      }
      if (id === '@/api/erpHttpSession') {
        return { readErpHttpSession: () => session };
      }
      if (id === './HistoricoProdutosCliente' || id.endsWith('/HistoricoProdutosCliente')) {
        return {
          historicoSessionCacheKey: (s) => (s?.token && s?.actorId ? `${s.actorId}:fp` : null),
          loadPedidosHistoricoHttp: loadHttp,
        };
      }
      if (id === './historicoComprasClientePolicy' || id.endsWith('/historicoComprasClientePolicy')) {
        return { consolidateTopProdutosFromPedidos };
      }
      throw new Error(`unexpected require: ${id}`);
    },
    console,
  };

  const code = await compileJsx(
    new URL('../src/components/comercial/SugestoesProdutos.jsx', import.meta.url).pathname,
  );
  vm.runInNewContext(code, sandbox, { filename: 'SugestoesProdutos.jsx' });
  const Comp = sandbox.module.exports.default || sandbox.exports.default;
  const tree = Comp({ clienteId, itensAtuais });
  return { tree, queries };
}

test('Top10 HTTP: erro → banner indisponível (≠ sem histórico)', async () => {
  const { tree, queries } = await mountTop10({
    queryResults: {
      'top10-pedidos-cliente-contexto': {
        data: undefined,
        isError: true,
        isFetching: false,
        isLoading: false,
      },
    },
  });
  assert.ok(findByAction(tree, 'top10-produtos-http-indisponivel').length >= 1);
  assert.equal(findByAction(tree, 'top10-produtos-sem-historico').length, 0);
  assert.ok(queries[0].queryKey.includes('http'));
  assert.ok(queries[0].queryKey.includes('u1'));
});

test('Top10 HTTP: sessão ausente → indisponível (enabled false)', async () => {
  const { tree, queries } = await mountTop10({ session: null });
  assert.equal(queries[0].enabled, false);
  assert.ok(findByAction(tree, 'top10-produtos-http-indisponivel').length >= 1);
});

test('Top10 HTTP: página incompleta banner; ranking com item.total', async () => {
  const { tree } = await mountTop10({
    queryResults: {
      'top10-pedidos-cliente-contexto': {
        data: {
          data: [{
            id: 'p1',
            data_pedido: '2026-02-01',
            itens: [
              { produto_id: 'bruto', descricao: 'BrutoAlto', quantidade: 10, preco_unitario: 20, total: 5 },
              { produto_id: 'liq', descricao: 'LiquidoTopo', quantidade: 1, preco_unitario: 40, total: 40 },
            ],
          }],
          meta: { limit: 200, offset: 0, total: 50, hasMore: true },
        },
        isError: false,
        isFetching: false,
        isLoading: false,
      },
      'top10-produtos-disponiveis-contexto': {
        data: [
          { id: 'liq', codigo: 'L1', descricao: 'LiquidoTopo', preco_venda: 40 },
          { id: 'bruto', codigo: 'B1', descricao: 'BrutoAlto', preco_venda: 20 },
        ],
        isLoading: false,
        isError: false,
        isFetching: false,
      },
    },
  });
  assert.ok(findByAction(tree, 'top10-produtos-pagina-incompleta').length >= 1);
  const txt = textOf(tree);
  assert.ok(txt.indexOf('LiquidoTopo') < txt.indexOf('BrutoAlto'));
});

test('Sugestoes HTTP: erro → banner (não return null silencioso)', async () => {
  const { tree, queries } = await mountSugestoes({
    queryResults: {
      pedidosClienteContexto: {
        data: undefined,
        isError: true,
        isFetching: false,
        isLoading: false,
      },
    },
  });
  assert.ok(findByAction(tree, 'sugestoes-produtos-http-indisponivel').length >= 1);
  assert.ok(queries[0].queryKey.includes('http'));
});

test('Sugestoes: sem permissão não consulta Pedido', async () => {
  const { tree, queries } = await mountSugestoes({ hasPermission: () => false });
  assert.equal(queries[0].enabled, false);
  assert.match(textOf(tree), /permissão|contexto/i);
});
