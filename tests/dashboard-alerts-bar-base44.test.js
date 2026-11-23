/**
 * DashboardAlertsBar — origem Base44 incorporada no Dashboard existente.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('DashboardAlertsBar: fail-closed e drill-down com permissão', async () => {
  const src = await readFile(new URL('../src/components/dashboard/DashboardAlertsBar.jsx', import.meta.url), 'utf8');
  assert.match(src, /data-block="dashboard-alerts-bar"/);
  assert.match(src, /hasContextoAtivo/);
  assert.match(src, /Number\.isFinite/);
  assert.match(src, /estoqueN > 0/);
  assert.match(src, /canSeeEstoque/);
  assert.match(src, /canSeeFinanceiro/);
  assert.match(src, /canSeeComercial/);
  assert.match(src, /createPageUrl\('Estoque'\)/);
  assert.match(src, /createPageUrl\('Comercial'\)/);
  assert.match(src, /createPageUrl\('Financeiro'\)/);
  assert.match(src, /Dashboard\.alerta\./);
});

test('Dashboard.jsx: alertas + KPI strip clicável + painéis secundários lazy', async () => {
  const dash = await readFile(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
  assert.match(dash, /DashboardAlertsBar/);
  assert.match(dash, /data-block="dashboard-kpi-strip"/);
  assert.match(dash, /hasContextoAtivo=\{hasContextoAtivo\}/);
  assert.match(dash, /Dashboard\.kpi\.faturamento/);
  assert.match(dash, /Dashboard\.kpi\.estoque-critico/);
  assert.match(dash, /React\.lazy\(\(\) => import\("@\/components\/dashboard\/ChartsSection"\)\)/);
  assert.match(dash, /React\.lazy\(\(\) => import\("@\/components\/dashboard\/FinancialSummary"\)\)/);
  assert.match(dash, /React\.lazy\(\(\) => import\("@\/components\/dashboard\/SecondaryKPIsSection"\)\)/);
});
