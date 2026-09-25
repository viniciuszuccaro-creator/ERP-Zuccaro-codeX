#!/usr/bin/env bash
# Provisiona identidade Auth sintética + profile ERP para Gate D (DEV).
# NÃO imprime service_role, senha, token ou UUID.
# NÃO faz `source` do .env completo (pode ter linhas inválidas tipo "Organization").
# Uso (Web Console):
#   SYNTH_PASS="$(openssl rand -base64 24)"   # guarde no cofre local; não cole no chat
#   SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' SYNTH_PASS="$SYNTH_PASS" \
#     bash /tmp/provision-gate-d-auth.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"
SYNTH_EMAIL="${SYNTH_EMAIL:?Set SYNTH_EMAIL}"
SYNTH_PASS="${SYNTH_PASS:?Set SYNTH_PASS}"

echo "GATE_AUTH_PROVISION_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "AUTHORIZES_CANARY=NO"
echo "alter_3080=NOT_PERFORMED"

case "${SYNTH_PASS}" in
  SENHA_DO_COFRE_OPENSSL|SENHA_DO_COFRE|SENHA_REAL_DO_COFRE|SENHA_FORTE_LOCAL|SUA_SENHA_FORTE|COLOQUE_SENHA_FORTE_AQUI|'...'|'…')
    echo 'BLOCKED: synth_pass_is_placeholder_from_chat' >&2
    echo 'HINT=use_SYNTH_PASS="$(openssl rand -base64 24)"' >&2
    exit 2
    ;;
esac
[[ ${#SYNTH_PASS} -ge 12 ]] || { echo 'BLOCKED: synth_pass_too_short' >&2; exit 2; }

[[ -f "$ENV_FILE" ]] || { echo "BLOCKED: env_file_missing path_set=YES" >&2; exit 2; }

env_get() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then
    line="${line:1:${#line}-2}"
  elif [[ "$line" =~ ^\'.*\'$ ]]; then
    line="${line:1:${#line}-2}"
  fi
  printf '%s' "$line"
}

SR="$(env_get SERVICE_ROLE_KEY)"
[[ -z "$SR" ]] && SR="$(env_get SUPABASE_SERVICE_ROLE_KEY)"
[[ -n "$SR" ]] || { echo 'BLOCKED: service_role_missing' >&2; exit 2; }
echo 'service_role_loaded=YES'

AUTH_BASE="$(env_get API_EXTERNAL_URL)"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE="$(env_get SUPABASE_PUBLIC_URL)"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE="$(env_get KONG_URL)"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE='http://127.0.0.1:8000'
AUTH_BASE="${AUTH_BASE%/}"
echo "auth_base_len=${#AUTH_BASE}"

auth_health_code() {
  local base="$1"
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 \
    -H "apikey: ${SR}" -H "Authorization: Bearer ${SR}" \
    "${base}/auth/v1/health" 2>/dev/null || true
}

http_health="$(auth_health_code "$AUTH_BASE")"
echo "auth_health=${http_health}"
if [[ "$http_health" != "200" ]]; then
  AUTH_BASE='http://127.0.0.1:8000'
  http_health="$(auth_health_code "$AUTH_BASE")"
  echo "auth_base_local_fallback=YES"
  echo "auth_health_local=${http_health}"
fi

TMP_JSON="$(mktemp)"
TMP_UUID="$(mktemp)"
TMP_HOST_JSON="/tmp/gate-d-auth-create-$$.json"
TMP_LIST_JSON="/tmp/gate-d-auth-list-$$.json"
cleanup() { rm -f "$TMP_JSON" "$TMP_UUID" "$TMP_HOST_JSON" "$TMP_LIST_JSON"; }
trap cleanup EXIT

NET="$(docker inspect -f '{{range $k, $_ := .NetworkSettings.Networks}}{{println $k}}{{end}}' supabase-auth 2>/dev/null | head -1 || true)"

extract_uuid_from_json() {
  local src="${1:-$TMP_JSON}"
  python3 - "$src" "$TMP_UUID" "$SYNTH_EMAIL" <<'PY'
import json, sys
path, out, email = sys.argv[1], sys.argv[2], sys.argv[3].lower()
try:
    d = json.load(open(path))
except Exception:
    open(out, 'w').write('')
    print('auth_user_created=NO')
    raise SystemExit(0)

def pick(obj):
    if not isinstance(obj, dict):
        return ''
    uid = obj.get('id') or ''
    if uid:
        return uid
    user = obj.get('user')
    if isinstance(user, dict) and user.get('id'):
        return user['id']
    return ''

uid = pick(d)
if not uid and isinstance(d.get('users'), list):
    for u in d['users']:
        if not isinstance(u, dict):
            continue
        em = (u.get('email') or '').lower()
        if em == email or not email:
            uid = u.get('id') or ''
            if uid:
                break
    if not uid and d['users']:
        uid = d['users'][0].get('id') or ''

open(out, 'w').write(uid or '')
print('auth_user_created=' + ('YES' if uid else 'NO'))
if not uid:
    err = d.get('error_code') or d.get('error') or d.get('msg') or d.get('message') or 'unknown'
    print('auth_error_hint=' + str(err)[:80].replace(' ', '_'))
PY
}

# Resolve UUID via Admin API (mesma instância GoTrue que respondeu email_exists)
resolve_uuid_admin() {
  : >"$TMP_UUID"
  local http_list=""
  # 1) Kong
  http_list="$(curl -sS -o "$TMP_LIST_JSON" -w '%{http_code}' --connect-timeout 5 \
    -H "apikey: ${SR}" -H "Authorization: Bearer ${SR}" \
    "${AUTH_BASE}/auth/v1/admin/users?page=1&per_page=200" 2>/dev/null || true)"
  echo "http_admin_list_kong=${http_list}"
  if [[ -s "$TMP_LIST_JSON" ]]; then
    extract_uuid_from_json "$TMP_LIST_JSON"
    [[ -s "$TMP_UUID" ]] && { echo 'auth_user_resolved_admin=YES'; return 0; }
  fi
  # 2) Docker direto
  if [[ -n "$NET" ]]; then
    rm -f "$TMP_LIST_JSON"
    http_list="$(docker run --rm --network "$NET" -v /tmp:/tmp curlimages/curl:8.5.0 \
      -sS -o "$TMP_LIST_JSON" -w '%{http_code}' \
      -H "apikey: ${SR}" -H "Authorization: Bearer ${SR}" \
      "http://supabase-auth:9999/admin/users?page=1&per_page=200" \
      2>/dev/null || true)"
    echo "http_admin_list_direct=${http_list}"
    if [[ -s "$TMP_LIST_JSON" ]]; then
      extract_uuid_from_json "$TMP_LIST_JSON"
      [[ -s "$TMP_UUID" ]] && { echo 'auth_user_resolved_admin=YES'; return 0; }
    fi
  fi
  echo 'auth_user_resolved_admin=NO'
  return 0
}

# Resolve UUID por e-mail via SQL (heredoc; tenta users + identities)
resolve_uuid_sql() {
  : >"$TMP_UUID"
  local sql_err="/tmp/gate-d-auth-sql-$$.err"
  docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_UUID" 2>"$sql_err" || true
SELECT id::text FROM auth.users
 WHERE lower(coalesce(email,'')) = lower(:'synth_email')
 ORDER BY created_at DESC NULLS LAST
 LIMIT 1;
SQL
  if [[ ! -s "$TMP_UUID" ]]; then
    docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_UUID" 2>>"$sql_err" || true
SELECT user_id::text FROM auth.identities
 WHERE lower(coalesce(identity_data->>'email','')) = lower(:'synth_email')
 ORDER BY created_at DESC NULLS LAST
 LIMIT 1;
SQL
  fi
  # Diagnóstico sanitizado (sem e-mail/UUID)
  docker exec supabase-db psql -X -U postgres -d postgres -Atc \
    "SELECT 'diag_auth_users='||count(*)::text FROM auth.users;" 2>/dev/null || echo 'diag_auth_users=ERR'
  docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v synth_email="$SYNTH_EMAIL" -At <<'SQL' 2>/dev/null || echo 'diag_auth_match=ERR'
SELECT 'diag_auth_match='||count(*)::text FROM auth.users
 WHERE lower(coalesce(email,'')) = lower(:'synth_email');
SQL
  if [[ -s "$sql_err" ]]; then
    # só indica se houve erro SQL, sem detalhe sensível
    echo "diag_sql_err=YES"
  else
    echo "diag_sql_err=NO"
  fi
  rm -f "$sql_err"
  if [[ -s "$TMP_UUID" ]]; then
    echo 'auth_user_resolved_sql=YES'
  else
    : >"$TMP_UUID"
    echo 'auth_user_resolved_sql=NO'
  fi
}

create_via_kong() {
  curl -sS -o "$TMP_JSON" -w '%{http_code}' --connect-timeout 5 \
    -X POST "${AUTH_BASE}/auth/v1/admin/users" \
    -H "apikey: ${SR}" \
    -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}" \
    2>/dev/null || true
}

http_create="$(create_via_kong)"
echo "http_kong=${http_create}"
extract_uuid_from_json "$TMP_JSON"

# email_exists → buscar usuário existente imediatamente
if [[ ! -s "$TMP_UUID" ]] && grep -Eq 'email_exists|User already registered' "$TMP_JSON" 2>/dev/null; then
  echo 'email_exists_detected=YES'
  resolve_uuid_admin
  [[ -s "$TMP_UUID" ]] || resolve_uuid_sql
fi

# Fallback GoTrue na rede Docker (JSON no host via -v /tmp)
if [[ ! -s "$TMP_UUID" ]]; then
  if [[ -n "$NET" ]]; then
    echo "docker_net_fallback=YES"
    for host in supabase-auth auth; do
      rm -f "$TMP_HOST_JSON"
      http_d="$(docker run --rm --network "$NET" -v /tmp:/tmp curlimages/curl:8.5.0 \
        -sS -o "$TMP_HOST_JSON" -w '%{http_code}' \
        -X POST "http://${host}:9999/admin/users" \
        -H "apikey: ${SR}" \
        -H "Authorization: Bearer ${SR}" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}" \
        2>/dev/null || true)"
      echo "http_direct_${host}=${http_d}"
      if [[ -s "$TMP_HOST_JSON" ]]; then
        cp "$TMP_HOST_JSON" "$TMP_JSON"
        extract_uuid_from_json "$TMP_JSON"
        [[ -s "$TMP_UUID" ]] && break
      fi
      if [[ "$http_d" == "422" || "$http_d" == "200" ]]; then
        resolve_uuid_admin
        [[ -s "$TMP_UUID" ]] && break
        resolve_uuid_sql
        [[ -s "$TMP_UUID" ]] && break
      fi
    done
  else
    echo 'docker_net_fallback=NO'
  fi
fi

if [[ ! -s "$TMP_UUID" ]]; then
  resolve_uuid_admin
fi
if [[ ! -s "$TMP_UUID" ]]; then
  resolve_uuid_sql
fi

if [[ ! -s "$TMP_UUID" ]]; then
  echo 'BLOCKED: auth_user_not_created' >&2
  echo 'HINT=email_exists_sem_uuid_admin_list_e_sql_vazios' >&2
  exit 3
fi
AUTH_UUID="$(cat "$TMP_UUID")"
echo 'auth_uuid_ready=YES'

# Atualiza senha para a SYNTH_PASS desta execução
if [[ "$http_health" == "200" ]]; then
  curl -sS -o /dev/null -w 'http_pw_update=%{http_code}\n' --connect-timeout 5 \
    -X PUT "${AUTH_BASE}/auth/v1/admin/users/${AUTH_UUID}" \
    -H "apikey: ${SR}" \
    -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}" \
    2>/dev/null || echo 'http_pw_update=SKIP'
elif [[ -n "$NET" ]]; then
  http_pw="$(docker run --rm --network "$NET" curlimages/curl:8.5.0 \
    -sS -o /dev/null -w '%{http_code}' \
    -X PUT "http://supabase-auth:9999/admin/users/${AUTH_UUID}" \
    -H "apikey: ${SR}" \
    -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}" \
    2>/dev/null || true)"
  echo "http_pw_update=${http_pw}"
fi

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v auth_uuid="$AUTH_UUID" \
  -v synth_email="$SYNTH_EMAIL" <<'SQL'
UPDATE profiles
SET ativo = true,
    group_id = COALESCE(group_id, (SELECT id FROM groups ORDER BY id LIMIT 1)),
    empresa_id = COALESCE(empresa_id, (
      SELECT id FROM empresas
      WHERE group_id = (SELECT id FROM groups ORDER BY id LIMIT 1)
      ORDER BY id LIMIT 1
    ))
WHERE auth_user_id = :'auth_uuid'::uuid;

UPDATE profiles
SET auth_user_id = :'auth_uuid'::uuid,
    ativo = true,
    group_id = COALESCE(group_id, (SELECT id FROM groups ORDER BY id LIMIT 1)),
    empresa_id = COALESCE(empresa_id, (
      SELECT id FROM empresas
      WHERE group_id = (SELECT id FROM groups ORDER BY id LIMIT 1)
      ORDER BY id LIMIT 1
    )),
    permissoes = COALESCE(
      permissoes,
      '{"Comercial":{"orcamento":["visualizar","criar","editar","cancelar"],"pedido":["visualizar","criar","editar","cancelar","converter-pedido","alterar-status"]}}'::jsonb
    )
WHERE lower(email) = lower(:'synth_email')
  AND auth_user_id IS NULL;

INSERT INTO profiles (
  id, email, full_name, role, ativo, group_id, empresa_id, auth_user_id, permissoes
)
SELECT
  gen_random_uuid(),
  :'synth_email',
  'Gate D Synth Actor',
  'user',
  true,
  (SELECT id FROM groups ORDER BY id LIMIT 1),
  (SELECT id FROM empresas WHERE group_id = (SELECT id FROM groups ORDER BY id LIMIT 1) ORDER BY id LIMIT 1),
  :'auth_uuid'::uuid,
  '{"Comercial":{"orcamento":["visualizar","criar","editar","cancelar"],"pedido":["visualizar","criar","editar","cancelar","converter-pedido","alterar-status"]}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = :'auth_uuid'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE lower(email) = lower(:'synth_email') AND auth_user_id IS NOT NULL
  );
SQL
echo 'profile_linked=YES'

echo 'PASTE_TO_GIT_BEGIN'
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'auth_users_count='||count(*)::text FROM auth.users;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_com_auth_count='||count(*)::text FROM profiles WHERE auth_user_id IS NOT NULL;"
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_ativos_sem_auth_count='||count(*)::text FROM profiles WHERE ativo AND auth_user_id IS NULL;"
echo 'rbac_minimo=orcamento_pedido'
echo 'AUTH_SYNTHETIC_STATUS=OK'
echo 'AUTHORIZES_CANARY=NO'
echo 'alter_3080=NOT_PERFORMED'
echo 'NOTE=segredos_somente_cofre_local'
echo 'PASTE_TO_GIT_END'
echo "GATE_AUTH_PROVISION_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
