/**
 * Lote HML UX — estados de contagem Cadastros + dashboard fail-closed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const cadastros = readFileSync('src/pages/Cadastros.jsx', 'utf8');
const badge = readFileSync('src/components/cadastros/CountBadgeSimplificado.jsx', 'utf8');
const core = readFileSync('src/components/cadastros/hooks/cadastrosAllCountsCore.js', 'utf8');
const dash = readFileSync('src/pages/Dashboard.jsx', 'utf8');
const logistica = readFileSync('src/components/comercial/LogisticaEntregaTab.jsx', 'utf8');

test('Cadastros: banners loading / unavailable / partial distintos', () => {
  assert.match(cadastros, /data-counts-loading/);
  assert.match(cadastros, /data-counts-unavailable/);
  assert.match(cadastros, /data-counts-partial/);
  assert.match(cadastros, /Carregando contagens dos cadastros/);
  assert.match(cadastros, /não<\/strong> significa/);
  assert.match(cadastros, /cadastros estejam vazios/);
  assert.match(cadastros, /SetorAtividade, GrupoProduto, Marca, UnidadeMedida/);
});

test('CountBadge: estados loading|unavailable|zero|ready', () => {
  assert.match(badge, /data-count-state=\{state\}/);
  assert.match(badge, /Zero confirmado neste contexto/);
  assert.match(badge, /não é zero confirmado/);
});

test('AllCounts: sem contexto não fabricar zeros', () => {
  assert.match(core, /throw new Error\('READ_COUNT_UNAVAILABLE'\)/);
  assert.doesNotMatch(
    core,
    /if \(!empresaId && !groupId\) \{\s*return emptyCadastrosCounts/,
  );
});

test('Dashboard: contagens usam formatDashboardCountDisplay (— ≠ 0 falso)', () => {
  assert.match(dash, /formatDashboardCountDisplay/);
  assert.match(dash, /totalProdutosDisplay/);
  assert.match(dash, /não fabricar zero/);
});

test('LogisticaEntregaTab: seletor recebe groupId/empresaId', () => {
  assert.match(logistica, /groupId=\{groupId\}/);
  assert.match(logistica, /empresaId=\{empresaId\}/);
});
