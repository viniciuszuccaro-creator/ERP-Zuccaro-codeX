#!/usr/bin/env bash
# Provisiona identidade Auth sintética + profile ERP para Gate D (DEV).
# NÃO imprime service_role, senha, token ou UUID.
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
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

SR="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
[[ -n "$SR" ]] || { echo 'BLOCKED: service_role_missing' >&2; exit 2; }
echo 'service_role_loaded=YES'

AUTH_BASE="${API_EXTERNAL_URL:-}"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE="${SUPABASE_PUBLIC_URL:-}"
[[ -z "$AUTH_BASE" ]] && AUTH_BASE='http://127.0.0.1:8000'
AUTH_BASE="${AUTH_BASE%/}"
echo "auth_base_len=${#AUTH_BASE}"

http_health="$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH_BASE}/auth/v1/health" || true)"
echo "auth_health=${http_health}"

TMP_JSON="$(mktemp)"
TMP_UUID="$(mktemp)"
cleanup() { rm -f "$TMP_JSON" "$TMP_UUID"; }
trap cleanup EXIT

create_via_kong() {
  curl -sS -o "$TMP_JSON" -w '%{http_code}' \
    -X POST "${AUTH_BASE}/auth/v1/admin/users" \
    -H "apikey: ${SR}" \
    -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}"
}

http_create="$(create_via_kong || true)"
echo "http_kong=${http_create}"

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
# retry / duplicate may nest differently
if not uid and isinstance(d.get('msg'), str):
    uid = ''
open(out, 'w').write(uid)
print('auth_user_created=' + ('YES' if uid else 'NO'))
if not uid:
    # sanitized error hint only
    err = d.get('error_code') or d.get('error') or d.get('msg') or d.get('message') or 'unknown'
    print('auth_error_hint=' + str(err)[:80].replace(' ', '_'))
PY
}

extract_uuid

if [[ ! -s "$TMP_UUID" ]]; then
  # Fallback: GoTrue direto na rede Docker
  NET="$(docker inspect -f '{{range $k, $_ := .NetworkSettings.Networks}}{{println $k}}{{end}}' supabase-auth 2>/dev/null | head -1 || true)"
  AUTH_HOST='supabase-auth'
  if [[ -n "$NET" ]]; then
    echo "docker_net_fallback=YES"
    for host in supabase-auth auth; do
      http_d="$(docker run --rm --network "$NET" curlimages/curl:8.5.0 \
        -sS -o /tmp/auth-create-inner.json -w '%{http_code}' \
        -X POST "http://${host}:9999/admin/users" \
        -H "apikey: ${SR}" \
        -H "Authorization: Bearer ${SR}" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\",\"email_confirm\":true}" \
        2>/dev/null || true)"
      echo "http_direct_${host}=${http_d}"
      if [[ -s /tmp/auth-create-inner.json ]]; then
        cp /tmp/auth-create-inner.json "$TMP_JSON"
        extract_uuid
        [[ -s "$TMP_UUID" ]] && break
      fi
    done
  else
    echo 'docker_net_fallback=NO'
  fi
fi

[[ -s "$TMP_UUID" ]] || { echo 'BLOCKED: auth_user_not_created' >&2; exit 3; }
AUTH_UUID="$(cat "$TMP_UUID")"

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v auth_uuid="$AUTH_UUID" <<'SQL'
INSERT INTO profiles (
  id, email, full_name, role, ativo, group_id, empresa_id, auth_user_id, permissoes
) VALUES (
  gen_random_uuid(),
  'gate-d.synth@dev.synthetic.local',
  'Gate D Synth Actor',
  'user',
  true,
  (SELECT id FROM groups ORDER BY id LIMIT 1),
  (SELECT id FROM empresas WHERE group_id = (SELECT id FROM groups ORDER BY id LIMIT 1) ORDER BY id LIMIT 1),
  :'auth_uuid'::uuid,
  '{"Comercial":{"orcamento":["visualizar","criar","editar","cancelar"],"pedido":["visualizar","criar","editar","cancelar","converter-pedido","alterar-status"]}}'::jsonb
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
