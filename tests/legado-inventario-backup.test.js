import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/legado/inventario-backup-erp-antigo.sh');

test('inventario legado: descobre pasta sintética, hasheia e não altera origem', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-inv-'));
  const volume = path.join(tmp, 'VOLUME1');
  const folder = path.join(volume, 'BACKUP ERP ANTIGO - CODEX');
  fs.mkdirSync(folder, { recursive: true });
  const sample = path.join(folder, 'amostra_sintetica.sql');
  const payload = '-- synthetic only\nSELECT 1;\n';
  fs.writeFileSync(sample, payload);
  const before = fs.readFileSync(sample);

  const report = path.join(tmp, 'report.json');
  const run = spawnSync('bash', [script, '--root', tmp, '--report', report], {
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /backup_dir_found=YES/);
  assert.match(run.stdout, /file_count=1/);
  assert.match(run.stdout, /format=sql_texto/);
  assert.match(run.stdout, /sha256=[a-f0-9]{64}/);
  assert.equal(fs.readFileSync(sample).toString(), before.toString(), 'origem alterada');

  const json = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.equal(json.file_count, 1);
  assert.equal(json.files[0].name, 'amostra_sintetica.sql');
  assert.equal(json.files[0].bytes, Buffer.byteLength(payload));
  assert.equal(json.note.includes('Sem conteudo'), true);
});

test('inventario legado: marca USUSENHA como blocked_secret_candidate', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-inv-sec-'));
  const volume = path.join(tmp, 'VOLUME1');
  const folder = path.join(volume, 'BACKUP ERP ANTIGO - CODEX');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'USUSENHA.TPS'), 'fake-binary');

  const run = spawnSync('bash', [script, '--root', tmp], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /format=blocked_secret_candidate/);
  assert.match(run.stdout, /BLOCKED_SECRET_FILENAME/);
  assert.doesNotMatch(run.stdout, /USUSENHA/);
});

test('inventario legado: falha fechada se a pasta nao existe', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-inv-miss-'));
  const run = spawnSync('bash', [script, '--root', tmp], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout + run.stderr, /backup_dir_found=NO/);
});

test('fixture sintetica de inventario nao contem PII tipica', () => {
  const fixture = path.join(root, 'fixtures/legado/inventario-sintetico.example.json');
  const json = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  assert.equal(json.synthetic, true);
  const blob = JSON.stringify(json);
  assert.doesNotMatch(blob, /@cpa|cpf|cnpj|senha|password|Bearer /i);
  assert.equal(json.note.includes('Sem dados reais') || json.note.includes('sintetica') || json.note.includes('Fixture'), true);
});
