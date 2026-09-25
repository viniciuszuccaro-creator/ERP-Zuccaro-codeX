#!/usr/bin/env bash
# Smoke Bearer sintético Gate D (canário ≠3080).
# NÃO imprime token, senha, anon key, UUID ou .env.
# Uso (mesma sessão do openssl / provision):
#   SYNTH_PASS='...' bash scripts/vps/gate-d-smoke-bearer-synthetic.sh
set -euo pipefail

SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
SYNTH_PASS="${SYNTH_PASS:?Set SYNTH_PASS from local vault}"
CANARY_PORT="${CANARY_PORT:-3086}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${CANARY_PORT}}"
SUPA_ENV="${SUPABASE_ENV_FILE:-/root/supabase/docker/.env}"

echo "GATE_D_BEARER_SMOKE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"

case "${SYNTH_PASS}" in
  SENHA_DO_COFRE_OPENSSL|SENHA_DO_COFRE|SENHA_REAL_DO_COFRE|SENHA_FORTE_LOCAL|SUA_SENHA_FORTE|COLOQUE_SENHA_FORTE_AQUI|'...'|'…')
    echo 'BLOCKED: synth_pass_is_placeholder_from_chat' >&2
    echo 'HINT=gere_com_openssl_e_rode_provision_na_mesma_sessao' >&2
    exit 2
    ;;
esac
[[ ${#SYNTH_PASS} -ge 12 ]] || { echo 'BLOCKED: synth_pass_too_short' >&2; exit 2; }

env_get() {
  local key="$1" line
  [[ -f "$SUPA_ENV" ]] || return 0
  line="$(grep -E "^${key}=" "$SUPA_ENV" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"
  elif [[ "$line" =~ ^\'.*\'$ ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}

ANON="$(env_get ANON_KEY)"
[[ -z "$ANON" ]] && ANON="$(env_get SUPABASE_ANON_KEY)"
[[ -n "$ANON" && ${#ANON} -ge 40 ]] || { echo 'BLOCKED: supabase_anon_missing_or_stub' >&2; exit 2; }
echo "anon_len=${#ANON}"

AUTH_BASE='http://127.0.0.1:8000'
http_health="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 \
  -H "apikey: ${ANON}" "${AUTH_BASE}/auth/v1/health" 2>/dev/null || true)"
echo "auth_health_local=${http_health}"
if [[ "$http_health" != "200" ]]; then
  echo 'BLOCKED: auth_local_8000_unreachable' >&2
  exit 3
fi

TMP_TOK="$(mktemp)"
TMP_GID="$(mktemp)"
TMP_EID="$(mktemp)"
TMP_BODY="$(mktemp)"
cleanup() { rm -f "$TMP_TOK" "$TMP_GID" "$TMP_EID" "$TMP_BODY"; }
trap cleanup EXIT

# Escopo multiempresa do profile sintético (sem imprimir UUIDs)
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_GID" 2>/dev/null || true
SELECT group_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email')
   AND auth_user_id IS NOT NULL AND ativo IS TRUE
 ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
 LIMIT 1;
SQL
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_EID" 2>/dev/null || true
SELECT empresa_id::text FROM profiles
 WHERE lower(email)=lower(:'synth_email')
   AND auth_user_id IS NOT NULL AND ativo IS TRUE
   AND empresa_id IS NOT NULL
 ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
 LIMIT 1;
SQL

GROUP_ID="$(tr -d '[:space:]' <"$TMP_GID" || true)"
EMPRESA_ID="$(tr -d '[:space:]' <"$TMP_EID" || true)"
if [[ -z "$GROUP_ID" || ${#GROUP_ID} -lt 32 ]]; then
  echo 'BLOCKED: profile_group_id_missing' >&2
  exit 4
fi
echo "tenant_group_set=YES"
if [[ -n "$EMPRESA_ID" && ${#EMPRESA_ID} -ge 32 ]]; then
  echo "tenant_empresa_set=YES"
else
  echo "tenant_empresa_set=NO"
  EMPRESA_ID=""
fi

http_tok="$(curl -sS -o "$TMP_TOK" -w '%{http_code}' --connect-timeout 8 \
  -X POST "${AUTH_BASE}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" \
  2>/dev/null || true)"
echo "http_token=${http_tok}"

TOK="$(python3 - "$TMP_TOK" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print('')
    raise SystemExit(0)
print(d.get('access_token') or '')
PY
)"
echo "token_len=${#TOK}"
[[ -n "$TOK" ]] || {
  hint="$(python3 -c "import json;d=json.load(open('$TMP_TOK'));print(d.get('error_code')or d.get('error')or d.get('msg')or 'unknown')" 2>/dev/null || echo 'parse_fail')"
  echo "token_error_hint=${hint}" >&2
  echo 'BLOCKED: token_not_issued' >&2
  exit 5
}

auth_hdrs=(-H "Authorization: Bearer ${TOK}" -H "apikey: ${ANON}" -H "x-group-id: ${GROUP_ID}")
if [[ -n "$EMPRESA_ID" ]]; then
  auth_hdrs+=(-H "x-empresa-id: ${EMPRESA_ID}")
fi

no_auth="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  "${BASE_URL}/api/v1/orcamentos" 2>/dev/null || true)"

orc_list="$(curl -sS -o "$TMP_BODY" -w '%{http_code}' --connect-timeout 5 \
  "${auth_hdrs[@]}" "${BASE_URL}/api/v1/orcamentos" 2>/dev/null || true)"
orc_code="$(python3 -c "import json;d=json.load(open('$TMP_BODY'));print(d.get('code')or d.get('error')or '')" 2>/dev/null || true)"

ped_list="$(curl -sS -o "$TMP_BODY" -w '%{http_code}' --connect-timeout 5 \
  "${auth_hdrs[@]}" "${BASE_URL}/api/v1/pedidos" 2>/dev/null || true)"
ped_code="$(python3 -c "import json;d=json.load(open('$TMP_BODY'));print(d.get('code')or d.get('error')or '')" 2>/dev/null || true)"

echo "no_auth=${no_auth}"
echo "orc_list=${orc_list}"
echo "ped_list=${ped_list}"
[[ -n "$orc_code" ]] && echo "orc_error_code=${orc_code}"
[[ -n "$ped_code" ]] && echo "ped_error_code=${ped_code}"

ok=1
[[ "$no_auth" =~ ^(401|403)$ ]] || ok=0
[[ "$orc_list" =~ ^(200|204)$ ]] || ok=0
[[ "$ped_list" =~ ^(200|204)$ ]] || ok=0

echo 'PASTE_TO_GIT_BEGIN'
echo "no_auth=${no_auth}"
echo "orc_list=${orc_list}"
echo "ped_list=${ped_list}"
[[ -n "$orc_code" ]] && echo "orc_error_code=${orc_code}"
[[ -n "$ped_code" ]] && echo "ped_error_code=${ped_code}"
echo "token_len=${#TOK}"
echo "anon_len=${#ANON}"
echo "tenant_group_set=YES"
echo "tenant_empresa_set=$([ -n "$EMPRESA_ID" ] && echo YES || echo NO)"
if [[ "$ok" -eq 1 ]]; then
  echo 'GATE_D_BEARER_SMOKE=OK'
else
  echo 'GATE_D_BEARER_SMOKE=FAIL'
fi
echo 'alter_3080=NOT_PERFORMED'
echo 'NOTE=segredos_somente_cofre_local'
echo 'PASTE_TO_GIT_END'
echo "GATE_D_BEARER_SMOKE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$ok" -eq 1 ]] || exit 6
