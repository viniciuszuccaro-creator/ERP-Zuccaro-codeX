#!/usr/bin/env bash
# Sincroniza SUPABASE_* do compose Supabase → .env.erp.dev, reinicia API,
# reprovisiona synth e prova login BFF (sem imprimir chaves/token/senha no final).
#
# Uso:
#   CONFIRM_AUTH_LOGIN_REPAIR=YES ERP_DOCKER_NETWORK=supabase_default \
#     bash scripts/vps/repair-auth-login-erp-dev.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_AUTH_LOGIN_REPAIR="${CONFIRM_AUTH_LOGIN_REPAIR:-}"
SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
SUPA_ENV="${SUPA_ENV:-/root/supabase/docker/.env}"
ERP_ENV_FILE="${ERP_ENV_FILE:-.env.erp.dev}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.erp.yml}"
PROVISION="${PROVISION:-$ROOT/scripts/vps/provision-gate-d-auth-synthetic.sh}"

echo "AUTH_LOGIN_REPAIR_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

[[ "$CONFIRM_AUTH_LOGIN_REPAIR" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_AUTH_LOGIN_REPAIR=YES' >&2
  exit 2
}
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK}"
[[ -f "$SUPA_ENV" ]] || { echo 'BLOCKED: supabase_env_missing' >&2; exit 1; }
[[ -f "$ERP_ENV_FILE" ]] || { echo 'BLOCKED: erp_env_missing' >&2; exit 1; }
[[ -f "$PROVISION" ]] || { echo 'BLOCKED: provision_missing' >&2; exit 1; }

env_get() {
  local file="$1" key="$2" line
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"
  elif [[ "$line" =~ ^\'.*\'$ ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}

ANON="$(env_get "$SUPA_ENV" ANON_KEY)"
[[ -z "$ANON" ]] && ANON="$(env_get "$SUPA_ENV" SUPABASE_ANON_KEY)"
SR="$(env_get "$SUPA_ENV" SERVICE_ROLE_KEY)"
[[ -z "$SR" ]] && SR="$(env_get "$SUPA_ENV" SUPABASE_SERVICE_ROLE_KEY)"
[[ ${#ANON} -ge 40 ]] || { echo 'BLOCKED: anon_too_short' >&2; exit 3; }
[[ ${#SR} -ge 40 ]] || { echo 'BLOCKED: service_role_too_short' >&2; exit 3; }
echo "anon_len=${#ANON}"
echo "service_role_len=${#SR}"

# URL interna na network Docker (erp-api fala com Kong pelo hostname do compose Supabase)
SUPA_URL_ERP="$(env_get "$ERP_ENV_FILE" SUPABASE_URL)"
if [[ -z "$SUPA_URL_ERP" || "$SUPA_URL_ERP" == *'<'* ]]; then
  SUPA_URL_ERP='http://kong:8000'
fi
# Preferir host que o container erp-api resolve
if docker exec erp-api-dev getent hosts kong >/dev/null 2>&1; then
  SUPA_URL_ERP='http://kong:8000'
elif docker exec erp-api-dev getent hosts supabase-kong >/dev/null 2>&1; then
  SUPA_URL_ERP='http://supabase-kong:8000'
fi
echo "supabase_url_erp=${SUPA_URL_ERP}"

# Atualiza .env.erp.dev sem ecoar segredos
python3 - "$ERP_ENV_FILE" "$SUPA_URL_ERP" "$ANON" "$SR" <<'PY'
from pathlib import Path
import re, sys
path = Path(sys.argv[1])
url, anon, sr = sys.argv[2], sys.argv[3], sys.argv[4]
text = path.read_text()

def upsert(text, key, value):
    line = f'{key}={value}'
    if re.search(rf'^{re.escape(key)}=.*$', text, re.M):
        return re.sub(rf'^{re.escape(key)}=.*$', line, text, count=1, flags=re.M)
    return text.rstrip() + '\n' + line + '\n'

text = upsert(text, 'SUPABASE_URL', url)
text = upsert(text, 'SUPABASE_ANON_KEY', anon)
text = upsert(text, 'SUPABASE_SERVICE_ROLE_KEY', sr)
if not re.search(r'^ERP_AUTH_MODE=', text, re.M):
    text = upsert(text, 'ERP_AUTH_MODE', 'supabase_user')
elif 'ERP_AUTH_MODE=dev_headers' in text:
    text = upsert(text, 'ERP_AUTH_MODE', 'supabase_user')
path.write_text(text)
print('erp_env_supabase_synced=YES')
PY

export ERP_DOCKER_NETWORK
docker compose -f "$COMPOSE_FILE" --env-file "$ERP_ENV_FILE" up -d --no-deps --force-recreate erp-api

for i in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3080/health 2>/dev/null || true)"
  echo "health_3080_poll_${i}=${code}"
  [[ "$code" == "200" ]] && break
  sleep 2
done

# Senha nova — mostra uma vez
SYNTH_PASS="$(openssl rand -base64 24)"
echo "=========================================="
echo "COPIE PARA O COFRE (não cole no chat):"
echo "E-MAIL=${SYNTH_EMAIL}"
echo "SENHA=${SYNTH_PASS}"
echo "=========================================="

SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" ENV_FILE="$SUPA_ENV" \
  bash "$PROVISION"

# Prova GoTrue no host
GOTRUE_HTTP="$(curl -sS -o /tmp/repair-auth-$$.json -w '%{http_code}' --connect-timeout 8 \
  -X POST 'http://127.0.0.1:8000/auth/v1/token?grant_type=password' \
  -H "apikey: ${ANON}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" 2>/dev/null || true)"
rm -f /tmp/repair-auth-$$.json
echo "gotrue_password_http=${GOTRUE_HTTP}"

# Prova BFF com Origin
BFF_BODY="$(curl -sS -m 12 -X POST 'http://127.0.0.1:3080/api/v1/auth/session' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://erp-dev.cpaferroeaco.com.br' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" \
  -w '|http=%{http_code}' 2>/dev/null || true)"
BFF_HTTP="${BFF_BODY##*|http=}"
BFF_JSON="${BFF_BODY%|http=*}"
echo "bff_login_http=${BFF_HTTP}"
python3 -c 'import json,sys
raw=sys.argv[1]
try: d=json.loads(raw)
except Exception: print("bff_parse=FAIL"); raise SystemExit(0)
err=d.get("error") or {}; data=d.get("data") or {}
if data.get("access_token") and data.get("profiles"):
  print("bff_login=OK"); print("profiles_count="+str(len(data["profiles"])))
elif err: print("bff_error_code="+str(err.get("code") or "")); print("bff_error_message="+str(err.get("message") or "")[:100])
else: print("bff_login=UNKNOWN")
' "$BFF_JSON" 2>/dev/null || echo 'bff_parse=FAIL'

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' 2>/dev/null || echo 'profiles_synth_ativos=ERR'
SELECT 'profiles_synth_ativos='||count(*)::text FROM profiles
 WHERE lower(email)=lower(:'synth_email') AND ativo IS TRUE AND auth_user_id IS NOT NULL;
SQL

# Diagnóstico Auth user (sem UUID/senha)
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' 2>/dev/null || echo 'auth_diag=ERR'
SELECT 'auth_user_count='||count(*)::text FROM auth.users WHERE lower(coalesce(email,''))=lower(:'synth_email');
SELECT 'auth_confirmed='||count(*)::text FROM auth.users
 WHERE lower(coalesce(email,''))=lower(:'synth_email') AND email_confirmed_at IS NOT NULL;
SELECT 'auth_banned='||count(*)::text FROM auth.users
 WHERE lower(coalesce(email,''))=lower(:'synth_email') AND banned_until IS NOT NULL AND banned_until > now();
SQL

if [[ "$GOTRUE_HTTP" != "200" ]]; then
  echo 'BLOCKED: gotrue_password_grant_failed' >&2
  exit 4
fi
if [[ "$BFF_HTTP" != "200" ]]; then
  echo 'BLOCKED: bff_login_failed — API pode ter ANON/URL diferente do Auth' >&2
  exit 5
fi

echo "AUTH_LOGIN_REPAIR_OK"
echo "NEXT=hard_refresh_browser_colar_senha_exata_do_cofre"
echo "AUTH_LOGIN_REPAIR_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
