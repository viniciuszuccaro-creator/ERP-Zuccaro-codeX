#!/usr/bin/env bash
# Smoke HTTPS externo — login Auth + navegação (sem segredos no Git).
# Exige URL HTTPS pública (não loopback). 400/403 NÃO contam como sucesso de listagem autenticada.
#
# Uso (fora da VPS, após DNS+TLS):
#   ERP_BROWSER_URL='https://erp-dev.cpaferroeaco.com.br/' \
#   SYNTH_EMAIL=... SYNTH_PASS=... \
#     bash scripts/vps/gate-f-smoke-https-external.sh
#
set -euo pipefail

ERP_BROWSER_URL="${ERP_BROWSER_URL:-}"
OFFICIAL_API="${OFFICIAL_API:-}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
SYNTH_EMAIL="${SYNTH_EMAIL:-}"
SYNTH_PASS="${SYNTH_PASS:-}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"

echo "GATE_F_HTTPS_EXTERNAL_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "NOTE=requires_public_https_dns_tls"

if [[ -z "$ERP_BROWSER_URL" ]]; then
  echo 'BLOCKED: set_ERP_BROWSER_URL_https_public' >&2
  echo "HINT=ERP_BROWSER_URL='https://erp-dev.cpaferroeaco.com.br/'" >&2
  exit 2
fi

if ! echo "$ERP_BROWSER_URL" | grep -Eiq '^https://'; then
  echo 'BLOCKED: ERP_BROWSER_URL_must_be_https_for_external_test' >&2
  echo 'HINT=loopback_http_use_gate-f-smoke-browser-login-nav_sh' >&2
  exit 2
fi

if echo "$ERP_BROWSER_URL" | grep -Eiq '127\.0\.0\.1|localhost'; then
  echo 'BLOCKED: external_test_rejects_loopback' >&2
  exit 2
fi

if echo "$ERP_BROWSER_URL" | grep -Eiq '[?&](access_token|refresh_token|token|password|apikey|service_role)='; then
  echo 'BLOCKED: browser_url_contains_secret_query' >&2
  exit 2
fi

browser_origin="$(echo "$ERP_BROWSER_URL" | sed -E 's#(https://[^/]+).*#\1#')"
if [[ -z "$OFFICIAL_API" ]]; then
  # Same-origin via SPA proxy preferido; fallback host api-* se ERP_BROWSER_URL for erp-dev
  if echo "$browser_origin" | grep -Eiq '^https://erp-dev\.'; then
    OFFICIAL_API="$(echo "$browser_origin" | sed 's#://erp-dev.#://api-erp-dev.#')"
  else
    OFFICIAL_API="$browser_origin"
  fi
fi

echo "browser_url_https=YES"
echo "browser_host=$(echo "$browser_origin" | sed -E 's#https://##')"

code_of() {
  local url="$1"; shift || true
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 -m 20 "$@" "$url" 2>/dev/null || echo '000'
}

spa_root="$(code_of "${browser_origin}/")"
spa_health="$(code_of "${browser_origin}/health")"
api_health="$(code_of "${OFFICIAL_API}/health")"
api_ready="$(code_of "${OFFICIAL_API}/ready")"
echo "spa_origin_http=${spa_root}"
echo "spa_proxy_health=${spa_health}"
echo "official_api_health=${api_health}"
echo "official_api_ready=${api_ready}"

if [[ "$spa_root" == "000" || "$api_health" == "000" ]]; then
  echo 'BLOCKED: dns_or_tls_unreachable' >&2
  echo 'HINT=see_docs/vps/DNS_HTTPS_ERP_DEV.md' >&2
  exit 3
fi

[[ "$spa_root" =~ ^(200|301|302)$ ]] || { echo 'BLOCKED: spa_origin_not_ok' >&2; exit 3; }
[[ "$api_health" == "200" && "$api_ready" == "200" ]] || { echo 'BLOCKED: api_health_ready_not_200' >&2; exit 3; }

meta_json="$(curl -sS --connect-timeout 10 -m 20 "${OFFICIAL_API}/api/v1/meta" 2>/dev/null || true)"
runtime="$(echo "$meta_json" | python3 -c 'import json,sys; m=json.loads(sys.stdin.read() or "{}"); print(m.get("runtime") or "")' 2>/dev/null || true)"
auth_mode="$(echo "$meta_json" | python3 -c 'import json,sys; m=json.loads(sys.stdin.read() or "{}"); print((m.get("auth") or {}).get("mode") or "")' 2>/dev/null || true)"
echo "official_runtime=${runtime}"
echo "official_auth_mode=${auth_mode}"
[[ "$runtime" == "$EXPECTED_RUNTIME" ]] || { echo "BLOCKED: runtime_mismatch expected=${EXPECTED_RUNTIME}" >&2; exit 4; }
[[ "$auth_mode" == "supabase_user" ]] || { echo 'BLOCKED: auth_mode_must_be_supabase_user' >&2; exit 4; }

no_auth="$(code_of "${OFFICIAL_API}/api/v1/orcamentos")"
spoof="$(code_of "${OFFICIAL_API}/api/v1/orcamentos" -H 'x-actor-id: spoof' -H 'x-group-id: spoof' -H 'x-empresa-id: spoof')"
echo "browser_nav_no_auth_orc=${no_auth}"
echo "browser_nav_spoof_dev_headers=${spoof}"
[[ "$no_auth" =~ ^(401|403)$ ]] || { echo 'BLOCKED: no_auth_must_reject' >&2; exit 5; }
[[ "$spoof" =~ ^(401|403)$ ]] || { echo 'BLOCKED: spoof_must_reject' >&2; exit 5; }
echo "browser_spoof_rejected=YES"

SYNTH_PASS="${SYNTH_PASS#"${SYNTH_PASS%%[![:space:]]*}"}"
SYNTH_PASS="${SYNTH_PASS%"${SYNTH_PASS##*[![:space:]]}"}"
[[ -n "$SYNTH_EMAIL" && -n "$SYNTH_PASS" && ${#SYNTH_PASS} -ge 8 ]] || {
  echo 'BLOCKED: set_SYNTH_EMAIL_and_SYNTH_PASS_for_login_step' >&2
  echo 'HINT=same_session_SYNTH_PASS_from_provision_openssl' >&2
  exit 2
}

# Token: se ENV_FILE existir (VPS), usa ANON local; senão exige ANON_KEY no ambiente (cofre).
ANON="${ANON_KEY:-}"
AUTH_TOKEN_URL="${AUTH_TOKEN_URL:-}"
if [[ -z "$ANON" && -f "$ENV_FILE" ]]; then
  line="$(grep -E '^ANON_KEY=' "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  ANON="${line#ANON_KEY=}"
  ANON="${ANON%\"}"; ANON="${ANON#\"}"
fi
[[ -n "$ANON" && ${#ANON} -ge 40 ]] || { echo 'BLOCKED: anon_missing_for_token' >&2; exit 2; }
[[ -n "$AUTH_TOKEN_URL" ]] || AUTH_TOKEN_URL='http://127.0.0.1:8000/auth/v1/token?grant_type=password'
# Em teste externo puro, Auth GoTrue pode não estar exposto; preferir provision na VPS + token local.
# Se AUTH_TOKEN_URL for loopback e não estivermos na VPS, falha com HINT.
if echo "$AUTH_TOKEN_URL" | grep -Eiq '127\.0\.0\.1|localhost'; then
  if ! curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 "http://127.0.0.1:8000/auth/v1/health" 2>/dev/null | grep -q 200; then
    echo 'BLOCKED: auth_token_url_loopback_unreachable_from_external_host' >&2
    echo 'HINT=run_provision_and_token_on_VPS_then_nav_with_ERP_BROWSER_URL_https' >&2
    exit 6
  fi
fi

token_http="$(curl -sS -o /tmp/gate-f-https-token.json -w '%{http_code}' --connect-timeout 10 \
  -X POST "$AUTH_TOKEN_URL" \
  -H "apikey: ${ANON}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" 2>/dev/null || echo '000')"
echo "http_token=${token_http}"
[[ "$token_http" == "200" ]] || {
  echo 'BLOCKED: token_not_issued' >&2
  rm -f /tmp/gate-f-https-token.json
  exit 6
}
ACCESS="$(python3 -c 'import json; print(json.load(open("/tmp/gate-f-https-token.json")).get("access_token") or "")' 2>/dev/null || true)"
rm -f /tmp/gate-f-https-token.json
[[ -n "$ACCESS" && ${#ACCESS} -ge 40 ]] || { echo 'BLOCKED: access_token_empty' >&2; exit 6; }
echo "token_len=${#ACCESS}"

# Tenant do profile (VPS supabase-db). Se indisponível, BLOCKED — não inventar UUID.
TMP_GID="$(mktemp)"; TMP_EID="$(mktemp)"
trap 'rm -f "$TMP_GID" "$TMP_EID"' EXIT
if docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_GID" 2>/dev/null; then
SELECT group_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email') AND auth_user_id IS NOT NULL AND ativo IS TRUE AND group_id IS NOT NULL
 ORDER BY updated_at DESC NULLS LAST LIMIT 1;
SQL
  true
else
  echo 'BLOCKED: profile_tenant_requires_vps_db' >&2
  echo 'HINT=run_this_smoke_on_VPS_with_ERP_BROWSER_URL_https_after_dns' >&2
  exit 4
fi
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_EID" 2>/dev/null || true
SELECT empresa_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email') AND auth_user_id IS NOT NULL AND ativo IS TRUE AND empresa_id IS NOT NULL
 ORDER BY updated_at DESC NULLS LAST LIMIT 1;
SQL
GROUP_ID="$(tr -d '[:space:]' <"$TMP_GID" || true)"
EMPRESA_ID="$(tr -d '[:space:]' <"$TMP_EID" || true)"
[[ -n "$GROUP_ID" && ${#GROUP_ID} -ge 32 ]] || { echo 'BLOCKED: profile_group_id_missing' >&2; exit 4; }
echo "tenant_group_set=YES"
[[ -n "$EMPRESA_ID" && ${#EMPRESA_ID} -ge 32 ]] && echo "tenant_empresa_set=YES" || { echo "tenant_empresa_set=NO"; EMPRESA_ID=""; }

auth_hdrs=(-H "Authorization: Bearer ${ACCESS}" -H "x-group-id: ${GROUP_ID}")
[[ -n "$EMPRESA_ID" ]] && auth_hdrs+=(-H "x-empresa-id: ${EMPRESA_ID}")

nav_meta="$(code_of "${OFFICIAL_API}/api/v1/meta" "${auth_hdrs[@]}")"
nav_orc="$(code_of "${OFFICIAL_API}/api/v1/orcamentos?limit=1" "${auth_hdrs[@]}")"
nav_spa="$(code_of "${browser_origin}/api/v1/meta" "${auth_hdrs[@]}")"
unset ACCESS GROUP_ID EMPRESA_ID

echo "nav_api_meta=${nav_meta}"
echo "nav_api_orc_list=${nav_orc}"
echo "nav_spa_proxy_meta=${nav_spa}"

ok=YES
[[ "$nav_meta" == "200" ]] || ok=NO
[[ "$nav_orc" =~ ^(200|204)$ ]] || ok=NO
# 400/403 na listagem autenticada = FAIL (não sucesso)
[[ "$nav_orc" =~ ^(400|403)$ ]] && ok=NO

echo "login_ok=YES"
echo "navigation_ok=${ok}"
echo "PASTE_TO_GIT_BEGIN"
echo "browser_url_https=YES"
echo "spa_origin_http=${spa_root}"
echo "official_runtime=${runtime}"
echo "official_auth_mode=${auth_mode}"
echo "http_token=${token_http}"
echo "tenant_headers_on_nav=YES"
echo "nav_api_meta=${nav_meta}"
echo "nav_api_orc_list=${nav_orc}"
echo "nav_spa_proxy_meta=${nav_spa}"
echo "GATE_F_HTTPS_EXTERNAL=$([[ "$ok" == "YES" ]] && echo OK || echo FAIL)"
echo "NOTE=segredos_somente_cofre_local"
echo "PASTE_TO_GIT_END"

[[ "$ok" == "YES" ]] || exit 7
echo "GATE_F_HTTPS_EXTERNAL_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
