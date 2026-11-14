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
  assert.match(dash, /resolveDashboardCountAfterFailure/);
  assert.match(dash, /dashboardCountSubtitle/);
});

test('LogisticaEntregaTab: seletor recebe groupId/empresaId', () => {
  assert.match(logistica, /groupId=\{groupId\}/);
  assert.match(logistica, /empresaId=\{empresaId\}/);
});

test('Cadastros blocos: data-permission usa seção owner (não entidade solta)', () => {
  const b1 = readFileSync('src/components/cadastros/blocks/Bloco1Pessoas.jsx', 'utf8');
  const b2 = readFileSync('src/components/cadastros/blocks/Bloco2Produtos.jsx', 'utf8');
  const b3 = readFileSync('src/components/cadastros/blocks/Bloco3Financeiro.jsx', 'utf8');
  const b4 = readFileSync('src/components/cadastros/blocks/Bloco4Logistica.jsx', 'utf8');
  const b5 = readFileSync('src/components/cadastros/blocks/Bloco5Organizacional.jsx', 'utf8');
  const b6 = readFileSync('src/components/cadastros/blocks/Bloco6Tecnologia.jsx', 'utf8');
  const perms = readFileSync('src/components/lib/usePermissions.jsx', 'utf8');
  const shell = readFileSync('src/components/layout/AppLayoutShell.jsx', 'utf8');

  assert.match(b1, /Cadastros\.Pessoas\.visualizar/);
  assert.match(b2, /section: "Produtos"/);
  assert.match(b2, /dataPermissionFor\(k\)/);
  assert.doesNotMatch(b2, /data-permission=\{`Cadastros\.\$\{k\}\.visualizar`\}/);
  assert.match(b3, /Cadastros\.Financeiro\.visualizar/);
  assert.match(b4, /Cadastros\.Logistica\.visualizar/);
  assert.match(b5, /section: "Organizacional"/);
  assert.match(b6, /Cadastros\.Tecnologia\.visualizar/);
  assert.match(perms, /setoratividade: 'produtos'/);
  assert.match(perms, /unidademedida: 'produtos'/);
  assert.match(perms, /banco: 'financeiro'/);
  assert.match(perms, /motorista: 'logistica'/);
  assert.match(shell, /data-menu-permissions-loading/);
});
