#!/usr/bin/env bash
# ERP-RUNTIME-08B: Gate C local/VPS controlado e Gate D canario. Nao promove.
set -Eeuo pipefail
umask 077
EXPECTED_MAIN=ca4171600cc30f9922c2f8b2ccb8b22d06aa6888
ROOT=/opt/erp-zuccaro
DB=supabase-db
OFFICIAL=erp-api-dev
CANARY=erp-api-runtime08b-ca417-canary
IMAGE=erp-zuccaro-erp-api:runtime08b-main-ca417160
API_OFFICIAL=http://127.0.0.1:3080
API_CANARY=http://127.0.0.1:3086
META_PATH=/api/v1/meta
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$ROOT/.runtime-gates/08b-ca417-gate-cd-$STAMP"
BACKUP="$ROOT/backups/pre-runtime08b-ca417-gate-cd-$STAMP.sql"
WORKTREE="$ROOT/.worktrees/runtime08b-ca417-gate-cd-$STAMP"
ENV_FILE="$RUN_DIR/canary.env"
CANARY_CREATED=0
die(){ printf 'FAIL: %s\n' "$*" >&2; exit 1; }
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$RUN_DIR/run.log"; }
need(){ command -v "$1" >/dev/null 2>&1 || die "comando ausente: $1"; }
psql_db(){ docker exec "$DB" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
http(){ curl --silent --show-error --max-time 10 --output "$2" --write-out '%{http_code}' "$1"; }
assert_status(){ [ "$1" = "$2" ] || die "HTTP esperado=$2 recebido=$1"; }
wait_ready(){ local url="$1" n; for n in $(seq 1 30); do curl --fail --silent --max-time 10 "$url/ready" >/dev/null 2>&1 && return 0; sleep 2; done; die "ready nao respondeu: $url"; }
cleanup(){ local status=$?; trap - EXIT ERR INT TERM; unset DATABASE_URL 2>/dev/null || true; rm -f "$ENV_FILE" 2>/dev/null || true; if [ "$CANARY_CREATED" = 1 ]; then log "cleanup fail-closed: parando somente $CANARY"; docker stop "$CANARY" >/dev/null 2>&1 || true; fi; exit "$status"; }
trap cleanup EXIT
trap 'exit 130' INT TERM
[ "${EUID:-1}" -eq 0 ] || die 'execute como root na VPS'
for command in docker curl git node npm sha256sum; do need "$command"; done
docker info >/dev/null 2>&1 || die 'Docker indisponivel'
[ -d "$ROOT/.git" ] || die "repositorio ausente: $ROOT"
mkdir -p "$RUN_DIR" "$(dirname "$BACKUP")" "$(dirname "$WORKTREE")"; chmod 700 "$RUN_DIR"
log 'GATE C: preflight sem mutacao oficial'
git -C "$ROOT" fetch origin
[ "$(git -C "$ROOT" rev-parse origin/main)" = "$EXPECTED_MAIN" ] || die 'origin/main diverge do SHA aprovado'
[ "$(git -C "$ROOT" status --porcelain)" = '' ] || die 'worktree principal nao esta limpa'
[ "$(docker inspect -f '{{.State.Running}}' "$OFFICIAL")" = true ] || die 'API oficial nao esta em execucao'
[ -z "$(docker inspect "$CANARY" 2>/dev/null || true)" ] || die 'nome do canario ja reservado'
if docker ps --format '{{.Names}} {{.Ports}}' | grep -Eq "(^|[[:space:]])$CANARY([[:space:]]|$)|:3086->"; then die 'canario existente ou porta 3086 ocupada'; fi
if command -v ss >/dev/null 2>&1 && ss -ltn | awk '{print $4}' | grep -Eq '(:|\])3086$'; then die 'porta 3086 ocupada no host'; fi
OFFICIAL_ID="$(docker inspect -f '{{.Id}}' "$OFFICIAL")"; OFFICIAL_IMAGE="$(docker inspect -f '{{.Image}}' "$OFFICIAL")"; OFFICIAL_STARTED="$(docker inspect -f '{{.State.StartedAt}}' "$OFFICIAL")"
NETWORK="$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$OFFICIAL" | sed '/^$/d')"
[ "$(printf '%s\n' "$NETWORK" | wc -l | tr -d ' ')" = 1 ] || die 'rede oficial ambigua'
docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$DB" | grep -Fx "$NETWORK" >/dev/null || die 'DB fora da rede oficial'
curl --fail --silent --max-time 10 --show-error "$API_OFFICIAL/health" >/dev/null; curl --fail --silent --max-time 10 --show-error "$API_OFFICIAL/ready" >/dev/null
node -e "const m=JSON.parse(process.argv[1]);if(m.runtime!=='ERP-RUNTIME-07B')process.exit(1)" "$(curl --fail --silent --max-time 10 "$API_OFFICIAL$META_PATH")" || die '3080 nao esta em ERP-RUNTIME-07B'
psql_db -Atc 'SELECT 1' | grep -Fx 1 >/dev/null || die 'PostgreSQL indisponivel'
[ "$(psql_db -Atc "SELECT count(*) FROM schema_migrations WHERE id ~ '^[0-9]{3}_.*\\.sql$'")" = 15 ] || die 'migrations nao sao 001-015'
[ "$(psql_db -Atc "SELECT count(*) FROM schema_migrations WHERE id='014_condicoes_pagamento.sql'")" = 1 ] || die '014 invalida'
[ "$(psql_db -Atc "SELECT count(*) FROM schema_migrations WHERE id='015_condicoes_pagamento_hardening.sql'")" = 1 ] || die '015 invalida'
[ "$(psql_db -Atc "SELECT count(*) FROM schema_migrations WHERE id ~ '^[0-9]+' AND substring(id from '^[0-9]+')::int > 15")" = 0 ] || die 'migration >015 detectada'
log "preflight aprovado; rede=$NETWORK; oficial=$OFFICIAL_IMAGE"
log 'GATE C: backup pre-canario'
docker exec "$DB" pg_dump -U postgres -d postgres > "$BACKUP"; [ -s "$BACKUP" ] || die 'backup vazio'; chmod 600 "$BACKUP"; log "backup=$(basename "$BACKUP") sha256=$(sha256sum "$BACKUP" | awk '{print $1}')"
log 'GATE C: worktree e validacoes da MAIN aprovada'
git -C "$ROOT" worktree add --detach "$WORKTREE" "$EXPECTED_MAIN"; [ "$(git -C "$WORKTREE" rev-parse HEAD)" = "$EXPECTED_MAIN" ] || die 'worktree incorreto'; log "worktree=$WORKTREE"
(cd "$WORKTREE" && npm ci && npm run audit:baseline && npm test && npm run lint && npm run typecheck && npm run build)
(cd "$WORKTREE/server" && npm ci && NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}" node --import tsx --test --test-concurrency=1 tests/*.test.ts && npm run typecheck && npm run build)
log 'GATE C: PostgreSQL E2E isolado, sem expor DATABASE_URL'
DATABASE_URL="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$OFFICIAL" | sed -n 's/^DATABASE_URL=//p')"; [ -n "$DATABASE_URL" ] || die 'DATABASE_URL ausente'
export DATABASE_URL
set +e; docker run --rm --network "$NETWORK" -e DATABASE_URL -v "$WORKTREE/server:/app" -w /app node:22-bookworm-slim bash -lc 'npm ci && npm run test:postgres' > "$RUN_DIR/postgres-e2e.log" 2>&1; POSTGRES_STATUS=$?; unset DATABASE_URL; set -e
[ "$POSTGRES_STATUS" -eq 0 ] || die 'test:postgres falhou; log protegido preservado'
grep -Eq 'POSTGRES_E2E_TOTAL_TESTS=[1-9][0-9]*' "$RUN_DIR/postgres-e2e.log" || die 'test:postgres executou zero testes'
grep -Eq '(^|[[:space:]#])fail[[:space:]]+0([[:space:]]|$)' "$RUN_DIR/postgres-e2e.log" || die 'test:postgres nao comprovou fail=0'
log 'test:postgres aprovado com testes >0 e fail=0'
log 'GATE C: imagem exclusiva do SHA aprovado'
docker build --label "erp.main.sha=$EXPECTED_MAIN" --label 'erp.runtime=ERP-RUNTIME-08B' -t "$IMAGE" "$WORKTREE/server"
IMAGE_ID="$(docker image inspect -f '{{.Id}}' "$IMAGE")"; log "imagem=$IMAGE id=$IMAGE_ID"
log 'GATE D: canario isolado em 3086'
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$OFFICIAL" > "$ENV_FILE"; chmod 600 "$ENV_FILE"
docker run -d --name "$CANARY" --network "$NETWORK" --restart no --env-file "$ENV_FILE" -e PORT=3080 -p 127.0.0.1:3086:3080 "$IMAGE" >/dev/null; CANARY_CREATED=1; rm -f "$ENV_FILE"
wait_ready "$API_CANARY"
node -e "const m=JSON.parse(process.argv[1]),c=m.condicaoPagamento;if(m.runtime!=='ERP-RUNTIME-08B'||!c||c.frontendHttp!==false||m.httpPilotEntities.includes('CondicaoPagamento'))process.exit(1)" "$(curl --fail --silent --max-time 10 "$API_CANARY$META_PATH")" || die 'metadata R08B invalida'
GROUP_A=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; EMPRESA_A=cccccccc-cccc-4ccc-8ccc-cccccccccccc; EMPRESA_B=dddddddd-dddd-4ddd-8ddd-dddddddddddd; ACTOR_A=a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4; ACTOR_B=b4b4b4b4-bbbb-4bbb-8bbb-b4b4b4b4b4b4
BASE="$API_CANARY/api/v1/condicoes-pagamento"; HEADERS=(-H "X-Group-Id: $GROUP_A" -H "X-Empresa-Id: $EMPRESA_A" -H "X-Actor-Id: $ACTOR_A")
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/list.json" -w '%{http_code}' "${HEADERS[@]}" "$BASE")"; assert_status "$STATUS" 200
STATUS="$(http "$BASE" "$RUN_DIR/no-actor.json")"; assert_status "$STATUS" 403
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/cross-actor.json" -w '%{http_code}' -H "X-Group-Id: $GROUP_A" -H "X-Empresa-Id: $EMPRESA_A" -H "X-Actor-Id: $ACTOR_B" "$BASE")"; assert_status "$STATUS" 403
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/cross-company.json" -w '%{http_code}' -H "X-Group-Id: $GROUP_A" -H "X-Empresa-Id: $EMPRESA_B" -H "X-Actor-Id: $ACTOR_A" "$BASE")"; { [ "$STATUS" = 403 ] || [ "$STATUS" = 409 ]; } || die 'cross-company nao bloqueado'
PAYLOAD="{\"nome\":\"R08 canario $STAMP\",\"parcelas\":[{\"ordem\":1,\"dias\":30,\"percentual\":\"100.000000\"}]}"
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/create.json" -w '%{http_code}' -X POST "${HEADERS[@]}" -H 'Content-Type: application/json' --data "$PAYLOAD" "$BASE")"; assert_status "$STATUS" 201
COND_ID="$(node -e "const x=require(process.argv[1]).data;if(!x.id||!/^\\d{6}$/.test(x.codigo))process.exit(1);process.stdout.write(x.id)" "$RUN_DIR/create.json")" || die 'codigo sequencial invalido'
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/get.json" -w '%{http_code}' "${HEADERS[@]}" "$BASE/$COND_ID")"; assert_status "$STATUS" 200
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/patch.json" -w '%{http_code}' -X PATCH "${HEADERS[@]}" -H 'Content-Type: application/json' --data '{"descricao":"canario controlado"}' "$BASE/$COND_ID")"; assert_status "$STATUS" 200
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/delete.json" -w '%{http_code}' -X DELETE "${HEADERS[@]}" "$BASE/$COND_ID")"; assert_status "$STATUS" 200
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/restore.json" -w '%{http_code}' -X POST "${HEADERS[@]}" "$BASE/$COND_ID/restore")"; assert_status "$STATUS" 200
log 'GATE D: RLS/FORCE, parcelas, padrao e auditoria'
[ "$(psql_db -Atc "SELECT count(*) FROM pg_class WHERE relname IN ('condicoes_pagamento','condicao_pagamento_empresas','condicao_pagamento_parcelas') AND relrowsecurity AND relforcerowsecurity")" = 3 ] || die 'RLS/FORCE invalido'
[ "$(psql_db -Atc "SELECT count(*) FROM (SELECT c.id FROM condicoes_pagamento c LEFT JOIN condicao_pagamento_parcelas p ON p.condicao_pagamento_id=c.id AND p.group_id=c.group_id AND p.ativo WHERE c.ativo GROUP BY c.id HAVING COALESCE(sum(p.percentual),0)<>100.000000) x")" = 0 ] || die 'parcelas ativas invalidas'
[ "$(psql_db -Atc "SELECT count(*) FROM (SELECT group_id,empresa_id FROM condicao_pagamento_empresas WHERE ativo AND eh_padrao GROUP BY group_id,empresa_id HAVING count(*)>1) x")" = 0 ] || die 'padrao duplicado'
[ "$(psql_db -Atc "SELECT count(*) FROM audit_logs WHERE entity='CondicaoPagamento' AND entity_id='$COND_ID' AND group_id='$GROUP_A' AND empresa_id='$EMPRESA_A' AND action IN ('create','update','inactivate','restore')")" -ge 4 ] || die 'auditoria insuficiente'
[ "$(psql_db -Atc "SELECT count(*) FROM audit_logs WHERE entity='CondicaoPagamento' AND entity_id='$COND_ID' AND ((COALESCE(before_data,'{}'::jsonb)::text || COALESCE(after_data,'{}'::jsonb)::text) ~* '(password|secret|token|authorization|database_url)')")" = 0 ] || die 'auditoria contem termo sensivel'
log 'GATE D: restart somente do canario'
docker restart "$CANARY" >/dev/null; wait_ready "$API_CANARY"; curl --fail --silent --max-time 10 "$API_CANARY/health" >/dev/null; curl --fail --silent --max-time 10 "$API_CANARY/ready" >/dev/null
node -e "const m=JSON.parse(process.argv[1]);if(m.runtime!=='ERP-RUNTIME-08B')process.exit(1)" "$(curl --fail --silent --max-time 10 "$API_CANARY$META_PATH")" || die 'metadata apos restart invalida'
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/restart-list.json" -w '%{http_code}' "${HEADERS[@]}" "$BASE")"; assert_status "$STATUS" 200
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/restart-get.json" -w '%{http_code}' "${HEADERS[@]}" "$BASE/$COND_ID")"; assert_status "$STATUS" 200
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/restart-produto.json" -w '%{http_code}' "${HEADERS[@]}" "$API_CANARY/api/v1/produtos")"; assert_status "$STATUS" 200
STATUS="$(curl --silent --show-error --max-time 10 -o "$RUN_DIR/restart-cliente.json" -w '%{http_code}' "${HEADERS[@]}" "$API_CANARY/api/v1/clientes")"; assert_status "$STATUS" 200
log 'Gate D aprovado; parando somente canario, sem remove/promocao'
docker stop "$CANARY" >/dev/null; CANARY_CREATED=0
[ "$(docker inspect -f '{{.Id}}' "$OFFICIAL")" = "$OFFICIAL_ID" ] || die 'container oficial alterado'
[ "$(docker inspect -f '{{.Image}}' "$OFFICIAL")" = "$OFFICIAL_IMAGE" ] || die 'imagem oficial alterada'
[ "$(docker inspect -f '{{.State.StartedAt}}' "$OFFICIAL")" = "$OFFICIAL_STARTED" ] || die 'API oficial reiniciada'
node -e "const m=JSON.parse(process.argv[1]);if(m.runtime!=='ERP-RUNTIME-07B')process.exit(1)" "$(curl --fail --silent --max-time 10 "$API_OFFICIAL$META_PATH")" || die '3080 alterada'
log "ENV_FILE_PERSISTENTE=NAO"
log "SUCESSO Gates C/D; canario parado e preservado=$CANARY; 3080 permanece ERP-RUNTIME-07B"
trap - EXIT ERR INT TERM
