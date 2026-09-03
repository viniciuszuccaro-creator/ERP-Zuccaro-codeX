import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildInventory, findHistoricalArtifactFiles, isHistoricalArtifact } from '../scripts/audit-baseline.mjs';

test('buildInventory classifies pages, components, functions and risks', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zuccaro-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(path.join(root, 'src', 'pages'), { recursive: true });
  await mkdir(path.join(root, 'src', 'components'), { recursive: true });
  await mkdir(path.join(root, 'base44', 'functions', 'guard'), { recursive: true });
  await mkdir(path.join(root, 'base44', 'entities'), { recursive: true });

  await writeFile(path.join(root, 'src', 'pages', 'Dashboard.jsx'), '<button data-action="open" data-permission="Dashboard.visualizar">Open</button>');
  await writeFile(path.join(root, 'src', 'components', 'Legacy.old.jsx'), `try { throw new Error(); } catch {}\nexport default '${'\u00c3'}';\n${'x\n'.repeat(601)}`);
  await writeFile(path.join(root, 'src', 'components', 'STATUS.md.jsx'), '# Status historico');
  await writeFile(path.join(root, 'base44', 'functions', 'guard', 'entry.ts'), 'export {};');
  await writeFile(path.join(root, 'base44', 'entities', 'config.jsonc'), '{}');

  const inventory = await buildInventory(root);

  assert.equal(inventory.summary.pages, 1);
  assert.equal(inventory.summary.components, 2);
  assert.equal(inventory.summary.functions, 1);
  assert.equal(inventory.summary.entitiesWithLocalSchema, 1);
  assert.equal(inventory.summary.filesOver600Lines, 1);
  assert.equal(inventory.summary.filesWithEncodingMarkers, 1);
  assert.equal(inventory.summary.legacyCandidates, 2);
  assert.equal(inventory.summary.historicalArtifacts, 1);
  assert.equal(inventory.summary.historicalArtifactsImportedByRuntime, 0);
  assert.equal(inventory.summary.interactiveControls, 1);
  assert.equal(inventory.summary.controlsWithActionMarker, 1);
  assert.equal(inventory.summary.controlsWithPermissionMarker, 1);
  assert.equal(inventory.summary.operationalEmptyCatches, 1);
  assert.deepEqual(inventory.priorities.emptyCatchFiles, [
    { path: 'src/components/Legacy.old.jsx', count: 1 },
  ]);
});

test('historical artifacts stay inventoried and are identified for operational validation', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zuccaro-artifacts-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(path.join(root, 'src', 'components', 'reports'), { recursive: true });
  await writeFile(path.join(root, 'src', 'components', 'README.md.jsx'), '# Documento');
  await writeFile(path.join(root, 'src', 'components', 'CERTIFICADO.jsx'), '# Certificado');
  await writeFile(path.join(root, 'src', 'components', 'Componente.jsx'), 'export default function Componente() { return null; }');
  await writeFile(path.join(root, 'src', 'components', 'reports', 'rhf_zod_report.jsx'), '{"summary":{}}');

  assert.equal(isHistoricalArtifact('src/components/README.md.jsx', 'export default null;'), true);
  assert.deepEqual(await findHistoricalArtifactFiles(root), [
    'src/components/CERTIFICADO.jsx',
    'src/components/README.md.jsx',
    'src/components/reports/rhf_zod_report.jsx',
  ]);
});

test('sensitive intercompany persistence keeps group scope and summarized auditing', async () => {
  const transferSource = await readFile(new URL('../base44/functions/intercompanyTransfer/entry.ts', import.meta.url), 'utf8');
  const conflictSource = await readFile(new URL('../base44/functions/conflictPolicy/entry.ts', import.meta.url), 'utf8');

  assert.match(transferSource, /fromGroupId !== toGroupId/);
  assert.match(transferSource, /group_id: groupId/);
  assert.match(transferSource, /requireEntityGuard/);
  assert.doesNotMatch(conflictSource, /dados_anteriores:\s*current/);
  assert.match(conflictSource, /total_campos_alterados/);
});

test('group company synchronization fails closed outside the resolved scope', async () => {
  const syncSource = await readFile(new URL('../base44/functions/syncGroupCompany/entry.ts', import.meta.url), 'utf8');

  assert.match(syncSource, /DEPLOY_AUDIT_TOKEN/);
  assert.match(syncSource, /internal automation token required/);
  assert.match(syncSource, /requireEntityGuard/);
  assert.match(syncSource, /recordMatchesGuardScope/);
  assert.match(syncSource, /SyncMap\.filter\(\{[\s\S]*?entity_name: entityName,[\s\S]*?group_id: groupId/);
  assert.match(syncSource, /Empresa fora do grupo informado/);
  assert.match(syncSource, /companies_total/);
  assert.doesNotMatch(syncSource, /Empresa\.filter\(\{ status: 'Ativa' \}\)/);
  assert.doesNotMatch(syncSource, /note: 'no scope'/);
  assert.doesNotMatch(syncSource, /catch \(_\) \{\}/);
});

test('multi-company backfill only scans the resolved group and known entities', async () => {
  const backfillSource = await readFile(new URL('../base44/functions/backfillGroupEmpresa/entry.ts', import.meta.url), 'utf8');
  const adminSource = await readFile(new URL('../src/components/administracao-sistema/AdminTabs.jsx', import.meta.url), 'utf8');

  assert.match(backfillSource, /DEPLOY_AUDIT_TOKEN/);
  assert.match(backfillSource, /requireEntityGuard/);
  assert.match(backfillSource, /ALLOWED_ENTITIES/);
  assert.match(backfillSource, /READ_ONLY_ENTITIES = new Set\(\['NotaFiscal'\]\)/);
  assert.match(backfillSource, /Empresa\.filter\(\{ group_id: scope\.groupId \}/);
  assert.match(backfillSource, /entityApi\.filter\(\{ \[companyField\]: empresa\.id \}/);
  assert.match(backfillSource, /Empresa fora do grupo informado/);
  assert.doesNotMatch(backfillSource, /\.filter\(\{\}, '-updated_date'/);
  assert.doesNotMatch(backfillSource, /catch \(_\)|catch \{\}/);
  assert.match(adminSource, /backfillGroupEmpresa'[\s\S]*?group_id: grupoId, empresa_id: empresaId/);
});

test('multi-company seed requires explicit scope or controlled empty initialization', async () => {
  const seedSource = await readFile(new URL('../base44/functions/seedMultiCompanyData/entry.ts', import.meta.url), 'utf8');

  assert.match(seedSource, /DEPLOY_AUDIT_TOKEN/);
  assert.match(seedSource, /requireEntityGuard/);
  assert.match(seedSource, /group_id obrigatorio para seed multiempresa/);
  assert.match(seedSource, /initialize_if_empty/);
  assert.match(seedSource, /Inicializacao exige token interno/);
  assert.match(seedSource, /Empresa\.filter\(\{ group_id: groupId \}/);
  assert.match(seedSource, /Empresa fora do grupo informado/);
  assert.match(seedSource, /normalizeCount\(body\?\.empresas, minimal \? 1 : 3, 20\)/);
  assert.match(seedSource, /internal_token: Deno\.env\.get\('DEPLOY_AUDIT_TOKEN'\)/);
  assert.doesNotMatch(seedSource, /comGrupo\[0\]/);
  assert.doesNotMatch(seedSource, /catch \(_\)|catch \{\}|catch\(\(\) => \{\}\)/);
});

test('administrative seed requires explicit multi-company scope and safe auditing', async () => {
  const seedSource = await readFile(new URL('../base44/functions/seedData/entry.ts', import.meta.url), 'utf8');
  const adminSource = await readFile(new URL('../src/components/administracao-sistema/AdminTabs.jsx', import.meta.url), 'utf8');

  assert.match(seedSource, /DEPLOY_AUDIT_TOKEN/);
  assert.match(seedSource, /completeGuardCallScope/);
  assert.match(seedSource, /requireEntityGuard/);
  assert.match(seedSource, /group_id obrigatorio para seed/);
  assert.match(seedSource, /empresa_id obrigatorio para seed/);
  assert.match(seedSource, /Empresa\.filter\(\{ group_id: resolvedScope\.groupId \}/);
  assert.match(seedSource, /Empresa fora do grupo informado/);
  assert.match(seedSource, /normalizeCount\(counts\?\.clientes, 5\)/);
  assert.match(seedSource, /internal_token: Deno\.env\.get\('DEPLOY_AUDIT_TOKEN'\)/);
  assert.doesNotMatch(seedSource, /Empresa\.list\('-updated_date', 1\)/);
  assert.doesNotMatch(seedSource, /GrupoEmpresarial\.create/);
  assert.doesNotMatch(seedSource, /dados_novos: raw|stack: error\?\.stack/);
  assert.doesNotMatch(seedSource, /catch \(_\)|catch \{\}|catch\(\(\) => \{\}\)/);
  assert.match(adminSource, /seedData'[\s\S]*?group_id: grupoId,[\s\S]*?empresa_id: empresaId/);
});

test('administrative tools align granular RBAC, group propagation and dry-run safety', async () => {
  const adminSource = await readFile(new URL('../src/components/administracao-sistema/AdminTabs.jsx', import.meta.url), 'utf8');
  const seedSource = await readFile(new URL('../base44/functions/seedData/entry.ts', import.meta.url), 'utf8');
  const backfillSource = await readFile(new URL('../base44/functions/backfillGroupEmpresa/entry.ts', import.meta.url), 'utf8');

  assert.match(adminSource, /canAccessFerramentas = canAccess\("Ferramentas"\)/);
  assert.match(adminSource, /podeExecutarFerramenta = isAdminUser \|\| hasPermission\("Sistema", "Ferramentas", "executar"\)/);
  assert.match(adminSource, /podeEditarFerramenta = isAdminUser \|\| hasPermission\("Sistema", "Ferramentas", "editar"\)/);
  assert.match(adminSource, /multiCompany: !empresaId/);
  assert.match(adminSource, /ultimoDryRunContexto !== contextoKey/);
  assert.match(adminSource, /data-permission="Sistema\.Ferramentas\.editar"/);
  assert.doesNotMatch(adminSource, /dadosNovos: \{ payload, summary:/);
  assert.doesNotMatch(seedSource, /user && user\.role !== 'admin'/);
  assert.doesNotMatch(backfillSource, /user && user\.role !== 'admin'/);
  assert.match(seedSource, /requireEntityGuard[\s\S]*?section: 'Ferramentas'/);
  assert.match(backfillSource, /requireEntityGuard[\s\S]*?section: 'Ferramentas'/);
});

test('generic read callers send canonical group and company context', async () => {
  const layoutSource = await readFile(new URL('../src/Layout.jsx', import.meta.url), 'utf8');
  const statusSource = await readFile(new URL('../src/components/administracao-sistema/AdminStatusBar.jsx', import.meta.url), 'utf8');
  const sortedHookSource = await readFile(new URL('../src/components/lib/useEntityListSorted.jsx', import.meta.url), 'utf8');
  const viewerSource = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');

  assert.match(layoutSource, /getEntityRecord'[\s\S]*?group_id: empresaAtual\?\.group_id[\s\S]*?empresa_id: empresaAtual\?\.id/);
  assert.match(statusSource, /getEntityRecord"[\s\S]*?group_id: gId \|\| null,[\s\S]*?empresa_id: eId \|\| null/);
  assert.doesNotMatch(statusSource, /catch \(_\)/);
  assert.match(sortedHookSource, /entityListSorted"[\s\S]*?group_id: grupoAtual\?\.id[\s\S]*?empresa_id: empresaAtual\?\.id/);
  assert.equal((viewerSource.match(/entityListSorted"/g) || []).length >= 2, true);
  assert.equal((viewerSource.match(/group_id: groupId,/g) || []).length >= 2, true);
  assert.equal((viewerSource.match(/empresa_id: empresaId,/g) || []).length >= 2, true);
});

test('integration toggles reflect persisted state and enforce the real write permission', async () => {
  const source = await readFile(new URL('../src/components/integracoes/CentralIntegracoes.jsx', import.meta.url), 'utf8');

  assert.match(source, /operacao = existentes\?\.length \? "editar" : "criar"/);
  assert.match(source, /operacao === "editar" \? podeEditarIntegracoes : podeCriarIntegracoes/);
  assert.match(source, /updateInContext\("ConfiguracaoSistema", existentes\[0\]\.id, payload\)/);
  assert.doesNotMatch(source, /updateInContext\("ConfiguracaoSistema", existentes\[0\]\.id, \{ \.\.\.existentes\[0\]/);
  assert.match(source, /cfgIntegracoes \? !podeEditarIntegracoes : !podeCriarIntegracoes/);
  assert.match(source, /data-permission=\{cfgIntegracoes \? "Sistema\.Integracoes\.editar" : "Sistema\.Integracoes\.criar"\}/);
  assert.equal((source.match(/status: "Inativo"/g) || []).length >= 3, true);
  assert.match(source, /auditarIntegracao\(\{ acao: "Erro ao salvar"/);
  assert.doesNotMatch(source, /Erro ao salvar integracao", description: String\(error/);
});

test('integration administration keeps explicit context and summarized audits', async () => {
  const source = await readFile(new URL('../src/components/administracao-sistema/IntegracoesIndex.jsx', import.meta.url), 'utf8');

  assert.match(source, /SENSITIVE_AUDIT_KEY/);
  assert.match(source, /empresa_id: empresaAtual.id, group_id: grupoAtivoId \|\| null/);
  assert.match(source, /const contextoValido = !!grupoAtivoId/);
  assert.match(source, /enabled: contextoValido && !!integracoesKey/);
  assert.match(source, /group_id: grupoAtivoId \|\| null,[\s\S]*?empresa_id: empresaAtual\?\.id \|\| null,[\s\S]*?filter: \{ chave: integracoesKey, \.\.\.scope \}/);
  assert.doesNotMatch(source, /\.catch\(\(\) => null\)|catch \{\}|catch \(_\)/);
  assert.doesNotMatch(source, /dadosNovos: payload|dadosNovos: \{ webhookUrl: text \}/);
  assert.match(source, /dadosNovos: \{ operacao: "criar_base", categoria: "Integracoes"/);
  assert.match(source, /dadosNovos: \{ provider: "asaas", evento: "payment_received", simulacao: true \}/);
  assert.match(source, /dadosNovos: \{ provider: "enotas", evento: "nfe_authorized", simulacao: true \}/);
  assert.match(source, /acao: "Erro ao consultar"/);
  assert.match(source, /acao: "Erro Copiar URL Webhook"/);
  assert.doesNotMatch(source, /description: String\(err\?\.message \|\| err\)/);
});

test('integration status enforces scope, RBAC and credential-free results', async () => {
  const statusSource = await readFile(new URL('../src/components/integracoes/StatusIntegracoes.jsx', import.meta.url), 'utf8');
  const nfeSource = await readFile(new URL('../src/components/lib/integracaoNFe.jsx', import.meta.url), 'utf8');
  const boletoSource = await readFile(new URL('../src/components/lib/integracaoBoletos.jsx', import.meta.url), 'utf8');
  const whatsappSource = await readFile(new URL('../src/components/lib/integracaoWhatsApp.jsx', import.meta.url), 'utf8');
  const buttonsSource = await readFile(new URL('../src/components/integracoes/IntegrationConfigButtons.jsx', import.meta.url), 'utf8');

  assert.match(statusSource, /empresa_id: empresaId, group_id: groupId \|\| null/);
  assert.match(buttonsSource, /empresa_id: empresaId, group_id: groupId \|\| null/);
  assert.match(buttonsSource, /data-permission="Sistema\.Integracoes\.executar"/);
  assert.match(buttonsSource, /Sistema\.Integracoes\.criar\|Sistema\.Integracoes\.editar/);
  assert.match(buttonsSource, /operacao === 'editar' \? podeEditar : podeCriar/);
  assert.match(buttonsSource, /updateInContext\('ConfiguracaoSistema', existentes\[0\]\.id, payload\)/);
  assert.doesNotMatch(buttonsSource, /\.\.\.existentes\[0\]|description: error\.message/);
  assert.match(statusSource, /summarizeIntegrationStatus/);
  assert.match(statusSource, /setStatusNFe\(null\)[\s\S]*?setStatusBoleto\(null\)[\s\S]*?setStatusWhatsApp\(null\)/);
  assert.match(statusSource, /className="w-full h-full space-y-6"/);

  for (const source of [nfeSource, boletoSource, whatsappSource]) {
    assert.match(source, /verificarConfiguracao\(empresaId, groupId\)/);
    assert.match(source, /empresa_id: scopedEmpresaId, group_id: scopedGroupId/);
  }
  assert.match(whatsappSource, /verificarConexao\(empresaId, groupId\)[\s\S]*?verificarConfiguracao\(empresaId, groupId\)/);
  assert.doesNotMatch(whatsappSource, /invoke\('whatsappSend', \{ action: 'status'/);
});

test('technical integration tests require execution permission and safe auditing', async () => {
  const files = ['TesteNFe.jsx', 'TesteBoletos.jsx', 'TesteTransportadoras.jsx', 'TesteGoogleMaps.jsx'];
  const sources = await Promise.all(files.map((file) => readFile(new URL(`../src/components/integracoes/${file}`, import.meta.url), 'utf8')));

  for (const source of sources) {
    assert.match(source, /const contextoValido = Boolean\(groupId\)/);
    assert.match(source, /hasPermission\("Sistema", "Integracoes", "executar"\)/);
    assert.match(source, /data-permission="Sistema\.Integracoes\.executar"/);
    assert.match(source, /sucesso: !\/\^\(Bloqueio\|Erro\)\//);
    assert.match(source, /w-full h-full space-y-4/);
    assert.doesNotMatch(source, /mensagem: error\.message|description: error\.message|erro: error\.message/);
  }

  const [nfe, boletos, transportadoras, maps] = sources;
  assert.match(nfe, /onClick=\{\(\) => abrirDocumento\(resultado\.xml_url, 'xml'\)\}/);
  assert.match(nfe, /onClick=\{\(\) => abrirDocumento\(resultado\.pdf_url, 'danfe'\)\}/);
  assert.doesNotMatch(nfe, /pedido_teste: pedidoTeste/);
  assert.match(boletos, /onClick=\{abrirBoleto\}/);
  assert.match(boletos, /await navigator\.clipboard\.writeText/);
  assert.doesNotMatch(boletos, /cliente_teste: clienteTeste|cliente: boletoSimulado\.cliente/);
  assert.match(transportadoras, /origem_informada: Boolean\(cepOrigem\)/);
  assert.match(maps, /endereco_informado: Boolean\(enderecoTeste\)/);
});


test('WhatsApp and marketplace integrations keep strict scope RBAC and safe audits', async () => {
  const whatsapp = await readFile(new URL('../src/components/integracoes/ConfigWhatsAppBusiness.jsx', import.meta.url), 'utf8');
  const marketplace = await readFile(new URL('../src/components/integracoes/SincronizacaoMarketplacesAtiva.jsx', import.meta.url), 'utf8');
  const marketplaceTable = await readFile(new URL('../src/components/integracoes/MarketplacePendingOrders.jsx', import.meta.url), 'utf8');

  assert.match(whatsapp, /const contextoValido = Boolean\(groupId\)/);
  assert.match(whatsapp, /operacaoSalvar = configSalva\?\.id \? 'editar' : 'criar'/);
  assert.match(whatsapp, /hasPermission\("Sistema", "Integracoes", "executar"\)/);
  assert.match(whatsapp, /data-permission="Sistema\.Integracoes\.executar"/);
  assert.match(whatsapp, /token_configurado: Boolean\(configuracaoSegura\.api_token\)/);
  assert.match(whatsapp, /setConfig\(configInicial\)/);
  assert.match(whatsapp, /w-full h-full space-y-6/);
  assert.doesNotMatch(whatsapp, /dadosNovos.*payload|numero_whatsapp: config\.numero_whatsapp|erro: error\.message|description: error\.message/);

  assert.match(marketplace, /const contextoValido = Boolean\(groupId && empresaId\)/);
  assert.match(marketplace, /const podeImportar = podeCriar && podeEditar/);
  assert.match(marketplace, /pedidoExterno\?\.group_id === groupId && pedidoExterno\?\.empresa_id === empresaId/);
  assert.match(marketplace, /filterInContext\('Pedido', \{ origem_externa_id: pedidoExterno\.id_externo \}/);
  assert.match(marketplace, /filterInContext\('Cliente', \{ id: clienteId \}/);
  assert.match(marketplace, /documento\.length === 11 \? 'Pessoa Física' : 'Pessoa Jurídica'/);
  assert.match(marketplace, /finally \{[\s\S]*?setSincronizando\(false\)/);
  assert.match(marketplace, /encodeURIComponent\(String\(pedidoExterno\.id_externo\)\)/);
  assert.match(marketplace, /'noopener,noreferrer'/);
  assert.match(marketplace, /w-full h-full space-y-4/);
  assert.doesNotMatch(marketplace, /json_completo: pedido|\}, pedidoExterno\);|description: error\.message/);
  assert.match(marketplaceTable, /data-permission="Sistema\.Integracoes\.criar\|Sistema\.Integracoes\.editar"/);
  assert.match(marketplaceTable, /data-permission="Sistema\.Integracoes\.visualizar"/);
});


test('remaining WhatsApp and marketplace controls persist safely with action RBAC', async () => {
  const whatsapp = await readFile(new URL('../src/components/integracoes/TesteWhatsApp.jsx', import.meta.url), 'utf8');
  const marketplace = await readFile(new URL('../src/components/integracoes/SincronizacaoMarketplaces.jsx', import.meta.url), 'utf8');

  assert.match(whatsapp, /const contextoValido = Boolean\(groupId\)/);
  assert.match(whatsapp, /hasPermission\("Sistema", "Integracoes", "executar"\)/);
  assert.equal((whatsapp.match(/data-permission="Sistema\.Integracoes\.executar"/g) || []).length, 4);
  assert.match(whatsapp, /telefone_informado: Boolean\(telefoneNormalizado\)/);
  assert.match(whatsapp, /setTelefone\(''\)[\s\S]*?setResultado\(null\)/);
  assert.match(whatsapp, /w-full h-full space-y-4/);
  assert.doesNotMatch(whatsapp, /auditarWhatsApp\([^;]*telefone: telefoneNormalizado|description: error\.message/);

  assert.match(marketplace, /const contextoValido = Boolean\(groupId && empresaId\)/);
  assert.match(marketplace, /filterInContext\('ConfiguracaoIntegracaoMarketplace'/);
  assert.match(marketplace, /updateInContext\('ConfiguracaoIntegracaoMarketplace'/);
  assert.match(marketplace, /createInContext\('ConfiguracaoIntegracaoMarketplace'/);
  assert.match(marketplace, /operacao === 'editar' \? podeEditar : podeCriar/);
  assert.match(marketplace, /hasPermission\('Sistema', 'Integracoes', 'executar'\)/);
  assert.match(marketplace, /data-permission="Sistema\.Integracoes\.executar"/);
  assert.match(marketplace, /data-permission=\{`Sistema\.Integracoes\.\$\{operacao\}`\}/);
  assert.match(marketplace, /entidade = 'PedidoExterno'/);
  assert.match(marketplace, /'ConfiguracaoIntegracaoMarketplace',[\s\S]*?existente\?\.id \|\| null/);
  assert.match(marketplace, /dados_anteriores: dadosAnteriores/);
  assert.match(marketplace, /w-full h-full space-y-6/);
  assert.doesNotMatch(marketplace, /description: error\.message|bg-\$\{mp\.cor\}|text-\$\{mp\.cor\}/);
});
