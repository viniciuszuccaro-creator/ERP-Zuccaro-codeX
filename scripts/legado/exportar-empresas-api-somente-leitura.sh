#!/usr/bin/env bash
# CODEX LEGADO — UM único comando Web Console (somente leitura).
# Banco efetivamente usado pela API (erp-api-dev). Sem UPDATE/DELETE/INSERT.
# Sem restart, sem tip-port, sem carga operacional, importAuthorized=false.
#
# Intervenção humana (exata):
# 1) Hostinger hPanel → VPS DEV → Web Console (root).
# 2) Colar este arquivo INTEIRO (um único paste) e Enter.
# 3) Copiar o bloco PASTE_TO_GIT_* para o chat (contagens sanitizadas).
# 4) Transferir o JSON privado (nome novo) para o HD
#    `BACKUP ERP ANTIGO - CODEX/04_REPORTS/` via scp/pendrive — NUNCA GitHub.
# 5) Não colar CNPJ completo nem senhas. Não apagar a terceira linha.
set -euo pipefail
umask 077

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PRIV_DIR="/root/erp-private"
PRIV_FILE="${PRIV_DIR}/legado-empresas-api-${STAMP}.json"
API="${API_CONTAINER:-erp-api-dev}"

mkdir -p "$PRIV_DIR"
chmod 700 "$PRIV_DIR"

if ! docker inspect "$API" >/dev/null 2>&1; then
  echo "BLOCKED=API_CONTAINER_MISSING name=${API}"
  echo "HUMAN=confirme o nome do container da API oficial (esperado erp-api-dev)"
  exit 2
fi

API_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$API")"
API_STATUS="$(docker inspect -f '{{.State.Status}}' "$API")"

# Extrai só o NOME do banco a partir do env da API — nunca imprime URL/senha.
_ERP_DBURL="$(
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$API" \
    | awk '/^DATABASE_URL=/{sub(/^DATABASE_URL=/,""); print; exit}'
)"
DBNAME="$(
  ERP_DBURL="${_ERP_DBURL:-}" python3 -c 'import os, urllib.parse
raw=os.environ.get("ERP_DBURL","").strip()
name="postgres"
if raw:
    u=urllib.parse.urlparse(raw)
    name=(u.path or "/postgres").lstrip("/") or "postgres"
    name=name.split("?")[0] or "postgres"
print(name)
'
)"
unset _ERP_DBURL
DBNAME="${DBNAME:-postgres}"

# Container Postgres na mesma rede da API (não imprime credenciais).
DB_CANDIDATES="$(docker ps --format '{{.Names}}' | grep -E 'supabase-db|postgres' || true)"
DB=""
for c in $DB_CANDIDATES; do
  if docker exec "$c" psql -U postgres -d "$DBNAME" -Atqc 'SELECT 1' >/dev/null 2>&1; then
    DB="$c"
    break
  fi
done
if [[ -z "$DB" ]]; then
  echo "BLOCKED=DB_CONTAINER_UNREACHABLE dbname=${DBNAME}"
  echo "HUMAN=confirme supabase-db na mesma rede da API; não cole DATABASE_URL"
  exit 3
fi

API_DB_PROBE="$(docker exec "$DB" psql -U postgres -d "$DBNAME" -Atqc "SELECT current_database();")"
CLUSTER_ID="$(docker exec "$DB" psql -U postgres -d "$DBNAME" -Atqc "SELECT system_identifier::text FROM pg_control_system();")"

# Export privado: nomes, IDs, grupos, status, referências; CNPJ só hash + last4.
docker exec -i "$DB" psql -U postgres -d "$DBNAME" -X -v ON_ERROR_STOP=1 -Atqc "
SELECT json_build_object(
  'generatedAtUtc', to_char(timezone('utc', now()), 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
  'currentDatabase', current_database(),
  'importAuthorized', false,
  'operationalLoadAuthorized', false,
  'neverDelete', true,
  'groups', (
    SELECT coalesce(json_agg(json_build_object(
      'id', g.id::text,
      'nome_do_grupo', g.nome_do_grupo,
      'razao_social_grupo', g.razao_social_grupo,
      'status', g.status,
      'cnpj_sha256', CASE
        WHEN nullif(regexp_replace(coalesce(g.cnpj_grupo,''), '[^0-9]', '', 'g'), '') IS NULL THEN NULL
        ELSE encode(digest(regexp_replace(g.cnpj_grupo, '[^0-9]', '', 'g'), 'sha256'), 'hex')
      END,
      'cnpj_last4', right(regexp_replace(coalesce(g.cnpj_grupo,''), '[^0-9]', '', 'g'), 4)
    ) ORDER BY g.nome_do_grupo), '[]'::json)
    FROM groups g
  ),
  'empresas', (
    SELECT coalesce(json_agg(json_build_object(
      'id', e.id::text,
      'group_id', e.group_id::text,
      'razao_social', e.razao_social,
      'nome_fantasia', e.nome_fantasia,
      'status', e.status,
      'cnpj_sha256', CASE
        WHEN nullif(regexp_replace(coalesce(e.cnpj,''), '[^0-9]', '', 'g'), '') IS NULL THEN NULL
        ELSE encode(digest(regexp_replace(e.cnpj, '[^0-9]', '', 'g'), 'sha256'), 'hex')
      END,
      'cnpj_last4', right(regexp_replace(coalesce(e.cnpj,''), '[^0-9]', '', 'g'), 4),
      'refs_cliente_empresas', CASE WHEN to_regclass('public.cliente_empresas') IS NULL THEN 0
        ELSE (SELECT count(*) FROM cliente_empresas ce WHERE ce.empresa_id = e.id) END,
      'refs_profiles', (SELECT count(*) FROM profiles p WHERE p.empresa_id = e.id),
      'refs_obra_empresas', CASE WHEN to_regclass('public.obra_empresas') IS NULL THEN 0
        ELSE (SELECT count(*) FROM obra_empresas oe WHERE oe.empresa_id = e.id) END
    ) ORDER BY e.razao_social), '[]'::json)
    FROM empresas e
  ),
  'counts', json_build_object(
    'groups', (SELECT count(*) FROM groups),
    'empresas', (SELECT count(*) FROM empresas),
    'empresas_ativas', (SELECT count(*) FROM empresas WHERE status ILIKE 'ativ%')
  )
);
" > "$PRIV_FILE"

chmod 600 "$PRIV_FILE"

python3 - "$PRIV_FILE" "$API" "$API_IMAGE" "$API_STATUS" "$DB" "$API_DB_PROBE" "$CLUSTER_ID" "$PRIV_FILE" <<'PY'
import json, sys, hashlib, os
path, api, image, status, db, curdb, cluster, priv = sys.argv[1:9]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
groups = data.get("groups") or []
empresas = data.get("empresas") or []
counts = data.get("counts") or {}

def norm(s):
    import unicodedata, re
    t = unicodedata.normalize("NFD", str(s or ""))
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()

cpa = z = extra = 0
for e in empresas:
    n = norm(e.get("nome_fantasia")) + " " + norm(e.get("razao_social"))
    if "cpa" in n and ("ferro" in n or "aco" in n):
        cpa += 1
    elif "3z" in n:
        z += 1
    else:
        extra += 1
grupo = sum(1 for g in groups if "grupo cpa" in norm(g.get("nome_do_grupo")))
digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
print("PASTE_TO_GIT_BEGIN")
print("lote=legado-empresas-api-somente-leitura")
print("importAuthorized=false")
print("operationalLoadAuthorized=false")
print("neverDelete=true")
print("cadesp_reused=true")
print("cadesp_redocument_requested=false")
print(f"api_container={api}")
print(f"api_image={image}")
print(f"api_status={status}")
print(f"db_container={db}")
print(f"current_database={curdb}")
print(f"cluster_id_sha256={hashlib.sha256(cluster.encode()).hexdigest()}")
print(f"private_file={os.path.basename(priv)}")
print(f"private_sha256={digest}")
print(f"groups={counts.get('groups')}")
print(f"empresas={counts.get('empresas')}")
print(f"empresas_ativas={counts.get('empresas_ativas')}")
print(f"match_label_cpa_ferro={cpa}")
print(f"match_label_3z={z}")
print(f"match_label_grupo_cpa={grupo}")
print(f"outras_linhas_empresa_nao_apagar={extra}")
print("coordenacao=#216/#217 ausencia_tela_nao_e_importacao")
print("HUMAN_NEXT=transferir JSON privado para HD 04_REPORTS; classificar com classificar-empresas-api-legado.mjs")
print("PASTE_TO_GIT_END")
PY
