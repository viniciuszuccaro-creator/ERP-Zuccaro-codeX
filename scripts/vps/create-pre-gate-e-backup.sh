#!/usr/bin/env bash
# Cria backup NOVO pre-gate-e na VPS (pg_dump) e verifica integridade
# SEM restauração destrutiva. NÃO aplica migration. NÃO inicia canário.
# NÃO autoriza Gates D/E/F.
#
# Uso (Web Console / SSH na VPS, autorização = BACKUP apenas):
#   bash scripts/vps/create-pre-gate-e-backup.sh
#   bash scripts/vps/create-pre-gate-e-backup.sh --self-test   # sem Docker/VPS
#
# Saída: linhas sanitizadas para colar em docs/vps/evidence/pre-gate-e-backup-*.txt
# O arquivo .sql permanece SOMENTE em /opt/erp-zuccaro/backups (nunca no Git).
set -Eeuo pipefail

# Permissões restritas para qualquer arquivo criado por este processo.
umask 077

BACKUP_DIR="${BACKUP_DIR:-/opt/erp-zuccaro/backups}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
SELF_TEST=0
OUT_PATH=''
DUMP_COMPLETE=0

usage() {
  cat <<'EOF'
Uso: create-pre-gate-e-backup.sh [--self-test]
  --self-test  exercita umask/perms/cleanup sem Docker (CI/local)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --self-test) SELF_TEST=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "BLOCKED: argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
done

remove_partial_dump() {
  local path="${1:-}"
  [[ -n "$path" && -e "$path" ]] || return 0
  if command -v shred >/dev/null 2>&1; then
    shred -u "$path" 2>/dev/null || rm -f "$path"
  else
    # Sobrescreve com zeros do tamanho atual antes de apagar (melhor esforço).
    local sz
    sz="$(wc -c <"$path" 2>/dev/null | tr -d ' ' || echo 0)"
    if [[ -n "$sz" && "$sz" -gt 0 ]]; then
      dd if=/dev/zero of="$path" bs=1 count="$sz" conv=notrunc status=none 2>/dev/null || true
    fi
    rm -f "$path"
  fi
}

on_exit() {
  local code=$?
  if (( DUMP_COMPLETE != 1 )) && [[ -n "${OUT_PATH:-}" && -e "$OUT_PATH" ]]; then
    remove_partial_dump "$OUT_PATH"
    echo "partial_dump_removed=YES path=$(basename "$OUT_PATH")" >&2
    echo "PRE_GATE_E_BACKUP_STATUS=FAILED_PARTIAL_REMOVED" >&2
  fi
  exit "$code"
}
trap on_exit EXIT

confirm_mode_600() {
  local path="$1"
  local mode
  mode="$(stat -c '%a' "$path" 2>/dev/null || stat -f '%OLp' "$path" 2>/dev/null || echo '')"
  # Aceita 600; em alguns FS o leading zero some (600).
  if [[ "$mode" != '600' && "$mode" != '0600' ]]; then
    echo "BLOCKED: permissao_inesperada path=$(basename "$path") mode=${mode:-UNKNOWN} expected=600" >&2
    return 1
  fi
  echo "file_mode=${mode}"
  return 0
}

echo "PRE_GATE_E_BACKUP_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "umask=$(umask)"
echo "note=arquivo_real_somente_na_vps"
echo "EXECUTE_DEF=NO"
echo "APPLY_MIGRATIONS=NO"
echo "START_CANARY=NO"
echo "AUTHORIZES_GATES_DEF=NO"

if (( SELF_TEST == 1 )); then
  BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pre-gate-e-selftest.XXXXXX")"
  echo "self_test_dir=${BACKUP_DIR}"
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_NAME="pre-gate-e-${STAMP}.sql"
OUT_PATH="${BACKUP_DIR}/${OUT_NAME}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "BLOCKED: backups_dir_missing path=${BACKUP_DIR}" >&2
  exit 1
fi

if (( SELF_TEST == 0 )); then
  if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    echo "BLOCKED: db_container_not_running name=${DB_CONTAINER}" >&2
    exit 1
  fi
fi

if [[ -e "$OUT_PATH" ]]; then
  echo "BLOCKED: destino ja existe: ${OUT_NAME}" >&2
  exit 1
fi

# Cria o destino vazio já com permissão restrita (umask 077 → 600).
: >"$OUT_PATH"
chmod 600 "$OUT_PATH"
confirm_mode_600 "$OUT_PATH"

echo "dump_start name=${OUT_NAME}"
if (( SELF_TEST == 1 )); then
  # Dump sintético mínimo com header/marker reais do pg_dump (sem dados).
  cat >"$OUT_PATH" <<'SQL'
--
-- PostgreSQL database dump
--
SELECT 1;
--
-- PostgreSQL database dump complete
--
SQL
  chmod 600 "$OUT_PATH"
else
  # Plain SQL no host — sem -Fc para permitir grep do marker sem pg_restore.
  # Redirecionamento sob umask 077; chmod reforça 600 após escrita.
  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
    >"$OUT_PATH"
  chmod 600 "$OUT_PATH"
fi

confirm_mode_600 "$OUT_PATH"

bytes="$(wc -c <"$OUT_PATH" | tr -d ' ')"
min_bytes=1000
if (( SELF_TEST == 1 )); then
  min_bytes=40
fi
if [[ -z "$bytes" || "$bytes" -lt "$min_bytes" ]]; then
  echo "BLOCKED: dump_too_small bytes=${bytes:-0}" >&2
  exit 1
fi

sha="$(sha256sum "$OUT_PATH" | awk '{print $1}')"

header_ok=NO
tail_ok=NO
if head -n 5 "$OUT_PATH" | grep -q 'PostgreSQL database dump'; then
  header_ok=YES
fi
if tail -n 20 "$OUT_PATH" | grep -q 'PostgreSQL database dump complete'; then
  tail_ok=YES
fi
sha2="$(sha256sum "$OUT_PATH" | awk '{print $1}')"
sha_match=NO
[[ "$sha" == "$sha2" ]] && sha_match=YES

echo "backup path=${OUT_NAME} bytes=${bytes} sha256=${sha} dump_complete_marker=${tail_ok}"
echo "integrity_header_pg_dump=${header_ok}"
echo "integrity_tail_complete=${tail_ok}"
echo "integrity_sha256_recompute_match=${sha_match}"
echo "integrity_file_mode_600=YES"
echo "restore_destructive=NOT_PERFORMED"
echo "git_commit_dump=FORBIDDEN"
echo "AUTHORIZES_GATES_DEF=NO"

if [[ "$header_ok" != YES || "$tail_ok" != YES || "$sha_match" != YES ]]; then
  echo 'PRE_GATE_E_BACKUP_STATUS=INTEGRITY_FAILED'
  echo "PRE_GATE_E_BACKUP_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi

DUMP_COMPLETE=1

if (( SELF_TEST == 1 )); then
  # Exercita cleanup de parcial: cria lixo e força remoção.
  PARTIAL="${BACKUP_DIR}/pre-gate-e-partial-fail.sql"
  umask 077
  : >"$PARTIAL"
  chmod 600 "$PARTIAL"
  echo 'PARTIAL' >"$PARTIAL"
  remove_partial_dump "$PARTIAL"
  if [[ -e "$PARTIAL" ]]; then
    echo 'BLOCKED: partial_cleanup_failed' >&2
    exit 1
  fi
  echo 'self_test_partial_cleanup=OK'
  # Remove o dump sintético de sucesso (não é VPS real).
  remove_partial_dump "$OUT_PATH"
  DUMP_COMPLETE=1
  echo 'self_test_dump_removed_after_checks=YES'
fi

echo 'PRE_GATE_E_BACKUP_STATUS=OK'
if (( SELF_TEST == 0 )); then
  echo 'PASTE_TO_GIT_BEGIN'
  echo "backup path=${OUT_NAME} bytes=${bytes} sha256=${sha} dump_complete_marker=YES"
  echo "integrity_header_pg_dump=YES"
  echo "integrity_tail_complete=YES"
  echo "integrity_sha256_recompute_match=YES"
  echo "integrity_file_mode_600=YES"
  echo "restore_destructive=NOT_PERFORMED"
  echo "AUTHORIZES_GATES_DEF=NO"
  echo 'PASTE_TO_GIT_END'
  echo "NOTE: copie o bloco PASTE_TO_GIT_* para docs/vps/evidence/pre-gate-e-backup-latest.txt"
fi
echo "PRE_GATE_E_BACKUP_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
