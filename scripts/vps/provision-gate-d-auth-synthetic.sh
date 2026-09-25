#!/usr/bin/env bash
# Provisiona identidade Auth sintética + profile ERP para Gate D (DEV).
# NÃO imprime service_role, senha, token ou UUID.
# NÃO faz `source` do .env completo (pode ter linhas inválidas tipo "Organization").
# Uso (Web Console, uma linha após definir SYNTH_*):
#   SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' SYNTH_PASS='...' \
#     bash scripts/vps/provision-gate-d-auth-synthetic.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"
SYNTH_EMAIL="${SYNTH_EMAIL:?Set SYNTH_EMAIL}"
SYNTH_PASS="${SYNTH_PASS:?Set SYNTH_PASS}"

echo "GATE_AUTH_PROVISION_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "AUTHORIZES_CANARY=NO"
echo "alter_3080=NOT_PERFORMED"

[[ -f "$ENV_FILE" ]] || { echo "BLOCKED: env_file_missing path_set=YES" >&2; exit 2; }

# Lê só KEY=VALUE — evita source quebrado do .env Supabase
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

http_health="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 "${AUTH_BASE}/auth/v1/health" 2>/dev/null || true)"
echo "auth_health=${http_health}"
if [[ "$http_health" != "200" ]]; then
  AUTH_BASE='http://127.0.0.1:8000'
  http_health="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 "${AUTH_BASE}/auth/v1/health" 2>/dev/null || true)"
  echo "auth_base_local_fallback=YES"
  echo "auth_health_local=${http_health}"
fi

TMP_JSON="$(mktemp)"
TMP_UUID="$(mktemp)"
TMP_HOST_JSON="/tmp/gate-d-auth-create-$$.json"
cleanup() { rm -f "$TMP_JSON" "$TMP_UUID" "$TMP_HOST_JSON"; }
trap cleanup EXIT

extract_uuid() {
  python3 - "$TMP_JSON" "$TMP_UUID" <<'PY'
import json, sys
path, out = sys.argv[1], sys.argv[2]
try:
    d = json.load(open(path))
except Exception:
    open(out, 'w').write('')
    print('auth_user_created=NO')
    raise SystemExit(0)
uid = d.get('id') or (d.get('user') or {}).get('id') or ''
if not uid and isinstance(d.get('users'), list) and d['users']:
    uid = d['users'][0].get('id') or ''
open(out, 'w').write(uid)
print('auth_user_created=' + ('YES' if uid else 'NO'))
if not uid:
    err = d.get('error_code') or d.get('error') or d.get('msg') or d.get('message') or 'unknown'
    print('auth_error_hint=' + str(err)[:80].replace(' ', '_'))
PY
}

# Resolve UUID por e-mail via SQL (sem imprimir o UUID)
resolve_uuid_sql() {
  docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v synth_email="$SYNTH_EMAIL" -Atc \
    "SELECT id::text FROM auth.users WHERE lower(email)=lower(:'synth_email') ORDER BY created_at DESC LIMIT 1;" \
    >"$TMP_UUID" 2>/dev/null || true
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
extract_uuid

# Se Kong falhou ou não devolveu UUID, tenta GoTrue na rede Docker (JSON no host via -v)
if [[ ! -s "$TMP_UUID" ]]; then
  NET="$(docker inspect -f '{{range $k, $_ := .NetworkSettings.Networks}}{{println $k}}{{end}}' supabase-auth 2>/dev/null | head -1 || true)"
  if [[ -n "$NET" ]]; then
    echo "docker_net_fallback=YES"
    for host in supabase-auth auth; do
      rm -f "$TMP_HOST_JSON"
      http_d="$(docker run --rm --network "$NET" \
        -v /tmp:/tmp \
        curlimages/curl:8.5.0 \
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
        extract_uuid
        [[ -s "$TMP_UUID" ]] && break
      fi
      # 422 = e-mail já existe (comum após 200 em tentativa anterior sem capturar UUID)
      if [[ "$http_d" == "422" || "$http_d" == "200" ]]; then
        resolve_uuid_sql
        [[ -s "$TMP_UUID" ]] && break
      fi
    done
  else
    echo 'docker_net_fallback=NO'
  fi
fi

# Último recurso: usuário já criado em tentativa anterior
if [[ ! -s "$TMP_UUID" ]]; then
  resolve_uuid_sql
fi

[[ -s "$TMP_UUID" ]] || { echo 'BLOCKED: auth_user_not_created' >&2; exit 3; }
AUTH_UUID="$(cat "$TMP_UUID")"

# Atualiza senha (idempotente) para a SYNTH_PASS desta execução — sem imprimir corpo
if [[ "$http_health" == "200" ]]; then
  curl -sS -o /dev/null -w 'http_pw_update=%{http_code}\n' --connect-timeout 5 \
    -X PUT "${AUTH_BASE}/auth/v1/admin/users/${AUTH_UUID}" \
    -H "apikey: ${SR}" \
    -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}" \
    2>/dev/null || echo 'http_pw_update=SKIP'
else
  NET="$(docker inspect -f '{{range $k, $_ := .NetworkSettings.Networks}}{{println $k}}{{end}}' supabase-auth 2>/dev/null | head -1 || true)"
  if [[ -n "$NET" ]]; then
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
fi

# Profile: vincula se ainda não houver auth_user_id para este e-mail/UUID
# (variáveis psql fora de $$ — :'var' não expande dentro de DO $$)
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
