#!/usr/bin/env bash
# Reprovisiona Auth sintético + prova login local (sem imprimir token/senha no final).
# Uso (Web Console) — a SENHA aparece UMA vez; copie para o cofre, não cole no chat:
#   CONFIRM_AUTH_SYNTH_RESET=YES bash scripts/vps/reset-auth-synth-login.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_AUTH_SYNTH_RESET="${CONFIRM_AUTH_SYNTH_RESET:-}"
SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"
PROVISION="${PROVISION:-$ROOT/scripts/vps/provision-gate-d-auth-synthetic.sh}"

echo "AUTH_SYNTH_RESET_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

[[ "$CONFIRM_AUTH_SYNTH_RESET" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_AUTH_SYNTH_RESET=YES' >&2
  exit 2
}
[[ -f "$PROVISION" ]] || { echo "BLOCKED: provision_script_missing" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "BLOCKED: supabase_env_missing" >&2; exit 1; }

case "$SYNTH_EMAIL" in
  *@dev.synthetic.local) ;;
  *) echo 'BLOCKED: synth_email_must_be_dev_synthetic_local' >&2; exit 2 ;;
esac

SYNTH_PASS="$(openssl rand -base64 24)"
echo "=========================================="
echo "COPIE AGORA PARA O COFRE LOCAL (não cole no chat):"
echo "E-MAIL=${SYNTH_EMAIL}"
echo "SENHA=${SYNTH_PASS}"
echo "=========================================="

SYNTH_EMAIL="$SYNTH_EMAIL" SYNTH_PASS="$SYNTH_PASS" ENV_FILE="$ENV_FILE" \
  bash "$PROVISION"

# Anon key só para prova local — não imprime
env_get() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"
  elif [[ "$line" =~ ^\'.*\'$ ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}
ANON="$(env_get ANON_KEY)"
[[ -z "$ANON" ]] && ANON="$(env_get SUPABASE_ANON_KEY)"
[[ -n "$ANON" ]] || { echo 'BLOCKED: anon_missing' >&2; exit 3; }

# Prova GoTrue direto (só HTTP code)
GOTRUE_HTTP="$(curl -sS -o /tmp/auth-synth-login-$$.json -w '%{http_code}' --connect-timeout 8 \
  -X POST 'http://127.0.0.1:8000/auth/v1/token?grant_type=password' \
  -H "apikey: ${ANON}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" 2>/dev/null || true)"
rm -f /tmp/auth-synth-login-$$.json
echo "gotrue_password_http=${GOTRUE_HTTP}"

# Prova BFF com Origin do browser (só code + código de erro)
BFF_BODY="$(curl -sS -m 10 -X POST 'http://127.0.0.1:3080/api/v1/auth/session' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://erp-dev.cpaferroeaco.com.br' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" \
  -w '|http=%{http_code}' 2>/dev/null || true)"
BFF_HTTP="${BFF_BODY##*|http=}"
BFF_JSON="${BFF_BODY%|http=*}"
echo "bff_login_http=${BFF_HTTP}"
python3 -c 'import json,sys
raw=sys.argv[1]
try:
  d=json.loads(raw)
except Exception:
  print("bff_parse=FAIL"); raise SystemExit(0)
err=(d.get("error") or {})
data=d.get("data") or {}
if data.get("access_token") and data.get("profiles"):
  print("bff_login=OK")
  print("profiles_count="+str(len(data.get("profiles") or [])))
elif err:
  print("bff_error_code="+str(err.get("code") or ""))
  print("bff_error_message="+str(err.get("message") or "")[:80])
else:
  print("bff_login=UNKNOWN")
' "$BFF_JSON" 2>/dev/null || echo 'bff_parse=FAIL'

# Contagens (sem UUID/e-mail)
docker exec supabase-db psql -X -U postgres -d postgres -Atc \
  "SELECT 'profiles_synth_ativos='||count(*)::text FROM profiles WHERE lower(email)=lower('${SYNTH_EMAIL}') AND ativo IS TRUE AND auth_user_id IS NOT NULL;" \
  2>/dev/null || echo 'profiles_synth_ativos=ERR'

if [[ "$GOTRUE_HTTP" != "200" ]]; then
  echo 'BLOCKED: gotrue_password_grant_failed' >&2
  exit 4
fi
if [[ "$BFF_HTTP" != "200" ]]; then
  echo 'BLOCKED: bff_login_failed_after_provision' >&2
  exit 5
fi

echo "AUTH_SYNTH_RESET_OK"
echo "NEXT=hard_refresh_e_usar_email_senha_mostrados_acima"
echo "AUTH_SYNTH_RESET_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
