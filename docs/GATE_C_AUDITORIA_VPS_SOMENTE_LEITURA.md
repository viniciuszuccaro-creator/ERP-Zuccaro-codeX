# Gate C — Auditoria VPS somente leitura (frente Cursor)

**Status:** `PARCIAL` — aguarda execução do bloco único na Web Console e
colagem da saída sanitizada.
**Frente:** Cursor / VPS / HML / migração legada.
**Branch:** `cursor/vps-hml-gate-c-legado-392b`
**Base comprovada:** `origin/main` @ `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888`
**PR Codex (não editar):** #33 `codex/comercial-360` (draft)
**Programa:** `docs/PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md` (PR #33)
**Runbook VPS:** `docs/OPERACAO_DEV_VPS.md`
**Deploy preparado (PR #33):** `docs/COMERCIAL_360_V1_DEPLOY.md` +
`scripts/deploy/comercial360-{canary,smoke,rollback}.sh`

Este lote é **somente documentação e ferramentas de leitura**. Não altera VPS,
banco, API 3080, migrations, Auth, buckets, ClamAV, frontend HTTP nem a PR #33.

---

## 1. Objetivo do Gate C

Fechar, com evidência sanitizada, a auditoria inicial da VPS DEV antes de
qualquer canário (D), migration real (E) ou promoção (F):

1. identidade do **banco efetivo** usado pela API oficial;
2. histórico de `schema_migrations` (aplicadas vs código candidato);
3. rede Docker e porta isolada livre para canário;
4. estado dos backups (caminho, tamanho, hash; restaurabilidade = gate à parte);
5. caminho de rollback da API (container/imagem preservados);
6. dependências do Supabase Auth (containers saudáveis ≠ Auth homologado).

Scripts preparados ou CI com PostgreSQL efêmero **não** fecham este gate.

---

## 2. Limites desta sessão (Cursor Cloud)

| Capacidade | Estado nesta sessão |
|---|---|
| MCP Hostinger VPS | **indisponível** (namespace ausente no ambiente) |
| Web Console autenticada | **não operável** daqui (URL pública só entrega a página do terminal) |
| SSH / escrita VPS | **proibido** neste gate |
| API local 3080 no cloud agent | inacessível (esperado; a API vive na VPS) |
| Consulta GitHub PR #33 | feita: draft, HEAD `b7019c6774412bdbafd2944bde4d7edde8c223f2`, CI frontend/backend SUCCESS |

**Inferência:** sem Web Console autenticada nesta sessão, o Gate C **não pode
ser marcado APROVADO** só com histórico. Continua **PARCIAL** até a saída do
bloco §6 ser colada e analisada.

---

## 3. Fatos observados (já comprovados / informados)

Legenda: **FATO** = evidência independente ou usuário + handoff; **INFERÊNCIA** =
conclusão ainda não fechada.

### 3.1 Identidade e runtime

| Item | Classificação | Evidência |
|---|---|---|
| VPS `srv1982741` | FATO (usuário / histórico Hostinger) | handoff Comercial 360 |
| Web Console informada | FATO (URL) | `https://bos2.hostingervps.com/4423/` — exige sessão do usuário |
| API `erp-api-dev` :3080 | FATO | imagem `runtime07b-main-ca0bc5f3`; health/ready HTTP 200 |
| Meta 3080 | FATO | `ERP-RUNTIME-07B`; `auth.mode=dev_headers` |
| Auth novo da PR #33 homologado na 3080 | **NÃO** | 07B/`dev_headers` ≠ `supabase_user` |
| Containers Supabase Auth/DB/Storage “healthy” | FATO (histórico MCP/usuário) | saúde de container ≠ SQL nem Auth de produto |
| PR #33 mesclada | **NÃO** | draft aberto |
| Migrations 016–024 na VPS | **NÃO evidenciadas** | handoff: 001–015 uma vez; 016+ ausentes na captura |

### 3.2 Banco / migrations

| Item | Classificação | Evidência |
|---|---|---|
| `schema_migrations` com 001–015, 1× cada | FATO (captura usuário + handoff) | sem 016–022/024 na captura de 15 linhas |
| `auth.users=0`, `profiles=2` ativos sem Auth | FATO (captura agregada) | Auth produto **não** homologado |
| `groups=2`, `empresas=3` | FATO agregado | sem PII |
| Comparação IP API vs DB = NO | FATO inconclusivo | proxy/IPv6/tradução possível |
| `current_database` + cluster API vs `supabase-db` = MATCH | FATO (handoff 2026-09-24) | fecha parcialmente identidade de cluster/banco **naquele instante** |
| Consulta foi ao banco efetivo da API **agora** | INFERÊNCIA até revalidar | precisa do bloco §6 na mesma janela de operação |

### 3.3 Rede, canário, backup, rollback

| Item | Classificação | Evidência |
|---|---|---|
| API e DB na rede Docker compartilhada | FATO (histórico) | nome exato da rede deve ser relido no precheck |
| Porta 3086 livre em instantes anteriores | FATO histórico | **não** assumir livre agora |
| Backup SQL ~21/09, ~486969 bytes, SHA-256, dump completo | FATO (handoff) | restaurabilidade **não** testada |
| Container/imagem rollback R07B preservados | FATO (handoff) | integridade de restore de schema **não** comprovada |
| Scanner ClamAV / buckets DAM / Produto HTTP | **não comprovados** | fora do Gate C de fechamento; gates próprios |

---

## 4. Critério de APROVADO / PARCIAL / BLOQUEADO

### APROVADO (Gate C)

Todas verdadeiras, com saída sanitizada do §6:

1. Identidade: `api_db_name` = `direct_db_name` e `api_cluster` = `direct_cluster` (MATCH).
2. Migrations: lista 001–015 exatamente 1×; nenhuma duplicata; registrar se existe id >015.
3. Rede: nome da rede do `erp-api-dev` e do `supabase-db` iguais; porta candidata ≠3080 e sem listener.
4. Backup: ao menos um arquivo com tamanho + SHA-256 + marcador de dump completo; caminho sob `/opt/erp-zuccaro/backups` (sem conteúdo).
5. Rollback: container/imagem R07B inspectáveis (nome/imagem/status), sem apagar.
6. Auth dependência: containers Auth/DB reportados; **e** registro explícito de que `auth.mode=dev_headers` na 3080 **não** homologa Auth da PR #33.
7. Nenhuma escrita VPS neste gate.

### PARCIAL (estado atual)

Itens históricos existem, mas falta **revalidação na mesma sessão operacional**
(bloco §6) e/ou backup novo pré-implantação / teste de restauração isolada
(esses dois últimos podem permanecer pendentes como *pré-requisitos de E/F*,
desde que documentados — o Gate C fecha a auditoria de leitura; E/F exigem
backup fresco autorizado).

### BLOQUEADO

Qualquer divergência de cluster/banco, migration duplicada, ausência de
rollback preservado, tentativa de usar CI efêmera como prova DEV, ou pedido de
escrita/canário sem autorização.

---

## 5. Contratos a comunicar ao Codex (PR #33)

Sem editar a branch do Codex. Mensagens objetivas:

1. Gate C Cursor: **PARCIAL** até saída do bloco §6; Hostinger MCP ausente neste ambiente.
2. Imagem oficial atual: R07B `ca0bc5f3` / `dev_headers` — canário deve exigir `auth.mode=supabase_user` (já no script da PR #33).
3. Migrations VPS evidenciadas: **001–015**; candidatas 016–024 só no código/CI — **não aplicar** sem Gate E + backup.
4. SHA de imagem imutável do canário deve ser o **MERGE_SHA da main** após merge da PR #33 — nunca build da branch feature.
5. Autorizar juntos: digest da imagem, lista exata de migrations faltantes, identidade sintética Auth para smoke D.

---

## 6. UM bloco somente leitura — colar na Web Console

**Instruções ao operador humano**

1. Abrir a Web Console já autenticada da VPS (`srv1982741`).
2. Colar **apenas** o bloco abaixo, inteiro.
3. Confirmar que não há `cat`/print de `.env`, URL, senha, token, e-mail, nome ou UUID individual.
4. Devolver a saída bruta (já sanitizada pelo próprio script) nesta conversa ou no PR.

```bash
#!/usr/bin/env bash
# Gate C — SOMENTE LEITURA. Não reinicia, não aplica migration, não toca 3080.
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
  curl -sS -m 5 -o /tmp/gc_meta http://127.0.0.1:3080/api/v1/meta || true
  if [[ -s /tmp/gc_meta ]]; then
    node -e 'const m=JSON.parse(require("fs").readFileSync("/tmp/gc_meta","utf8")); console.log("meta_runtime="+m.runtime); console.log("meta_auth_mode="+(m.auth&&m.auth.mode||"")); console.log("meta_http_entities="+((m.httpEntities||[]).join(",")))' \
      || echo 'meta_parse=ERR'
  else
    echo 'meta_parse=EMPTY'
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
# Usa o processo da API para ler current_database + system identifier via SQL
# sem imprimir DATABASE_URL. Se o helper interno não existir, marca INCONCLUSIVO.
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
  # Conexão local peer/trust dentro do container — sem ecoar segredo.
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
ss -ltn 2>/dev/null | awk 'NR==1 || /:3080|:3086|:3090|:3091/ {print}' || netstat -ltn 2>/dev/null | awk '/3080|3086|3090|3091/ {print}' || true
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
```

---

## 7. O que NÃO fazer após colar o bloco

- Não aplicar migrations 016–024.
- Não reiniciar `erp-api-dev` / não alterar bind 3080.
- Não criar canário.
- Não rotacionar/reutilizar token Hostinger exposto em chat.
- Não imprimir `.env` / `DATABASE_URL` / JWT / chaves.
- Não commitár saída com PII; apenas agregados do script.

---

## 8. Próximo passo desta frente (já preparado em paralelo)

1. Aguardar saída do §6 → atualizar este documento para APROVADO ou BLOQUEADO.
2. Preparação Gates D–F: `docs/GATES_D_F_PREPARACAO_CANARIO.md`.
3. Descoberta legado somente leitura: `docs/LEGADO_BACKUP_DESCOBERTA_SOMENTE_LEITURA.md` +
   `scripts/legado/inventario-backup-erp-antigo.sh`.
