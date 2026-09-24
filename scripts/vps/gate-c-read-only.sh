#!/usr/bin/env bash
# Gate C — SOMENTE LEITURA na VPS DEV.
# Não reinicia, não aplica migration, não toca bind 3080, não cria canário.
# Não imprime .env, DATABASE_URL, senha, token, e-mail, nome ou UUID individual.
set -Eeuo pipefail

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "GATE_C_READ_ONLY_BEGIN utc=$ts"

echo '--- CONTAINERS ---'
docker ps -a --format 'name={{.Names}} status={{.Status}} image={{.Image}}' \
  | awk '/erp-api|supabase-(db|auth|storage)|rollback|canary/ {print}'

echo '--- OFFICIAL API 3080 ---'
if docker ps --format '{{.Names}}' | grep -Fxq erp-api-dev; then
  img="$(docker inspect erp-api-dev --format '{{.Config.Image}}')"
  net="$(docker inspect erp-api-dev --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
  echo "official_image=$img"
  echo "official_networks=$net"
  curl -sS -m 5 -o /tmp/gc_health -w 'health_http=%{http_code}\n' http://127.0.0.1:3080/health || echo 'health_http=ERR'
  curl -sS -m 5 -o /tmp/gc_ready -w 'ready_http=%{http_code}\n' http://127.0.0.1:3080/ready || echo 'ready_http=ERR'
  # Preferir Node DENTRO do container da API (o host da VPS pode não ter node)
  if docker exec erp-api-dev node -e 'fetch("http://127.0.0.1:3080/api/v1/meta").then(async(r)=>{if(!r.ok)throw new Error("http");const m=await r.json();console.log("meta_runtime="+(m.runtime||""));console.log("meta_auth_mode="+((m.auth&&m.auth.mode)||""));console.log("meta_http_entities="+((m.httpEntities||[]).join(",")));}).catch(()=>process.exit(1))' 2>/dev/null; then
    :
  elif curl -sS -m 5 -o /tmp/gc_meta http://127.0.0.1:3080/api/v1/meta && [[ -s /tmp/gc_meta ]] && command -v python3 >/dev/null; then
    python3 -c 'import json;m=json.load(open("/tmp/gc_meta"));a=m.get("auth") or {};print("meta_runtime="+str(m.get("runtime") or ""));print("meta_auth_mode="+str(a.get("mode") or ""));print("meta_http_entities="+",".join(m.get("httpEntities") or []))' \
      || echo 'meta_parse=ERR'
  else
    curl -sS -m 5 -o /tmp/gc_meta http://127.0.0.1:3080/api/v1/meta || true
    echo 'meta_parse=ERR'
    echo 'meta_parse_reason=no_parser_available'
  fi
else
  echo 'official_api=MISSING'
fi

echo '--- SUPABASE-DB ---'
if docker ps --format '{{.Names}}' | grep -Fxq supabase-db; then
  db_net="$(docker inspect supabase-db --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
  echo "db_networks=$db_net"
  db_health="$(docker inspect supabase-db --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
  echo "db_health=$db_health"
else
  echo 'supabase_db=MISSING'
fi

echo '--- IDENTITY API_DB vs DIRECT_DB (sem URL/senha) ---'
api_id='INCONCLUSIVO'
direct_id='INCONCLUSIVO'
if docker ps --format '{{.Names}}' | grep -Fxq erp-api-dev; then
  api_id="$(docker exec erp-api-dev node -e '
const {Client}=require("pg");
const u=process.env.DATABASE_URL;
if(!u){console.log("API_NO_DATABASE_URL"); process.exit(0)}
(async()=>{
  const c=new Client({connectionString:u, connectionTimeoutMillis:5000});
  try {
    await c.connect();
    const r=await c.query("select current_database() as db, system_identifier::text as cluster from pg_control_system()");
    console.log("API|"+r.rows[0].db+"|"+r.rows[0].cluster);
  } catch(e) { console.log("API_ERR"); }
  finally { try { await c.end(); } catch {} }
})();' 2>/dev/null || echo 'API_ERR')"
fi
if docker ps --format '{{.Names}}' | grep -Fxq supabase-db; then
  direct_id="$(docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
    "select 'DIRECT|'||current_database()||'|'||system_identifier::text from pg_control_system();" 2>/dev/null || echo 'DIRECT_ERR')"
fi
echo "api_identity=$api_id"
echo "direct_identity=$direct_id"
api_db="$(echo "$api_id" | awk -F'|' 'NF>=3{print $2}')"
api_cl="$(echo "$api_id" | awk -F'|' 'NF>=3{print $3}')"
di_db="$(echo "$direct_id" | awk -F'|' 'NF>=3{print $2}')"
di_cl="$(echo "$direct_id" | awk -F'|' 'NF>=3{print $3}')"
if [[ -n "$api_db" && -n "$di_db" && "$api_db" == "$di_db" && "$api_cl" == "$di_cl" ]]; then
  echo 'conexao_api_vs_supabase_db=MATCH'
else
  echo 'conexao_api_vs_supabase_db=NO_MATCH_OR_INCONCLUSIVO'
fi

echo '--- SCHEMA_MIGRATIONS (agregado) ---'
if docker ps --format '{{.Names}}' | grep -Fxq supabase-db; then
  docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
    "select id||'='||count(*)::text from schema_migrations group by id order by id;"
  docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
    "select 'migration_rows='||count(*)::text from schema_migrations;"
fi

echo '--- AUTH / PROFILES (agregado, sem PII) ---'
if docker ps --format '{{.Names}}' | grep -Fxq supabase-db; then
  docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
    "select 'auth_users='||count(*)::text from auth.users;
     select 'profiles='||count(*)::text from profiles;
     select 'ativos_sem_auth='||count(*)::text from profiles p where p.ativo and p.auth_user_id is null;
     select 'groups='||count(*)::text from groups;
     select 'empresas='||count(*)::text from empresas;"
fi

echo '--- PORTAS (canario candidato) ---'
ss -ltn 2>/dev/null | awk 'NR==1 || /:3080|:3086|:3090|:3091/ {print}' || true
for p in 3086 3090 3091; do
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${p}$"; then
    echo "port_${p}=BUSY"
  else
    echo "port_${p}=FREE"
  fi
done

echo '--- BACKUPS (metadados) ---'
if [[ -d /opt/erp-zuccaro/backups ]]; then
  find /opt/erp-zuccaro/backups -maxdepth 2 -type f \( -name '*.sql' -o -name '*.sql.gz' -o -name '*.dump' \) -printf '%p %s\n' 2>/dev/null \
    | while read -r path size; do
        hash="$(sha256sum "$path" | awk '{print $1}')"
        complete='NO'
        if [[ "$path" == *.gz ]]; then
          if zgrep -q 'PostgreSQL database dump complete\|pg_dump' "$path" 2>/dev/null; then complete='YES'; fi
        else
          if grep -q 'PostgreSQL database dump complete\|pg_dump' "$path" 2>/dev/null; then complete='YES'; fi
        fi
        echo "backup path=$(basename "$path") bytes=$size sha256=$hash dump_complete_marker=$complete"
      done
else
  echo 'backups_dir=MISSING'
fi

echo '--- ROLLBACK ARTIFACTS ---'
docker ps -a --format 'name={{.Names}} status={{.Status}} image={{.Image}}' \
  | awk 'BEGIN{IGNORECASE=1} /rollback|07b|runtime07b|failed/ {print}' || true
docker images --format 'image={{.Repository}}:{{.Tag}} id={{.ID}}' \
  | awk 'BEGIN{IGNORECASE=1} /runtime07b|erp-api/ {print}' | head -20

echo '--- AUTH CONTAINERS ---'
docker ps -a --format 'name={{.Names}} status={{.Status}}' \
  | awk 'BEGIN{IGNORECASE=1} /supabase-auth|auth/ {print}'

echo "GATE_C_READ_ONLY_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo 'NOTA: auth.mode=dev_headers na 3080 NAO homologa Auth da PR #33.'
echo 'NOTA: nao aplicar migrations 016+; nao iniciar canario; nao promover.'
