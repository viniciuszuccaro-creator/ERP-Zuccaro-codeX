#!/usr/bin/env bash
# Gate D — negativos obrigatórios (token inválido / tenant adulterado) no canário ≠3080.
# Não imprime token, senha, UUID, .env. Não altera 3080. Não autoriza Gate F.
#
# Uso (mesma sessão openssl + provision, como Bearer/mutação):
#   SYNTH_PASS='...' bash scripts/vps/gate-d-smoke-negatives-tenant.sh
set -euo pipefail

SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
SYNTH_PASS="${SYNTH_PASS:?Set SYNTH_PASS from local vault}"
CANARY_PORT="${CANARY_PORT:-3086}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${CANARY_PORT}}"
SUPA_ENV="${SUPABASE_ENV_FILE:-/root/supabase/docker/.env}"
CANARY_NAME="${CANARY_NAME:-erp-api-comercial360-canary}"

echo "GATE_D_NEGATIVES_SMOKE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"

case "${SYNTH_PASS}" in
  SENHA_DO_COFRE_OPENSSL|SENHA_DO_COFRE|SENHA_REAL_DO_COFRE|SENHA_FORTE_LOCAL|SUA_SENHA_FORTE|COLOQUE_SENHA_FORTE_AQUI|'...'|'…')
    echo 'BLOCKED: synth_pass_is_placeholder_from_chat' >&2
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
[[ "$http_health" == "200" ]] || { echo 'BLOCKED: auth_local_8000_unreachable' >&2; exit 3; }

TMP_TOK="$(mktemp)"
TMP_GID="$(mktemp)"
TMP_EID="$(mktemp)"
TMP_OTHER_EID="$(mktemp)"
TMP_BODY="$(mktemp)"
cleanup() {
  rm -f "$TMP_TOK" "$TMP_GID" "$TMP_EID" "$TMP_OTHER_EID" "$TMP_BODY"
}
trap cleanup EXIT

# Escopo do profile sintético (sem echo de UUID)
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
[[ -n "$GROUP_ID" && ${#GROUP_ID} -ge 32 ]] || { echo 'BLOCKED: profile_group_id_missing' >&2; exit 4; }
[[ -n "$EMPRESA_ID" && ${#EMPRESA_ID} -ge 32 ]] || { echo 'BLOCKED: profile_empresa_id_missing' >&2; exit 4; }
echo "tenant_group_set=YES"
echo "tenant_empresa_set=YES"

# Outra empresa do mesmo grupo (se existir) — senão UUID sintético fora do vínculo
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v gid="$GROUP_ID" -v eid="$EMPRESA_ID" -At <<'SQL' >"$TMP_OTHER_EID" 2>/dev/null || true
SELECT id::text FROM empresas
 WHERE group_id=:'gid'::uuid
   AND id<>:'eid'::uuid
   AND ativo IS TRUE
 ORDER BY created_at NULLS LAST
 LIMIT 1;
SQL
OTHER_EMPRESA="$(tr -d '[:space:]' <"$TMP_OTHER_EID" || true)"
if [[ -n "$OTHER_EMPRESA" && ${#OTHER_EMPRESA} -ge 32 ]]; then
  echo "other_empresa_in_group=YES"
else
  OTHER_EMPRESA='00000000-0000-4000-8000-000000000099'
  echo "other_empresa_in_group=NO"
  echo "other_empresa_fallback_synthetic=YES"
fi

# UUID de grupo adulterado (não imprimir)
FAKE_GROUP='00000000-0000-4000-8000-0000000000aa'

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
[[ -n "$TOK" ]] || { echo 'BLOCKED: token_not_issued' >&2; exit 5; }

# Controlo positivo mínimo (prova que o canário aceita o Bearer válido)
pos="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 \
  -H "Authorization: Bearer ${TOK}" -H "apikey: ${ANON}" \
  -H "x-group-id: ${GROUP_ID}" -H "x-empresa-id: ${EMPRESA_ID}" \
  "${BASE_URL}/api/v1/orcamentos?limit=1" 2>/dev/null || true)"
echo "positive_orc_list=${pos}"
[[ "$pos" == "200" ]] || { echo 'BLOCKED: positive_control_failed' >&2; exit 6; }

# 1) Sem Authorization
no_auth="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -H "apikey: ${ANON}" -H "x-group-id: ${GROUP_ID}" -H "x-empresa-id: ${EMPRESA_ID}" \
  "${BASE_URL}/api/v1/orcamentos?limit=1" 2>/dev/null || true)"
echo "neg_no_auth=${no_auth}"

# 2) Token inválido
bad_tok="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -H "Authorization: Bearer clearly.invalid.token.gate.d" -H "apikey: ${ANON}" \
  -H "x-group-id: ${GROUP_ID}" -H "x-empresa-id: ${EMPRESA_ID}" \
  "${BASE_URL}/api/v1/orcamentos?limit=1" 2>/dev/null || true)"
echo "neg_invalid_token=${bad_tok}"

# 3) group_id adulterado
bad_gid="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -H "Authorization: Bearer ${TOK}" -H "apikey: ${ANON}" \
  -H "x-group-id: ${FAKE_GROUP}" -H "x-empresa-id: ${EMPRESA_ID}" \
  "${BASE_URL}/api/v1/orcamentos?limit=1" 2>/dev/null || true)"
echo "neg_adulterated_group=${bad_gid}"

# 4) empresa_id fora do vínculo / outra empresa
bad_eid="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -H "Authorization: Bearer ${TOK}" -H "apikey: ${ANON}" \
  -H "x-group-id: ${GROUP_ID}" -H "x-empresa-id: ${OTHER_EMPRESA}" \
  "${BASE_URL}/api/v1/orcamentos?limit=1" 2>/dev/null || true)"
echo "neg_foreign_empresa=${bad_eid}"

# 5) Sem headers de tenant (Bearer válido)
no_tenant="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -H "Authorization: Bearer ${TOK}" -H "apikey: ${ANON}" \
  "${BASE_URL}/api/v1/orcamentos?limit=1" 2>/dev/null || true)"
echo "neg_missing_tenant_headers=${no_tenant}"

# 6) Spoof dev_headers sem Bearer (fail-closed Auth real)
spoof="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -H "apikey: ${ANON}" \
  -H "x-actor-id: 00000000-0000-4000-8000-000000000001" \
  -H "x-group-id: ${GROUP_ID}" -H "x-empresa-id: ${EMPRESA_ID}" \
  "${BASE_URL}/api/v1/orcamentos?limit=1" 2>/dev/null || true)"
echo "neg_spoof_dev_headers=${spoof}"

is_denied() {
  case "$1" in
    401|403|404|400) return 0 ;;
    *) return 1 ;;
  esac
}

ok=YES
is_denied "$no_auth" || ok=NO
is_denied "$bad_tok" || ok=NO
is_denied "$bad_gid" || ok=NO
is_denied "$bad_eid" || ok=NO
is_denied "$no_tenant" || ok=NO
is_denied "$spoof" || ok=NO
[[ "$pos" == "200" ]] || ok=NO

CANARY_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CANARY_NAME" 2>/dev/null || true)"

SMOKE_RESULT=FAIL
[[ "$ok" == "YES" ]] && SMOKE_RESULT=OK

echo "PASTE_TO_GIT_BEGIN"
echo "positive_orc_list=${pos}"
echo "neg_no_auth=${no_auth}"
echo "neg_invalid_token=${bad_tok}"
echo "neg_adulterated_group=${bad_gid}"
echo "neg_foreign_empresa=${bad_eid}"
echo "neg_missing_tenant_headers=${no_tenant}"
echo "neg_spoof_dev_headers=${spoof}"
echo "canary_image=${CANARY_IMAGE:-unknown}"
echo "token_len=${#TOK}"
echo "anon_len=${#ANON}"
echo "GATE_D_NEGATIVES_SMOKE=${SMOKE_RESULT}"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"
echo "NOTE=segredos_somente_cofre_local"
echo "PASTE_TO_GIT_END"

echo "GATE_D_NEGATIVES_SMOKE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$ok" == "YES" ]] || { echo 'BLOCKED: gate_d_negatives_failed' >&2; exit 8; }
