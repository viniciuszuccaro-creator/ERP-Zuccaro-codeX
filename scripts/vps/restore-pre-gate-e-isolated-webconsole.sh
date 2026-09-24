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
# Stamp só com [0-9_] — hífen é inválido em identificador SQL sem aspas
STAMP="$(date -u +%Y%m%d_%H%M%S)"
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
# Identificador SQL sem aspas: só [a-z0-9_]
if [[ ! "$ISOLATED_DB" =~ ^[a-z][a-z0-9_]*$ ]]; then
  echo "RESTORE_ISOLATED_DB_STATUS=BLOCKED_INVALID_DBNAME isolated=${ISOLATED_DB}"
  echo 'NOTE: use apenas letras/digitos/underscore (sem hifen)'
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
DEV_BEFORE_RAW="$dev_before"

# Segurança: dump não pode redirecionar psql de volta ao DEV via \connect
CONNECT_COUNT="$(grep -cE '^\\connect' "$DUMP_PATH" || true)"
CONNECT_TO_DEV="$(grep -cE "^\\\\connect[[:space:]]+(\")?${DEV_DBNAME}(\")?([[:space:]]|$)" "$DUMP_PATH" || true)"
echo "dump_connect_directives=${CONNECT_COUNT}"
echo "dump_connect_to_dev=${CONNECT_TO_DEV}"
if (( CONNECT_TO_DEV > 0 )); then
  echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_DUMP_CONNECTS_TO_DEV'
  echo 'NOTE: dump contem \\connect para o banco DEV; abortar sem restaurar'
  exit 9
fi

# Criar banco isolado (NÃO é DEV)
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT 1 FROM pg_database WHERE datname='${ISOLATED_DB}'" | grep -q 1 && {
  echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_ISOLATED_DB_ALREADY_EXISTS'
  exit 6
}
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE ${ISOLATED_DB};"
echo "isolated_db_created=${ISOLATED_DB}"

# Confirma sessão no isolado (nunca no DEV)
iso_probe="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$ISOLATED_DB" -tAc "SELECT current_database();")"
if [[ "$iso_probe" != "$ISOLATED_DB" ]]; then
  echo "RESTORE_ISOLATED_DB_STATUS=BLOCKED_WRONG_TARGET got=${iso_probe}"
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${ISOLATED_DB};" || true
  exit 10
fi

# Pré-reset SOMENTE no isolado: evita ERROR "schema public already exists"
docker exec "$DB_CONTAINER" psql -U postgres -d "$ISOLATED_DB" -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
echo 'isolated_public_schema_reset=YES'

LOG="/tmp/restore-isolated-${STAMP}.log"
# Filtra \\connect e CREATE/COMMENT SCHEMA public (já resetados); dump no host permanece intacto
set +e
grep -vE '^\\connect([[:space:]]|$)|^CREATE SCHEMA public;|^COMMENT ON SCHEMA public' "$DUMP_PATH" \
  | docker exec -i "$DB_CONTAINER" psql -U postgres -d "$ISOLATED_DB" -v ON_ERROR_STOP=1 \
  >"$LOG" 2>&1
rc=$?
set -e

print_sanitized_restore_errors() {
  local log="$1"
  [[ -f "$log" ]] || return 0
  echo 'restore_error_excerpt_sanitized_begin'
  # Só linhas de erro; redige UUID, e-mail, URL, password
  grep -E 'ERROR:|FATAL:|PANIC:|DETAIL:|HINT:|ERROR  ' "$log" 2>/dev/null \
    | head -n 40 \
    | sed -E \
      -e 's/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/REDACTED_UUID/g' \
      -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/REDACTED_EMAIL/g' \
      -e 's#postgres(ql)?://[^[:space:]]+#REDACTED_URL#g' \
      -e 's/(password|secret|token)[=:][^[:space:]]+/\1=REDACTED/gi' \
      -e 's/[0-9]{12,}/REDACTED_LONGNUM/g' \
    || echo '(no ERROR/FATAL lines in log)'
  echo 'restore_error_excerpt_sanitized_end'
  # Classifica causas comuns (sem conteúdo sensível)
  if grep -q 'schema "public" already exists' "$log" 2>/dev/null; then
    echo 'restore_fail_class=PUBLIC_SCHEMA_EXISTS'
  elif grep -qiE 'role .* does not exist' "$log" 2>/dev/null; then
    echo 'restore_fail_class=MISSING_ROLE'
  elif grep -qiE 'extension .* (is not available|does not exist|already exists)' "$log" 2>/dev/null; then
    echo 'restore_fail_class=EXTENSION'
  elif grep -qiE 'permission denied' "$log" 2>/dev/null; then
    echo 'restore_fail_class=PERMISSION'
  elif grep -qiE 'syntax error' "$log" 2>/dev/null; then
    echo 'restore_fail_class=SYNTAX'
  else
    echo 'restore_fail_class=OTHER_SEE_EXCERPT'
  fi
}

if (( rc != 0 )); then
  echo "RESTORE_ISOLATED_DB_STATUS=BLOCKED_RESTORE_FAILED rc=${rc}"
  echo "restore_log_path=${LOG}"
  print_sanitized_restore_errors "$LOG"
  # limpa isolado em falha parcial (DEV intocado)
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${ISOLATED_DB};" || true
  echo "isolated_db_dropped_after_fail=${ISOLATED_DB}"
  # Confirma DEV ainda igual após falha
  dev_after_fail="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$DEV_DBNAME" -tAc \
    "SELECT current_database()||'|'||(SELECT system_identifier::text FROM pg_control_system())||'|mig='||(SELECT count(*)::text FROM schema_migrations);")"
  if [[ "$DEV_BEFORE_RAW" != "$dev_after_fail" ]]; then
    echo 'RESTORE_ISOLATED_DB_STATUS=BLOCKED_DEV_CHANGED_AFTER_FAIL'
    exit 8
  fi
  echo 'dev_untouched_after_fail=YES'
  exit 7
fi
echo 'restore_psql_rc=0'
echo "restore_log_path=${LOG}"

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
