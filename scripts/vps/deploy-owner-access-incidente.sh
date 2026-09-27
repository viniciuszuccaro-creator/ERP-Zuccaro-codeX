#!/usr/bin/env bash
# AUDIT não escreve. APPLY reutiliza registros conferidos; BOOTSTRAP exige decisão explícita.
# Senha nova apenas em /dev/tty, nunca argumento/env/arquivo. Rollback DB separado das imagens.
set +x
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
MODE="${OWNER_ACCESS_MODE:-AUDIT}"
[[ "$MODE" == AUDIT || "$MODE" == APPLY || "$MODE" == BOOTSTRAP ]] || { echo 'BLOCKED: invalid_mode' >&2; exit 2; }
[[ -z "${OWNER_PASS:-}" ]] || { unset OWNER_PASS; echo 'BLOCKED: password_environment_not_allowed_use_tty' >&2; exit 2; }
OWNER_EMAIL="${OWNER_EMAIL:-}"
OWNER_GROUP_ID="${OWNER_GROUP_ID:-}"
OWNER_EMPRESA_ID="${OWNER_EMPRESA_ID:-}"
EMPRESA_3Z_ID="${EMPRESA_3Z_ID:-}"
OWNER_FULL_NAME="${OWNER_FULL_NAME:-}"
APPROVE_EXISTING_TENANT_MAPPING="${APPROVE_EXISTING_TENANT_MAPPING:-NO}"
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
[[ "$OWNER_EMAIL" == *@* && "$OWNER_EMAIL" != *$'\n'* ]] || { echo 'BLOCKED: explicit_owner_email_required' >&2; exit 2; }
if [[ "$MODE" != AUDIT ]]; then
  [[ "${CONFIRM_OWNER_ACCESS_DEPLOY:-}" == YES && "${CONFIRM_OWNER_GROUP_ADMIN:-}" == YES ]] || { echo 'BLOCKED: deployment_and_group_admin_confirmation_required' >&2; exit 2; }
  for value in "$OWNER_GROUP_ID" "$OWNER_EMPRESA_ID" "$EMPRESA_3Z_ID"; do
    [[ "$value" =~ $UUID_RE ]] || { echo 'BLOCKED: explicit_valid_tenant_ids_required_no_fallback' >&2; exit 2; }
  done
  [[ "$OWNER_EMPRESA_ID" != "$EMPRESA_3Z_ID" ]] || { echo 'BLOCKED: distinct_companies_required' >&2; exit 2; }
  : "${ERP_DOCKER_NETWORK:?Discover the actual Docker network}"
  : "${EXPECTED_DATABASE:?Confirm the actual API database}"
  : "${APPROVED_SHA:?Full SHA reviewed by Cursor with green CI}"
  [[ "$APPROVED_SHA" =~ ^[0-9a-f]{40}$ && "$(git rev-parse HEAD)" == "$APPROVED_SHA" ]] || { echo 'BLOCKED: checkout_not_reviewed_sha' >&2; exit 2; }
  [[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo 'BLOCKED: tracked_checkout_dirty' >&2; exit 2; }
fi
IDENTITY_SQL="SELECT current_database() || '|' || extract(epoch from pg_postmaster_start_time())::text"
DIRECT_ID="$(docker exec supabase-db psql -X -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c "$IDENTITY_SQL")"
API_ID="$(docker exec erp-api-dev node --input-type=module -e 'import pg from "pg"; const c=new pg.Client({connectionString:process.env.DATABASE_URL}); try { await c.connect(); const r=await c.query("SELECT current_database() || chr(124) || extract(epoch from pg_postmaster_start_time())::text AS identity"); console.log(r.rows[0].identity); } catch { console.error("BLOCKED: api_database_identity_unavailable"); process.exitCode=3; } finally { await c.end(); }')"
[[ "$DIRECT_ID" == "$API_ID" ]] || { echo 'BLOCKED: api_and_direct_database_differ' >&2; exit 3; }
DATABASE="${API_ID%%|*}"
echo 'database_identity_matches=YES'
[[ "$MODE" == AUDIT || "$DATABASE" == "$EXPECTED_DATABASE" ]] || { echo 'BLOCKED: unexpected_database' >&2; exit 3; }
GATE_JS="$(cat <<'JS'
const fs=require('fs'), pg=require('pg');
const [op,email,group,company,other,name,reuse,mode,password]=fs.readFileSync(0,'utf8').split('\0');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
(async()=>{await client.connect();
const fail=code=>{throw new Error(code);};
const auth=await client.query('SELECT id FROM auth.users WHERE lower(email)=lower($1)',[email]);
const profiles=await client.query('SELECT id,auth_user_id,group_id,empresa_id,ativo FROM profiles WHERE lower(email)=lower($1) OR auth_user_id IN (SELECT id FROM auth.users WHERE lower(email)=lower($1))',[email]);
const groups=await client.query("SELECT id,nome_do_grupo,status FROM groups WHERE id=$1::uuid OR lower(nome_do_grupo)=lower('Grupo CPA')",[group||null]);
const companies=await client.query("SELECT id,group_id,nome_fantasia,razao_social,status FROM empresas WHERE group_id IN (SELECT id FROM groups WHERE id=$1::uuid OR lower(nome_do_grupo)=lower('Grupo CPA')) OR id=ANY($2::uuid[])",[group||null,[company,other].filter(Boolean)]);
console.log(JSON.stringify({owner_auth_count:auth.rowCount,owner_profiles:profiles.rowCount,owner_active_profiles:profiles.rows.filter(p=>p.ativo).length,candidate_groups:groups.rowCount,active_companies:companies.rows.filter(e=>e.status==='Ativa').length}));
if(op==='audit') return;
if(auth.rowCount>1 || profiles.rowCount>1) fail('duplicate_owner_identity');
if(profiles.rows.some(p=>(p.auth_user_id && p.auth_user_id!==auth.rows[0]?.id) || p.group_id!==group)) fail('existing_profile_identity_or_tenant_conflict');
if([group,company,other].some(id=>['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2'].includes(id)) && reuse!=='YES') fail('synthetic_tenant_requires_owner_decision');
if(groups.rows.some(g=>g.id!==group)) fail('ambiguous_existing_group_requires_resolution');
const g=groups.rows.find(g=>g.id===group);
if(g && (g.nome_do_grupo!=='Grupo CPA' || g.status!=='Ativo')) fail('existing_group_mismatch_no_rename');
const expected=[[company,'CPA ferro e aço'],[other,'3Z LTDA']];
for(const [id,display] of expected){
const row=companies.rows.find(e=>e.id===id);
if(row && (row.group_id!==group || row.status!=='Ativa' || (row.nome_fantasia||row.razao_social).toLowerCase()!==display.toLowerCase())) fail('existing_company_mismatch_no_reparent');
if(companies.rows.some(e=>e.id!==id && (e.nome_fantasia||e.razao_social).toLowerCase()===display.toLowerCase())) fail('duplicate_company_name_requires_resolution');
if(mode==='APPLY' && !row) fail('existing_company_required');
}
if(mode==='APPLY' && (!g || auth.rowCount!==1)) fail('existing_group_and_auth_required');
if(op==='preflight'){console.log('owner_preflight=PASS');return;}
if(op==='bootstrap'){
if(mode!=='BOOTSTRAP') fail('bootstrap_not_authorized');
if(auth.rowCount===0){
if(!password || password.length<12) fail('interactive_password_minimum_12');
const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base || !key) fail('auth_admin_configuration_missing');
let response;try{response=await fetch(new URL('auth/v1/admin/users',base.replace(/\/+$/,'')+'/'),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:name}}),signal:AbortSignal.timeout(8000)});}catch{fail('auth_create_unconfirmed_reaudit_before_retry');}
if(!response.ok) fail('auth_create_failed_reaudit_before_retry');
const check=await client.query('SELECT id FROM auth.users WHERE lower(email)=lower($1)',[email]);
if(check.rowCount!==1) fail('auth_created_in_different_database');
console.log('owner_auth_created=YES');
}
await client.query('BEGIN');
const created=[];
try{
await client.query('LOCK TABLE groups, empresas IN SHARE ROW EXCLUSIVE MODE');
const duplicate=await client.query("SELECT id FROM groups WHERE lower(nome_do_grupo)=lower('Grupo CPA') AND id<>$1",[group]);
if(duplicate.rowCount) fail('concurrent_group_conflict');
const existing=await client.query('SELECT id,nome_do_grupo,status FROM groups WHERE id=$1',[group]);
if(existing.rowCount && (existing.rows[0].nome_do_grupo!=='Grupo CPA' || existing.rows[0].status!=='Ativo')) fail('concurrent_group_id_conflict');
if(!g && existing.rowCount) fail('concurrent_group_id_conflict');
if(!existing.rowCount){await client.query("INSERT INTO groups(id,nome_do_grupo,status) VALUES($1,'Grupo CPA','Ativo')",[group]);created.push(['Group',group,company,{status:'Ativo'}]);}
for(const [id,display] of expected){
const conflict=await client.query('SELECT id FROM empresas WHERE lower(COALESCE(nome_fantasia,razao_social))=lower($1) AND group_id=$2 AND id<>$3',[display,group,id]);
if(conflict.rowCount) fail('concurrent_company_conflict');
const row=await client.query('SELECT group_id,nome_fantasia,razao_social,status FROM empresas WHERE id=$1',[id]);
if(row.rowCount){const e=row.rows[0];if(e.group_id!==group || e.status!=='Ativa' || (e.nome_fantasia||e.razao_social).toLowerCase()!==display.toLowerCase()) fail('concurrent_company_id_conflict');}
else {await client.query("INSERT INTO empresas(id,group_id,razao_social,nome_fantasia,status) VALUES($1,$2,$3,$3,'Ativa')",[id,group,display]);created.push(['Empresa',id,id,{status:'Ativa'}]);}
}
for(const [entity,id,empresa,after] of created) await client.query("INSERT INTO audit_logs(group_id,empresa_id,actor_email,entity,entity_id,action,before_data,after_data) VALUES($1,$2,'system:vps-owner-bootstrap',$3,$4,'create',NULL,$5::jsonb)",[group,empresa,entity,id,JSON.stringify(after)]);
await client.query('COMMIT'); console.log('tenant_bootstrap=COMMITTED');
}catch(error){await client.query('ROLLBACK');throw error;}
}
})().catch(error=>{console.error('BLOCKED: '+(/^[a-z0-9_]+$/.test(error.message)?error.message:'database_operation_failed'));process.exitCode=4;}).finally(()=>client.end());
JS
)"
run_gate() {
  printf '%s\0' "$1" "$OWNER_EMAIL" "$OWNER_GROUP_ID" "$OWNER_EMPRESA_ID" "$EMPRESA_3Z_ID" "$OWNER_FULL_NAME" "$APPROVE_EXISTING_TENANT_MAPPING" "$MODE" "${PASSWORD:-}" | docker exec -i erp-api-dev node -e "$GATE_JS"
}
run_gate audit
[[ "$MODE" != AUDIT ]] || { echo 'OWNER_ACCESS_AUDIT_ONLY_NO_WRITES'; exit 0; }
if [[ "$MODE" == BOOTSTRAP ]]; then
  [[ "${CONFIRM_OWNER_TENANT_CREATE:-}" == YES && -n "$OWNER_FULL_NAME" ]] || { echo 'BLOCKED: explicit_bootstrap_decision_required' >&2; exit 2; }
fi
run_gate preflight
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/backups/owner-access-deploy/$STAMP"
mkdir -p "$BACKUP_DIR"
docker exec supabase-db pg_dump -U postgres -d postgres -Fc >"$BACKUP_DIR/database.dump"
[[ -s "$BACKUP_DIR/database.dump" ]] || { echo 'BLOCKED: empty_backup' >&2; exit 3; }
docker exec -i supabase-db pg_restore -l <"$BACKUP_DIR/database.dump" >"$BACKUP_DIR/archive-list.txt"
sha256sum "$BACKUP_DIR/database.dump" >"$BACKUP_DIR/database.sha256"
cp .env.erp.dev "$BACKUP_DIR/api.env.restore"
cp docker-compose.erp.yml "$BACKUP_DIR/compose.restore.yml"
echo 'backup_archive_valid=YES'
# As imagens testadas no canário são as mesmas promovidas, sem rebuild posterior.
CANARY_NETWORK="erp-owner-canary-$STAMP"
CANARY_API="erp-owner-api-$STAMP"
CANARY_WEB="erp-owner-web-$STAMP"
CANDIDATE_API_IMAGE="erp-zuccaro-owner-api:$APPROVED_SHA"
CANDIDATE_WEB_IMAGE="erp-zuccaro-owner-web:$APPROVED_SHA"
for port in 3086 3087; do
  [[ -z "$(ss -H -lnt "sport = :$port")" ]] || { echo 'BLOCKED: canary_port_in_use' >&2; exit 3; }
done
cleanup_canary() {
  docker rm -f "$CANARY_WEB" "$CANARY_API" >/dev/null 2>&1 || true
  docker network rm "$CANARY_NETWORK" >/dev/null 2>&1 || true
}
# Nomes exclusivos; nunca remover containers oficiais, volumes, imagens ou backups.
trap cleanup_canary EXIT
docker build --label "org.opencontainers.image.revision=$APPROVED_SHA" -t "$CANDIDATE_API_IMAGE" server
docker build --label "org.opencontainers.image.revision=$APPROVED_SHA" --build-arg VITE_ERP_BACKEND=http --build-arg VITE_ERP_API_SAME_ORIGIN=true -f Dockerfile.frontend -t "$CANDIDATE_WEB_IMAGE" .
docker network create "$CANARY_NETWORK" >/dev/null
docker run -d --name "$CANARY_API" --network "$ERP_DOCKER_NETWORK" --env-file .env.erp.dev -e NODE_ENV=production -e ERP_ENV=dev -e PORT=3080 -e REQUIRE_DATABASE=true --memory 512m --cpus 0.5 -p 127.0.0.1:3086:3080 "$CANDIDATE_API_IMAGE" >/dev/null
docker network connect --alias erp-api "$CANARY_NETWORK" "$CANARY_API"
docker run -d --name "$CANARY_WEB" --network "$CANARY_NETWORK" --memory 128m --cpus 0.25 -p 127.0.0.1:3087:80 "$CANDIDATE_WEB_IMAGE" >/dev/null
CANARY_OK=NO
for ((i=1;i<=30;i++)); do
  if curl -fsS -m 3 http://127.0.0.1:3086/ready >/dev/null && curl -fsS -m 3 http://127.0.0.1:3087/ready >/dev/null; then CANARY_OK=YES; break; fi
  sleep 2
done
[[ "$CANARY_OK" == YES ]] || { echo 'BLOCKED: canary_readiness_failed_official_preserved' >&2; exit 4; }
[[ "$(curl -sS -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3087/api/v1/auth/session -H 'x-actor-id: fabricated' -H 'x-group-id: fabricated')" == 401 ]] || { echo 'BLOCKED: canary_fabricated_identity_accepted' >&2; exit 4; }
HTML="$(curl -fsS -m 5 http://127.0.0.1:3087/)"
ASSET="$(printf '%s' "$HTML" | grep -oE '/assets/index-[^"]+\.js' | head -1)"
[[ -n "$ASSET" ]] || { echo 'BLOCKED: canary_spa_asset_missing' >&2; exit 4; }
curl -fsS -m 15 "http://127.0.0.1:3087$ASSET" >"$BACKUP_DIR/canary-bundle.js"
grep -q 'erp-login-email' "$BACKUP_DIR/canary-bundle.js" || { echo 'BLOCKED: canary_login_missing' >&2; exit 4; }
printf 'canary_source_sha=%s\n' "$APPROVED_SHA"
docker inspect -f 'canary={{.Name}} digest={{.Image}}' "$CANARY_API" "$CANARY_WEB"
cleanup_canary
trap - EXIT

if [[ "$MODE" == BOOTSTRAP ]]; then
  [[ -r /dev/tty ]] || { echo 'BLOCKED: secure_interactive_terminal_required' >&2; exit 2; }
  read -r -s -p 'Senha nova apenas se Auth ausente (12+ caracteres): ' PASSWORD </dev/tty
  printf '\n' >/dev/tty
  run_gate bootstrap
  unset PASSWORD
fi
run_gate preflight
CONFIRM_OWNER_ADMIN_PROFILE=YES OWNER_SCOPE=GROUP CONFIRM_OWNER_GROUP_ADMIN=YES OWNER_EMAIL="$OWNER_EMAIL" OWNER_GROUP_ID="$OWNER_GROUP_ID" OWNER_EMPRESA_ID="$OWNER_EMPRESA_ID" OWNER_FULL_NAME="$OWNER_FULL_NAME" DEMOTE_SYNTH=YES bash scripts/vps/provision-owner-admin-profile.sh >"$BACKUP_DIR/provision.log" 2>&1 || { echo 'BLOCKED: provisioning_failed_preserve_backup_private_log' >&2; exit 4; }
echo 'database_changes_preserved_on_image_rollback=YES'
CONFIRM_SPA_LOGIN_REBUILD=YES ERP_DOCKER_NETWORK="$ERP_DOCKER_NETWORK" GIT_REF=HEAD APPROVED_SHA="$APPROVED_SHA" CANDIDATE_API_IMAGE="$CANDIDATE_API_IMAGE" CANDIDATE_WEB_IMAGE="$CANDIDATE_WEB_IMAGE" bash scripts/vps/spa-login-rebuild-api-web.sh
printf 'reviewed_source_sha=%s\n' "$APPROVED_SHA"
docker inspect -f 'service={{.Name}} digest={{.Image}}' erp-api-dev erp-web-dev
echo 'NEXT=owner_logout_login_both_companies_Comercial_Configuracoes'
