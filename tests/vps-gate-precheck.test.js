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

function writeGateCFixture(file, { match = true, backup = true, portFree = true, dup013 = false } = {}) {
  const lines = [];
  for (let i = 1; i <= 15; i += 1) {
    lines.push(`${String(i).padStart(3, '0')}=1`);
  }
  if (dup013) lines.push('013=2');
  lines.push(match ? 'conexao_api_vs_supabase_db=MATCH' : 'conexao_api_vs_supabase_db=NO');
  lines.push('health_http=200');
  lines.push('ready_http=200');
  lines.push('meta_runtime=ERP-RUNTIME-07B');
  lines.push('meta_auth_mode=dev_headers');
  lines.push('official_image=erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3');
  if (backup) {
    lines.push('backup path=erp-dev-20260921.sql bytes=486969 sha256=abc dump_complete_marker=YES');
  } else {
    lines.push('backups_dir=MISSING');
  }
  lines.push(portFree ? 'port_3086=FREE' : 'port_3086=BUSY');
  lines.push('port_3090=BUSY');
  lines.push('name=supabase-auth status=Up');
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

test('score-gate-c APROVADO com fixture completa', () => {
  const score = path.join(root, 'scripts/vps/score-gate-c.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-c-score-'));
  const out = path.join(tmp, 'ok.txt');
  writeGateCFixture(out);
  const run = spawnSync('bash', [score, out], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /GATE_C_RESULT=APROVADO/);
});

test('score-gate-c BLOQUEADO sem MATCH', () => {
  const score = path.join(root, 'scripts/vps/score-gate-c.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-c-score-'));
  const out = path.join(tmp, 'bad.txt');
  writeGateCFixture(out, { match: false });
  const run = spawnSync('bash', [score, out], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /GATE_C_RESULT=BLOQUEADO/);
});

test('score-gate-c PARCIAL sem backup', () => {
  const score = path.join(root, 'scripts/vps/score-gate-c.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-c-score-'));
  const out = path.join(tmp, 'partial.txt');
  writeGateCFixture(out, { backup: false });
  const run = spawnSync('bash', [score, out], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /GATE_C_RESULT=PARCIAL/);
});

test('rollback-dry-run-check OK a partir de saída Gate C com 07b', () => {
  const script = path.join(root, 'scripts/vps/rollback-dry-run-check.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));
  const out = path.join(tmp, 'gc.txt');
  fs.writeFileSync(out, [
    'official_image=erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3',
    'name=erp-api-dev-rollback-07b status=Exited',
    'image=erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3 id=sha',
  ].join('\n'));
  const run = spawnSync('bash', [script, '--from-gate-c-output', out], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /ROLLBACK_DRYRUN_OK/);
});

test('rollback-dry-run-check bloqueia se parecer escrita', () => {
  const script = path.join(root, 'scripts/vps/rollback-dry-run-check.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));
  const out = path.join(tmp, 'gc.txt');
  fs.writeFileSync(out, 'rollback ok\ndocker stop erp-api-dev\nCONFIRM_ROLLBACK=YES\n');
  const run = spawnSync('bash', [script, '--from-gate-c-output', out], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /ROLLBACK_DRYRUN_BLOCKED/);
});

test('score-gate-c APROVADO com evidência real 2026-09-24 (meta_parse=ERR tolerado)', () => {
  const score = path.join(root, 'scripts/vps/score-gate-c.sh');
  const evidence = path.join(root, 'docs/vps/evidence/gate-c-2026-09-24.txt');
  const run = spawnSync('bash', [score, evidence], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /GATE_C_RESULT=APROVADO/);
  assert.match(run.stdout, /identity_match|MATCH/);
});

test('print-auth-package-status READY apos Gate C APROVADO', () => {
  const script = path.join(root, 'scripts/vps/print-auth-package-status.sh');
  const run = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /GATE_C_RESULT=APROVADO/);
  assert.match(run.stdout, /missing_for_gate_e=016,017,018,019,020,021,022,023,024/);
  assert.match(run.stdout, /proposed_EXPECTED_RUNTIME=ERP-RUNTIME-08B/);
  assert.match(run.stdout, /TERMO_STATUS=WAITING_SIGNATURE/);
  assert.match(run.stdout, /BACKUP_NOVO_STATUS=STALE_NEED_NEW/);
  assert.match(run.stdout, /GO_NOGO=NO/);
  assert.match(run.stdout, /PACKAGE_STATUS=READY_FOR_HUMAN_DECISION/);
});

test('validate-termo-autorizacao WAITING_SIGNATURE no termo em branco', () => {
  const script = path.join(root, 'scripts/vps/validate-termo-autorizacao.sh');
  const run = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const exec = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(exec.status, 0, exec.stderr || exec.stdout);
  assert.match(exec.stdout, /TERMO_STATUS=WAITING_SIGNATURE/);
  assert.match(exec.stdout, /EXECUTE_DEF=NO/);
});

test('validate-termo-autorizacao SIGNED_CHECKLIST_OK quando preenchido', () => {
  const script = path.join(root, 'scripts/vps/validate-termo-autorizacao.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'termo-'));
  const filled = path.join(tmp, 'termo.md');
  fs.writeFileSync(filled, [
    '# Termo',
    'Data (UTC): 2026-09-24T12:00:00Z',
    'Responsável: Operador Teste',
    '- [x] **Gate E** — aplicar faltantes',
    'Assinatura responsável: Operador Teste',
    '',
  ].join('\n'));
  const run = spawnSync('bash', [script, filled], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /TERMO_STATUS=SIGNED_CHECKLIST_OK/);
  assert.match(run.stdout, /EXECUTE_DEF=NO/);
});

test('check-backup-novo-gate-e STALE na evidencia Gate C', () => {
  const script = path.join(root, 'scripts/vps/check-backup-novo-gate-e.sh');
  const evidence = path.join(root, 'docs/vps/evidence/gate-c-2026-09-24.txt');
  const run = spawnSync('bash', [script, evidence], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /BACKUP_NOVO_STATUS=STALE_NEED_NEW/);
  assert.match(run.stdout, /fresh_named_backups=0/);
});

test('check-backup-novo-gate-e NAMED_CANDIDATE com pre-gate-e', () => {
  const script = path.join(root, 'scripts/vps/check-backup-novo-gate-e.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  const ev = path.join(tmp, 'ev.txt');
  fs.writeFileSync(ev, 'backup path=pre-gate-e-20260924-120000.sql bytes=1 sha256=present dump_complete_marker=YES\n');
  const run = spawnSync('bash', [script, ev], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT/);
});

test('print-gate-e-fatias expoe comercial e produto', () => {
  const script = path.join(root, 'scripts/vps/print-gate-e-fatias.sh');
  const run = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /proposed_fatia_comercial=016,017/);
  assert.match(run.stdout, /proposed_fatia_produto_dam_canais=018,019,020,021,022,023,024/);
  assert.match(run.stdout, /APPLY_NOW=NO/);
  assert.match(run.stdout, /GATE_E_PLAN_STATUS=PROPOSED_AWAITING_CODEX/);
});

test('go-nogo-def NO com blockers atuais', () => {
  const script = path.join(root, 'scripts/vps/go-nogo-def.sh');
  const run = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /GO_NOGO=NO/);
  assert.match(run.stdout, /termo_waiting_signature/);
  assert.match(run.stdout, /backup_novo_ausente/);
  assert.match(run.stdout, /EXECUTE_DEF=NO/);
});
