#!/usr/bin/env bash
# Guarda fail-closed: DATABASE_URL deve apontar para banco ISOLADO identificado.
# Bloqueia DEV oficial (dbname=postgres / nomes reservados) antes de DROP SCHEMA.
# Uso: source ou chamar; exporta ISOLATED_DB_NAME_RESOLVED.
# Não imprime a URL completa (sanitiza).
set -Eeuo pipefail

assert_isolated_database_url() {
  local url="${DATABASE_URL:-}"
  local required_name="${ISOLATED_DATABASE_NAME:-}"
  local allow="${ALLOW_DROP_SCHEMA_PUBLIC:-}"

  if [[ -z "$url" ]]; then
    echo 'ISOLATED_DB_GUARD=BLOCKED_NO_DATABASE_URL' >&2
    return 2
  fi

  # Extrai dbname sem imprimir credenciais
  local dbname
  dbname="$(python3 - <<'PY'
import os, urllib.parse
u = os.environ["DATABASE_URL"]
p = urllib.parse.urlparse(u)
name = (p.path or "").lstrip("/")
# query form ?dbname=
if not name:
    q = urllib.parse.parse_qs(p.query)
    name = (q.get("dbname") or [""])[0]
print(name.split("?")[0])
PY
)"

  echo "isolated_db_guard_dbname=${dbname:-EMPTY}"
  echo "isolated_db_guard_required=${required_name:-UNSET}"

  if [[ -z "$dbname" ]]; then
    echo 'ISOLATED_DB_GUARD=BLOCKED_EMPTY_DBNAME' >&2
    return 3
  fi

  case "$dbname" in
    postgres|template0|template1|supabase|supabase_admin)
      echo 'ISOLATED_DB_GUARD=BLOCKED_DEV_OR_RESERVED_DBNAME' >&2
      echo 'NOTE: recusar dbname=postgres (DEV oficial Gate C) e nomes reservados' >&2
      return 4
      ;;
  esac

  if [[ -z "$required_name" ]]; then
    echo 'ISOLATED_DB_GUARD=BLOCKED_ISOLATED_DATABASE_NAME_REQUIRED' >&2
    echo 'NOTE: exporte ISOLATED_DATABASE_NAME=erp_r07b_compat|erp_restore_isolated_*' >&2
    return 5
  fi

  if [[ "$dbname" != "$required_name" ]]; then
    echo 'ISOLATED_DB_GUARD=BLOCKED_DBNAME_MISMATCH' >&2
    echo "NOTE: DATABASE_URL dbname=${dbname} != ISOLATED_DATABASE_NAME=${required_name}" >&2
    return 6
  fi

  # Nome isolado deve ser explícito (prefixo conhecido)
  if [[ ! "$required_name" =~ ^(erp_r07b_compat|erp_restore_isolated)([_-].+)?$ ]]; then
    echo 'ISOLATED_DB_GUARD=BLOCKED_NAME_NOT_IN_ALLOWLIST' >&2
    echo 'NOTE: use erp_r07b_compat ou erp_restore_isolated_*' >&2
    return 7
  fi

  if [[ "$allow" != 'ISOLATED_ONLY' ]]; then
    echo 'ISOLATED_DB_GUARD=BLOCKED_ALLOW_DROP_SCHEMA_PUBLIC_REQUIRED' >&2
    echo 'NOTE: exporte ALLOW_DROP_SCHEMA_PUBLIC=ISOLATED_ONLY para autorizar DROP no isolado' >&2
    return 8
  fi

  export ISOLATED_DB_NAME_RESOLVED="$dbname"
  echo 'ISOLATED_DB_GUARD=OK'
  echo "isolated_database_name=${dbname}"
  echo 'dev_official_dbname_blocked=postgres'
  return 0
}

# Self-test sem Postgres: prova bloqueio de DEV e aceitação do isolado.
run_self_test() {
  local fails=0
  local out

  # 1) DEV oficial (dbname=postgres) deve bloquear
  out="$(
    DATABASE_URL='postgresql://u:p@localhost:5432/postgres' \
    ISOLATED_DATABASE_NAME='erp_r07b_compat' \
    ALLOW_DROP_SCHEMA_PUBLIC='ISOLATED_ONLY' \
    bash "$0" 2>&1 || true
  )"
  echo "$out" | grep -q 'ISOLATED_DB_GUARD=BLOCKED_DEV_OR_RESERVED_DBNAME' || {
    echo 'SELFTEST_FAIL: expected BLOCKED_DEV_OR_RESERVED_DBNAME' >&2
    fails=$((fails + 1))
  }

  # 2) Sem ISOLATED_DATABASE_NAME
  out="$(
    DATABASE_URL='postgresql://u:p@localhost:5432/erp_r07b_compat' \
    ALLOW_DROP_SCHEMA_PUBLIC='ISOLATED_ONLY' \
    bash "$0" 2>&1 || true
  )"
  echo "$out" | grep -q 'ISOLATED_DB_GUARD=BLOCKED_ISOLATED_DATABASE_NAME_REQUIRED' || {
    echo 'SELFTEST_FAIL: expected BLOCKED_ISOLATED_DATABASE_NAME_REQUIRED' >&2
    fails=$((fails + 1))
  }

  # 3) Mismatch de nome
  out="$(
    DATABASE_URL='postgresql://u:p@localhost:5432/erp_r07b_compat' \
    ISOLATED_DATABASE_NAME='erp_restore_isolated_x' \
    ALLOW_DROP_SCHEMA_PUBLIC='ISOLATED_ONLY' \
    bash "$0" 2>&1 || true
  )"
  echo "$out" | grep -q 'ISOLATED_DB_GUARD=BLOCKED_DBNAME_MISMATCH' || {
    echo 'SELFTEST_FAIL: expected BLOCKED_DBNAME_MISMATCH' >&2
    fails=$((fails + 1))
  }

  # 4) Sem ALLOW_DROP_SCHEMA_PUBLIC
  out="$(
    DATABASE_URL='postgresql://u:p@localhost:5432/erp_r07b_compat' \
    ISOLATED_DATABASE_NAME='erp_r07b_compat' \
    bash "$0" 2>&1 || true
  )"
  echo "$out" | grep -q 'ISOLATED_DB_GUARD=BLOCKED_ALLOW_DROP_SCHEMA_PUBLIC_REQUIRED' || {
    echo 'SELFTEST_FAIL: expected BLOCKED_ALLOW_DROP_SCHEMA_PUBLIC_REQUIRED' >&2
    fails=$((fails + 1))
  }

  # 5) Isolado válido (erp_r07b_compat)
  out="$(
    DATABASE_URL='postgresql://u:p@localhost:5432/erp_r07b_compat' \
    ISOLATED_DATABASE_NAME='erp_r07b_compat' \
    ALLOW_DROP_SCHEMA_PUBLIC='ISOLATED_ONLY' \
    bash "$0" 2>&1
  )"
  echo "$out" | grep -q 'ISOLATED_DB_GUARD=OK' || {
    echo 'SELFTEST_FAIL: expected OK for erp_r07b_compat' >&2
    fails=$((fails + 1))
  }

  # 6) Isolado válido (erp_restore_isolated_*)
  out="$(
    DATABASE_URL='postgresql://u:p@localhost:5432/erp_restore_isolated_20260924' \
    ISOLATED_DATABASE_NAME='erp_restore_isolated_20260924' \
    ALLOW_DROP_SCHEMA_PUBLIC='ISOLATED_ONLY' \
    bash "$0" 2>&1
  )"
  echo "$out" | grep -q 'ISOLATED_DB_GUARD=OK' || {
    echo 'SELFTEST_FAIL: expected OK for erp_restore_isolated_*' >&2
    fails=$((fails + 1))
  }

  if (( fails > 0 )); then
    echo "ISOLATED_DB_GUARD_SELFTEST=FAIL fails=${fails}"
    return 1
  fi
  echo 'ISOLATED_DB_GUARD_SELFTEST=OK'
  echo 'dev_official_dbname_blocked=postgres'
  echo 'allowed_prefixes=erp_r07b_compat,erp_restore_isolated_*'
  return 0
}

# Se executado diretamente:
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  if [[ "${1:-}" == '--self-test' ]]; then
    run_self_test
  else
    assert_isolated_database_url
  fi
fi
