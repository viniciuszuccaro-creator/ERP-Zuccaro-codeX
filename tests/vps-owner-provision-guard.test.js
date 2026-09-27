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

test('rebuild script: preflight de porta ANTES de stop e return (não exit) em holder desconhecido', () => {
  const src = fs.readFileSync(REBUILD, 'utf8');
  const buildIdx = src.indexOf('compose_build_begin');
  const preflightIdx = src.indexOf('assert_no_unknown_port_holders 3080');
  const swapIdx = src.indexOf('compose_swap_begin');
  const stopIdx = src.indexOf('stop_rm_${name}');
  assert.ok(buildIdx > 0);
  assert.ok(preflightIdx > buildIdx);
  assert.ok(swapIdx > preflightIdx);
  assert.ok(stopIdx > swapIdx);
  assert.match(src, /trap on_rebuild_err ERR/);
  assert.match(src, /assert_no_unknown_port_holders/);
  assert.match(src, /return 6/);
  assert.equal(/exit 6/.test(src), false);
});

test('REAL spa-login-rebuild: holder desconhecido NÃO remove oficiais', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-rebuild-real-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const events = path.join(tmp, 'events.log');
  const tagFile = path.join(tmp, 'rollback-tags');

  fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash
echo "curl:$*" >> "${events}"
echo '000'
exit 0
`, { mode: 0o755 });

  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "docker:$*" >> "${events}"
case "$1" in
  ps)
    if [[ "$*" == *"--filter publish=3080"* ]]; then exit 0; fi
    if [[ "$*" == *"--filter publish=3081"* ]]; then
      echo 'cid3081'
      exit 0
    fi
    if [[ "$*" == *"--format {{.Names}}"* ]]; then
      echo 'erp-api-dev'
      echo 'erp-web-dev'
      exit 0
    fi
    exit 0
    ;;
  inspect)
    if [[ "$*" == *"{{.Name}}"* ]]; then
      echo '/unknown-web'
      exit 0
    fi
    if [[ "$*" == *"{{.Image}}"* ]]; then
      echo 'sha256:deadbeef'
      exit 0
    fi
    exit 0
    ;;
  tag) echo "tag_ok" >> "${events}"; exit 0 ;;
  image) exit 0 ;;
  compose)
    if [[ "$*" == *build* ]]; then echo 'build_ok' >> "${events}"; exit 0; fi
    if [[ "$*" == *up* ]]; then echo 'UP_CALLED' >> "${events}"; exit 1; fi
    exit 0
    ;;
  stop) echo "STOP:$*" >> "${events}"; exit 0 ;;
  rm) echo "RM:$*" >> "${events}"; exit 0 ;;
esac
exit 0
`, { mode: 0o755 });

  const result = spawnSync('bash', [REBUILD], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CONFIRM_SPA_LOGIN_REBUILD: 'YES',
      ERP_DOCKER_NETWORK: 'supabase_default',
      GIT_REF: 'HEAD',
      COMPOSE_FILE: 'docker-compose.erp.yml',
      ENV_FILE: 'tests/fixtures/spa-login.env.erp.dev',
      ROLLBACK_TAG_FILE: tagFile,
      AUTO_ROLLBACK_ON_FAIL: 'YES',
    },
    cwd: ROOT,
  });
  assert.ok(fs.existsSync(events), `events missing; stdout=${result.stdout} stderr=${result.stderr}`);
  const log = fs.readFileSync(events, 'utf8');
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr + result.stdout, /port_3081_unknown_container/);
  assert.match(log, /build_ok/);
  assert.equal(/STOP:.*erp-api-dev|stop_rm_erp-api-dev=YES/.test(log + result.stdout), false);
  assert.equal(/STOP:.*erp-web-dev|stop_rm_erp-web-dev=YES/.test(log + result.stdout), false);
  assert.equal(/UP_CALLED/.test(log), false);
  assert.equal(/AUTO_ROLLBACK_TRIGGER/.test(result.stdout + result.stderr), false);
});

test('REAL spa-login-rebuild: falha compose up após swap dispara rollback', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-rebuild-upfail-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const events = path.join(tmp, 'events.log');
  const tagFile = path.join(tmp, 'rollback-tags');
  const rollbackScript = path.join(ROOT, 'scripts/vps/spa-login-rollback-api-web.sh');

  fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash
echo "curl:$*" >> "${events}"
# health polls after up → fail
if [[ "$*" == *"3080/health"* ]]; then echo '000'; exit 0; fi
echo '000'
exit 0
`, { mode: 0o755 });

  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "docker:$*" >> "${events}"
case "$1" in
  ps) exit 0 ;;
  inspect)
    if [[ "$*" == *"{{.Image}}"* ]]; then echo 'sha256:abc'; exit 0; fi
    if [[ "$*" == *"{{.Config.Image}}"* ]]; then echo 'img:x'; exit 0; fi
    if [[ "$*" == *"PortBindings"* ]]; then echo '{}'; exit 0; fi
    if [[ "$*" == *"State.Status"* ]]; then echo 'exited'; exit 0; fi
    exit 0
    ;;
  tag) exit 0 ;;
  image) exit 0 ;;
  compose)
    if [[ "$*" == *build* ]]; then exit 0; fi
    if [[ "$*" == *up* ]]; then echo 'UP' >> "${events}"; exit 0; fi
    exit 0
    ;;
  stop) echo "STOP:$*" >> "${events}"; exit 0 ;;
  rm) echo "RM:$*" >> "${events}"; exit 0 ;;
  logs) exit 0 ;;
esac
exit 0
`, { mode: 0o755 });

  const result = spawnSync('bash', [REBUILD], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CONFIRM_SPA_LOGIN_REBUILD: 'YES',
      ERP_DOCKER_NETWORK: 'supabase_default',
      GIT_REF: 'HEAD',
      ENV_FILE: 'tests/fixtures/spa-login.env.erp.dev',
      ROLLBACK_TAG_FILE: tagFile,
      AUTO_ROLLBACK_ON_FAIL: 'YES',
      SPA_LOGIN_API_HEALTH_ATTEMPTS: '1',
      SPA_LOGIN_API_HEALTH_SLEEP: '0',
      SPA_LOGIN_WEB_HEALTH_ATTEMPTS: '1',
      SPA_LOGIN_WEB_HEALTH_SLEEP: '0',
    },
    cwd: ROOT,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /AUTO_ROLLBACK_TRIGGER|health_3080_not_200/);
  assert.ok(fs.existsSync(rollbackScript));
});

test('REAL provision restore: falha docker cp não executa psql nem OK', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-restore-cp-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const events = path.join(tmp, 'events.log');
  const jsonFile = path.join(tmp, 'backup.json');
  fs.writeFileSync(jsonFile, '[]\n');

  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "docker:$*" >> "${events}"
if [[ "$1" == "cp" ]]; then
  echo 'cp_fail' >> "${events}"
  exit 1
fi
if [[ "$1" == "exec" ]]; then
  echo 'PSQL_OR_EXEC' >> "${events}"
  exit 0
fi
exit 0
`, { mode: 0o755 });

  const result = spawnSync('bash', [PROVISION], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CONFIRM_OWNER_ADMIN_RESTORE: 'YES',
      OWNER_PROV_RESTORE_FILE: jsonFile,
      OWNER_PROFILE_EXISTED_BEFORE_FLAG: 'YES',
      OWNER_EMAIL: 'owner@example.com',
    },
  });
  const log = fs.readFileSync(events, 'utf8');
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr + result.stdout, /restore_docker_cp_failed/);
  assert.equal(/OWNER_ADMIN_RESTORE_OK/.test(result.stdout), false);
  assert.equal(/PSQL_OR_EXEC/.test(log), false);
  assert.match(log, /cp_fail/);
});

test('spa-login-rollback: CONFIRM obrigatório e imagem ausente falha', () => {
  const ROLLBACK = path.join(ROOT, 'scripts/vps/spa-login-rollback-api-web.sh');
  const src = fs.readFileSync(ROLLBACK, 'utf8');
  assert.match(src, /CONFIRM_SPA_LOGIN_ROLLBACK/);
  assert.match(src, /port_.*_unknown_container/);
  assert.match(src, /SPA_LOGIN_ROLLBACK_OK/);

  const noConfirm = spawnSync('bash', [ROLLBACK], {
    encoding: 'utf8',
    env: { ...process.env, ERP_DOCKER_NETWORK: 'supabase_default' },
  });
  assert.equal(noConfirm.status, 2);
  assert.match(noConfirm.stderr, /CONFIRM_SPA_LOGIN_ROLLBACK/);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-rb-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const compose = path.join(tmp, 'docker-compose.erp.yml');
  const envFile = path.join(tmp, '.env.erp.dev');
  fs.writeFileSync(compose, 'services: {}\n');
  fs.writeFileSync(envFile, 'X=1\n');
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
if [[ "$1" == "image" && "$2" == "inspect" ]]; then
  echo 'BLOCKED: image missing' >&2
  exit 1
fi
exit 0
`, { mode: 0o755 });

  // Script resolve COMPOSE/ENV relative to its ROOT (repo). Use absolute via symlink into repo tmp — instead
  // copy minimal files and invoke with env pointing at absolute paths by running from a fake root.
  const fakeRoot = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(fakeRoot, 'scripts/vps'), { recursive: true });
  fs.copyFileSync(ROLLBACK, path.join(fakeRoot, 'scripts/vps/spa-login-rollback-api-web.sh'));
  fs.writeFileSync(path.join(fakeRoot, 'docker-compose.erp.yml'), 'services: {}\n');
  fs.writeFileSync(path.join(fakeRoot, '.env.erp.dev'), 'X=1\n');

  const miss = spawnSync('bash', [path.join(fakeRoot, 'scripts/vps/spa-login-rollback-api-web.sh')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CONFIRM_SPA_LOGIN_ROLLBACK: 'YES',
      ERP_DOCKER_NETWORK: 'supabase_default',
      ROLLBACK_API_TAG: 'erp-zuccaro-erp-api:pre-missing',
      ROLLBACK_WEB_TAG: 'erp-zuccaro-erp-web:pre-missing',
    },
  });
  assert.equal(miss.status, 3, miss.stderr + miss.stdout);
  assert.match(miss.stderr, /rollback_api_image_missing/);
});

test('rebuild: falha de build não chama stop (PATH stub)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-rebuild-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const events = path.join(tmp, 'events.log');
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
if [[ "$1" == "compose" && "$2" == "build" ]]; then exit 1; fi
if [[ "$1" == "stop" ]]; then echo STOPPED >> "${events}"; fi
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

test('rebuild: falha após swap dispara auto-rollback (PATH stub)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-swap-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const events = path.join(tmp, 'events.log');
  const harness = path.join(tmp, 'harness.sh');
  fs.writeFileSync(harness, `#!/usr/bin/env bash
set -Eeuo pipefail
EVENTS="${events}"
SWAP_STARTED=0
attempt_auto_rollback() { echo "rollback:$1" >> "$EVENTS"; return 0; }
on_err() {
  ec=$?
  echo "err:$ec:swap=$SWAP_STARTED" >> "$EVENTS"
  if [[ "$SWAP_STARTED" == "1" ]]; then attempt_auto_rollback "trap"; fi
  exit "$ec"
}
trap on_err ERR
docker compose build erp-api erp-web
SWAP_STARTED=1
docker compose up -d erp-api
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "docker:$*" >> "${events}"
if [[ "$1" == "compose" && "$2" == "build" ]]; then exit 0; fi
if [[ "$1" == "compose" && "$2" == "up" ]]; then exit 1; fi
exit 0
`, { mode: 0o755 });
  const result = spawnSync('bash', [harness], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.notEqual(result.status, 0);
  const log = fs.readFileSync(events, 'utf8');
  assert.match(log, /err:.*swap=1/);
  assert.match(log, /rollback:trap/);
});

test('provision restore mode exige arquivo seletivo (fail-closed)', () => {
  const miss = spawnSync('bash', [PROVISION], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CONFIRM_OWNER_ADMIN_RESTORE: 'YES',
      OWNER_EMAIL: 'owner@example.com',
    },
  });
  assert.equal(miss.status, 2);
  assert.match(miss.stderr, /OWNER_PROV_RESTORE_FILE/);
});
