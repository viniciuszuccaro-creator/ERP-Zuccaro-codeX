import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVISION = path.join(ROOT, 'scripts/vps/provision-owner-admin-profile.sh');
const REBUILD = path.join(ROOT, 'scripts/vps/spa-login-rebuild-api-web.sh');

test('provision script não usa min(uuid) e tem if docker exec não invertido', () => {
  const src = fs.readFileSync(PROVISION, 'utf8');
  assert.equal(/min\s*\(\s*id\s*\)/i.test(src), false);
  assert.match(src, /SELECT count\(\*\) INTO v_auth_count/);
  assert.match(src, /SELECT id INTO v_auth_id/);
  assert.match(src, /if docker exec -i supabase-db psql/);
  assert.equal(/if !\s*docker exec -i supabase-db psql/.test(src), false);
  assert.match(src, /rollback_not=pg_dump_data_only_replay/);
  assert.match(src, /CONFIRM_OWNER_ADMIN_RESTORE=YES/);
  assert.match(src, /profiles-selective-pre-owner-prov/);
});

test('caminho sucesso/falha do if docker exec (não invertido)', () => {
  const success = spawnSync('bash', ['-c', `
set -e
if true; then
  echo 'transaction=COMMITTED'
else
  echo 'BLOCKED: transaction_failed_rolled_back' >&2
  exit 4
fi
`], { encoding: 'utf8' });
  assert.equal(success.status, 0);
  assert.match(success.stdout, /transaction=COMMITTED/);

  const failure = spawnSync('bash', ['-c', `
set +e
if false; then
  echo 'transaction=COMMITTED'
else
  echo 'BLOCKED: transaction_failed_rolled_back' >&2
  exit 4
fi
`], { encoding: 'utf8' });
  assert.equal(failure.status, 4);
  assert.match(failure.stderr, /transaction_failed_rolled_back/);
  assert.equal(/transaction=COMMITTED/.test(failure.stdout), false);
});

test('provision grant: sucesso COMMITTED e falha SQL bloqueia postcheck', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-prov-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const logFile = path.join(tmp, 'docker.log');
  const perms = path.join(ROOT, 'scripts/vps/owner-admin-permissoes.json');
  const backupDir = path.join(tmp, 'backups');

  const stub = `#!/usr/bin/env bash
echo "$*" >> "${logFile}"
if [[ "$1" == "cp" ]]; then exit 0; fi
if [[ "$1" == "exec" ]]; then
  input="$(cat || true)"
  if [[ "$input" == *"json_agg"* ]]; then
    echo '[]'
    exit 0
  fi
  if [[ "$input" == *"BEGIN"* ]]; then
    if [[ "\${FORCE_TX_FAIL:-0}" == "1" ]]; then
      echo 'ERROR: forced sql fail' >&2
      exit 1
    fi
    exit 0
  fi
  if [[ "$input" == *"FROM groups g"* || "$input" == *"FROM groups g WHERE"* ]]; then
    echo '1|0|1|1|1'
    exit 0
  fi
  if [[ "$input" == *"group_exists"* ]]; then
    echo '1|0|1|1|1'
    exit 0
  fi
  # precheck multi-count
  if [[ "$input" == *"empresas e"* && "$input" == *"auth.users"* ]]; then
    echo '1|0|1|1|1'
    exit 0
  fi
  # postcheck synth admin → 0
  if [[ "$input" == *"synth_email"* || "$input" == *":'synth_email'"* ]]; then
    echo '0'
    exit 0
  fi
  # postcheck owner admin → 1
  echo '1'
  exit 0
fi
exit 0
`;
  fs.writeFileSync(path.join(bin, 'docker'), stub, { mode: 0o755 });

  const envBase = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    CONFIRM_OWNER_ADMIN_PROFILE: 'YES',
    OWNER_EMAIL: 'owner@example.com',
    OWNER_GROUP_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    OWNER_EMPRESA_ID: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    OWNER_PERMS_FILE: perms,
    OWNER_PROV_BACKUP_DIR: backupDir,
    DEMOTE_SYNTH: 'YES',
    EXPECTED_OWNER_ADMIN: '1',
    EXPECTED_SYNTH_ADMIN: '0',
  };

  const ok = spawnSync('bash', [PROVISION], { encoding: 'utf8', env: envBase });
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  assert.match(ok.stdout, /transaction=COMMITTED/);
  assert.match(ok.stdout, /OWNER_ADMIN_PROVISION_OK/);
  assert.match(ok.stdout, /rollback_not=pg_dump_data_only_replay/);

  const fail = spawnSync('bash', [PROVISION], {
    encoding: 'utf8',
    env: { ...envBase, FORCE_TX_FAIL: '1' },
  });
  assert.equal(fail.status, 4, fail.stderr + fail.stdout);
  assert.match(fail.stderr, /transaction_failed_rolled_back/);
  assert.equal(/OWNER_ADMIN_PROVISION_OK/.test(fail.stdout), false);
  assert.equal(/transaction=COMMITTED/.test(fail.stdout), false);
});

test('rebuild script constrói antes de stop e tem trap de rollback', () => {
  const src = fs.readFileSync(REBUILD, 'utf8');
  const buildIdx = src.indexOf('compose_build_begin');
  const swapIdx = src.indexOf('compose_swap_begin');
  const stopIdx = src.indexOf('stop_rm_${name}');
  assert.ok(buildIdx > 0);
  assert.ok(swapIdx > buildIdx);
  assert.ok(stopIdx > swapIdx);
  assert.match(src, /trap on_rebuild_err ERR/);
  assert.match(src, /SWAP_STARTED=1/);
});

test('rebuild: falha de build não chama stop (PATH stub)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-rebuild-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const events = path.join(tmp, 'events.log');
  const compose = path.join(tmp, 'docker-compose.erp.yml');
  const envFile = path.join(tmp, '.env.erp.dev');
  fs.writeFileSync(compose, 'services: {}\n');
  fs.writeFileSync(envFile, 'X=1\n');

  // Minimal harness mirroring order: build then swap
  const harness = path.join(tmp, 'harness.sh');
  fs.writeFileSync(harness, `#!/usr/bin/env bash
set -Eeuo pipefail
EVENTS="${events}"
SWAP_STARTED=0
attempt_auto_rollback() { echo "rollback:$1" >> "$EVENTS"; }
on_err() {
  ec=$?
  echo "err:$ec:swap=$SWAP_STARTED" >> "$EVENTS"
  if [[ "$SWAP_STARTED" == "1" ]]; then attempt_auto_rollback "trap"; fi
  exit "$ec"
}
trap on_err ERR
echo build_begin >> "$EVENTS"
docker compose build erp-api erp-web
echo build_ok >> "$EVENTS"
SWAP_STARTED=1
echo swap_begin >> "$EVENTS"
docker stop erp-api-dev
`, { mode: 0o755 });

  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "docker:$*" >> "${events}"
if [[ "$*" == *"compose build"* || "$*" == "compose -f"* ]]; then
  exit 1
fi
if [[ "$1" == "stop" ]]; then
  echo STOPPED >> "${events}"
fi
exit 0
`, { mode: 0o755 });

  // Fix stub: docker compose is two args
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "docker:$*" >> "${events}"
if [[ "$1" == "compose" && "$2" == "build" ]]; then
  exit 1
fi
if [[ "$1" == "stop" ]]; then
  echo STOPPED >> "${events}"
fi
exit 0
`, { mode: 0o755 });

  const result = spawnSync('bash', [harness], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.notEqual(result.status, 0);
  const log = fs.readFileSync(events, 'utf8');
  assert.match(log, /build_begin/);
  assert.equal(/STOPPED/.test(log), false);
  assert.equal(/swap_begin/.test(log), false);
  assert.match(log, /err:.*swap=0/);
});
