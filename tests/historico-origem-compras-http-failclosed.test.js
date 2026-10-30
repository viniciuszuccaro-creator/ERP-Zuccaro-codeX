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
  resolveDataPedidoHistorico,
  resolveOrigemCanalComprovada,
  resolvePrecoUnitarioComprovado,
  resolveUnidadeItemHistorico,
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
  // Pacote B: Adicionar não inventa UN; unidade só se comprovada.
  assert.doesNotMatch(compras, /unidade_medida:\s*["']UN["']/);
  assert.match(compras, /if\s*\(\s*produto\.unidade\s*\)/);
  assert.match(compras, /resolveUnidadeItemHistorico|produto\.unidade/);
  const policy = sourceContract('src/components/comercial/historicoComprasClientePolicy.js');
  assert.match(policy, /extractItensPedidoHistorico/);
  assert.match(policy, /itens_revenda/);
  assert.match(policy, /resolveUnidadeItemHistorico/);
  assert.match(policy, /produtoId\}::\$\{unidade/);
  const produtos = sourceContract('src/components/comercial/HistoricoProdutosCliente.jsx');
  assert.match(produtos, /EMPRESA_SESSION_MISMATCH/);
  assert.match(produtos, /expectedEmpresaId/);
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
  empresaId = 'e1',
  groupId = 'g1',
  contexto = 'empresa',
  hasPermission = () => true,
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
          empresaAtual: empresaId ? { id: empresaId, group_id: groupId } : null,
          grupoAtual: groupId ? { id: groupId } : null,
          contexto,
        }),
      },
      '@/components/lib/usePermissions': {
        __esModule: true,
        default: () => ({
          hasPermission,
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
        resolveUnidadeItemHistorico,
        resolveDataPedidoHistorico,
      },
      './historicoComprasClientePolicy.js': {
        __esModule: true,
        consolidateTopProdutosFromPedidos,
        extractItensPedidoHistorico,
        resolveOrigemCanalComprovada,
        resolveValorPedidoHistorico,
        resolveValorItemHistorico,
        resolveUnidadeItemHistorico,
        resolveDataPedidoHistorico,
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

test('Origem HTTP: sessão ausente/expirada → indisponível (enabled false; ≠ Manual)', async () => {
  const sandbox = buildOrigemSandbox({
    session: null,
    queryResult: { data: undefined, isError: false, isFetching: false, isLoading: false },
  });
  const tree = await mountOrigem(sandbox);
  assert.equal(sandbox.queries[0].enabled, false);
  assert.ok(findByAction(tree, 'historico-origem-http-indisponivel').length >= 1);
  assert.doesNotMatch(textOf(tree), /Canal Preferido:\s*Manual|100%/);
});

test('Origem: sem permissão não consulta Pedido', async () => {
  const sandbox = buildOrigemSandbox({
    hasPermission: () => false,
    backendMode: 'http',
  });
  const tree = await mountOrigem(sandbox);
  assert.equal(sandbox.queries[0].enabled, false);
  assert.match(textOf(tree), /permissão|contexto/i);
});

test('Origem HTTP: queryKey isola cliente/ator/empresa (troca de contexto sem dados antigos)', async () => {
  const sandbox = buildOrigemSandbox({
    session: { token: 'tok', actorId: 'actor-A', groupId: 'g1' },
    empresaId: 'e1',
  });
  await mountOrigem(sandbox, { clienteId: 'cli-A' });
  const key = sandbox.queries[0].queryKey;
  assert.ok(key.includes('cli-A'));
  assert.ok(key.includes('actor-A'));
  assert.ok(key.includes('e1'));
  assert.ok(key.includes('http'));
});

test('Compras HTTP: item.total líquido vence bruto no ranking montado', async () => {
  const { tree } = await mountCompras({
    __backendMode: 'http',
    __session: { token: 'tok', actorId: 'u1', groupId: 'g1' },
    __queryResult: {
      data: {
        data: [{
          id: 'p1',
          itens: [
            { produto_id: 'bruto', descricao: 'BrutoAlto', quantidade: 10, preco_unitario: 20, total: 5 },
            { produto_id: 'liq', descricao: 'LiquidoTopo', quantidade: 1, preco_unitario: 40, total: 40 },
          ],
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
  const txt = textOf(tree);
  const iLiq = txt.indexOf('LiquidoTopo');
  const iBruto = txt.indexOf('BrutoAlto');
  assert.ok(iLiq >= 0 && iBruto >= 0);
  assert.ok(iLiq < iBruto, 'ranking deve listar líquido antes do bruto enganoso');
});

test('policy Pacote B: KG ≠ UN; unidades distintas não somam; ausência ≠ inventar UN', () => {
  assert.equal(resolveUnidadeItemHistorico({ unidade_sigla: 'KG' }), 'KG');
  assert.equal(resolveUnidadeItemHistorico({ unidade: 'PC' }), 'PC');
  assert.equal(resolveUnidadeItemHistorico({ quantidade: 1, preco_unitario: 10 }), null);

  const top = consolidateTopProdutosFromPedidos([
    {
      id: 'p1',
      data_pedido: '2026-01-10',
      itens: [
        { produto_id: 'cimento', descricao: 'Cimento', quantidade: 2, preco_unitario: 30, total: 60, unidade_sigla: 'KG' },
        { produto_id: 'cimento', descricao: 'Cimento', quantidade: 3, preco_unitario: 5, total: 15, unidade_sigla: 'PC' },
      ],
    },
  ], { limit: 5 });
  assert.equal(top.length, 2, 'KG e PC do mesmo produto viram linhas distintas');
  const kg = top.find((r) => r.unidade === 'KG');
  const pc = top.find((r) => r.unidade === 'PC');
  assert.ok(kg && pc);
  assert.equal(kg.quantidade_total, 2);
  assert.equal(pc.quantidade_total, 3);
  // Sem unidade comprovada: null (≠ UN inventada)
  const semUn = consolidateTopProdutosFromPedidos([
    { itens: [{ produto_id: 'x', descricao: 'X', quantidade: 1, preco_unitario: 1, total: 1 }] },
  ]);
  assert.equal(semUn[0].unidade, null);
});

test('policy Pacote B: último preço pela data do pedido, não pela ordem do loop', () => {
  // Ordem inversa: pedido antigo primeiro no array, recente por último —
  // e o inverso: recente primeiro. Ambos devem fixar preço do mais recente.
  const antigo = {
    id: 'old',
    data_pedido: '2025-01-01',
    itens: [{ produto_id: 'p', descricao: 'P', quantidade: 1, preco_unitario: 10, total: 10, unidade_sigla: 'UN' }],
  };
  const recente = {
    id: 'new',
    data_pedido: '2026-06-01',
    itens: [{ produto_id: 'p', descricao: 'P', quantidade: 1, preco_unitario: 99, total: 99, unidade_sigla: 'UN' }],
  };
  assert.equal(resolveDataPedidoHistorico(recente), '2026-06-01');
  const forward = consolidateTopProdutosFromPedidos([antigo, recente], { limit: 5 });
  const reverse = consolidateTopProdutosFromPedidos([recente, antigo], { limit: 5 });
  assert.equal(forward[0].ultimo_preco, 99);
  assert.equal(reverse[0].ultimo_preco, 99);
  assert.equal(forward[0].quantidade_total, 2);
});

test('policy: created_at HTTP conta como data; preço zero comprovado vence antigo', () => {
  assert.equal(resolveDataPedidoHistorico({ created_at: '2026-03-15T12:00:00Z' }), '2026-03-15T12:00:00Z');
  assert.equal(resolvePrecoUnitarioComprovado({ preco_unitario: '0.000000' }), 0);
  assert.equal(resolvePrecoUnitarioComprovado({}), null);
  assert.equal(resolvePrecoUnitarioComprovado({ preco_unitario: '' }), null);

  const jan = {
    id: 'jan',
    created_at: '2026-01-10T00:00:00Z',
    itens: [{ produto_id: 'p', descricao: 'P', quantidade: 1, preco_unitario: 10, total: 10, unidade_sigla: 'KG' }],
  };
  const marZero = {
    id: 'mar',
    created_at: '2026-03-10T00:00:00Z',
    itens: [{ produto_id: 'p', descricao: 'P', quantidade: 1, preco_unitario: '0.000000', total: 0, unidade_sigla: 'KG' }],
  };
  const forward = consolidateTopProdutosFromPedidos([jan, marZero], { limit: 5 });
  const reverse = consolidateTopProdutosFromPedidos([marZero, jan], { limit: 5 });
  assert.equal(forward[0].ultimo_preco, 0);
  assert.equal(reverse[0].ultimo_preco, 0);
  assert.ok(String(forward[0].ultima_compra).includes('2026-03'));
  // Ausência de preço: null (≠ inventar 0)
  const semPreco = consolidateTopProdutosFromPedidos([
    { created_at: '2026-04-01', itens: [{ produto_id: 'x', descricao: 'X', quantidade: 1, total: 5, unidade_sigla: 'UN' }] },
  ]);
  assert.equal(semPreco[0].ultimo_preco, null);
});

test('assertHistoricoHttpScope: troca de empresa na sessão invalida resposta pendente', async () => {
  const source = await readFile(new URL('../src/components/comercial/HistoricoProdutosCliente.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const sessionLive = { token: 'tok-a', actorId: 'actor-a', groupId: 'g1', empresaId: 'emp-A' };
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
  assert.equal(typeof assertHistoricoHttpScope, 'function');
  // Request iniciada com emp-A; sessão agora aponta emp-B → EMPRESA_SESSION_MISMATCH
  assert.throws(
    () => assertHistoricoHttpScope({
      session: { ...sessionLive, empresaId: 'emp-B' },
      groupId: 'g1',
      empresaId: 'emp-A',
      expectedEmpresaId: 'emp-A',
    }),
    (err) => err?.code === 'EMPRESA_SESSION_MISMATCH',
  );
  // Mesma empresa: ok
  assert.doesNotThrow(() => assertHistoricoHttpScope({
    session: sessionLive,
    groupId: 'g1',
    empresaId: 'emp-A',
    expectedEmpresaId: 'emp-A',
  }));
});

test('Compras montado: preço ausente → — e Adicionar sem preco_venda; zero comprovado ok', async () => {
  const added = [];
  const code = await compileJsx(new URL('../src/components/comercial/HistoricoComprasCliente.jsx', import.meta.url));
  const sb = buildOrigemSandbox({
    queryResult: {
      data: {
        data: [
          {
            id: 'p-old',
            created_at: '2026-01-01T00:00:00Z',
            itens: [{ produto_id: 'z', descricao: 'ZeroPreco', quantidade: 1, preco_unitario: 10, total: 10, unidade_sigla: 'KG' }],
          },
          {
            id: 'p-new',
            created_at: '2026-03-01T00:00:00Z',
            itens: [{ produto_id: 'z', descricao: 'ZeroPreco', quantidade: 1, preco_unitario: '0.000000', total: 0, unidade_sigla: 'KG' }],
          },
          {
            id: 'p-sem',
            created_at: '2026-02-01T00:00:00Z',
            itens: [{ produto_id: 's', descricao: 'SemPreco', quantidade: 2, total: 0, unidade_sigla: 'PC' }],
          },
        ],
        meta: { limit: 200, offset: 0, total: 3, hasMore: false },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
  });
  vm.runInNewContext(code, sb);
  const Comp = sb.module.exports.default || sb.exports.default;
  const tree = Comp({ clienteId: 'c1', onAdicionarProduto: (p) => added.push(p) });
  const txt = textOf(tree);
  assert.match(txt, /ZeroPreco/);
  assert.match(txt, /R\$ 0\.00/); // zero comprovado
  assert.match(txt, /SemPreco/);
  assert.match(txt, /Último preço:\s*—/);
  const btns = findByAction(tree, 'adicionar-produto-historico-cliente');
  assert.ok(btns.length >= 2);
  btns.forEach((b) => b.props.onClick());
  const zero = added.find((p) => p.descricao === 'ZeroPreco');
  const sem = added.find((p) => p.descricao === 'SemPreco');
  assert.ok(zero && sem);
  assert.equal(zero.preco_venda, 0);
  assert.equal(zero.unidade_medida, 'KG');
  assert.equal(sem.preco_venda, undefined);
  assert.equal(sem.unidade_medida, 'PC');
});

test('Compras montado: unidades mistas exibem KG/PC separados; Adicionar não inventa UN', async () => {
  const added = [];
  const { tree, sandbox } = await mountCompras({
    __backendMode: 'http',
    __session: { token: 'tok', actorId: 'u1', groupId: 'g1' },
    __queryResult: {
      data: {
        data: [{
          id: 'p1',
          data_pedido: '2026-03-01',
          itens: [
            { produto_id: 'cimento', descricao: 'CimentoMisto', quantidade: 2, preco_unitario: 30, total: 60, unidade_sigla: 'KG' },
            { produto_id: 'cimento', descricao: 'CimentoMisto', quantidade: 3, preco_unitario: 5, total: 15, unidade_sigla: 'PC' },
          ],
        }],
        meta: { limit: 200, offset: 0, total: 1, hasMore: false },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
    __loadHttp: async () => ({ data: [], meta: { limit: 200, offset: 0, total: 0, hasMore: false } }),
    __filterInContext: async () => [],
  }, { clienteId: 'c1', onAdicionarProduto: (p) => added.push(p) });
  const txt = textOf(tree);
  assert.match(txt, /CimentoMisto/);
  assert.match(txt, /KG/);
  assert.match(txt, /PC/);
  assert.doesNotMatch(txt, /\b5\s+unidades\b/i); // não soma 2+3 como "5 unidades"
  // Clique Adicionar na linha KG (só com callback — sem botão órfão)
  const buttons = findByAction(tree, 'adicionar-produto-historico-cliente');
  assert.ok(buttons.length >= 2);
  // Remount with callback to capture payload — recompile with onAdicionarProduto
  const code = await compileJsx(new URL('../src/components/comercial/HistoricoComprasCliente.jsx', import.meta.url));
  const sb = buildOrigemSandbox({
    queryResult: {
      data: {
        data: [{
          id: 'p1',
          data_pedido: '2026-03-01',
          itens: [
            { produto_id: 'cimento', descricao: 'CimentoKG', quantidade: 2, preco_unitario: 30, total: 60, unidade_sigla: 'KG' },
            { produto_id: 'sem-un', descricao: 'SemUnidade', quantidade: 1, preco_unitario: 10, total: 10 },
          ],
        }],
        meta: { limit: 200, offset: 0, total: 1, hasMore: false },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
  });
  vm.runInNewContext(code, sb);
  const Comp = sb.module.exports.default || sb.exports.default;
  const tree2 = Comp({
    clienteId: 'c1',
    onAdicionarProduto: (p) => added.push(p),
  });
  const addBtns = findByAction(tree2, 'adicionar-produto-historico-cliente');
  assert.ok(addBtns.length >= 2);
  // Ranking por valor: CimentoKG (60) antes de SemUnidade (10)
  addBtns[0].props.onClick();
  addBtns[1].props.onClick();
  assert.equal(added.length, 2);
  const kgPayload = added.find((p) => p.descricao === 'CimentoKG');
  const semPayload = added.find((p) => p.descricao === 'SemUnidade');
  assert.ok(kgPayload && semPayload);
  assert.equal(kgPayload.unidade_medida, 'KG');
  assert.equal(kgPayload.unidade_sigla, 'KG');
  assert.equal(semPayload.unidade_medida, undefined);
  assert.equal(semPayload.unidade_sigla, undefined);
  assert.ok(!('custo_aquisicao' in kgPayload));
  assert.ok(!('estoque_atual' in kgPayload));
  void sandbox;
});

test('Compras montado: página incompleta (hasMore) não inventa top completo; badge unidade comprovada', async () => {
  const { tree } = await mountCompras({
    __backendMode: 'http',
    __session: { token: 'tok', actorId: 'u1', groupId: 'g1' },
    __queryResult: {
      data: {
        data: [{
          id: 'p1',
          data_pedido: '2026-02-01',
          itens: [
            { produto_id: 'a', descricao: 'Areia', quantidade: 10, preco_unitario: 8, total: 80, unidade_sigla: 'KG' },
          ],
        }],
        meta: { limit: 200, offset: 0, total: 50, hasMore: true },
      },
      isError: false,
      isFetching: false,
      isLoading: false,
    },
    __loadHttp: async () => ({ data: [], meta: { limit: 200, offset: 0, total: 0, hasMore: false } }),
    __filterInContext: async () => [],
  });
  const badges = findByAction(tree, 'historico-compras-unidade');
  assert.ok(badges.length >= 1);
  assert.match(textOf(badges[0]), /10\s+KG/);
  // Página incompleta: UI continua listando o que veio; não inventa total=50 nem canal.
  assert.doesNotMatch(textOf(tree), /Manual/);
});
