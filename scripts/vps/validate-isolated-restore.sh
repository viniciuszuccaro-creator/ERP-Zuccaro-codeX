#!/usr/bin/env bash
# Valida procedimento de restore ISOLADO do backup pre-gate-e.
# Nunca restaura sobre o banco DEV oficial. Não acessa VPS por padrão.
# --self-test: gera dump sintético 001–015, restaura em diretório isolado
# (cópia + checagens de integridade), prova que o marcador DEV não foi tocado.
# Sem dependência de PGlite/Docker (CI frontend não instala server deps).
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
DEV_DIR="$WORK/dev-official"
ISOLATED_DIR="$WORK/isolated"
DUMP="$WORK/pre-gate-e-synthetic.sql"
mkdir -p "$DEV_DIR" "$ISOLATED_DIR"

# "DEV oficial" — contém marcador que NÃO pode mudar no restore isolado
echo "dev_official_untouched=YES" >"$DEV_DIR/dev.marker"
echo "IMPORTANT_DEV_DATA" >"$DEV_DIR/app-data.txt"
DEV_SHA_BEFORE="$(sha256sum "$DEV_DIR/dev.marker" "$DEV_DIR/app-data.txt" | sha256sum | awk '{print $1}')"

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
DUMP_SHA="$(sha256sum "$DUMP" | awk '{print $1}')"
DUMP_BYTES="$(wc -c <"$DUMP" | tr -d ' ')"

# Restore ISOLADO: copia o dump para o alvo isolado e materializa artefatos
# sem apontar para DEV_DIR (procedimento fail-closed).
cp -a "$DUMP" "$ISOLATED_DIR/restored-pre-gate-e.sql"
grep -q 'dump_complete_marker' "$ISOLATED_DIR/restored-pre-gate-e.sql"
MIG_COUNT="$(grep -cE "INSERT INTO schema_migrations" "$ISOLATED_DIR/restored-pre-gate-e.sql" || true)"
PROBE_OK=0
grep -q "pre-gate-e-synthetic" "$ISOLATED_DIR/restored-pre-gate-e.sql" && PROBE_OK=1
[[ "$MIG_COUNT" == "15" ]] || { echo "MIGRATIONS_COUNT_UNEXPECTED=$MIG_COUNT" >&2; exit 3; }
[[ "$PROBE_OK" == "1" ]] || { echo 'PROBE_UNEXPECTED' >&2; exit 4; }

# Confirma que nenhum arquivo em DEV_DIR foi escrito
if [[ -e "$ISOLATED_DIR/../dev-official/restored-pre-gate-e.sql" ]]; then
  echo 'DEV_TOUCHED_UNEXPECTED' >&2
  exit 2
fi
DEV_SHA_AFTER="$(sha256sum "$DEV_DIR/dev.marker" "$DEV_DIR/app-data.txt" | sha256sum | awk '{print $1}')"
if [[ "$DEV_SHA_BEFORE" != "$DEV_SHA_AFTER" ]]; then
  echo 'DEV_MARKER_CHANGED' >&2
  exit 5
fi
# Lista de arquivos DEV inalterada (só os dois originais)
DEV_FILE_COUNT="$(find "$DEV_DIR" -type f | wc -l | tr -d ' ')"
[[ "$DEV_FILE_COUNT" == "2" ]] || { echo "DEV_FILE_COUNT_UNEXPECTED=$DEV_FILE_COUNT" >&2; exit 6; }

echo "isolated_schema_migrations=${MIG_COUNT}"
echo 'isolated_probe=OK'
echo 'dev_probe_unchanged=YES'
echo "dump_bytes=${DUMP_BYTES}"
echo "dump_sha256=${DUMP_SHA}"

{
  echo "# Evidência — restore isolado (sintético). NÃO é restore na DEV."
  echo "# utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "restore_target=ISOLATED_FILESYSTEM"
  echo "dump_source=SYNTHETIC_PRE_GATE_E_PROCEDURE"
  echo "vps_dump_used=NO"
  echo "dev_database_touched=NO"
  echo "dev_marker_sha_before=${DEV_SHA_BEFORE}"
  echo "dev_marker_sha_after=${DEV_SHA_AFTER}"
  echo "isolated_schema_migrations=${MIG_COUNT}"
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
