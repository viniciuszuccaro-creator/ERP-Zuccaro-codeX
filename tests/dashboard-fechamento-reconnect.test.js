import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { readBoundaryRemainder } from './helpers/readBoundaryRemainder.js';

const dashboard = readFileSync('src/pages/Dashboard.jsx', 'utf8');
const page = readFileSync('src/pages/DashboardFechamentoPedidos.jsx', 'utf8');
const pagesConfig = readFileSync('src/pages.config.js', 'utf8');
const widget = readFileSync('src/components/comercial/WidgetFechamentoPedidos.jsx', 'utf8');
const DASHBOARD_PIN = '5b8ddf19ed369ceb076cd9a80cbc08ae7009eb30fd0a40ffe277135c3f01d00a';

test('recuperação: Dashboard monta WidgetFechamentoPedidos com RBAC Comercial', () => {
  assert.match(dashboard, /WidgetFechamentoPedidos/);
  assert.match(dashboard, /canSeeComercial && \(/);
  assert.match(dashboard, /empresaId=\{empresaAtual\?\.id/);
});

test('recuperação: página DashboardFechamentoPedidos não está vazia e reusa o componente', () => {
  assert.ok(page.trim().length > 0, 'página não pode estar vazia');
  assert.match(page, /from '@\/components\/comercial\/DashboardFechamentoPedidos'/);
  assert.match(page, /w-full h-full/);
});

test('recuperação: rota registrada em pages.config', () => {
  assert.match(pagesConfig, /import DashboardFechamentoPedidos from '\.\/pages\/DashboardFechamentoPedidos'/);
  assert.match(pagesConfig, /"DashboardFechamentoPedidos": DashboardFechamentoPedidos/);
});

test('widget preserva openWindow para o dashboard completo', () => {
  assert.match(widget, /openWindow\(\s*DashboardFechamentoPedidos/);
});

test('widget: pendência/erro distintos de zero (KPI fail-closed)', () => {
  assert.match(widget, /resolveFechamentoKpiState/);
  assert.match(widget, /contagemIndisponivel = kpiState !== 'ready'/);
  assert.match(widget, /kpiState === 'error'/);
  assert.match(widget, /return 'Erro'/);
  assert.match(widget, /kpiState === 'loading'/);
  assert.match(widget, /return '…'/);
  assert.match(widget, /erro de carga ≠ zero/);
  assert.match(widget, /contagens indisponíveis ≠ zero/);
});

test('Dashboard: peels autorizados preservam hash pin do restante', () => {
  let text = readBoundaryRemainder('src/pages/Dashboard.jsx', dashboard.replace(/\r\n/g, '\n'));
  let count = 0;
  text = text.replace(/Number\((otd|aproveitamentoBarra|taxaInadimplencia)\)(?= (?:>=|<) \d)/g, (_, value) => {
    count++;
    return value;
  });
  assert.equal(count, 12);
  const emitted = ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      removeComments: true,
    },
  }).outputText;
  assert.equal(createHash('sha256').update(emitted).digest('hex'), DASHBOARD_PIN);
});
