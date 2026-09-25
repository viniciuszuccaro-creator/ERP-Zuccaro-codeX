#!/usr/bin/env bash
# Smoke HTTPS — distingue camadas (não misturar VPS com “navegação real fora”).
#
# Camadas (GATE_F_HTTPS_PROBE):
#   reachability  — DNS+TLS+SPA/API health públicos (qualquer host)
#   vps_api       — Auth GoTrue loopback + tenant via docker (SOMENTE na VPS);
#                   chama API/SPA por URL HTTPS pública. NÃO prova acesso do seu PC.
#   external_nav  — login+nav a partir de host FORA da VPS (sem docker/loopback Auth);
#                   exige ANON_KEY + AUTH_TOKEN_URL HTTPS (ou ACCESS_TOKEN+tenant no cofre).
#   auto          — reachability; se VPS local → vps_api; senão tenta external_nav se credenciais externas.
#
# 400/403 na listagem autenticada NÃO contam como sucesso.
# GATE_F_HTTPS_EXTERNAL_NAV=OK é o único veredito de “navegação real fora da VPS”.
# GATE_F_HTTPS_VPS_API=OK ≠ implantação de acesso diário.
#
set -euo pipefail

ERP_BROWSER_URL="${ERP_BROWSER_URL:-}"
OFFICIAL_API="${OFFICIAL_API:-}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
SYNTH_EMAIL="${SYNTH_EMAIL:-}"
SYNTH_PASS="${SYNTH_PASS:-}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"
GATE_F_HTTPS_PROBE="${GATE_F_HTTPS_PROBE:-auto}"
# Cofre externo (external_nav): opcional se Auth público não existir
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
TENANT_GROUP_ID="${TENANT_GROUP_ID:-}"
TENANT_EMPRESA_ID="${TENANT_EMPRESA_ID:-}"
ANON="${ANON_KEY:-}"
AUTH_TOKEN_URL="${AUTH_TOKEN_URL:-}"

echo "GATE_F_HTTPS_PROBE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "probe_mode=${GATE_F_HTTPS_PROBE}"
echo "NOTE=vps_api_is_not_daily_access_external_nav_required_for_laptop"

if [[ -z "$ERP_BROWSER_URL" ]]; then
  echo 'BLOCKED: set_ERP_BROWSER_URL_https_public' >&2
  echo "HINT=ERP_BROWSER_URL='https://erp-dev.cpaferroeaco.com.br/'" >&2
  exit 2
fi

if ! echo "$ERP_BROWSER_URL" | grep -Eiq '^https://'; then
  echo 'BLOCKED: ERP_BROWSER_URL_must_be_https' >&2
  echo 'HINT=loopback_http_use_gate-f-smoke-browser-login-nav_sh' >&2
  exit 2
fi

if echo "$ERP_BROWSER_URL" | grep -Eiq '127\.0\.0\.1|localhost'; then
  echo 'BLOCKED: probe_rejects_loopback_browser_url' >&2
  exit 2
fi

if echo "$ERP_BROWSER_URL" | grep -Eiq '[?&](access_token|refresh_token|token|password|apikey|service_role)='; then
  echo 'BLOCKED: browser_url_contains_secret_query' >&2
  exit 2
fi

browser_origin="$(echo "$ERP_BROWSER_URL" | sed -E 's#(https://[^/]+).*#\1#')"
if [[ -z "$OFFICIAL_API" ]]; then
  if echo "$browser_origin" | grep -Eiq '^https://erp-dev\.'; then
    OFFICIAL_API="$(echo "$browser_origin" | sed 's#://erp-dev.#://api-erp-dev.#')"
  else
    OFFICIAL_API="$browser_origin"
  fi
fi

echo "browser_url_https=YES"
echo "browser_host=$(echo "$browser_origin" | sed -E 's#https://##')"
echo "official_api_host=$(echo "$OFFICIAL_API" | sed -E 's#https?://([^/]+).*#\1#')"

code_of() {
  local url="$1"; shift || true
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 -m 20 "$@" "$url" 2>/dev/null)" || true
  [[ -n "$code" && "$code" != "000000" ]] || code='000'
  # curl pode imprimir 000 e ainda assim falhar (|| echo duplicava → 000000)
  [[ "$code" =~ ^[0-9]{3}$ ]] || code='000'
  echo "$code"
}

vps_local_available() {
  # Auth loopback saudável OU docker supabase-db responde
  local auth_ok=NO db_ok=NO
  if curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 "http://127.0.0.1:8000/auth/v1/health" 2>/dev/null | grep -q 200; then
    auth_ok=YES
  fi
  if docker exec supabase-db true 2>/dev/null; then
    db_ok=YES
  fi
  [[ "$auth_ok" == "YES" || "$db_ok" == "YES" ]]
}

# ── Camada A: DNS + TLS + health públicos ───────────────────────────────────
layer_reachability() {
  echo "LAYER_A_DNS_TLS_BEGIN"
  spa_root="$(code_of "${browser_origin}/")"
  spa_health="$(code_of "${browser_origin}/health")"
  api_health="$(code_of "${OFFICIAL_API}/health")"
  api_ready="$(code_of "${OFFICIAL_API}/ready")"
  # Index HTML: preferir no-store (cache SPA)
  spa_cc="$(curl -sSI --connect-timeout 10 -m 20 "${browser_origin}/" 2>/dev/null | tr -d '\r' | grep -i '^cache-control:' | head -1 | sed 's/^[Cc]ache-[Cc]ontrol:[[:space:]]*//' || true)"
  echo "spa_origin_http=${spa_root}"
  echo "spa_proxy_health=${spa_health}"
  echo "official_api_health=${api_health}"
  echo "official_api_ready=${api_ready}"
  echo "spa_cache_control=${spa_cc:-missing}"

  if [[ "$spa_root" == "000" || "$api_health" == "000" ]]; then
    echo 'LAYER_A_DNS_TLS=BLOCKED'
    echo 'BLOCKED: dns_or_tls_unreachable' >&2
    echo 'HINT=see_docs/vps/DNS_HTTPS_ERP_DEV.md' >&2
    return 3
  fi
  [[ "$spa_root" =~ ^(200|301|302)$ ]] || { echo 'LAYER_A_DNS_TLS=FAIL'; echo 'BLOCKED: spa_origin_not_ok' >&2; return 3; }
  [[ "$api_health" == "200" && "$api_ready" == "200" ]] || { echo 'LAYER_A_DNS_TLS=FAIL'; echo 'BLOCKED: api_health_ready_not_200' >&2; return 3; }

  meta_json="$(curl -sS --connect-timeout 10 -m 20 "${OFFICIAL_API}/api/v1/meta" 2>/dev/null || true)"
  runtime="$(echo "$meta_json" | python3 -c 'import json,sys; m=json.loads(sys.stdin.read() or "{}"); print(m.get("runtime") or "")' 2>/dev/null || true)"
  auth_mode="$(echo "$meta_json" | python3 -c 'import json,sys; m=json.loads(sys.stdin.read() or "{}"); print((m.get("auth") or {}).get("mode") or "")' 2>/dev/null || true)"
  echo "official_runtime=${runtime}"
  echo "official_auth_mode=${auth_mode}"
  [[ "$runtime" == "$EXPECTED_RUNTIME" ]] || { echo 'LAYER_A_DNS_TLS=FAIL'; echo "BLOCKED: runtime_mismatch expected=${EXPECTED_RUNTIME}" >&2; return 4; }
  [[ "$auth_mode" == "supabase_user" ]] || { echo 'LAYER_A_DNS_TLS=FAIL'; echo 'BLOCKED: auth_mode_must_be_supabase_user' >&2; return 4; }

  no_auth="$(code_of "${OFFICIAL_API}/api/v1/orcamentos")"
  spoof="$(code_of "${OFFICIAL_API}/api/v1/orcamentos" -H 'x-actor-id: spoof' -H 'x-group-id: spoof' -H 'x-empresa-id: spoof')"
  echo "public_api_no_auth_orc=${no_auth}"
  echo "public_api_spoof_dev_headers=${spoof}"
  [[ "$no_auth" =~ ^(401|403)$ ]] || { echo 'LAYER_A_DNS_TLS=FAIL'; echo 'BLOCKED: no_auth_must_reject' >&2; return 5; }
  [[ "$spoof" =~ ^(401|403)$ ]] || { echo 'LAYER_A_DNS_TLS=FAIL'; echo 'BLOCKED: spoof_must_reject' >&2; return 5; }

  echo "LAYER_A_DNS_TLS=OK"
  echo "NOTE=reachability_ok_does_not_prove_login_or_daily_access"
  return 0
}

obtain_token_via_auth_url() {
  local url="$1"
  SYNTH_PASS="${SYNTH_PASS#"${SYNTH_PASS%%[![:space:]]*}"}"
  SYNTH_PASS="${SYNTH_PASS%"${SYNTH_PASS##*[![:space:]]}"}"
  [[ -n "$SYNTH_EMAIL" && -n "$SYNTH_PASS" && ${#SYNTH_PASS} -ge 8 ]] || {
    echo 'BLOCKED: set_SYNTH_EMAIL_and_SYNTH_PASS_for_login_step' >&2
    return 2
  }
  if [[ -z "$ANON" && -f "$ENV_FILE" ]]; then
    line="$(grep -E '^ANON_KEY=' "$ENV_FILE" 2>/dev/null | tail -1 || true)"
    ANON="${line#ANON_KEY=}"
    ANON="${ANON%\"}"; ANON="${ANON#\"}"
  fi
  [[ -n "$ANON" && ${#ANON} -ge 40 ]] || { echo 'BLOCKED: anon_missing_for_token' >&2; return 2; }

  token_http="$(curl -sS -o /tmp/gate-f-https-token.json -w '%{http_code}' --connect-timeout 10 \
    -X POST "$url" \
    -H "apikey: ${ANON}" -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" 2>/dev/null || echo '000')"
  echo "http_token=${token_http}"
  [[ "$token_http" == "200" ]] || {
    echo 'BLOCKED: token_not_issued' >&2
    rm -f /tmp/gate-f-https-token.json
    return 6
  }
  ACCESS="$(python3 -c 'import json; print(json.load(open("/tmp/gate-f-https-token.json")).get("access_token") or "")' 2>/dev/null || true)"
  rm -f /tmp/gate-f-https-token.json
  [[ -n "$ACCESS" && ${#ACCESS} -ge 40 ]] || { echo 'BLOCKED: access_token_empty' >&2; return 6; }
  echo "token_len=${#ACCESS}"
  ACCESS_TOKEN="$ACCESS"
  return 0
}

tenant_from_vps_db() {
  TMP_GID="$(mktemp)"; TMP_EID="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$TMP_GID' '$TMP_EID'" RETURN
  if ! docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_GID" 2>/dev/null; then
SELECT group_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email') AND auth_user_id IS NOT NULL AND ativo IS TRUE AND group_id IS NOT NULL
 ORDER BY updated_at DESC NULLS LAST LIMIT 1;
SQL
    echo 'BLOCKED: profile_tenant_requires_vps_db' >&2
    return 4
  fi
  docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_EID" 2>/dev/null || true
SELECT empresa_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email') AND auth_user_id IS NOT NULL AND ativo IS TRUE AND empresa_id IS NOT NULL
 ORDER BY updated_at DESC NULLS LAST LIMIT 1;
SQL
  TENANT_GROUP_ID="$(tr -d '[:space:]' <"$TMP_GID" || true)"
  TENANT_EMPRESA_ID="$(tr -d '[:space:]' <"$TMP_EID" || true)"
  [[ -n "$TENANT_GROUP_ID" && ${#TENANT_GROUP_ID} -ge 32 ]] || { echo 'BLOCKED: profile_group_id_missing' >&2; return 4; }
  echo "tenant_group_set=YES"
  [[ -n "$TENANT_EMPRESA_ID" && ${#TENANT_EMPRESA_ID} -ge 32 ]] && echo "tenant_empresa_set=YES" || { echo "tenant_empresa_set=NO"; TENANT_EMPRESA_ID=""; }
  echo "tenant_source=vps_docker_db"
  return 0
}

nav_authenticated() {
  local path_label="$1"
  local auth_hdrs=(-H "Authorization: Bearer ${ACCESS_TOKEN}" -H "x-group-id: ${TENANT_GROUP_ID}")
  [[ -n "${TENANT_EMPRESA_ID:-}" ]] && auth_hdrs+=(-H "x-empresa-id: ${TENANT_EMPRESA_ID}")

  nav_meta="$(code_of "${OFFICIAL_API}/api/v1/meta" "${auth_hdrs[@]}")"
  nav_orc="$(code_of "${OFFICIAL_API}/api/v1/orcamentos?limit=1" "${auth_hdrs[@]}")"
  nav_spa="$(code_of "${browser_origin}/api/v1/meta" "${auth_hdrs[@]}")"

  echo "nav_api_meta=${nav_meta}"
  echo "nav_api_orc_list=${nav_orc}"
  echo "nav_spa_proxy_meta=${nav_spa}"
  echo "nav_path=${path_label}"

  local ok=YES
  [[ "$nav_meta" == "200" ]] || ok=NO
  [[ "$nav_orc" =~ ^(200|204)$ ]] || ok=NO
  [[ "$nav_orc" =~ ^(400|403)$ ]] && ok=NO
  echo "navigation_ok=${ok}"
  [[ "$ok" == "YES" ]]
}

# ── Camada B: API auth via VPS local (não é prova externa) ───────────────────
layer_vps_api() {
  echo "LAYER_B_VPS_API_BEGIN"
  echo "NOTE=this_layer_runs_on_VPS_not_from_laptop"

  if ! vps_local_available; then
    echo 'LAYER_B_VPS_API=BLOCKED'
    echo 'BLOCKED: vps_local_auth_or_db_unavailable' >&2
    echo 'HINT=run_on_VPS_or_use_GATE_F_HTTPS_PROBE=external_nav' >&2
    return 6
  fi

  local auth_url="${AUTH_TOKEN_URL:-http://127.0.0.1:8000/auth/v1/token?grant_type=password}"
  if ! echo "$auth_url" | grep -Eiq '127\.0\.0\.1|localhost'; then
    echo 'LAYER_B_VPS_API=BLOCKED'
    echo 'BLOCKED: vps_api_probe_expects_loopback_AUTH_TOKEN_URL' >&2
    echo 'HINT=for_public_auth_use_GATE_F_HTTPS_PROBE=external_nav' >&2
    return 6
  fi
  echo "api_auth_path=vps_loopback_gotrue"

  obtain_token_via_auth_url "$auth_url" || { echo "LAYER_B_VPS_API=BLOCKED"; return $?; }
  tenant_from_vps_db || { echo "LAYER_B_VPS_API=BLOCKED"; return $?; }

  if nav_authenticated "vps_hybrid_https_url"; then
    echo "login_ok=YES"
    echo "LAYER_B_VPS_API=OK"
    echo "GATE_F_HTTPS_VPS_API=OK"
    echo "GATE_F_HTTPS_EXTERNAL_NAV=NOT_PROVEN"
    echo "NOTE=vps_api_ok_is_not_daily_laptop_access"
    return 0
  fi
  echo "LAYER_B_VPS_API=FAIL"
  echo "GATE_F_HTTPS_VPS_API=FAIL"
  return 7
}

# ── Camada C: navegação real fora da VPS ─────────────────────────────────────
layer_external_nav() {
  echo "LAYER_C_EXTERNAL_NAV_BEGIN"
  echo "NOTE=must_run_outside_VPS_without_docker_or_loopback_auth"

  if vps_local_available; then
    echo 'LAYER_C_EXTERNAL_NAV=BLOCKED'
    echo 'BLOCKED: external_nav_rejects_vps_local_resources' >&2
    echo 'HINT=run_from_laptop_or_cloud_agent_not_on_VPS;_use_vps_api_probe_on_VPS' >&2
    return 6
  fi

  # Token: ACCESS_TOKEN do cofre OU Auth URL pública (nunca loopback)
  if [[ -n "$ACCESS_TOKEN" && ${#ACCESS_TOKEN} -ge 40 ]]; then
    echo "api_auth_path=cofre_ACCESS_TOKEN"
    echo "http_token=preissued"
    echo "token_len=${#ACCESS_TOKEN}"
  else
    local auth_url="${AUTH_TOKEN_URL:-}"
    [[ -n "$auth_url" ]] || {
      echo 'LAYER_C_EXTERNAL_NAV=BLOCKED'
      echo 'BLOCKED: set_AUTH_TOKEN_URL_https_or_ACCESS_TOKEN_for_external_nav' >&2
      return 2
    }
    if echo "$auth_url" | grep -Eiq '127\.0\.0\.1|localhost'; then
      echo 'LAYER_C_EXTERNAL_NAV=BLOCKED'
      echo 'BLOCKED: external_nav_rejects_loopback_AUTH_TOKEN_URL' >&2
      return 6
    fi
    if ! echo "$auth_url" | grep -Eiq '^https://'; then
      echo 'LAYER_C_EXTERNAL_NAV=BLOCKED'
      echo 'BLOCKED: external_AUTH_TOKEN_URL_must_be_https' >&2
      return 6
    fi
    echo "api_auth_path=public_gotrue_https"
    obtain_token_via_auth_url "$auth_url" || { echo "LAYER_C_EXTERNAL_NAV=BLOCKED"; return $?; }
  fi

  if [[ -z "${TENANT_GROUP_ID:-}" || ${#TENANT_GROUP_ID} -lt 32 ]]; then
    echo 'LAYER_C_EXTERNAL_NAV=BLOCKED'
    echo 'BLOCKED: set_TENANT_GROUP_ID_from_cofre_for_external_nav' >&2
    echo 'HINT=no_docker_on_external_host' >&2
    return 2
  fi
  echo "tenant_group_set=YES"
  echo "tenant_source=cofre_env"
  [[ -n "${TENANT_EMPRESA_ID:-}" && ${#TENANT_EMPRESA_ID} -ge 32 ]] && echo "tenant_empresa_set=YES" || {
    echo "tenant_empresa_set=NO"; TENANT_EMPRESA_ID="";
  }

  if nav_authenticated "external_host_https"; then
    echo "login_ok=YES"
    echo "LAYER_C_EXTERNAL_NAV=OK"
    echo "GATE_F_HTTPS_EXTERNAL_NAV=OK"
    echo "GATE_F_HTTPS_VPS_API=NOT_USED"
    return 0
  fi
  echo "LAYER_C_EXTERNAL_NAV=FAIL"
  echo "GATE_F_HTTPS_EXTERNAL_NAV=FAIL"
  return 7
}

paste_summary() {
  echo "PASTE_TO_GIT_BEGIN"
  echo "probe_mode=${GATE_F_HTTPS_PROBE}"
  echo "browser_url_https=YES"
  echo "spa_origin_http=${spa_root:-}"
  echo "official_runtime=${runtime:-}"
  echo "official_auth_mode=${auth_mode:-}"
  echo "LAYER_A_DNS_TLS=${LAYER_A:-}"
  echo "LAYER_B_VPS_API=${LAYER_B:-SKIPPED}"
  echo "LAYER_C_EXTERNAL_NAV=${LAYER_C:-SKIPPED}"
  echo "GATE_F_HTTPS_VPS_API=${VERDICT_VPS:-SKIPPED}"
  echo "GATE_F_HTTPS_EXTERNAL_NAV=${VERDICT_EXT:-SKIPPED}"
  echo "NOTE=daily_access_only_when_EXTERNAL_NAV_OK_and_DNS_TLS"
  echo "NOTE=segredos_somente_cofre_local"
  echo "PASTE_TO_GIT_END"
}

# ── Orquestração ─────────────────────────────────────────────────────────────
LAYER_A=SKIPPED
LAYER_B=SKIPPED
LAYER_C=SKIPPED
VERDICT_VPS=SKIPPED
VERDICT_EXT=SKIPPED

case "$GATE_F_HTTPS_PROBE" in
  reachability|vps_api|external_nav|auto) ;;
  *)
    echo "BLOCKED: invalid_GATE_F_HTTPS_PROBE=${GATE_F_HTTPS_PROBE}" >&2
    echo 'HINT=reachability|vps_api|external_nav|auto' >&2
    exit 2
    ;;
esac

set +e
layer_reachability
rc_a=$?
set -e
if [[ $rc_a -ne 0 ]]; then
  if [[ "${spa_root:-}" == "000" || "${api_health:-}" == "000" ]]; then
    LAYER_A=BLOCKED
  else
    LAYER_A=FAIL
  fi
  paste_summary
  exit "$rc_a"
fi
LAYER_A=OK

run_vps=NO
run_ext=NO
case "$GATE_F_HTTPS_PROBE" in
  reachability)
    echo "NOTE=stopped_after_reachability_set_PROBE_vps_api_or_external_nav"
    ;;
  vps_api) run_vps=YES ;;
  external_nav) run_ext=YES ;;
  auto)
    if vps_local_available; then
      run_vps=YES
      echo "auto_selected=vps_api"
    else
      run_ext=YES
      echo "auto_selected=external_nav"
    fi
    ;;
esac

if [[ "$run_vps" == "YES" ]]; then
  set +e
  layer_vps_api
  rc_b=$?
  set -e
  if [[ $rc_b -eq 0 ]]; then
    LAYER_B=OK; VERDICT_VPS=OK; VERDICT_EXT=NOT_PROVEN
  elif [[ $rc_b -eq 7 ]]; then
    LAYER_B=FAIL; VERDICT_VPS=FAIL
  else
    LAYER_B=BLOCKED; VERDICT_VPS=BLOCKED
  fi
  paste_summary
  [[ $rc_b -eq 0 ]] || exit "$rc_b"
  echo "GATE_F_HTTPS_PROBE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

if [[ "$run_ext" == "YES" ]]; then
  set +e
  layer_external_nav
  rc_c=$?
  set -e
  if [[ $rc_c -eq 0 ]]; then
    LAYER_C=OK; VERDICT_EXT=OK; VERDICT_VPS=NOT_USED
  elif [[ $rc_c -eq 7 ]]; then
    LAYER_C=FAIL; VERDICT_EXT=FAIL
  else
    LAYER_C=BLOCKED; VERDICT_EXT=BLOCKED
  fi
  paste_summary
  [[ $rc_c -eq 0 ]] || exit "$rc_c"
  echo "GATE_F_HTTPS_PROBE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

# Só reachability
paste_summary
echo "GATE_F_HTTPS_EXTERNAL_NAV=NOT_PROVEN"
echo "GATE_F_HTTPS_PROBE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
