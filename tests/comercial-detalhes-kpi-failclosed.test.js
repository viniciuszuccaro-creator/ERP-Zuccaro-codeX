import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

async function compile(url) {
  const source = await readFile(url, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function findByAction(tree, action) {
  const out = [];
  walk(tree, (n) => {
    if (n?.props?.['data-action'] === action) out.push(n);
  });
  return out;
}

async function mountDetalhes({ queryResult, hasPermission = () => true }) {
  const compiled = await compile(new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
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
        useQuery() {
          return queryResult;
        },
      },
      '@/components/ui/tabs': { Tabs: 'Tabs' },
      '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
      '@/components/ui/badge': { Badge: 'Badge' },
      '@/components/ui/button': { Button: 'Button' },
      '@/components/ui/alert': { Alert: 'Alert', AlertDescription: 'AlertDescription' },
      'lucide-react': new Proxy({}, { get: () => 'Icon' }),
      'framer-motion': { motion: { div: 'motion.div' } },
      './HistoricoOrigemCliente': { __esModule: true, default: () => ({ type: 'HistoricoOrigem', props: {}, children: [] }) },
      './HistoricoProdutosCliente': { __esModule: true, default: () => ({ type: 'HistoricoProdutos', props: {}, children: [] }) },
      './HistoricoComprasCliente': { __esModule: true, default: () => ({ type: 'HistoricoCompras', props: {}, children: [] }) },
      './Top10ProdutosCliente': { __esModule: true, default: () => ({ type: 'Top10', props: {}, children: [] }) },
      './CentralCliente360Panel': { __esModule: true, default: () => ({ type: 'Central360', props: {}, children: [] }) },
      '@/components/lib/useContextoVisual': {
        useContextoVisual: () => ({
          filterInContext: async () => { throw new Error('não deve chamar no mount sintético'); },
          empresaAtual: { id: 'e1', group_id: 'g1' },
          grupoAtual: { id: 'g1' },
          contexto: 'empresa',
        }),
      },
      '@/components/lib/usePermissions': {
        __esModule: true,
        default: () => ({ hasPermission, user: { id: 'u1', email: 'synthetic@example.invalid' } }),
      },
      '@/api/httpApiClient': { resolveErpAuthSessionToken: () => 'sess-synthetic' },
      '@/lib/app-params': { appParams: { token: null } },
    },
  };
  vm.runInNewContext(`var React = require("react");\n${compiled}`, sandbox);
  const DetalhesCliente = sandbox.exports.default || sandbox.module.exports.default;
  return DetalhesCliente({
    cliente: { id: 'cli-1', nome: 'Cliente', status: 'Ativo', codigo: 7 },
    windowMode: true,
  });
}

test('DetalhesCliente KPI: erro de pedidos → DESCONHECIDO (não inventa R$ 0)', async () => {
  const tree = await mountDetalhes({
    queryResult: {
      data: undefined,
      isError: true,
      isLoading: false,
      isFetching: false,
      error: { message: 'Falha de leitura' },
    },
  });
  const kpi = findByAction(tree, 'cliente-360-kpi-pedidos')[0];
  assert.equal(kpi.props['data-kpi-status'], 'unavailable');
  assert.ok(findByAction(tree, 'cliente-360-kpi-desconhecido').length >= 3);
  assert.match(JSON.stringify(tree), /DESCONHECIDO/);
  assert.doesNotMatch(JSON.stringify(tree), /R\$ 0,00/);
  assert.match(JSON.stringify(tree), /Falha de leitura/);
});

test('DetalhesCliente KPI: lista vazia confirmada → zeros reais', async () => {
  const tree = await mountDetalhes({
    queryResult: { data: [], isError: false, isLoading: false, isFetching: false },
  });
  const kpi = findByAction(tree, 'cliente-360-kpi-pedidos')[0];
  assert.equal(kpi.props['data-kpi-status'], 'ok');
  const total = findByAction(tree, 'cliente-360-kpi-total-compras')[0];
  assert.ok(total);
  assert.deepEqual(total.children, ['R$ ', '0,00']);
  assert.equal(findByAction(tree, 'cliente-360-kpi-qtd-pedidos')[0].children[0], 0);
  assert.match(JSON.stringify(tree), /cliente-360-ultimos-pedidos-vazio/);
  assert.equal(findByAction(tree, 'cliente-360-kpi-desconhecido').length, 0);
});

test('PainelDinamicoCliente: editar cadastro usa uniqueKey por ID', async () => {
  const src = await readFile(new URL('../src/components/cadastros/PainelDinamicoCliente.jsx', import.meta.url), 'utf8');
  assert.match(src, /uniqueKey:\s*clienteId/);
  assert.match(src, /cadastro-cliente-completo-\$\{clienteId\}/);
});
