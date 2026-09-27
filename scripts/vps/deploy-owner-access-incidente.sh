#!/usr/bin/env bash
# Deploy controlado do incidente de acesso do proprietário.
# Cria/alinha Grupo CPA + empresas, garante Auth do owner, provisiona RBAC,
# demove synth e rebuild API+SPA (com tags de rollback no script de rebuild).
#
# Uso (VPS) — SEMPRE checkout da main ANTES (senão o script não existe no disco):
#   cd /opt/erp-zuccaro
#   git fetch origin main && git checkout --detach origin/main
#   CONFIRM_OWNER_ACCESS_DEPLOY=YES OWNER_PASS='***' \
#     bash scripts/vps/deploy-owner-access-incidente.sh
#
# OWNER_PASS: senha da conta Auth do proprietário (mín. 8). Obrigatória se
# auth.users ainda não tiver o e-mail do owner (evidência: auth_other_accounts=0).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_OWNER_ACCESS_DEPLOY="${CONFIRM_OWNER_ACCESS_DEPLOY:-}"
OWNER_EMAIL="${OWNER_EMAIL:-vinicius.zuccaro@gmail.com}"
OWNER_PASS="${OWNER_PASS:-}"
OWNER_FULL_NAME="${OWNER_FULL_NAME:-Vinicius Zuccaro}"
GIT_REF="${GIT_REF:-HEAD}"
ERP_DOCKER_NETWORK="${ERP_DOCKER_NETWORK:-supabase_default}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT/backups/owner-access-deploy}"
ENV_FILE="${ENV_FILE:-$ROOT/.env.erp.dev}"
SUPA_ENV="${SUPA_ENV:-/opt/supabase/docker/.env}"

# UUIDs canônicos do seed A (determinísticos). Usados se Grupo CPA ainda não existir.
DEFAULT_GROUP_ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
DEFAULT_EMPRESA_CPA_ID='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
DEFAULT_EMPRESA_3Z_ID='c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2'
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'

mask_uuid() {
  local u="$1"
  [[ ${#u} -ge 12 ]] || { echo '********'; return; }
  echo "${u:0:8}…${u: -4}"
}

# Ignora placeholders tipo <uuid-grupo-cpa> deixados no shell de pastes anteriores.
sanitize_uuid_or_default() {
  local raw="${1:-}"
  local fallback="$2"
  local name="$3"
  if [[ -z "$raw" ]]; then
    echo "$fallback"
    return
  fi
  if [[ "$raw" == *'<'* || "$raw" == *'>'* || "$raw" == *'…'* || "$raw" == *'...'* ]]; then
    echo "WARN: ${name}_looks_like_placeholder_using_default" >&2
    echo "$fallback"
    return
  fi
  if [[ ! "$raw" =~ $UUID_RE ]]; then
    echo "WARN: ${name}_invalid_uuid_using_default got_prefix=${raw:0:12}" >&2
    echo "$fallback"
    return
  fi
  echo "$raw"
}

[[ "$CONFIRM_OWNER_ACCESS_DEPLOY" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_OWNER_ACCESS_DEPLOY=YES' >&2
  exit 2
}

mkdir -p "$EVIDENCE_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
EVIDENCE_FILE="$EVIDENCE_DIR/evidence-${STAMP}.txt"

{
  echo "OWNER_ACCESS_DEPLOY_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "git_ref=${GIT_REF}"
} | tee "$EVIDENCE_FILE"

if [[ "$GIT_REF" != "HEAD" ]]; then
  REF_BRANCH="${GIT_REF#origin/}"
  git fetch origin "$REF_BRANCH"
  git checkout --detach "origin/${REF_BRANCH}"
fi
TIP="$(git rev-parse HEAD)"
TIP8="${TIP:0:8}"
echo "main_tip=${TIP8}" | tee -a "$EVIDENCE_FILE"

[[ -f "$ROOT/scripts/vps/deploy-owner-access-incidente.sh" ]] || {
  echo 'BLOCKED: script_missing_after_checkout — rode git checkout --detach origin/main' >&2
  exit 3
}

docker inspect -f '{{.Name}} {{.Id}} {{.Config.Image}}' erp-api-dev erp-web-dev 2>/dev/null \
  | tee -a "$EVIDENCE_FILE" || true

# --- 1) Garantir Grupo CPA + empresas ativas (INSERT se ausente; UPDATE nomes) ---
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
INSERT INTO groups (id, nome_do_grupo, status, observacoes)
VALUES (
  '${DEFAULT_GROUP_ID}'::uuid,
  'Grupo CPA',
  'Ativo',
  'Owner-access bootstrap — tenant operacional CPA'
)
ON CONFLICT (id) DO UPDATE
  SET nome_do_grupo = EXCLUDED.nome_do_grupo,
      status = 'Ativo',
      updated_at = timezone('utc', now());

INSERT INTO empresas (id, group_id, razao_social, nome_fantasia, cnpj, status)
VALUES (
  '${DEFAULT_EMPRESA_CPA_ID}'::uuid,
  '${DEFAULT_GROUP_ID}'::uuid,
  'CPA FERRO E ACO LTDA',
  'CPA ferro e aço',
  NULL,
  'Ativa'
)
ON CONFLICT (id) DO UPDATE
  SET group_id = EXCLUDED.group_id,
      razao_social = EXCLUDED.razao_social,
      nome_fantasia = EXCLUDED.nome_fantasia,
      status = 'Ativa',
      updated_at = timezone('utc', now());

INSERT INTO empresas (id, group_id, razao_social, nome_fantasia, cnpj, status)
VALUES (
  '${DEFAULT_EMPRESA_3Z_ID}'::uuid,
  '${DEFAULT_GROUP_ID}'::uuid,
  '3Z LTDA',
  '3Z LTDA',
  NULL,
  'Ativa'
)
ON CONFLICT (id) DO UPDATE
  SET group_id = EXCLUDED.group_id,
      razao_social = EXCLUDED.razao_social,
      nome_fantasia = EXCLUDED.nome_fantasia,
      status = 'Ativa',
      updated_at = timezone('utc', now());
SQL

OWNER_GROUP_ID="$(sanitize_uuid_or_default "${OWNER_GROUP_ID:-}" "$DEFAULT_GROUP_ID" OWNER_GROUP_ID)"
OWNER_EMPRESA_ID="$(sanitize_uuid_or_default "${OWNER_EMPRESA_ID:-}" "$DEFAULT_EMPRESA_CPA_ID" OWNER_EMPRESA_ID)"
EMPRESA_3Z_ID="$(sanitize_uuid_or_default "${EMPRESA_3Z_ID:-}" "$DEFAULT_EMPRESA_3Z_ID" EMPRESA_3Z_ID)"

echo "tenant_bootstrapped=YES group=$(mask_uuid "$OWNER_GROUP_ID")" | tee -a "$EVIDENCE_FILE"
echo "owner_group_id_prefix=${OWNER_GROUP_ID:0:8}" | tee -a "$EVIDENCE_FILE"
echo "owner_empresa_id_prefix=${OWNER_EMPRESA_ID:0:8}" | tee -a "$EVIDENCE_FILE"

docker exec -i supabase-db psql -X -U postgres -d postgres -At <<SQL | tee -a "$EVIDENCE_FILE"
SELECT 'group_cpa=' || (EXISTS (SELECT 1 FROM groups WHERE id='${DEFAULT_GROUP_ID}'::uuid AND nome_do_grupo='Grupo CPA'))::text;
SELECT 'empresas_ativas=' || count(*)::text FROM empresas
 WHERE group_id='${DEFAULT_GROUP_ID}'::uuid AND status='Ativa'
   AND (
     lower(COALESCE(nome_fantasia,razao_social)) LIKE '%cpa ferro%'
     OR lower(COALESCE(nome_fantasia,razao_social)) LIKE '%3z%'
   );
SQL

# --- 2) Garantir Auth do proprietário (evidência: auth_other_accounts=0) ---
OWNER_AUTH_COUNT="$(docker exec -i supabase-db psql -X -U postgres -d postgres -At \
  -v owner_email="$OWNER_EMAIL" <<'SQL'
SELECT count(*)::text FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email');
SQL
)"
OWNER_AUTH_COUNT="$(echo "$OWNER_AUTH_COUNT" | tr -d '[:space:]')"
echo "owner_auth_count=${OWNER_AUTH_COUNT}" | tee -a "$EVIDENCE_FILE"

if [[ "$OWNER_AUTH_COUNT" != "1" ]]; then
  [[ -n "$OWNER_PASS" && ${#OWNER_PASS} -ge 8 ]] || {
    echo 'BLOCKED: owner_auth_missing — set OWNER_PASS (min 8) to create Auth user via Admin API' >&2
    echo 'HINT=CONFIRM_OWNER_ACCESS_DEPLOY=YES OWNER_PASS=... bash scripts/vps/deploy-owner-access-incidente.sh' >&2
    exit 4
  }
  # Carrega service_role sem ecoar valor
  SR=""
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
    SR="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${JWT_SERVICE_ROLE:-}}}"
  fi
  if [[ -z "$SR" && -f "$SUPA_ENV" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$SUPA_ENV"; set +a
    SR="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
  fi
  [[ -n "$SR" ]] || {
    echo 'BLOCKED: service_role_missing_for_owner_auth_create' >&2
    exit 5
  }
  AUTH_BASE="${SUPABASE_PUBLIC_URL:-http://127.0.0.1:8000}"
  TMP_JSON="/tmp/owner-auth-create-$$.json"
  HTTP_CREATE="$(curl -sS -o "$TMP_JSON" -w '%{http_code}' --connect-timeout 8 \
    -X POST "${AUTH_BASE}/auth/v1/admin/users" \
    -H "apikey: ${SR}" \
    -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${OWNER_EMAIL}\",\"password\":\"${OWNER_PASS}\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"${OWNER_FULL_NAME}\"}}" \
    2>/dev/null || echo '000')"
  echo "owner_auth_create_http=${HTTP_CREATE}" | tee -a "$EVIDENCE_FILE"
  # email_exists → ok; senão exige 200/201
  if [[ "$HTTP_CREATE" != "200" && "$HTTP_CREATE" != "201" ]]; then
    if grep -Eqi 'email_exists|already registered' "$TMP_JSON" 2>/dev/null; then
      echo 'owner_auth_create=EXISTS' | tee -a "$EVIDENCE_FILE"
    else
      echo 'BLOCKED: owner_auth_create_failed' >&2
      rm -f "$TMP_JSON"
      exit 6
    fi
  else
    echo 'owner_auth_create=YES' | tee -a "$EVIDENCE_FILE"
  fi
  rm -f "$TMP_JSON"
  # Confirma count=1
  OWNER_AUTH_COUNT="$(docker exec -i supabase-db psql -X -U postgres -d postgres -At \
    -v owner_email="$OWNER_EMAIL" <<'SQL'
SELECT count(*)::text FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email');
SQL
)"
  OWNER_AUTH_COUNT="$(echo "$OWNER_AUTH_COUNT" | tr -d '[:space:]')"
  echo "owner_auth_count_after=${OWNER_AUTH_COUNT}" | tee -a "$EVIDENCE_FILE"
  [[ "$OWNER_AUTH_COUNT" == "1" ]] || {
    echo "BLOCKED: owner_auth_still_missing got=${OWNER_AUTH_COUNT}" >&2
    exit 7
  }
fi

# --- 3) Perfil admin ERP + demote synth ---
CONFIRM_OWNER_ADMIN_PROFILE=YES \
  OWNER_EMAIL="$OWNER_EMAIL" \
  OWNER_GROUP_ID="$OWNER_GROUP_ID" \
  OWNER_EMPRESA_ID="$OWNER_EMPRESA_ID" \
  OWNER_FULL_NAME="$OWNER_FULL_NAME" \
  DEMOTE_SYNTH=YES \
  bash scripts/vps/provision-owner-admin-profile.sh | tee -a "$EVIDENCE_FILE"

# --- 4) Rebuild API + SPA ---
CONFIRM_SPA_LOGIN_REBUILD=YES \
  ERP_DOCKER_NETWORK="$ERP_DOCKER_NETWORK" \
  GIT_REF=HEAD \
  bash scripts/vps/spa-login-rebuild-api-web.sh | tee -a "$EVIDENCE_FILE"

docker inspect -f 'name={{.Name}} image={{.Config.Image}} id={{.Id}}' erp-api-dev erp-web-dev \
  | tee -a "$EVIDENCE_FILE"

docker exec -i supabase-db psql -X -U postgres -d postgres -At <<SQL | tee -a "$EVIDENCE_FILE"
SELECT 'owner_admin=' || count(*)::text
FROM profiles p
WHERE lower(p.email) = lower('${OWNER_EMAIL}') AND p.ativo = true AND p.role = 'admin';
SELECT 'owner_group=' || left(g.id::text,8) || '|' || g.nome_do_grupo
FROM profiles p JOIN groups g ON g.id = p.group_id
WHERE lower(p.email) = lower('${OWNER_EMAIL}') AND p.ativo = true LIMIT 1;
SELECT 'empresa=' || left(e.id::text,8) || '|' || COALESCE(e.nome_fantasia, e.razao_social)
FROM empresas e
WHERE e.group_id = '${OWNER_GROUP_ID}'::uuid AND e.status = 'Ativa'
ORDER BY COALESCE(e.nome_fantasia, e.razao_social);
SELECT 'synth_admin=' || count(*)::text
FROM profiles p
WHERE lower(p.email) = lower('gate-d.synth@dev.synthetic.local') AND p.ativo = true AND p.role = 'admin';
SQL

curl -sS http://127.0.0.1:3080/api/v1/meta | python3 -c '
import sys,json
m=json.load(sys.stdin)
print("runtime", m.get("runtime"))
print("auth_mode", (m.get("auth") or {}).get("mode"))
print("pwd_path", (m.get("authSession") or {}).get("passwordLoginPath"))
' | tee -a "$EVIDENCE_FILE"

echo "evidence_file=${EVIDENCE_FILE}" | tee -a "$EVIDENCE_FILE"
echo "OWNER_ACCESS_DEPLOY_END tip=${TIP8}" | tee -a "$EVIDENCE_FILE"
echo "NEXT=browser_Sair_login_owner_seletor_CPA_Comercial_Config"
