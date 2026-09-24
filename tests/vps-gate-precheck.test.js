import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const precheck = path.join(root, 'scripts/vps/gate-d-f-precheck.sh');
const gateC = path.join(root, 'scripts/vps/gate-c-read-only.sh');

test('gate-c-read-only.sh passa bash -n', () => {
  const run = spawnSync('bash', ['-n', gateC], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('gate-d-f-precheck --local encontra docs Cursor e lista migrations main', () => {
  const run = spawnSync('bash', [precheck, '--local'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /cursor_df_doc=PRESENT/);
  assert.match(run.stdout, /gate_c_script=PRESENT/);
  assert.match(run.stdout, /candidate_migrations_in_checkout=.*015/);
  assert.match(run.stdout, /PRECHECK_OK/);
  assert.match(run.stdout, /nao_aplicar_016plus/);
});

test('gate-d-f-precheck --from-gate-c-output calcula faltantes 016+ e exige MATCH', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-df-'));
  const out = path.join(tmp, 'gate-c.txt');
  const lines = [];
  for (let i = 1; i <= 15; i += 1) {
    lines.push(`${String(i).padStart(3, '0')}=1`);
  }
  lines.push('conexao_api_vs_supabase_db=MATCH');
  lines.push('meta_auth_mode=dev_headers');
  fs.writeFileSync(out, `${lines.join('\n')}\n`);

  const run = spawnSync('bash', [precheck, '--from-gate-c-output', out], { encoding: 'utf8' });
  // main só tem 001-015 → missing_for_gate_e=NONE e OK
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /missing_for_gate_e=NONE/);
  assert.match(run.stdout, /identity_match=YES/);
  assert.match(run.stdout, /official_auth_mode=dev_headers/);
});

test('gate-d-f-precheck bloqueia duplicata de migration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-df-dup-'));
  const out = path.join(tmp, 'gate-c.txt');
  const lines = [];
  for (let i = 1; i <= 15; i += 1) {
    lines.push(`${String(i).padStart(3, '0')}=1`);
  }
  lines.push('013=2');
  lines.push('conexao_api_vs_supabase_db=MATCH');
  fs.writeFileSync(out, `${lines.join('\n')}\n`);

  const run = spawnSync('bash', [precheck, '--from-gate-c-output', out], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout + run.stderr, /duplicada|PRECHECK_BLOCKED/);
});

test('gate-d-f-precheck com --candidate-list comercial360 marca 016-024 faltantes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-df-list-'));
  const out = path.join(tmp, 'gate-c.txt');
  const lines = [];
  for (let i = 1; i <= 15; i += 1) {
    lines.push(`${String(i).padStart(3, '0')}=1`);
  }
  lines.push('conexao_api_vs_supabase_db=MATCH');
  lines.push('meta_auth_mode=dev_headers');
  fs.writeFileSync(out, `${lines.join('\n')}\n`);

  const list = path.join(root, 'docs/vps/migrations-candidatas-comercial360.txt');
  const run = spawnSync('bash', [
    precheck,
    '--from-gate-c-output', out,
    '--candidate-list', list,
  ], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /missing_for_gate_e=016,017,018,019,020,021,022,023,024/);
  assert.match(run.stdout, /identity_match=YES/);
});

test('extract-gate-c-migrations.sh filtra linhas agregadas', () => {
  const extract = path.join(root, 'scripts/vps/extract-gate-c-migrations.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-c-ext-'));
  const raw = path.join(tmp, 'raw.txt');
  const slim = path.join(tmp, 'slim.txt');
  fs.writeFileSync(raw, [
    'noise',
    '001=1',
    '015=1',
    'conexao_api_vs_supabase_db=MATCH',
    'meta_auth_mode=dev_headers',
    'meta_runtime=ERP-RUNTIME-07B',
    'secret_should_not_matter=ignore',
  ].join('\n'));
  const run = spawnSync('bash', [extract, raw, slim], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const text = fs.readFileSync(slim, 'utf8');
  assert.match(text, /001=1/);
  assert.match(text, /conexao_api_vs_supabase_db=MATCH/);
  assert.doesNotMatch(text, /secret_should_not_matter/);
});
