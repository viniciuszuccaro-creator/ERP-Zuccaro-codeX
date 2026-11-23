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
  // Conteúdo fica dentro do Tabs — evita aba “vazia” com painel deslocado fora da coluna.
  assert.doesNotMatch(src, /activeTab === ['"]historico_produtos['"]/);
  // Uma única montagem no TabsContent — sem segunda tela paralela.
  assert.equal((src.match(/<HistoricoProdutosCliente\b/g) || []).length, 1);
});

/**
 * Aba montada ≠ histórico carregado: consulta só com contexto + permissão;
 * sem permissão não dispara Pedido filter e exibe alerta fail-closed.
 */
async function mountHistoricoCliente({ clienteId = 'cli-1', hasPermission = () => true, groupId = 'g1', empresaId = 'e1' } = {}) {
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
          const data = opts.enabled ? [] : undefined;
          return { data: data ?? [], isLoading: false, isFetching: false };
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
    },
  };

  vm.runInNewContext(compiled, sandbox);
  const Component = sandbox.exports.default || sandbox.module.exports.default;
  slot = 0;
  const tree = Component({ clienteId });
  scheduled.splice(0).forEach((fn) => fn());
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  return { tree, walk: () => walk(tree), queries, filterCalls };
}

test('HistoricoProdutosCliente: sem permissão não consulta Pedido (aba montada ≠ carga)', async () => {
  const { tree, walk, queries, filterCalls } = await mountHistoricoCliente({
    hasPermission: () => false,
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].enabled, false);
  assert.equal(filterCalls.length, 0);
  const alert = walk().find((n) => n.props?.['data-permission'] === 'Comercial.Pedido.visualizar' && n.type === 'Alert');
  assert.ok(alert || walk().some((n) => n.props?.['data-context-required'] === 'true'), 'alerta fail-closed');
  assert.ok(tree);
});

test('HistoricoProdutosCliente: com permissão consulta no contexto (queryKey grupo/empresa)', async () => {
  let permissionCalls = 0;
  const { queries, filterCalls } = await mountHistoricoCliente({
    hasPermission: (key) => {
      permissionCalls += 1;
      return key === 'Comercial.Pedido.visualizar' || key === 'CRM.Cliente.visualizar';
    },
  });
  assert.ok(permissionCalls > 0);
  assert.equal(queries.length, 1);
  assert.equal(queries[0].enabled, true);
  const key = queries[0].queryKey;
  assert.equal(key[0], 'historico-produtos-cliente-contexto');
  assert.equal(key[1], 'cli-1');
  assert.equal(key[2], 'g1');
  assert.equal(key[3], 'e1');
  // useQuery com enabled true expõe queryFn — executá-la prova o contrato real.
  await queries[0].queryFn();
  assert.equal(filterCalls.length, 1);
  assert.equal(filterCalls[0].entity, 'Pedido');
  assert.equal(filterCalls[0].filter.cliente_id, 'cli-1');
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
