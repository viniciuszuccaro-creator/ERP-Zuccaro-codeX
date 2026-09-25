#!/usr/bin/env bash
# Gate F / acesso browser — URL segura + login Auth + navegação API (sem segredos no Git).
# A promoção 3080 NÃO é URL de browser. URL canônica do SPA DEV: http://127.0.0.1:3081/
# (erp-web nginx same-origin → /api /health /ready).
#
# Uso na VPS:
#   cd /opt/erp-zuccaro
#   SYNTH_PASS="$(openssl rand -base64 24)"   # cofre local
#   SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' SYNTH_PASS="$SYNTH_PASS" \
#     bash scripts/vps/provision-gate-d-auth-synthetic.sh
#   SYNTH_EMAIL=... SYNTH_PASS=... \
#   ERP_BROWSER_URL='http://127.0.0.1:3081/' \
#     bash scripts/vps/gate-f-smoke-browser-login-nav.sh
#
# Opcional: ERP_API_BASE (default same-origin via browser URL), OFFICIAL_API=http://127.0.0.1:3080
set -euo pipefail

ERP_BROWSER_URL="${ERP_BROWSER_URL:-}"
OFFICIAL_API="${OFFICIAL_API:-http://127.0.0.1:3080}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
SYNTH_EMAIL="${SYNTH_EMAIL:-}"
SYNTH_PASS="${SYNTH_PASS:-}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"

echo "GATE_F_BROWSER_LOGIN_NAV_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "NOTE=3080_is_api_not_browser_spa"

url_has_secret_query() {
  echo "$1" | grep -Eiq '[?&](access_token|refresh_token|token|password|passwd|secret|apikey|api_key|anon|service_role|authorization|x-actor-id|x-group-id|x-empresa-id)='
}

assert_url_browser_safe() {
  local label="$1" u="$2"
  if [[ -z "$u" ]]; then
    echo "${label}_set=NO"
    echo "BLOCKED: set_ERP_BROWSER_URL_to_spa_origin" >&2
    echo "HINT=ERP_BROWSER_URL='http://127.0.0.1:3081/'" >&2
    exit 2
  fi
  echo "${label}_set=YES"
  if url_has_secret_query "$u"; then
    echo "BLOCKED: ${label}_contains_secret_or_tenant_query" >&2
    exit 2
  fi
  if echo "$u" | grep -Eiq '^https://'; then
    echo "${label}_https=YES"
  elif echo "$u" | grep -Eiq '^http://(127\.0\.0\.1|localhost)(:|/|$)'; then
    echo "${label}_loopback_http=YES"
  else
    echo "BLOCKED: ${label}_must_be_https_or_loopback_http" >&2
    exit 2
  fi
  echo "${label}_safe=YES"
}

assert_url_browser_safe 'browser_url' "$ERP_BROWSER_URL"
assert_url_browser_safe 'official_api' "$OFFICIAL_API"

code_of() {
  local url="$1"; shift || true
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 "$@" "$url" 2>/dev/null || echo '000'
}

body_of() {
  local url="$1"; shift || true
  curl -sS --connect-timeout 5 "$@" "$url" 2>/dev/null || true
}

# --- SPA (browser) ---
browser_origin="$(echo "$ERP_BROWSER_URL" | sed -E 's#(https?://[^/]+).*#\1#')"
spa_root_code="$(code_of "${browser_origin}/")"
spa_health_code="$(code_of "${browser_origin}/health")"
echo "spa_origin_http=${spa_root_code}"
echo "spa_proxy_health=${spa_health_code}"
[[ "$spa_root_code" =~ ^(200|301|302)$ ]] || {
  echo 'BLOCKED: spa_origin_unreachable' >&2
  echo 'HINT=subir_erp-web_em_3081_ou_ajustar_ERP_BROWSER_URL' >&2
  exit 3
}

# --- API oficial 3080 (não é browser) ---
api_health="$(code_of "${OFFICIAL_API}/health")"
api_ready="$(code_of "${OFFICIAL_API}/ready")"
echo "official_api_health=${api_health}"
echo "official_api_ready=${api_ready}"
[[ "$api_health" == "200" && "$api_ready" == "200" ]] || {
  echo 'BLOCKED: official_api_health_or_ready_not_200' >&2
  exit 3
}

meta_json="$(body_of "${OFFICIAL_API}/api/v1/meta")"
runtime="$(echo "$meta_json" | python3 -c 'import json,sys; m=json.loads(sys.stdin.read() or "{}"); print(m.get("runtime") or "")' 2>/dev/null || true)"
auth_mode="$(echo "$meta_json" | python3 -c 'import json,sys; m=json.loads(sys.stdin.read() or "{}"); print((m.get("auth") or {}).get("mode") or "")' 2>/dev/null || true)"
echo "official_runtime=${runtime}"
echo "official_auth_mode=${auth_mode}"
[[ "$runtime" == "$EXPECTED_RUNTIME" ]] || {
  echo "BLOCKED: runtime_mismatch expected=${EXPECTED_RUNTIME}" >&2
  exit 4
}
[[ "$auth_mode" == "supabase_user" ]] || {
  echo 'BLOCKED: auth_mode_must_be_supabase_user_for_browser_login' >&2
  exit 4
}

# Spoof / no-auth na API (navegação protegida)
no_auth="$(code_of "${OFFICIAL_API}/api/v1/orcamentos")"
spoof="$(code_of "${OFFICIAL_API}/api/v1/orcamentos" -H 'x-actor-id: spoof' -H 'x-group-id: spoof' -H 'x-empresa-id: spoof')"
echo "browser_nav_no_auth_orc=${no_auth}"
echo "browser_nav_spoof_dev_headers=${spoof}"
[[ "$no_auth" =~ ^(401|403)$ ]] || { echo 'BLOCKED: no_auth_must_reject' >&2; exit 5; }
[[ "$spoof" =~ ^(401|403)$ ]] || { echo 'BLOCKED: spoof_must_reject' >&2; exit 5; }
echo "browser_spoof_rejected=YES"

# --- Login Auth sintético (token só em memória; nunca echo) ---
[[ -n "$SYNTH_EMAIL" && -n "$SYNTH_PASS" ]] || {
  echo 'BLOCKED: set_SYNTH_EMAIL_and_SYNTH_PASS_for_login_step' >&2
  exit 2
}
[[ -f "$ENV_FILE" ]] || { echo 'BLOCKED: env_file_missing' >&2; exit 2; }

env_get() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}

ANON="$(env_get ANON_KEY)"
AUTH_BASE="$(env_get API_EXTERNAL_URL)"
[[ -n "$ANON" && ${#ANON} -ge 40 ]] || { echo 'BLOCKED: anon_missing' >&2; exit 2; }
[[ -n "$AUTH_BASE" ]] || AUTH_BASE='http://127.0.0.1:8000'
AUTH_LOCAL='http://127.0.0.1:8000'

token_http="$(curl -sS -o /tmp/gate-f-browser-token.json -w '%{http_code}' --connect-timeout 8 \
  -X POST "${AUTH_LOCAL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" 2>/dev/null || echo '000')"
echo "http_token=${token_http}"
[[ "$token_http" == "200" ]] || {
  echo 'BLOCKED: token_not_issued' >&2
  echo 'HINT=reprovision_auth_synthetic_then_retry' >&2
  rm -f /tmp/gate-f-browser-token.json
  exit 6
}

ACCESS="$(python3 -c 'import json; print(json.load(open("/tmp/gate-f-browser-token.json")).get("access_token") or "")' 2>/dev/null || true)"
rm -f /tmp/gate-f-browser-token.json
[[ -n "$ACCESS" && ${#ACCESS} -ge 40 ]] || { echo 'BLOCKED: access_token_empty' >&2; exit 6; }
echo "token_len=${#ACCESS}"

# Navegação autenticada: meta + listagem orçamentos (sem imprimir body/PII)
nav_meta="$(code_of "${OFFICIAL_API}/api/v1/meta" -H "Authorization: Bearer ${ACCESS}")"
nav_orc="$(code_of "${OFFICIAL_API}/api/v1/orcamentos?limit=1" -H "Authorization: Bearer ${ACCESS}" -H 'Content-Type: application/json')"
# Mesma origem SPA proxy (quando health proxy ok)
nav_spa_api='SKIP'
if [[ "$spa_health_code" == "200" ]]; then
  nav_spa_api="$(code_of "${browser_origin}/api/v1/meta" -H "Authorization: Bearer ${ACCESS}")"
fi
unset ACCESS
echo "nav_api_meta=${nav_meta}"
echo "nav_api_orc_list=${nav_orc}"
echo "nav_spa_proxy_meta=${nav_spa_api}"

ok=YES
[[ "$nav_meta" == "200" ]] || ok=NO
[[ "$nav_orc" =~ ^(200|400|403)$ ]] || ok=NO
# 400 sem tenant headers é aceitável se o BFF exigir x-group/empresa além do Bearer
echo "login_ok=$([[ "$token_http" == "200" ]] && echo YES || echo NO)"
echo "navigation_ok=${ok}"

echo "PASTE_TO_GIT_BEGIN"
echo "browser_url_set=YES"
echo "browser_url_safe=YES"
echo "spa_origin_http=${spa_root_code}"
echo "spa_proxy_health=${spa_health_code}"
echo "official_runtime=${runtime}"
echo "official_auth_mode=${auth_mode}"
echo "http_token=${token_http}"
echo "browser_spoof_rejected=YES"
echo "nav_api_meta=${nav_meta}"
echo "nav_api_orc_list=${nav_orc}"
echo "nav_spa_proxy_meta=${nav_spa_api}"
echo "GATE_F_BROWSER_LOGIN_NAV=$([[ "$ok" == "YES" ]] && echo OK || echo FAIL)"
echo "NOTE=segredos_somente_cofre_local"
echo "NOTE2=ERP_BROWSER_URL_canonico_loopback_3081_or_https_public"
echo "PASTE_TO_GIT_END"

[[ "$ok" == "YES" ]] || exit 7
echo "GATE_F_BROWSER_LOGIN_NAV_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
