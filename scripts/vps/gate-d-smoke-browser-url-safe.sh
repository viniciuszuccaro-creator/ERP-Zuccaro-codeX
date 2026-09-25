#!/usr/bin/env bash
# Gate D — smoke de URL browser segura no canário (≠3080).
# Não usa Gate F, não altera 3080, não imprime token/senha/UUID/.env.
# Não usa dev_headers como prova de Auth.
#
# Uso na VPS (Web Console):
#   cd /opt/erp-zuccaro
#   git pull origin cursor/pos-gate-e-prep-d-392b
#   CANARY_PORT=3086 EXPECTED_RUNTIME=ERP-RUNTIME-08B \
#     bash scripts/vps/gate-d-smoke-browser-url-safe.sh
#
# Opcional: CANARY_BROWSER_URL='https://host/.../api' (sem query com segredo)
set -euo pipefail

CANARY_PORT="${CANARY_PORT:-3086}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
OFFICIAL_PORT="${OFFICIAL_PORT:-3080}"
CANARY_BASE="${BASE_URL:-http://127.0.0.1:${CANARY_PORT}}"
BROWSER_URL="${CANARY_BROWSER_URL:-}"
OFFICIAL_BASE="http://127.0.0.1:${OFFICIAL_PORT}"

echo "GATE_D_BROWSER_URL_SMOKE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"
echo "canary_port=${CANARY_PORT}"
echo "expected_runtime=${EXPECTED_RUNTIME}"

url_has_secret_query() {
  local u="$1"
  # Qualquer query com nomes típicos de segredo/escopo em URL de browser é inseguro.
  echo "$u" | grep -Eiq '[?&](access_token|refresh_token|token|password|passwd|secret|apikey|api_key|anon|service_role|authorization|x-actor-id|x-group-id|x-empresa-id)='
}

assert_url_browser_safe() {
  local label="$1" u="$2"
  if [[ -z "$u" ]]; then
    echo "${label}_set=NO"
    return 0
  fi
  echo "${label}_set=YES"
  echo "${label}_scheme=$(echo "$u" | sed -n 's#^\([a-zA-Z][a-zA-Z0-9+.-]*\)://.*#\1#p')"
  if url_has_secret_query "$u"; then
    echo "BLOCKED: ${label}_contains_secret_or_tenant_query" >&2
    echo 'HINT=URL_browser_nao_pode_carregar_token_ou_escopo_em_query' >&2
    exit 2
  fi
  # Loopback http é aceitável no canário DEV; URL pública exige https.
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

assert_url_browser_safe 'canary_base' "$CANARY_BASE"
assert_url_browser_safe 'browser_url' "$BROWSER_URL"

code_of() {
  local url="$1"
  shift || true
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 "$@" "$url" 2>/dev/null || echo '000'
}

body_of() {
  local url="$1"
  shift || true
  curl -sS --connect-timeout 5 "$@" "$url" 2>/dev/null || true
}

# --- Canário ---
canary_health="$(code_of "${CANARY_BASE}/health")"
canary_ready="$(code_of "${CANARY_BASE}/ready")"
echo "canary_health=${canary_health}"
echo "canary_ready=${canary_ready}"
[[ "$canary_health" == "200" && "$canary_ready" == "200" ]] || {
  echo 'BLOCKED: canary_health_or_ready_not_200' >&2
  exit 3
}

meta_json="$(body_of "${CANARY_BASE}/api/v1/meta")"
meta_code="$(code_of "${CANARY_BASE}/api/v1/meta")"
echo "canary_meta_http=${meta_code}"
[[ "$meta_code" == "200" && -n "$meta_json" ]] || {
  echo 'BLOCKED: canary_meta_unreachable' >&2
  exit 3
}

parse_meta() {
  local json="$1"
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys
m=json.loads(sys.argv[1]); auth=m.get("auth") or {}
print("runtime="+str(m.get("runtime") or ""))
print("auth_mode="+str(auth.get("mode") or ""))
ents=m.get("httpEntities") or []
print("has_orcamento="+("YES" if "Orcamento" in ents else "NO"))
print("has_pedido="+("YES" if "Pedido" in ents else "NO"))' "$json"
    return $?
  fi
  if command -v node >/dev/null 2>&1; then
    node -e 'const m=JSON.parse(process.argv[1]); const a=m.auth||{}; const e=m.httpEntities||[];
console.log("runtime="+(m.runtime||""));
console.log("auth_mode="+(a.mode||""));
console.log("has_orcamento="+(e.includes("Orcamento")?"YES":"NO"));
console.log("has_pedido="+(e.includes("Pedido")?"YES":"NO"));' "$json"
    return $?
  fi
  echo 'BLOCKED: need python3 or node to parse /meta' >&2
  return 1
}

meta_parsed="$(parse_meta "$meta_json")"
echo "$meta_parsed"
runtime="$(echo "$meta_parsed" | sed -n 's/^runtime=//p')"
auth_mode="$(echo "$meta_parsed" | sed -n 's/^auth_mode=//p')"
has_orc="$(echo "$meta_parsed" | sed -n 's/^has_orcamento=//p')"
has_ped="$(echo "$meta_parsed" | sed -n 's/^has_pedido=//p')"

[[ "$runtime" == "$EXPECTED_RUNTIME" ]] || {
  echo "BLOCKED: canary_runtime_mismatch got=${runtime}" >&2
  exit 4
}
[[ "$auth_mode" == "supabase_user" ]] || {
  echo "BLOCKED: canary_auth_mode_not_supabase_user got=${auth_mode}" >&2
  echo 'HINT=dev_headers_nao_homologa_Gate_D' >&2
  exit 4
}
[[ "$has_orc" == "YES" && "$has_ped" == "YES" ]] || {
  echo 'BLOCKED: canary_missing_orcamento_or_pedido_entity' >&2
  exit 4
}
echo "canary_auth_mode=supabase_user"
echo "canary_rejects_dev_headers_as_proof=YES"

# Browser/sem sessão: listagens comerciais devem falhar fechado (sem Authorization).
no_auth_orc="$(code_of "${CANARY_BASE}/api/v1/orcamentos")"
no_auth_ped="$(code_of "${CANARY_BASE}/api/v1/pedidos")"
echo "browser_no_auth_orc=${no_auth_orc}"
echo "browser_no_auth_ped=${no_auth_ped}"
if [[ "$no_auth_orc" != "401" && "$no_auth_orc" != "403" ]]; then
  echo "BLOCKED: browser_orc_not_fail_closed got=${no_auth_orc}" >&2
  exit 5
fi
if [[ "$no_auth_ped" != "401" && "$no_auth_ped" != "403" ]]; then
  echo "BLOCKED: browser_ped_not_fail_closed got=${no_auth_ped}" >&2
  exit 5
fi

# Headers de ator sem Bearer não podem abrir o canário supabase_user.
spoof="$(code_of "${CANARY_BASE}/api/v1/orcamentos" \
  -H 'x-actor-id: 00000000-0000-4000-8000-000000000000' \
  -H 'x-group-id: 00000000-0000-4000-8000-000000000001' \
  -H 'x-empresa-id: 00000000-0000-4000-8000-000000000002')"
echo "browser_spoof_dev_headers=${spoof}"
if [[ "$spoof" == "200" ]]; then
  echo 'BLOCKED: canary_accepted_dev_headers_without_bearer' >&2
  exit 5
fi
echo "browser_spoof_rejected=YES"

# --- Oficial 3080 (somente leitura; deve permanecer intocada) ---
off_health="$(code_of "${OFFICIAL_BASE}/health")"
off_meta_json="$(body_of "${OFFICIAL_BASE}/api/v1/meta")"
echo "official_health=${off_health}"
if [[ "$off_health" == "200" && -n "$off_meta_json" ]]; then
  off_parsed="$(parse_meta "$off_meta_json" || true)"
  off_runtime="$(echo "$off_parsed" | sed -n 's/^runtime=//p')"
  off_auth="$(echo "$off_parsed" | sed -n 's/^auth_mode=//p')"
  echo "official_runtime=${off_runtime}"
  echo "official_auth_mode=${off_auth}"
  if [[ "$off_runtime" == "$EXPECTED_RUNTIME" && "$off_auth" == "supabase_user" ]]; then
    echo 'NOTE=official_3080_looks_promoted_review_before_Gate_F'
  else
    echo 'official_3080_untouched_probe=YES'
  fi
else
  echo 'official_3080_probe=SKIP_OR_DOWN'
fi

ok=YES
[[ "$canary_health" == "200" ]] || ok=NO
[[ "$auth_mode" == "supabase_user" ]] || ok=NO
[[ "$no_auth_orc" == "401" || "$no_auth_orc" == "403" ]] || ok=NO
[[ "$spoof" != "200" ]] || ok=NO

echo "PASTE_TO_GIT_BEGIN"
echo "canary_port=${CANARY_PORT}"
echo "canary_health=${canary_health}"
echo "canary_ready=${canary_ready}"
echo "canary_runtime=${runtime}"
echo "canary_auth_mode=${auth_mode}"
echo "browser_no_auth_orc=${no_auth_orc}"
echo "browser_no_auth_ped=${no_auth_ped}"
echo "browser_spoof_dev_headers=${spoof}"
echo "browser_spoof_rejected=YES"
echo "browser_url_set=$([[ -n "$BROWSER_URL" ]] && echo YES || echo NO)"
echo "GATE_D_BROWSER_URL_SMOKE=$([[ "$ok" == "YES" ]] && echo OK || echo FAIL)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"
echo "NOTE=segredos_somente_cofre_local"
echo "PASTE_TO_GIT_END"

echo "GATE_D_BROWSER_URL_SMOKE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$ok" == "YES" ]] || exit 6
