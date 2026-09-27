#!/usr/bin/env bash
# Deploy controlado do incidente de acesso do proprietário (#91 + harden).
# Uso na Web Console / SSH da VPS (humano ou agente com acesso):
#   CONFIRM_OWNER_ACCESS_DEPLOY=YES bash scripts/vps/deploy-owner-access-incidente.sh
#
# Não imprime e-mail completo, senha, token ou UUID completo nos logs de prova.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_OWNER_ACCESS_DEPLOY="${CONFIRM_OWNER_ACCESS_DEPLOY:-}"
OWNER_EMAIL="${OWNER_EMAIL:-vinicius.zuccaro@gmail.com}"
OWNER_GROUP_ID="${OWNER_GROUP_ID:-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa}"
OWNER_EMPRESA_ID="${OWNER_EMPRESA_ID:-cccccccc-cccc-4ccc-8ccc-cccccccccccc}"
EMPRESA_3Z_ID="${EMPRESA_3Z_ID:-c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2}"
GIT_REF="${GIT_REF:-origin/main}"
ERP_DOCKER_NETWORK="${ERP_DOCKER_NETWORK:-supabase_default}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT/backups/owner-access-deploy}"

mask_uuid() {
  local u="$1"
  [[ ${#u} -ge 12 ]] || { echo '********'; return; }
  echo "${u:0:8}…${u: -4}"
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

# Checkout
if [[ "$GIT_REF" == "HEAD" ]]; then
  echo 'git_checkout=SKIP' | tee -a "$EVIDENCE_FILE"
else
  REF_BRANCH="${GIT_REF#origin/}"
  git fetch origin "$REF_BRANCH"
  git checkout --detach "origin/${REF_BRANCH}"
fi
TIP="$(git rev-parse HEAD)"
TIP8="${TIP:0:8}"
echo "main_tip=${TIP8}" | tee -a "$EVIDENCE_FILE"

# Backup containers / images before rebuild
docker inspect -f '{{.Name}} {{.Id}} {{.Config.Image}}' erp-api-dev erp-web-dev 2>/dev/null \
  | tee -a "$EVIDENCE_FILE" || true

# Align CPA display names on synthetic tenant A (no real CNPJ)
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
UPDATE groups SET nome_do_grupo = 'Grupo CPA', updated_at = timezone('utc', now())
 WHERE id = '${OWNER_GROUP_ID}'::uuid;
UPDATE empresas SET
  razao_social = 'CPA FERRO E ACO LTDA',
  nome_fantasia = 'CPA ferro e aço',
  updated_at = timezone('utc', now())
 WHERE id = '${OWNER_EMPRESA_ID}'::uuid AND group_id = '${OWNER_GROUP_ID}'::uuid;
UPDATE empresas SET
  razao_social = '3Z LTDA',
  nome_fantasia = '3Z LTDA',
  updated_at = timezone('utc', now())
 WHERE id = '${EMPRESA_3Z_ID}'::uuid AND group_id = '${OWNER_GROUP_ID}'::uuid;
SQL
echo "tenant_names_aligned=YES group=$(mask_uuid "$OWNER_GROUP_ID")" | tee -a "$EVIDENCE_FILE"

CONFIRM_OWNER_ADMIN_PROFILE=YES \
  OWNER_EMAIL="$OWNER_EMAIL" \
  OWNER_GROUP_ID="$OWNER_GROUP_ID" \
  OWNER_EMPRESA_ID="$OWNER_EMPRESA_ID" \
  DEMOTE_SYNTH=YES \
  bash scripts/vps/provision-owner-admin-profile.sh | tee -a "$EVIDENCE_FILE"

CONFIRM_SPA_LOGIN_REBUILD=YES \
  ERP_DOCKER_NETWORK="$ERP_DOCKER_NETWORK" \
  GIT_REF=HEAD \
  bash scripts/vps/spa-login-rebuild-api-web.sh | tee -a "$EVIDENCE_FILE"

docker inspect -f 'name={{.Name}} image={{.Config.Image}} id={{.Id}}' erp-api-dev erp-web-dev \
  | tee -a "$EVIDENCE_FILE"

# Sanitized proof: group/empresa names for owner email domain only (no full email/token)
docker exec -i supabase-db psql -X -U postgres -d postgres -At <<SQL | tee -a "$EVIDENCE_FILE"
SELECT 'owner_profiles=' || count(*)::text
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
echo "NEXT=browser: Sair → login proprietário → seletor CPA/3Z → Comercial + Configurações"
