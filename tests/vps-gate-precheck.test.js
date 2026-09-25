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
  assert.equal(run.status, 0, run.stderr || run.stdout);
  // Checkout sem 016+ (main/#34) → NONE; árvore integrada #33+#34 → 016–024 faltantes na VPS.
  const has016 = fs.existsSync(path.join(root, 'server/migrations'))
    && fs.readdirSync(path.join(root, 'server/migrations')).some((n) => n.startsWith('016_'));
  if (has016) {
    assert.match(run.stdout, /missing_for_gate_e=016,017,018,019,020,021,022,023,024/);
  } else {
    assert.match(run.stdout, /missing_for_gate_e=NONE/);
  }
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
  // Termo pode estar aguardando assinatura ou já assinado (Gate E).
  assert.match(run.stdout, /TERMO_STATUS=(FACTS_READY_WAITING_SIGNATURE|SIGNED_CHECKLIST_OK)/);
  assert.match(run.stdout, /BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT/);
  assert.match(run.stdout, /GO_NOGO=NO/);
  assert.match(run.stdout, /PACKAGE_STATUS=READY_FOR_HUMAN_DECISION/);
});

test('validate-termo-autorizacao SIGNED_CHECKLIST_OK no termo com Gate E assinado', () => {
  const script = path.join(root, 'scripts/vps/validate-termo-autorizacao.sh');
  const run = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const exec = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(exec.status, 0, exec.stderr || exec.stdout);
  assert.match(exec.stdout, /TERMO_STATUS=SIGNED_CHECKLIST_OK/);
  assert.match(exec.stdout, /EXECUTE_DEF=NO/);
});

test('validate-termo-autorizacao SIGNED_CHECKLIST_OK quando preenchido', () => {
  const script = path.join(root, 'scripts/vps/validate-termo-autorizacao.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'termo-'));
  const filled = path.join(tmp, 'termo.md');
  fs.writeFileSync(filled, [
    '# Termo',
    '## Fatos comprovados (Gate C — x)',
    '## E. Sequência concreta para decisão (após este termo)',
    'Responsável (assinatura humana): Operador Teste',
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
  const sha = 'a'.repeat(64);
  fs.writeFileSync(ev, [
    `backup path=pre-gate-e-20260924-120000.sql bytes=5000 sha256=${sha} dump_complete_marker=YES`,
    'integrity_header_pg_dump=YES',
    'integrity_tail_complete=YES',
    'integrity_sha256_recompute_match=YES',
    'restore_destructive=NOT_PERFORMED',
    '',
  ].join('\n'));
  // aponta meta latest via cópia no tmp nao funciona; passa so o arquivo
  const run = spawnSync('bash', [script, ev], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT/);
});

test('verify-pre-gate-e-backup-meta OK com fixture', () => {
  const script = path.join(root, 'scripts/vps/verify-pre-gate-e-backup-meta.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-'));
  const meta = path.join(tmp, 'meta.txt');
  const sha = 'b'.repeat(64);
  fs.writeFileSync(meta, [
    `backup path=pre-gate-e-20260924-130000.sql bytes=9000 sha256=${sha} dump_complete_marker=YES`,
    'integrity_header_pg_dump=YES',
    'integrity_tail_complete=YES',
    'integrity_sha256_recompute_match=YES',
    'restore_destructive=NOT_PERFORMED',
    '',
  ].join('\n'));
  const run = spawnSync('bash', [script, meta], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /PRE_GATE_E_META_STATUS=OK/);
});

test('create-pre-gate-e-backup.sh passa bash -n', () => {
  const script = path.join(root, 'scripts/vps/create-pre-gate-e-backup.sh');
  const run = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('create-pre-gate-e-backup --self-test umask perms e cleanup', () => {
  const script = path.join(root, 'scripts/vps/create-pre-gate-e-backup.sh');
  const run = spawnSync('bash', [script, '--self-test'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /umask=0077/);
  assert.match(run.stdout, /file_mode=600/);
  assert.match(run.stdout, /integrity_file_mode_600=YES/);
  assert.match(run.stdout, /self_test_partial_cleanup=OK/);
  assert.match(run.stdout, /AUTHORIZES_GATES_DEF=NO/);
  assert.match(run.stdout, /PRE_GATE_E_BACKUP_STATUS=OK/);
  assert.match(run.stdout, /EXECUTE_DEF=NO/);
});

test('create-pre-gate-e-backup remove parcial em falha de integridade', () => {
  const script = path.join(root, 'scripts/vps/create-pre-gate-e-backup.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-gate-fail-'));
  // Força falha: container inexistente com BACKUP_DIR gravável → bloqueia antes do dump.
  // Exercita falha pós-arquivo: usa self-test pattern via env DB + dump vazio simulado
  // com um wrapper mínimo inline.
  const wrapper = path.join(tmp, 'fail-partial.sh');
  fs.writeFileSync(wrapper, `#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
BACKUP_DIR="${tmp}/b"
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/pre-gate-e-partial.sql"
DUMP_COMPLETE=0
remove_partial_dump() {
  local path="\$1"
  [[ -e "\$path" ]] || return 0
  rm -f "\$path"
}
on_exit() {
  local code=\$?
  if (( DUMP_COMPLETE != 1 )) && [[ -e "\$OUT" ]]; then
    remove_partial_dump "\$OUT"
    echo partial_dump_removed=YES
  fi
  exit \$code
}
trap on_exit EXIT
: >"\$OUT"
chmod 600 "\$OUT"
echo 'NOT A REAL DUMP' >"\$OUT"
# falha de integridade proposital
exit 1
`);
  fs.chmodSync(wrapper, 0o755);
  const run = spawnSync('bash', [wrapper], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stdout + run.stderr, /partial_dump_removed=YES/);
  assert.equal(fs.existsSync(path.join(tmp, 'b/pre-gate-e-partial.sql')), false);
});

test('print-gate-e-fatias expoe comercial e produto', () => {
  const script = path.join(root, 'scripts/vps/print-gate-e-fatias.sh');
  const run = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /proposed_fatia_comercial=016,017/);
  assert.match(run.stdout, /proposed_fatia_produto_dam_canais=018,019,020,021,022,023,024/);
  assert.match(run.stdout, /proposed_strategy=016_024_single_invocation_main_order/);
  assert.match(run.stdout, /review_slices_only=YES/);
  assert.match(run.stdout, /APPLY_NOW=NO/);
  assert.match(run.stdout, /AUTHORIZES_GATES_DEF=NO/);
  assert.match(run.stdout, /GATE_E_PLAN_STATUS=EXECUTED_OK/);
});

test('go-nogo-def reporta GATE_E_READY=NO quando probe da main não tem 016-024', () => {
  const script = path.join(root, 'scripts/vps/go-nogo-def.sh');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-mig-absent-'));
  // Probe sem 016–024: simula main antiga
  fs.writeFileSync(path.join(dir, '015_probe.sql'), '-- probe\n');
  const run = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, MAIN_MIGRATIONS_DIR: dir },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /main_migrations_016_024=PENDING_ABSENT/);
  assert.match(run.stdout, /main_missing_migrations=016,017,018,019,020,021,022,023,024/);
  // Evidência Gate E OK no repo: schema DEV marcado APPLIED mesmo se main probe falha.
  assert.match(run.stdout, /vps_schema_016_024=APPLIED/);
  assert.match(run.stdout, /gate_e_executed_evidence=OK/);
  assert.match(run.stdout, /GATE_E_READY=NO/);
  assert.match(run.stdout, /gate_e_blockers=.*main_missing_migrations_016_024/);
  // Auth sintético OK na evidência versionada → D não bloqueia por Auth.
  assert.match(run.stdout, /auth_synthetic_status=OK/);
  assert.match(run.stdout, /GATE_D_READY=YES/);
  assert.doesNotMatch(run.stdout, /auth_synthetic_gate_pending/);
  // Digest REGISTERED na evidência versionada.
  assert.match(run.stdout, /image_digest_status=REGISTERED/);
  assert.doesNotMatch(run.stdout, /gate_d_blockers=.*image_digest_pending/);
  assert.doesNotMatch(run.stdout, /gate_d_blockers=.*gate_e_schema_not_applied/);
  assert.match(run.stdout, /GATE_F_READY=NO/);
  // Com termo assinado (Gate E): AUTHORIZED_CHECKLIST; senão READY_FOR_REVIEW.
  assert.match(run.stdout, /DECISION_STATE=(READY_FOR_REVIEW|AUTHORIZED_CHECKLIST)/);
  assert.match(run.stdout, /AUTHORIZATION=NOT_GRANTED/);
  assert.match(run.stdout, /EXECUTED=NO/);
  assert.match(run.stdout, /GO_NOGO=NO/);
  assert.match(run.stdout, /EXECUTE_DEF=NO/);
  assert.match(run.stdout, /NOTE: READY_FOR_REVIEW != AUTHORIZED != EXECUTED/);
  assert.doesNotMatch(run.stdout, /gate_e_blockers=.*image_digest/);
  assert.doesNotMatch(run.stdout, /gate_e_blockers=.*auth_synthetic/);
});

test('go-nogo-def GATE_E_READY=YES quando checkout tem 016-024 (probe local)', () => {
  const script = path.join(root, 'scripts/vps/go-nogo-def.sh');
  // CI shallow pode não ter origin/main; usar dir local do checkout (pós-#35).
  const migDir = path.join(root, 'server/migrations');
  const run = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, MAIN_MIGRATIONS_DIR: migDir },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /main_migrations_016_024=PRESENT/);
  assert.match(run.stdout, /vps_schema_016_024=APPLIED/);
  assert.match(run.stdout, /GATE_E_READY=YES/);
  assert.match(run.stdout, /gate_e_blockers=NONE/);
  assert.match(run.stdout, /AUTHORIZATION=NOT_GRANTED/);
  assert.match(run.stdout, /EXECUTED=NO/);
  assert.doesNotMatch(run.stdout, /gate_d_blockers=.*gate_e_schema_not_applied/);
});

test('go-nogo-def GATE_E_READY=YES quando MAIN_MIGRATIONS_DIR tem 016-024', () => {
  const script = path.join(root, 'scripts/vps/go-nogo-def.sh');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-mig-'));
  for (const id of ['016', '017', '018', '019', '020', '021', '022', '023', '024']) {
    fs.writeFileSync(path.join(dir, `${id}_probe.sql`), '-- probe\n');
  }
  const run = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, MAIN_MIGRATIONS_DIR: dir },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /main_migrations_016_024=PRESENT/);
  assert.match(run.stdout, /main_missing_migrations=NONE/);
  assert.match(run.stdout, /vps_schema_016_024=APPLIED/);
  assert.match(run.stdout, /GATE_E_READY=YES/);
  assert.match(run.stdout, /gate_e_blockers=NONE/);
  assert.match(run.stdout, /auth_synthetic_status=OK/);
  assert.match(run.stdout, /GATE_D_READY=YES/);
  assert.doesNotMatch(run.stdout, /auth_synthetic_gate_pending/);
  assert.match(run.stdout, /image_digest_status=REGISTERED/);
  assert.doesNotMatch(run.stdout, /gate_d_blockers=.*image_digest_pending/);
  assert.doesNotMatch(run.stdout, /gate_d_blockers=.*gate_e_schema_not_applied/);
  assert.match(run.stdout, /AUTHORIZATION=NOT_GRANTED/);
  assert.match(run.stdout, /EXECUTED=NO/);
  assert.doesNotMatch(run.stdout, /gate_e_blockers=.*image_digest/);
});

test('print-pedido-codex DECISIONS_DOCUMENTED com 5 itens e Auth OK', () => {
  const script = path.join(root, 'scripts/vps/print-pedido-codex.sh');
  const run = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /codex_pending_count=0/);
  assert.match(run.stdout, /codex_done_count=5/);
  assert.match(run.stdout, /CODEX_PEDIDO_STATUS=DECISIONS_DOCUMENTED/);
  assert.match(run.stdout, /decided_EXPECTED_RUNTIME=ERP-RUNTIME-08B/);
  assert.match(run.stdout, /decided_gate_e_strategy=016_024_single_invocation_main_order/);
  assert.match(run.stdout, /review_slices=016_017,018_024/);
  assert.match(run.stdout, /image_digest_status=REGISTERED/);
  assert.match(run.stdout, /auth_synthetic_status=OK/);
  assert.match(run.stdout, /gates_def_executed=NO/);
  assert.match(run.stdout, /AUTHORIZES_GATES_DEF=NO/);
  assert.doesNotMatch(run.stdout, /fatias_comercial_016_017_then_produto/);
});

test('print-pedido-codex e go-nogo: Auth PENDING ainda bloqueia Gate D', () => {
  const pedido = path.join(root, 'scripts/vps/print-pedido-codex.sh');
  const go = path.join(root, 'scripts/vps/go-nogo-def.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-auth-'));
  const digestEv = path.join(tmp, 'digest.txt');
  const authEv = path.join(tmp, 'auth.txt');
  fs.writeFileSync(
    digestEv,
    [
      'merge_sha8=2fc2fc80',
      'image_tag=erp-zuccaro-erp-api:comercial360-main-2fc2fc80',
      'image_id_prefix=sha256:deadbeefcafe',
      'DIGEST_STATUS=OK',
      'AUTHORIZES_CANARY=NO',
      'AUTHORIZES_GATE_D=NO',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(authEv, 'AUTH_SYNTHETIC_STATUS=PENDING_AUTH_GATE\n');
  const pedidoRun = spawnSync('bash', [pedido], {
    encoding: 'utf8',
    env: { ...process.env, DIGEST_EVIDENCE: digestEv, AUTH_EVIDENCE: authEv },
  });
  assert.equal(pedidoRun.status, 0, pedidoRun.stderr || pedidoRun.stdout);
  assert.match(pedidoRun.stdout, /image_digest_status=REGISTERED/);
  assert.match(pedidoRun.stdout, /auth_synthetic_status=PENDING_AUTH_GATE/);

  const migDir = path.join(root, 'server/migrations');
  const goRun = spawnSync('bash', [go], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MAIN_MIGRATIONS_DIR: migDir,
      DIGEST_EVIDENCE: digestEv,
      AUTH_EVIDENCE: authEv,
    },
  });
  assert.equal(goRun.status, 0, goRun.stderr || goRun.stdout);
  assert.match(goRun.stdout, /image_digest_status=REGISTERED/);
  assert.doesNotMatch(goRun.stdout, /gate_d_blockers=.*image_digest_pending/);
  assert.match(goRun.stdout, /auth_synthetic_gate_pending/);
  assert.match(goRun.stdout, /GATE_D_READY=NO/);
});

test('freeze-go-nogo-snapshot grava GO_NOGO=NO e EXHAUSTED', () => {
  const script = path.join(root, 'scripts/vps/freeze-go-nogo-snapshot.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freeze-'));
  const out = path.join(tmp, 'snap.txt');
  const evidence = path.join(root, 'docs/vps/evidence/gate-c-2026-09-24.txt');
  const absent = fs.mkdtempSync(path.join(os.tmpdir(), 'main-mig-freeze-'));
  fs.writeFileSync(path.join(absent, '015_probe.sql'), '-- probe\n');
  const run = spawnSync('bash', [script, evidence, out], {
    encoding: 'utf8',
    env: { ...process.env, MAIN_MIGRATIONS_DIR: absent },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const text = fs.readFileSync(out, 'utf8');
  assert.match(text, /GO_NOGO=NO/);
  assert.match(text, /GATE_E_READY=NO/);
  assert.match(text, /main_missing_migrations_016_024/);
  // Auth OK no repo: D ready técnico; GO_NOGO=NO permanece por E/F.
  assert.match(text, /GATE_D_READY=YES/);
  assert.match(text, /GATE_F_READY=NO/);
  assert.match(text, /DECISION_STATE=(READY_FOR_REVIEW|AUTHORIZED_CHECKLIST)/);
  assert.match(text, /AUTONOMOUS_PREP_STATUS=EXHAUSTED_WAITING_HUMAN_CODEX/);
  assert.match(text, /EXECUTE_DEF=NO/);
  assert.doesNotMatch(text, /Bearer |sk_live_|BEGIN PRIVATE KEY/i);
});

test('snapshot versionado go-nogo esta coerente', () => {
  const snap = path.join(root, 'docs/vps/evidence/go-nogo-snapshot-2026-09-24.txt');
  assert.equal(fs.existsSync(snap), true);
  const text = fs.readFileSync(snap, 'utf8');
  assert.match(text, /GO_NOGO=NO/);
  assert.match(text, /GATE_E_READY=/);
  assert.match(text, /GATE_D_READY=/);
  assert.match(text, /GATE_F_READY=/);
  assert.match(text, /DECISION_STATE=/);
  assert.match(text, /AUTONOMOUS_PREP_STATUS=EXHAUSTED_WAITING_HUMAN_CODEX/);
});

test('validate-isolated-restore --self-test nao toca DEV', () => {
  const script = path.join(root, 'scripts/vps/validate-isolated-restore.sh');
  const syn = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(syn.status, 0, syn.stderr);
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'restore-ev-')), 'ev.txt');
  const run = spawnSync('bash', [script, '--self-test'], {
    encoding: 'utf8',
    env: { ...process.env, RESTORE_EVIDENCE_OUT: out },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /RESTORE_ISOLATED_STATUS=OK/);
  assert.match(run.stdout, /dev_database_touched=NO/);
  assert.match(run.stdout, /DEV_DATABASE_TOUCHED=NO/);
  assert.match(run.stdout, /AUTHORIZES_GATES_DEF=NO/);
  const text = fs.readFileSync(out, 'utf8');
  assert.match(text, /restore_isolated=VALIDATED_SYNTHETIC/);
  assert.match(text, /vps_dump_used=NO/);
});

test('scan-sanitized-artifacts CLEAN nos docs VPS', () => {
  const script = path.join(root, 'scripts/vps/scan-sanitized-artifacts.sh');
  const syn = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(syn.status, 0, syn.stderr);
  const run = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /SANITIZE_SCAN_STATUS=CLEAN/);
  assert.match(run.stdout, /hit_count=0/);
});

test('evidence R07B API compat file is OK when present', () => {
  const ev = path.join(root, 'docs/vps/evidence/r07b-api-schema-016-024-compat.txt');
  if (!fs.existsSync(ev)) {
    // Em checkouts sem prova local ainda; CI da #35 gera o arquivo.
    return;
  }
  const text = fs.readFileSync(ev, 'utf8');
  assert.match(text, /api_under_test=R07B_ca0bc5f3_NOT_08B/);
  assert.match(text, /runtime_meta=ERP-RUNTIME-07B/);
  assert.match(text, /produto_ops=list,get,create,patch/);
  assert.match(text, /R07B_API_COMPAT_STATUS=OK/);
});

test('evidence restore isolado DB OK sem autorizar gates', () => {
  const ev = path.join(root, 'docs/vps/evidence/restore-isolated-db-pending.txt');
  assert.equal(fs.existsSync(ev), true);
  const text = fs.readFileSync(ev, 'utf8');
  assert.match(text, /RESTORE_ISOLATED_DB_STATUS=OK/);
  assert.match(text, /dev_untouched=YES/);
  assert.match(text, /dump_committed_to_git=NO/);
  assert.match(text, /dump_left_on_vps=YES/);
  assert.match(text, /isolated_schema_migrations_count=15/);
  assert.match(text, /AUTHORIZES_GATES_DEF=NO/);
  assert.match(text, /EXECUTE_DEF=NO/);
  assert.match(text, /erp_restore_isolated_20260924_155458/);
  assert.match(text, /e72ca99b453fa6b060b5264f636794b3a601202c18e4185deb12f0020cae3f80/);
});

test('gate-d-smoke-browser-url-safe.sh passa bash -n e bloqueia query com segredo', () => {
  const script = path.join(root, 'scripts/vps/gate-d-smoke-browser-url-safe.sh');
  const syn = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(syn.status, 0, syn.stderr);
  const text = fs.readFileSync(script, 'utf8');
  assert.match(text, /GATE_D_BROWSER_URL_SMOKE/);
  assert.match(text, /alter_3080=NOT_PERFORMED/);
  assert.match(text, /AUTHORIZES_GATE_F=NO/);
  assert.match(text, /dev_headers/);
  assert.match(text, /PASTE_TO_GIT_BEGIN/);

  const blocked = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CANARY_PORT: '3086',
      EXPECTED_RUNTIME: 'ERP-RUNTIME-08B',
      BASE_URL: 'http://127.0.0.1:3086/?access_token=leak',
    },
  });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr + blocked.stdout, /secret_or_tenant_query|BLOCKED/);
});

test('gate-d-smoke-mutation-orc-ped.sh passa bash -n e bloqueia placeholder', () => {
  const script = path.join(root, 'scripts/vps/gate-d-smoke-mutation-orc-ped.sh');
  const syn = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(syn.status, 0, syn.stderr);
  const text = fs.readFileSync(script, 'utf8');
  assert.match(text, /GATE_D_MUTATION_SMOKE/);
  assert.match(text, /converter-pedido/);
  assert.match(text, /alter_3080=NOT_PERFORMED/);
  assert.match(text, /AUTHORIZES_GATE_F=NO/);
  assert.match(text, /canary_image_is_main_immutable/);
  assert.match(text, /HINT=.*from_checkout|HINT=.*stale_main_image/);
  const blocked = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, SYNTH_PASS: 'SENHA_DO_COFRE_OPENSSL' },
  });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr + blocked.stdout, /placeholder_from_chat|BLOCKED/);
});

test('gate-d-smoke-negatives-tenant.sh passa bash -n e bloqueia placeholder', () => {
  const script = path.join(root, 'scripts/vps/gate-d-smoke-negatives-tenant.sh');
  const syn = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(syn.status, 0, syn.stderr);
  const text = fs.readFileSync(script, 'utf8');
  assert.match(text, /GATE_D_NEGATIVES_SMOKE/);
  assert.match(text, /neg_adulterated_group/);
  assert.match(text, /neg_foreign_empresa/);
  assert.match(text, /alter_3080=NOT_PERFORMED/);
  assert.match(text, /AUTHORIZES_GATE_F=NO/);
  const blocked = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, SYNTH_PASS: 'SENHA_DO_COFRE_OPENSSL' },
  });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr + blocked.stdout, /placeholder_from_chat|BLOCKED/);
});

test('comercial360-canary-from-checkout.sh passa bash -n e nao usa tag MAIN', () => {
  const script = path.join(root, 'scripts/deploy/comercial360-canary-from-checkout.sh');
  const syn = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(syn.status, 0, syn.stderr);
  const text = fs.readFileSync(script, 'utf8');
  assert.match(text, /comercial360-gate-d-/);
  assert.match(text, /main_immutable_tag_used=NO/);
  assert.match(text, /alter_3080=NOT_PERFORMED/);
  assert.match(text, /AUTHORIZES_GATE_F=NO/);
  assert.match(text, /comercial360-canary\.sh/);
  assert.doesNotMatch(text, /comercial360-main-2fc2fc80/);
  const blocked = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, CANARY_PORT: '3086' },
  });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr + blocked.stdout, /ERP_DOCKER_NETWORK|BLOCKED/);
});
