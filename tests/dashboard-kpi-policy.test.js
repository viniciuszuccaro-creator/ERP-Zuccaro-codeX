import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertDashboardContext,
  buildDashboardQueryKey,
  buildKpiDrillDownUrl,
  buildVendasPorMesFromPedidos,
  computeDashboardDerivedKpis,
  computeRealtimeKpisFromStores,
  isCappedListUnreliable,
  resolveDashboardCount,
  resolveMetaOperacional,
  DASHBOARD_LIST_SOFT_LIMIT,
} from '../src/components/lib/dashboardKpiPolicy.js';

test('dashboard exige contexto de grupo/empresa', () => {
  assert.throws(() => assertDashboardContext({ groupId: '', empresaId: 'e1' }), /Grupo/);
  assert.throws(() => assertDashboardContext({ groupId: 'g1', empresaId: '', scopeType: 'empresa' }), /Empresa/);
  assert.equal(assertDashboardContext({ groupId: 'g1', scopeType: 'grupo' }), true);
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
  const painel = await readFile(new URL('../src/components/logistica/PainelMetricasRealtime.jsx', import.meta.url), 'utf8');
  const hook = await readFile(new URL('../src/components/dashboard/hooks/useDashboardDerivedData.jsx', import.meta.url), 'utf8');

  assert.match(dash, /buildDashboardQueryKey/);
  assert.match(dash, /buildKpiDrillDownUrl/);
  assert.match(dash, /resolveDashboardCount/);
  assert.match(bi, /buildVendasPorMesFromPedidos/);
  assert.doesNotMatch(bi, /valor: 45000/);
  assert.match(realtime, /DASHBOARD_REALTIME_LIMIT/);
  assert.match(realtime, /computeRealtimeKpisFromStores/);
  assert.doesNotMatch(realtime, /getByContext\('Pedido', '-created_date', 20\)/);
  assert.match(painel, /filterInContext/);
  assert.match(painel, /buildDashboardQueryKey/);
  assert.match(painel, /resolveMetaOperacional/);
  assert.doesNotMatch(painel, /entregasDia:\s*20/);
  assert.doesNotMatch(painel, /queryKey:\s*\['pedidos'\]/);
  assert.match(hook, /computeDashboardDerivedKpis/);
});
