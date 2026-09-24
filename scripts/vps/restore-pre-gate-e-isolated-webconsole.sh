#!/usr/bin/env bash
# Restore ISOLADO do dump pré-Gate E na VPS (Web Console).
# Mantém o dump em /opt/erp-zuccaro/backups — NÃO copia para o Git.
# Cria banco isolado, restaura, confere hash/migrations, prova DEV intocado.
# Imprime SOMENTE bloco sanitizado PASTE_TO_GIT_*.
#
# Uso na Web Console (autorizada):
#   cd /opt/erp-zuccaro   # ou path do repo na VPS
#   bash scripts/vps/restore-pre-gate-e-isolated-webconsole.sh
#
# Variáveis opcionais:
#   DUMP_PATH=/opt/erp-zuccaro/backups/pre-gate-e-20260924-140304.sql
#   EXPECTED_SHA256=e72ca99b453fa6b060b5264f636794b3a601202c18e4185deb12f0020cae3f80
#   EXPECTED_BYTES=390275
#   DB_CONTAINER=supabase-db
#   DEV_DBNAME=postgres
set -Eeuo pipefail

DUMP_PATH="${DUMP_PATH:-/opt/erp-zuccaro/backups/pre-gate-e-20260924-140304.sql}"
EXPECTED_SHA256="${EXPECTED_SHA256:-e72ca99b453fa6b060b5264f636794b3a601202c18e4185deb12f0020cae3f80}"
EXPECTED_BYTES="${EXPECTED_BYTES:-390275}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DEV_DBNAME="${DEV_DBNAME:-postgres}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
ISOLATED_DB="erp_restore_isolated_${STAMP}"

echo "RESTORE_ISOLATED_DB_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "dump_path_basename=$(basename "$DUMP_PATH")"
echo "isolated_database_name=${ISOLATED_DB}"
echo "dev_dbname=${DEV_DBNAME}"
echo "db_container=${DB_CONTAINER}"
echo 'note=nao_usa_DATABASE_URL;nao_executa_DROP_SCHEMA_no_DEV;cria_banco_isolado'

# Fail-closed: nunca restaurar no DEV oficial nem reutilizar nome reservado
if [[ "$ISOLATED_DB" == "$DEV_DBNAME" || "$ISOLATED_DB" == 'postgres' ]]; then
  echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_ISOLATED_EQUALS_DEV'
  exit 1
fi
# Recusa se alguém exportar DATABASE_URL apontando para DEV neste shell
if [[ -n "${DATABASE_URL:-}" ]]; then
  _dbn="$(python3 - <<'PY'
import os, urllib.parse
p = urllib.parse.urlparse(os.environ["DATABASE_URL"])
name = (p.path or "").lstrip("/").split("?")[0]
if not name:
    name = (urllib.parse.parse_qs(p.query).get("dbname") or [""])[0]
print(name)
PY
)"
  if [[ "$_dbn" == 'postgres' || "$_dbn" == "$DEV_DBNAME" ]]; then
    echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_DATABASE_URL_POINTS_TO_DEV'
    echo 'NOTE: unset DATABASE_URL ou use banco isolado; este script cria erp_restore_isolated_*'
    exit 1
  fi
fi

if [[ ! -f "$DUMP_PATH" ]]; then
  echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_DUMP_MISSING'
  echo "NOTE: dump ausente em path esperado; nao inventar dump sintetico"
  exit 2
fi

BYTES="$(wc -c <"$DUMP_PATH" | tr -d ' ')"
SHA="$(sha256sum "$DUMP_PATH" | awk '{print $1}')"
MODE="$(stat -c '%a' "$DUMP_PATH" 2>/dev/null || echo UNKNOWN)"
echo "dump_bytes=${BYTES}"
echo "dump_sha256=${SHA}"
echo "dump_mode=${MODE}"

if [[ "$BYTES" != "$EXPECTED_BYTES" ]]; then
  echo "RESTORE_ISOLATED_DB_STATUS=BLOCKED_BYTES_MISMATCH expected=${EXPECTED_BYTES} actual=${BYTES}"
  exit 3
fi
if [[ "$SHA" != "$EXPECTED_SHA256" ]]; then
  echo "RESTORE_ISOLATED_DB_STATUS=BLOCKED_SHA256_MISMATCH"
  exit 4
fi

# Integridade textual do dump (sem imprimir conteúdo)
HEADER_OK=NO
TAIL_OK=NO
if head -c 200 "$DUMP_PATH" | grep -q 'PostgreSQL database dump\|pg_dump'; then
  HEADER_OK=YES
fi
if tail -n 5 "$DUMP_PATH" | grep -qiE 'PostgreSQL database dump complete|dump_complete'; then
  TAIL_OK=YES
fi
echo "integrity_header_pg_dump=${HEADER_OK}"
echo "integrity_tail_complete=${TAIL_OK}"
[[ "$HEADER_OK" == 'YES' && "$TAIL_OK" == 'YES' ]] || {
  echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_DUMP_INTEGRITY'
  exit 5
}

# Snapshot DEV antes (identidade + contagem migrations) — somente leitura
dev_before="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$DEV_DBNAME" -tAc \
  "SELECT current_database()||'|'||(SELECT system_identifier::text FROM pg_control_system())||'|mig='||(SELECT count(*)::text FROM schema_migrations);")"
echo "dev_before_sanitized=$(echo "$dev_before" | sed -E 's/[0-9]{10,}/REDACTED_CLUSTER/g')"
# Guarda valor bruto só em variável local para comparação
DEV_BEFORE_RAW="$dev_before"

# Criar banco isolado (NÃO é DEV)
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT 1 FROM pg_database WHERE datname='${ISOLATED_DB}'" | grep -q 1 && {
  echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_ISOLATED_DB_ALREADY_EXISTS'
  exit 6
}
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE ${ISOLATED_DB};"
echo "isolated_db_created=${ISOLATED_DB}"

# Restore SOMENTE no isolado (dump via stdin; dump permanece no host)
set +e
docker exec -i "$DB_CONTAINER" psql -U postgres -d "$ISOLATED_DB" -v ON_ERROR_STOP=1 <"$DUMP_PATH" \
  >/tmp/restore-isolated-${STAMP}.log 2>&1
rc=$?
set -e
if (( rc != 0 )); then
  echo "RESTORE_ISOLATED_DB_STATUS=BLOCKED_RESTORE_FAILED rc=${rc}"
  # limpa isolado em falha parcial
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${ISOLATED_DB};" || true
  exit 7
fi
echo 'restore_psql_rc=0'

# Contagens no isolado
iso_mig="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$ISOLATED_DB" -tAc \
  "SELECT count(*) FROM schema_migrations;" 2>/dev/null || echo MISSING)"
iso_mig_ids="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$ISOLATED_DB" -tAc \
  "SELECT string_agg(id, ',' ORDER BY id) FROM schema_migrations;" 2>/dev/null || echo MISSING)"
iso_db="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$ISOLATED_DB" -tAc "SELECT current_database();")"

echo "isolated_current_database=${iso_db}"
echo "isolated_schema_migrations_count=${iso_mig}"
# Sanitiza lista: só IDs de arquivo
echo "isolated_schema_migrations_ids=${iso_mig_ids}"

# DEV depois — deve ser idêntico
dev_after="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$DEV_DBNAME" -tAc \
  "SELECT current_database()||'|'||(SELECT system_identifier::text FROM pg_control_system())||'|mig='||(SELECT count(*)::text FROM schema_migrations);")"
echo "dev_after_sanitized=$(echo "$dev_after" | sed -E 's/[0-9]{10,}/REDACTED_CLUSTER/g')"

if [[ "$DEV_BEFORE_RAW" != "$dev_after" ]]; then
  echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_DEV_CHANGED'
  exit 8
fi
echo 'dev_untouched=YES'

# Esperado pós pre-gate-e: 001–015 (15). Se diferente, reportar sem falhar hard se dump antigo diferir.
echo "expected_migrations_pre_gate_e=015"
if [[ "$iso_mig" == "15" ]]; then
  echo 'isolated_migrations_match_pre_gate_e=YES'
else
  echo 'isolated_migrations_match_pre_gate_e=CHECK'
fi

echo "PASTE_TO_GIT_BEGIN"
echo "# Evidência sanitizada — restore isolado dump pré-Gate E (VPS)"
echo "# utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "dump_basename=$(basename "$DUMP_PATH")"
echo "dump_bytes=${BYTES}"
echo "dump_sha256=${SHA}"
echo "dump_sha256_match_expected=YES"
echo "integrity_header_pg_dump=${HEADER_OK}"
echo "integrity_tail_complete=${TAIL_OK}"
echo "isolated_database_name=${ISOLATED_DB}"
echo "isolated_schema_migrations_count=${iso_mig}"
echo "isolated_schema_migrations_ids=${iso_mig_ids}"
echo "dev_dbname=${DEV_DBNAME}"
echo "dev_untouched=YES"
echo "dump_left_on_vps=YES"
echo "dump_committed_to_git=NO"
echo "RESTORE_ISOLATED_DB_STATUS=OK"
echo "AUTHORIZES_GATES_DEF=NO"
echo "EXECUTE_DEF=NO"
echo "APPLY_MIGRATIONS=NO"
echo "START_CANARY=NO"
echo "PASTE_TO_GIT_END"

echo "RESTORE_ISOLATED_DB_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
