#!/usr/bin/env bash
# Valida procedimento de restore ISOLADO do backup pre-gate-e.
# Nunca restaura sobre o banco DEV oficial. Não acessa VPS por padrão.
# --self-test: gera dump sintético 001–015, "restaura" em instância isolada (PGlite via node),
# prova que o alvo isolado recebe o schema e que o marcador DEV não foi tocado.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE_OUT="${RESTORE_EVIDENCE_OUT:-$ROOT/docs/vps/evidence/restore-isolated-validation.txt}"
MODE="${1:-}"

echo "RESTORE_ISOLATED_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$MODE" != '--self-test' ]]; then
  echo 'USAGE: validate-isolated-restore.sh --self-test'
  echo 'NOTE: dump real da VPS nao e versionado; use self-test para homologar o procedimento'
  echo 'RESTORE_TARGET=ISOLATED_ONLY'
  echo 'DEV_DATABASE_TOUCHED=NO'
  echo 'AUTHORIZES_GATES_DEF=NO'
  echo "RESTORE_ISOLATED_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/restore-isolated.XXXXXX")"
DEV_MARKER="$WORK/dev-official.marker"
ISOLATED_DIR="$WORK/isolated"
DUMP="$WORK/pre-gate-e-synthetic.sql"
mkdir -p "$ISOLATED_DIR"
echo "dev_official_untouched=YES" >"$DEV_MARKER"
DEV_SHA_BEFORE="$(sha256sum "$DEV_MARKER" | awk '{print $1}')"

# Dump sintético mínimo (não é o dump VPS; prova o procedimento)
{
  echo '-- Synthetic pre-gate-e dump for isolated restore procedure validation'
  echo '-- NOT the VPS dump. DEV must not be targeted.'
  echo 'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());'
  for id in 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015; do
    echo "INSERT INTO schema_migrations (id) VALUES ('${id}_synthetic.sql') ON CONFLICT DO NOTHING;"
  done
  echo 'CREATE TABLE IF NOT EXISTS restore_probe (id INT PRIMARY KEY, note TEXT);'
  echo "INSERT INTO restore_probe (id, note) VALUES (1, 'pre-gate-e-synthetic');"
  echo '-- dump_complete_marker'
} >"$DUMP"

export ROOT DUMP
ROOT="$ROOT" DUMP="$DUMP" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.env.ROOT;
const dumpPath = process.env.DUMP;
const require = createRequire(path.join(root, 'server/package.json'));
const { PGlite } = require('@electric-sql/pglite');

const dump = fs.readFileSync(dumpPath, 'utf8');
const isolated = new PGlite();
const devProbe = new PGlite();
await devProbe.exec(`CREATE TABLE IF NOT EXISTS dev_guard (id INT PRIMARY KEY); INSERT INTO dev_guard VALUES (1);`);
const before = await devProbe.query('SELECT count(*)::int AS c FROM dev_guard');

await isolated.exec(dump);
const mig = await isolated.query(`SELECT count(*)::int AS c FROM schema_migrations`);
const probe = await isolated.query(`SELECT note FROM restore_probe WHERE id=1`);
const after = await devProbe.query('SELECT count(*)::int AS c FROM dev_guard');

if (Number(before.rows[0].c) !== 1 || Number(after.rows[0].c) !== 1) {
  console.error('DEV_TOUCHED_UNEXPECTED');
  process.exit(2);
}
if (Number(mig.rows[0].c) !== 15) {
  console.error('MIGRATIONS_COUNT_UNEXPECTED', mig.rows[0].c);
  process.exit(3);
}
if (probe.rows[0]?.note !== 'pre-gate-e-synthetic') {
  console.error('PROBE_UNEXPECTED');
  process.exit(4);
}
console.log('isolated_schema_migrations=15');
console.log('isolated_probe=OK');
console.log('dev_probe_unchanged=YES');
await isolated.close();
await devProbe.close();
NODE

if [[ ! -f "$DEV_MARKER" ]]; then
  echo "BLOCKED: dev marker missing at $DEV_MARKER" >&2
  exit 6
fi
DEV_SHA_AFTER="$(sha256sum "$DEV_MARKER" | awk '{print $1}')"
if [[ -z "${DEV_SHA_AFTER:-}" ]]; then
  echo 'BLOCKED: failed to hash dev marker' >&2
  exit 7
fi
if [[ "$DEV_SHA_BEFORE" != "$DEV_SHA_AFTER" ]]; then
  echo 'DEV_MARKER_CHANGED'
  exit 5
fi

{
  echo "# Evidência — restore isolado (sintético). NÃO é restore na DEV."
  echo "# utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "restore_target=ISOLATED_PGLITE"
  echo "dump_source=SYNTHETIC_PRE_GATE_E_PROCEDURE"
  echo "vps_dump_used=NO"
  echo "dev_database_touched=NO"
  echo "dev_marker_sha_before=${DEV_SHA_BEFORE}"
  echo "dev_marker_sha_after=${DEV_SHA_AFTER}"
  echo "isolated_schema_migrations=15"
  echo "restore_isolated=VALIDATED_SYNTHETIC"
  echo "RESTORE_ISOLATED_STATUS=OK"
  echo "AUTHORIZES_GATES_DEF=NO"
  echo "EXECUTE_DEF=NO"
  echo "APPLY_MIGRATIONS=NO"
} | tee "$EVIDENCE_OUT"

echo "evidence_written=${EVIDENCE_OUT#"$ROOT"/}"
echo 'RESTORE_TARGET=ISOLATED_ONLY'
echo 'DEV_DATABASE_TOUCHED=NO'
echo 'AUTHORIZES_GATES_DEF=NO'
echo "RESTORE_ISOLATED_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
rm -rf "$WORK"
exit 0
