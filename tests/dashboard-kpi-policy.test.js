import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { buildContextFilter } from '../src/components/lib/cadastroCountFilter.js';
import { runHttpPilotAwareCountEntities } from '../src/api/httpPilotCountBridge.js';

import {
  assertDashboardContext,
  buildDashboardQueryKey,
  buildKpiDrillDownUrl,
  buildVendasPorMesFromPedidos,
  computeDashboardDerivedKpis,
  computeRealtimeKpisFromStores,
  isCappedListUnreliable,
  resolveDashboardCount,
  resolveRealtimeDashboardScope,
  resolveMetaOperacional,
  DASHBOARD_LIST_SOFT_LIMIT,
} from '../src/components/lib/dashboardKpiPolicy.js';

test('Dashboard consulta os totais oficiais de Clientes e Produtos somente no contexto permitido', async () => {
  const source = await readFile(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('Dashboard.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const queries = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)
        && node.name.elements.some(e => ['totalClientes', 'totalProdutos'].includes(e.name.getText(tree)))) {
      queries.push(node.initializer.arguments[0].getText(tree));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(queries.length, 2);
  const empresasDoGrupo = [{ id: '3z' }, { id: 'cpa' }];
  const expectedTotals = { Cliente: 17472, Produto: 273 };
  for (const empresaId of [null, 'cpa', '3z']) {
    const seen = [];
    const groupId = 'grupo-cpa';
    const invoke = (method, payload) => {
      assert.equal(method, 'countEntities');
      return runHttpPilotAwareCountEntities(payload, {
        pilotSet: new Set(Object.keys(expectedTotals)),
        httpEntities: Object.fromEntries(Object.entries(expectedTotals).map(([entity, total]) => [entity, {
          filter: () => assert.fail('A contagem nao deve ler paginas'),
          count: async filter => { seen.push([entity, filter]); return total; },
        }])),
        countLocal: () => assert.fail('Uma contagem HTTP nao pode cair no cache local'),
      });
    };
    for (const allowed of [false, true]) {
      const dependencies = {
        hasContextoAtivo: true, canSeeCRM: allowed, canSeeEstoque: allowed, estaNoGrupo: empresaId === null,
        groupId, empresaId, empresasDoGrupo, contextQueryKey: [groupId, empresaId],
        buildContextFilter, resolveDashboardCount, base44: { functions: { invoke } },
      };
      for (const query of queries) {
        const config = new Function(...Object.keys(dependencies), `return (${query});`)(...Object.values(dependencies));
        assert.equal(config.enabled, allowed);
        const entity = config.queryKey[0] === 'clientes-count' ? 'Cliente' : 'Produto';
        if (config.enabled) assert.equal(await config.queryFn(), expectedTotals[entity]);
        if (empresaId === null) assert.deepEqual(config.queryKey.slice(-2), ['3z', 'cpa']);
      }
      assert.equal(seen.length, allowed ? 2 : 0);
    }
    for (const [entity, filter] of seen) assert.deepEqual(filter, buildContextFilter(entity, empresaId, groupId, empresasDoGrupo));
  }
});

test('dashboard exige contexto de grupo/empresa', () => {
  assert.throws(() => assertDashboardContext({ groupId: '', empresaId: 'e1' }), /Grupo/);
  assert.throws(() => assertDashboardContext({ groupId: 'g1', empresaId: '', scopeType: 'empresa' }), /Empresa/);
  assert.equal(assertDashboardContext({ groupId: 'g1', scopeType: 'grupo' }), true);
});

test('dashboard realtime consolida grupo e bloqueia empresa externa', () => {
  const groupScope = resolveRealtimeDashboardScope({
    scopeType: 'grupo',
    groupId: 'g1',
    requestedEmpresaId: 'externa',
  });
  assert.equal(groupScope.valid, true);
  assert.equal(groupScope.empresaId, null);

  const companyScope = resolveRealtimeDashboardScope({
    scopeType: 'empresa',
    groupId: 'g1',
    requestedEmpresaId: 'e1',
    currentEmpresa: { id: 'e1', group_id: 'g1' },
    groupCompanies: [{ id: 'e1', group_id: 'g1' }],
  });
  assert.equal(companyScope.valid, true);
  assert.equal(companyScope.empresaId, 'e1');

  const externalScope = resolveRealtimeDashboardScope({
    scopeType: 'empresa',
    groupId: 'g1',
    requestedEmpresaId: 'e2',
    currentEmpresa: { id: 'e1', group_id: 'g1' },
    groupCompanies: [{ id: 'e1', group_id: 'g1' }],
  });
  assert.equal(externalScope.valid, false);
  assert.equal(externalScope.empresaId, null);
});

test('queryKey inclui usuario, grupo e empresa', () => {
  const key = buildDashboardQueryKey({
    prefix: 'dash',
    userId: 'u1',
    groupId: 'g1',
    empresaId: 'e1',
    scopeType: 'empresa',
    periodo: 'mes',
  });
  assert.deepEqual(key.slice(0, 6), ['dash', 'u1', 'empresa', 'g1', 'e1', 'mes']);
});

test('lista no soft limit nao e confiavel e count tem prioridade', () => {
  const full = Array.from({ length: DASHBOARD_LIST_SOFT_LIMIT }, (_, i) => ({ id: i }));
  assert.equal(isCappedListUnreliable(full), true);
  assert.equal(resolveDashboardCount({ countValue: 12000, list: full }).total, 12000);
  assert.equal(resolveDashboardCount({ countValue: 12000, list: full }).fonte, 'count');
  assert.equal(resolveDashboardCount({ list: full }).confiavel, false);
  for (const countValue of [null, '', ' ', false]) {
    assert.equal(resolveDashboardCount({ countValue, list: full }).fonte, 'lista');
    assert.equal(resolveDashboardCount({ countValue, list: full }).confiavel, false);
  }
  assert.equal(resolveDashboardCount({ countValue: 0, list: full }).fonte, 'count');
});

test('kpis derivados e vendas mensais usam pedidos reais', () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const derived = computeDashboardDerivedKpis({
    periodo: 'mes',
    pedidos: [
      { data_pedido: hoje, status: 'Aprovado', valor_total: 100, cliente_nome: 'Ana' },
      { data_pedido: hoje, status: 'Cancelado', valor_total: 50, cliente_nome: 'Ana' },
    ],
    contasReceber: [{ status: 'Pendente', valor: 40, data_vencimento: '2020-01-01' }],
    contasPagar: [{ status: 'Pendente', valor: 10 }],
    entregas: [],
    ordensProducao: [],
    colaboradores: [{ status: 'Ativo' }],
    clientes: [{ status: 'Ativo' }],
    produtos: [],
  });
  assert.equal(derived.totalVendas, 100);
  assert.equal(derived.fluxoCaixa, 30);
  assert.ok(Number(derived.taxaInadimplencia) > 0);

  const meses = buildVendasPorMesFromPedidos([
    { data_pedido: `${new Date().getFullYear()}-01-15`, status: 'Aprovado', valor_total: 10 },
  ]);
  assert.ok(meses.some((item) => item.valor === 10));
  assert.doesNotMatch(JSON.stringify(meses), /45000/);
});

test('realtime e drill-down sao deterministas', () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const kpis = computeRealtimeKpisFromStores({
    pedidos: [{ data_pedido: hoje, status: 'Aguardando Aprovação', valor_total: 20 }],
    contas: [{ data_vencimento: hoje, status: 'Pendente', valor: 15 }],
    ops: [{ status: 'Em Produção', percentual_conclusao: 50 }],
    entregas: [{ data_previsao: hoje, status: 'Em Trânsito' }],
  });
  assert.equal(kpis.pedidos.hoje, 1);
  assert.equal(kpis.financeiro.vencendoHoje, 1);
  assert.equal(kpis.expedicao.emRota, 1);

  const url = buildKpiDrillDownUrl('/Comercial', {
    origem: 'dashboard',
    kpi: 'vendas_periodo',
    periodo: 'mes',
    group_id: 'g1',
    empresa_id: 'e1',
  });
  assert.match(url, /origem=dashboard/);
  assert.match(url, /kpi=vendas_periodo/);
  assert.match(url, /group_id=g1/);
  assert.equal(resolveMetaOperacional({ entregasHoje: 0 }).entregasDia, 1);
});

test('telas existentes usam policy e abandonam mock de vendas', async () => {
  const dash = await readFile(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
  const bi = await readFile(new URL('../src/components/dashboard/DashboardOperacionalBI.jsx', import.meta.url), 'utf8');
  const realtime = await readFile(new URL('../src/components/lib/useRealtimeData.jsx', import.meta.url), 'utf8');
  const realtimeDashboard = await readFile(new URL('../src/components/dashboard/DashboardTempoReal.jsx', import.meta.url), 'utf8');
  const painel = await readFile(new URL('../src/components/logistica/PainelMetricasRealtime.jsx', import.meta.url), 'utf8');
  const hook = await readFile(new URL('../src/components/dashboard/hooks/useDashboardDerivedData.jsx', import.meta.url), 'utf8');

  assert.match(dash, /buildDashboardQueryKey/);
  assert.match(dash, /buildKpiDrillDownUrl/);
  assert.match(dash, /resolveDashboardCount/);
  assert.match(bi, /buildVendasPorMesFromPedidos/);
  assert.doesNotMatch(bi, /valor: 45000/);
  assert.match(realtime, /DASHBOARD_REALTIME_LIMIT/);
  assert.match(realtime, /computeRealtimeKpisFromStores/);
  assert.match(realtime, /prefix: 'pedidos-realtime'/);
  assert.match(realtime, /prefix: 'entregas-realtime'/);
  assert.doesNotMatch(realtime, /getByContext\('Pedido', '-created_date', 20\)/);
  assert.match(realtimeDashboard, /resolveRealtimeDashboardScope/);
  assert.match(realtimeDashboard, /user\?\.id \|\| user\?\.email/);
  assert.match(painel, /filterInContext/);
  assert.match(painel, /buildDashboardQueryKey/);
  assert.match(painel, /resolveMetaOperacional/);
  assert.doesNotMatch(painel, /entregasDia:\s*20/);
  assert.doesNotMatch(painel, /queryKey:\s*\['pedidos'\]/);
  assert.match(hook, /computeDashboardDerivedKpis/);
});
