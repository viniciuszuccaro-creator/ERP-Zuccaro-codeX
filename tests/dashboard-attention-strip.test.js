/**
 * Faixa de atenção operacional do Dashboard (atrasados / expedir / receber).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('DashboardAttentionStrip: fail-closed + drill-down + zero confirmado', async () => {
  const src = await readFile(new URL('../src/components/dashboard/DashboardAttentionStrip.jsx', import.meta.url), 'utf8');
  assert.match(src, /data-block="dashboard-attention-strip"/);
  assert.match(src, /hasContextoAtivo/);
  assert.match(src, /Dashboard\.atencao\.aprovacao/);
  assert.match(src, /Dashboard\.atencao\.expedicao/);
  assert.match(src, /Dashboard\.atencao\.receber/);
  assert.match(src, /zero confirmado/);
  assert.match(src, /Sem permissão Comercial\/Expedição\/Financeiro/);
  assert.match(src, /periodoLabel/);
  assert.match(src, /escopoLabel/);
});

test('Dashboard.jsx monta AttentionStrip com escopo e entregas', async () => {
  const dash = await readFile(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
  assert.match(dash, /DashboardAttentionStrip/);
  assert.match(dash, /aprovacaoCount=/);
  assert.match(dash, /prontoExpedirCount=/);
  assert.match(dash, /createPageUrl\('Expedicao'\)/);
  assert.match(dash, /createPageUrl\('Financeiro'\)/);
});
