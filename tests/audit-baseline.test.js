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
