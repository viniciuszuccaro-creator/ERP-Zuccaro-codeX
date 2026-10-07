import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  validatePrivateReportOrigins,
  VALIDATOR_VERSION,
} from '../scripts/legado/validar-origem-relatorios-privados.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'fixtures/legado/origem-relatorios-sinteticos');
const fixtureManifest = path.join(fixtureRoot, 'manifest-origem.json');
const script = path.join(root, 'scripts/legado/validar-origem-relatorios-privados.mjs');

test('origem privada: fixture sintetica verifica fonte, hash, extrator e reproducao', () => {
  const report = validatePrivateReportOrigins(fixtureRoot, fixtureManifest);
  assert.equal(report.validatorVersion, VALIDATOR_VERSION);
  assert.equal(report.synthetic, true);
  assert.equal(report.operationalImportAuthorized, false);
  assert.equal(report.mode, 'READ_ONLY_NO_IMPORT');
  assert.equal(report.report_count, 2);
  assert.equal(report.verified_count, 2);
  assert.equal(report.failed_count, 0);
  assert.equal(report.reproduction_passes, 2);
  assert.equal(report.all_origins_verified, true);
  for (const item of report.reports) {
    assert.equal(item.status, 'ORIGIN_VERIFIED');
    assert.equal(item.reproduced, true);
    assert.equal(item.hash_match, true);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.equal(item.leaf.includes('/'), false);
    assert.doesNotMatch(item.leaf, /@|cpf|cnpj|senha/i);
  }
});

test('origem privada: CLI da fixture sai 0 e nao imprime conteudo do relatorio', () => {
  const run = spawnSync(process.execPath, [script, '--root', fixtureRoot, '--manifest', fixtureManifest], {
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /ORIGIN_VERIFIED/);
  assert.match(run.stdout, /legado-aggregate-summary/);
  // Saída agregada não deve embutir métricas internas do relatório sintético.
  assert.doesNotMatch(run.stdout, /monetary_diff_cents|"source_rows"|extractor_passes/);
  assert.doesNotMatch(run.stdout + run.stderr, /cpaferroeaco@|password|Bearer /i);
});

test('origem privada: root ausente falha fechada (BLOCKED reproduzivel)', () => {
  const missing = path.join(os.tmpdir(), `legado-origem-missing-${Date.now()}`);
  assert.throws(
    () => validatePrivateReportOrigins(missing, fixtureManifest),
    (err) => String(err.message).startsWith('LEGACY_REPORTS_ROOT_UNAVAILABLE'),
  );
});

test('origem privada: hash adulterado falha e nao autoriza importacao', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-origem-tamper-'));
  fs.cpSync(fixtureRoot, tmp, { recursive: true });
  const manifestPath = path.join(tmp, 'manifest-origem.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // Remove bytes esperados para isolar a falha de hash (não bytes).
  for (const row of manifest.reports) delete row.bytes;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const target = path.join(tmp, '04_REPORTS/legacy-synthetic-aggregate-a.json');
  fs.writeFileSync(target, `${fs.readFileSync(target, 'utf8')}\n`);
  assert.throws(
    () => validatePrivateReportOrigins(tmp, manifestPath),
    (err) => String(err.message).startsWith('LEGACY_ORIGIN_HASH_MISMATCH'),
  );
});

test('origem privada: bytes divergentes falham fechado antes do hash', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-origem-bytes-'));
  fs.cpSync(fixtureRoot, tmp, { recursive: true });
  const target = path.join(tmp, '04_REPORTS/legacy-synthetic-aggregate-a.json');
  fs.writeFileSync(target, `${fs.readFileSync(target, 'utf8')}\n`);
  assert.throws(
    () => validatePrivateReportOrigins(tmp, path.join(tmp, 'manifest-origem.json')),
    (err) => String(err.message).startsWith('LEGACY_ORIGIN_BYTES_MISMATCH'),
  );
});

test('origem privada: extrator nao registrado falha fechada', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-origem-ext-'));
  fs.cpSync(fixtureRoot, tmp, { recursive: true });
  const manifestPath = path.join(tmp, 'manifest-origem.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.reports[0].extractorId = 'extrator-fantasma';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(
    () => validatePrivateReportOrigins(tmp, manifestPath),
    (err) => String(err.message).startsWith('LEGACY_ORIGIN_EXTRACTOR_UNREGISTERED'),
  );
});

test('origem privada: path escape (.. ) falha fechada', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-origem-esc-'));
  fs.cpSync(fixtureRoot, tmp, { recursive: true });
  const manifestPath = path.join(tmp, 'manifest-origem.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.reports[0].relativePath = '../outside.json';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(
    () => validatePrivateReportOrigins(tmp, manifestPath),
    (err) => String(err.message).startsWith('LEGACY_ORIGIN_RELPATH_INVALID'),
  );
});

test('origem privada: reproducao exige duas passagens iguais ao manifesto', () => {
  const file = path.join(fixtureRoot, '04_REPORTS/legacy-synthetic-aggregate-b.json');
  const buf = fs.readFileSync(file);
  const h1 = createHash('sha256').update(buf).digest('hex');
  const h2 = createHash('sha256').update(buf).digest('hex');
  assert.equal(h1, h2);
  const manifest = JSON.parse(fs.readFileSync(fixtureManifest, 'utf8'));
  const entry = manifest.reports.find((r) => r.relativePath.endsWith('aggregate-b.json'));
  assert.equal(entry.sha256, h1);
  assert.equal(entry.extractorVersion.includes('synthetic'), true);
});

test('fixture de origem nao contem PII tipica', () => {
  const blob = [
    fs.readFileSync(fixtureManifest, 'utf8'),
    fs.readFileSync(path.join(fixtureRoot, '04_REPORTS/legacy-synthetic-aggregate-a.json'), 'utf8'),
    fs.readFileSync(path.join(fixtureRoot, '04_REPORTS/legacy-synthetic-aggregate-b.json'), 'utf8'),
  ].join('\n');
  assert.match(blob, /"synthetic": true/);
  assert.doesNotMatch(blob, /@cpa|cpf|cnpj|senha|password|Bearer |TID_EMP0|DELL-VINI/i);
});
