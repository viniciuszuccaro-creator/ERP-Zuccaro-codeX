import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  carregarStagingIsoladoLegado,
  STAGING_LOADER_VERSION,
  toCentavos,
} from '../scripts/legado/carregar-staging-isolado-legado.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contratoPath = path.join(root, 'fixtures/legado/vinculos-juridicos-sinteticos/contrato-aliases-aprovados.json');
const lotePath = path.join(root, 'fixtures/legado/staging-isolado-sintetico/lote-staging.json');
const script = path.join(root, 'scripts/legado/carregar-staging-isolado-legado.mjs');

const contrato = () => JSON.parse(fs.readFileSync(contratoPath, 'utf8'));
const lote = () => JSON.parse(fs.readFileSync(lotePath, 'utf8'));

test('toCentavos converte string decimal sem float', () => {
  assert.equal(toCentavos('100.50'), 10050);
  assert.equal(toCentavos('50.00'), 5000);
  assert.equal(toCentavos('0.01'), 1);
  assert.equal(toCentavos('bad'), null);
});

test('staging isolado carrega comprovados, quarentena sem prova e nega import', () => {
  const L = lote();
  const report = carregarStagingIsoladoLegado({
    contrato: contrato(),
    itens: L.itens,
    groupId: L.groupId,
    totaisEsperadosCentavos: L.totaisEsperadosCentavos,
    stagingPrepAuthorized: true,
  });

  assert.equal(report.loaderVersion, STAGING_LOADER_VERSION);
  assert.equal(report.importAuthorized, false);
  assert.equal(report.operationalLoadAuthorized, false);
  assert.equal(report.blockedRealHdExtract, true);
  assert.equal(report.relatorio.origem, 8);
  assert.equal(report.relatorio.carregados, 4); // cliente, produto, ped CPA, ped 3Z
  assert.equal(report.relatorio.reusos, 1);
  assert.equal(report.relatorio.conflitos, 1);
  assert.equal(report.relatorio.quarentena, 2); // NF grupo + EMP03
  assert.equal(report.relatorio.monetary.porEmpresaCentavos.DEST_CPA_FERRO_E_ACO, 10050);
  assert.equal(report.relatorio.monetary.porEmpresaCentavos.DEST_3Z_LTDA, 5000);
  assert.equal(report.relatorio.monetary.totalDiffCentavos, 0);
  assert.equal(report.relatorio.monetary.reconciliado, true);
  assert.ok(report.relatorio.porMotivo.codigo_grupo_nao_e_emissor >= 1
    || report.relatorio.porMotivo.inferencia_somente_pasta >= 1);
  for (const p of report.privados) {
    assert.equal(p.importAuthorized, false);
    assert.equal(p.destino_migracao, 'staging');
  }
});

test('sem stagingPrepAuthorized falha fechado', () => {
  const L = lote();
  assert.throws(
    () => carregarStagingIsoladoLegado({
      contrato: contrato(),
      itens: L.itens.slice(0, 1),
      groupId: L.groupId,
      stagingPrepAuthorized: false,
    }),
    /LEGACY_STAGING_PREP_UNAUTHORIZED/,
  );
});

test('diferenca monetaria em centavos e reportada por empresa', () => {
  const L = lote();
  const report = carregarStagingIsoladoLegado({
    contrato: contrato(),
    itens: L.itens,
    groupId: L.groupId,
    totaisEsperadosCentavos: {
      DEST_CPA_FERRO_E_ACO: 10000, // espera 100.00; observado 100.50 → +50
      DEST_3Z_LTDA: 5000,
    },
    stagingPrepAuthorized: true,
  });
  assert.equal(report.relatorio.monetary.diferencasCentavos.DEST_CPA_FERRO_E_ACO, 50);
  assert.equal(report.relatorio.monetary.diferencasCentavos.DEST_3Z_LTDA, 0);
  assert.equal(report.relatorio.monetary.totalDiffCentavos, 50);
  assert.equal(report.relatorio.monetary.reconciliado, false);
  assert.equal(report.importAuthorized, false);
  assert.ok(report.relatorio.porMotivo.diferenca_monetaria_centavos >= 1);
});

test('dependencia ausente bloqueia carga do lote apto', () => {
  const report = carregarStagingIsoladoLegado({
    contrato: contrato(),
    groupId: 'grupo-cpa-sintetico',
    stagingPrepAuthorized: true,
    itens: [{
      entidade: 'pedido',
      codigoLegado: 'PED-ORFAO',
      codigoEmpresaLegado: '001',
      assinaturaOrigem: 'a'.repeat(64),
      valorTotal: '10.00',
      dependencias: [{ entidade: 'cliente', codigoLegado: 'CLI-INEXISTENTE', escopo: 'grupo' }],
    }],
  });
  assert.equal(report.relatorio.carregados, 0);
  assert.ok(report.relatorio.porMotivo.dependencia_nao_comprovada >= 1);
  assert.equal(report.importAuthorized, false);
});

test('contrato com importAuthorized true e rejeitado', () => {
  const c = contrato();
  c.importAuthorized = true;
  assert.throws(
    () => carregarStagingIsoladoLegado({
      contrato: c,
      groupId: 'g',
      stagingPrepAuthorized: true,
      itens: [{ entidade: 'cliente', codigoLegado: 'X', assinaturaOrigem: 'b'.repeat(64) }],
    }),
    /LEGACY_STAGING_CONTRATO_IMPORT_FLAG/,
  );
});

test('CLI do lote sai 0, contagens e sem PII', () => {
  const run = spawnSync(process.execPath, [
    script, '--contrato', contratoPath, '--lote', lotePath,
  ], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /"carregados": 4/);
  assert.match(run.stdout, /"quarentena": 2/);
  assert.match(run.stdout, /"importAuthorized": false/);
  assert.match(run.stdout, /"totalDiffCentavos": 0/);
  assert.doesNotMatch(run.stdout + run.stderr, /@cpa|password|Bearer |DELL-VINI/i);
});

test('fixture lote nao contem PII tipica', () => {
  const blob = fs.readFileSync(lotePath, 'utf8');
  assert.match(blob, /"synthetic": true/);
  assert.doesNotMatch(blob, /@cpa|cpf|senha|password|Bearer /i);
});
