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
  assert.match(dash, /totalPedidosDisplay/);
  assert.match(dash, /pedidos-count-dash/);
  assert.match(dash, /não fabricar zero/);
  assert.match(dash, /resolveDashboardCountAfterFailure/);
  assert.match(dash, /dashboardCountSubtitle/);
  assert.match(dash, /hasContext: Boolean\(hasContextoAtivo\)/);
  assert.match(dash, /allowed: Boolean\(canSeeEstoque\)/);
  assert.match(dash, /allowed: Boolean\(canSeeComercial\)/);
  assert.doesNotMatch(dash, /title: "Total Pedidos",\s*value: pedidos\.length/);
  assert.match(dash, /amostra carregada · ≠ total global confirmado/);
});

test('DashboardCorporativo: count fail-closed (— ≠ 0; sem || length)', () => {
  const corp = readFileSync('src/pages/DashboardCorporativo.jsx', 'utf8');
  assert.match(corp, /resolveDashboardCountAfterFailure/);
  assert.match(corp, /formatDashboardCountDisplay/);
  assert.match(corp, /dashboardCountSubtitle/);
  assert.match(corp, /data-corp-count="clientes"/);
  assert.match(corp, /data-corp-count="produtos"/);
  assert.doesNotMatch(corp, /response\.data\?\.count \|\| (clientes|produtos)\.length/);
  assert.doesNotMatch(corp, /catch \{\s*return (clientes|produtos)\.length;/);
});

test('DashboardCorporativo: cards Ativos usam ativo HTTP + cap na lista bruta (Bugbot)', () => {
  const corp = readFileSync('src/pages/DashboardCorporativo.jsx', 'utf8');
  assert.match(corp, /clientes-count-corp-ativos/);
  assert.match(corp, /produtos-count-corp-ativos/);
  assert.match(corp, /dashboardAtivosCountFilter\('Cliente'/);
  assert.match(corp, /dashboardAtivosCountFilter\('Produto'/);
  assert.match(corp, /resolveHttpPilotEntities/);
  assert.match(corp, /isDashboardCadastroAtivo/);
  assert.match(corp, /isCappedListUnreliable\(rawList\)/);
  assert.match(corp, /listCapped \? \[\] : rawList\.filter\(isDashboardCadastroAtivo\)/);
  assert.doesNotMatch(corp, /ativo: true, status: 'Ativo'/);
});

test('FormasPagamentoPedido: Cadastros canônicos sem mock/fixture', () => {
  const formas = readFileSync('src/components/comercial/FormasPagamentoPedido.jsx', 'utf8');
  assert.match(formas, /useFormasPagamento/);
  assert.match(formas, /data-block="formas-pagamento-pedido-canonico"/);
  assert.match(formas, /data-formas-state="falha"/);
  assert.match(formas, /formatMasterCodigoLabel/);
  assert.doesNotMatch(formas, /base44\.entities\.FormaPagamento\.list/);
  assert.doesNotMatch(formas, /id: "1", tipo: "À Vista"/);
  assert.doesNotMatch(formas, /const useQuery = \(\{ queryKey, queryFn \}\) =>/);
  assert.match(formas, /if \(loadingFormas \|\| formasLoadFailed\) return/);
  assert.match(formas, /if \(!formaSelecionada\) return/);
  assert.match(formas, /preserveSavedScheduleRef/);
});

test('Dashboard Clientes KPI: uma população (count), sem misturar ativos da amostra', () => {
  assert.match(dash, /clientesKpiDisplay/);
  assert.match(dash, /title: "Clientes"/);
  assert.doesNotMatch(dash, /clientesAtivosDisplay/);
  assert.doesNotMatch(
    dash,
    /totalClientesResolved\?\.confiavel\s*\?\s*totalClientesDisplay\s*:\s*formatDashboardCountDisplay\(clientesAtivosResolved\)/,
  );
});

test('DashboardCanaisOrigem: KPI fail-closed (— ≠ 0; amostra capada)', async () => {
  const {
    formatCanaisOrigemKpiDisplay,
    CANAIS_ORIGEM_PEDIDOS_SOFT_LIMIT,
  } = await import('../src/components/lib/dashboardKpiPolicy.js');
  assert.equal(formatCanaisOrigemKpiDisplay({ blocked: true, value: 0 }), '—');
  assert.equal(formatCanaisOrigemKpiDisplay({ blocked: false, value: 0 }), '0');
  assert.equal(formatCanaisOrigemKpiDisplay({ blocked: false, value: null }), '—');
  assert.equal(CANAIS_ORIGEM_PEDIDOS_SOFT_LIMIT, 500);
  const src = readFileSync('src/components/cadastros/DashboardCanaisOrigem.jsx', 'utf8');
  assert.match(src, /isCappedListUnreliable/);
  assert.match(src, /formatCanaisOrigemKpiDisplay/);
  assert.match(src, /metricsBlocked/);
  assert.match(src, /canais-origem-amostra-capada/);
  assert.match(src, /queriesEnabled && \(loadingParametros \|\| loadingPedidos\)/);
  assert.match(src, /parametrosList\.filter\(p => !p\.ativo\)/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.doesNotMatch(src, /parametros\.filter\(p => !p\.ativo\)/);
});

test('Central360: pagamento-resumo usa labels de condição hidratados', () => {
  const shell = readFileSync('src/components/comercial/CentralVendas360Shell.jsx', 'utf8');
  const pedido = readFileSync('src/components/comercial/PedidoCanonicoPanel.jsx', 'utf8');
  const orc = readFileSync('src/components/comercial/OrcamentosTab.jsx', 'utf8');
  assert.match(shell, /central360-pagamento-resumo/);
  assert.match(shell, /central360-pagamento-itens/);
  assert.match(shell, /CondicaoComercial/);
  assert.match(shell, /tabela_preco_codigo/);
  assert.match(shell, /partitionCentralItens\(selected\.itens\)/);
  assert.match(pedido, /condicao_pagamento_label/);
  assert.match(pedido, /condicao_pagamento_codigo/);
  assert.match(pedido, /tabela_preco_label/);
  assert.match(orc, /condicao_pagamento_label/);
  assert.match(orc, /tabela_preco_label/);
  assert.match(pedido, /numero_pedido:selected\.numero/);
});

test('OrcamentosTab Bugbot: epochAtClick no select + submitting após invalidate situação', () => {
  const orc = readFileSync('src/components/comercial/OrcamentosTab.jsx', 'utf8');
  assert.match(orc, /const epochAtClick = selectionEpochLiveRef\.current/);
  assert.match(orc, /notifyCentralSelect\(detail, epochAtClick\)/);
  // Epoch no GET compartilhado (select + dblclick) — não aborta grades/pagamento-resumo.
  assert.match(orc, /epochAtClick != null && epochAtClick !== selectionEpochLiveRef\.current/);
  assert.match(orc, /detailInflightRef/);
  assert.match(orc, /fetchOrcamentoDetail/);
  assert.match(orc, /actionGate\.current\.invalidate\(\);\s*\n\s*setSubmitting\(false\)/);
});

test('LogisticaEntregaTab: seletor recebe groupId/empresaId', () => {
  assert.match(logistica, /groupId=\{resolvedGroupId\}/);
  assert.match(logistica, /empresaId=\{resolvedEmpresaId\}/);
  assert.match(logistica, /endereco \|\| \{\}/);
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
