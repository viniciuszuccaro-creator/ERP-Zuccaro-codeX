import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.jsx', 'utf8');
const page = readFileSync('src/pages/DashboardFechamentoPedidos.jsx', 'utf8');
const pagesConfig = readFileSync('src/pages.config.js', 'utf8');
const widget = readFileSync('src/components/comercial/WidgetFechamentoPedidos.jsx', 'utf8');

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
