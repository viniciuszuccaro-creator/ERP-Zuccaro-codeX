#!/usr/bin/env bash
# Cria backup NOVO pre-gate-e na VPS (pg_dump) e verifica integridade
# SEM restauração destrutiva. NÃO aplica migration. NÃO inicia canário.
#
# Uso (Web Console / SSH na VPS, com autorização humana para BACKUP apenas):
#   bash create-pre-gate-e-backup.sh
#   # ou, a partir do clone:
#   bash scripts/vps/create-pre-gate-e-backup.sh
#
# Saída: linhas sanitizadas para colar em docs/vps/evidence/pre-gate-e-backup-*.txt
# O arquivo .sql permanece SOMENTE em /opt/erp-zuccaro/backups (nunca no Git).
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/erp-zuccaro/backups}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_NAME="pre-gate-e-${STAMP}.sql"
OUT_PATH="${BACKUP_DIR}/${OUT_NAME}"

echo "PRE_GATE_E_BACKUP_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "note=arquivo_real_somente_na_vps"
echo "EXECUTE_DEF=NO"
echo "APPLY_MIGRATIONS=NO"
echo "START_CANARY=NO"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "BLOCKED: backups_dir_missing path=${BACKUP_DIR}" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "BLOCKED: db_container_not_running name=${DB_CONTAINER}" >&2
  exit 1
fi

if [[ -e "$OUT_PATH" ]]; then
  echo "BLOCKED: destino ja existe: ${OUT_NAME}" >&2
  exit 1
fi

echo "dump_start name=${OUT_NAME}"
# Plain SQL no host — sem -Fc para permitir grep do marker sem pg_restore.
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  >"$OUT_PATH"

bytes="$(wc -c <"$OUT_PATH" | tr -d ' ')"
if [[ -z "$bytes" || "$bytes" -lt 1000 ]]; then
  echo "BLOCKED: dump_too_small bytes=${bytes:-0}" >&2
  rm -f "$OUT_PATH"
  exit 1
fi

sha="$(sha256sum "$OUT_PATH" | awk '{print $1}')"

# Integridade sem restauração destrutiva:
# 1) header pg_dump
# 2) marker de conclusão no final
# 3) SHA-256 recompute (segunda passagem)
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
echo "restore_destructive=NOT_PERFORMED"
echo "git_commit_dump=FORBIDDEN"

if [[ "$header_ok" != YES || "$tail_ok" != YES || "$sha_match" != YES ]]; then
  echo 'PRE_GATE_E_BACKUP_STATUS=INTEGRITY_FAILED'
  echo "PRE_GATE_E_BACKUP_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi

echo 'PRE_GATE_E_BACKUP_STATUS=OK'
echo 'PASTE_TO_GIT_BEGIN'
echo "backup path=${OUT_NAME} bytes=${bytes} sha256=${sha} dump_complete_marker=YES"
echo "integrity_header_pg_dump=YES"
echo "integrity_tail_complete=YES"
echo "integrity_sha256_recompute_match=YES"
echo "restore_destructive=NOT_PERFORMED"
echo 'PASTE_TO_GIT_END'
echo "NOTE: copie o bloco PASTE_TO_GIT_* para docs/vps/evidence/pre-gate-e-backup-latest.txt"
echo "PRE_GATE_E_BACKUP_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
