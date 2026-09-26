#!/usr/bin/env bash
# Rebuild erp-api-dev + erp-web-dev com o formulário e-mail/senha (PR #45).
# Não mexe no Supabase. Não usa down -v.
#
# Preserva container_name oficiais e portas 127.0.0.1:3080 / 127.0.0.1:3081.
# Antes de trocar: tag de rollback. Se health falhar após up: tenta rollback
# automático via scripts/vps/spa-login-rollback-api-web.sh.
#
# NÃO renomeia containers do Compose (labels fazem o `compose up` recriar o
# backup e disputar 3080/3081).
#
# Uso (Web Console VPS) — NÃO rodar o script antigo sem este HEAD:
#   cd /opt/erp-zuccaro
#   git fetch origin cursor/spa-login-http-supabase-392b
#   git checkout --detach origin/cursor/spa-login-http-supabase-392b
#   CONFIRM_SPA_LOGIN_REBUILD=YES ERP_DOCKER_NETWORK=supabase_default \
#     GIT_REF=HEAD \
#     bash scripts/vps/spa-login-rebuild-api-web.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_SPA_LOGIN_REBUILD="${CONFIRM_SPA_LOGIN_REBUILD:-}"
GIT_REF="${GIT_REF:-origin/main}"
EXPECTED_MARKER_API='passwordLoginPath'
EXPECTED_MARKER_SPA='erp-login-email'
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.erp.yml}"
ENV_FILE="${ENV_FILE:-.env.erp.dev}"
ROLLBACK_TAG_FILE="${ROLLBACK_TAG_FILE:-$ROOT/.spa-login-rollback-tags}"
AUTO_ROLLBACK_ON_FAIL="${AUTO_ROLLBACK_ON_FAIL:-YES}"

echo "SPA_LOGIN_REBUILD_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "git_ref=${GIT_REF}"

[[ "$CONFIRM_SPA_LOGIN_REBUILD" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_SPA_LOGIN_REBUILD=YES' >&2
  exit 2
}
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK}"

command -v docker >/dev/null
command -v git >/dev/null
[[ -f "$ROOT/$COMPOSE_FILE" ]] || { echo "BLOCKED: compose_missing file=${COMPOSE_FILE}" >&2; exit 1; }
[[ -f "$ROOT/$ENV_FILE" ]] || { echo "BLOCKED: env_file_missing path=${ENV_FILE}" >&2; exit 1; }

curl -sS -o /dev/null -w 'health_3080_before=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_before=000'
curl -sS -o /dev/null -w 'web_3081_before=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3081/ 2>/dev/null || echo 'web_3081_before=000'

if [[ "$GIT_REF" == "HEAD" ]]; then
  echo 'git_checkout=SKIP_ALREADY_ON_REF'
else
  REF_BRANCH="${GIT_REF#origin/}"
  git fetch origin "$REF_BRANCH"
  git checkout --detach "origin/${REF_BRANCH}"
fi

MERGE_SHA="$(git rev-parse HEAD)"
MERGE_SHA8="${MERGE_SHA:0:8}"
echo "merge_sha=${MERGE_SHA}"
echo "merge_sha8=${MERGE_SHA8}"

if ! grep -q "$EXPECTED_MARKER_API" "$ROOT/server/src/api/router.ts"; then
  echo 'BLOCKED: auth_session_endpoint_missing_on_ref' >&2
  exit 3
fi
if ! grep -q "$EXPECTED_MARKER_SPA" "$ROOT/src/components/UserNotRegisteredError.jsx"; then
  echo 'BLOCKED: spa_login_form_missing_on_ref' >&2
  exit 3
fi
echo 'login_markers_on_ref=YES'

STAMP="$(date -u +%Y%m%d-%H%M%S)"
ROLLBACK_API_TAG="erp-zuccaro-erp-api:pre-spa-login-${STAMP}"
ROLLBACK_WEB_TAG="erp-zuccaro-erp-web:pre-spa-login-${STAMP}"

tag_running_image() {
  local name="$1" tag="$2"
  if ! docker ps -a --format '{{.Names}}' | grep -Fxq "$name"; then
    echo "tag_${name}=SKIP_NOT_FOUND"
    return 0
  fi
  local img
  img="$(docker inspect -f '{{.Image}}' "$name")"
  docker tag "$img" "$tag"
  echo "tag_${name}=${tag}"
}

tag_running_image erp-api-dev "$ROLLBACK_API_TAG"
tag_running_image erp-web-dev "$ROLLBACK_WEB_TAG"

# Persistência das tags para rollback executável (humano ou auto).
cat >"$ROLLBACK_TAG_FILE" <<EOF
# Gerado por spa-login-rebuild-api-web.sh — sem segredos
ROLLBACK_API_TAG='${ROLLBACK_API_TAG}'
ROLLBACK_WEB_TAG='${ROLLBACK_WEB_TAG}'
MERGE_SHA8='${MERGE_SHA8}'
STAMP='${STAMP}'
EOF
echo "rollback_tag_file=${ROLLBACK_TAG_FILE}"
echo "rollback_api_tag=${ROLLBACK_API_TAG}"
echo "rollback_web_tag=${ROLLBACK_WEB_TAG}"

attempt_auto_rollback() {
  local reason="$1"
  echo "AUTO_ROLLBACK_TRIGGER reason=${reason}"
  if [[ "$AUTO_ROLLBACK_ON_FAIL" != "YES" ]]; then
    echo 'auto_rollback=SKIP (AUTO_ROLLBACK_ON_FAIL!=YES)'
    return 1
  fi
  if ! docker image inspect "$ROLLBACK_API_TAG" >/dev/null 2>&1; then
    echo 'BLOCKED: auto_rollback_api_tag_missing' >&2
    return 1
  fi
  if ! docker image inspect "$ROLLBACK_WEB_TAG" >/dev/null 2>&1; then
    echo 'BLOCKED: auto_rollback_web_tag_missing' >&2
    return 1
  fi
  CONFIRM_SPA_LOGIN_ROLLBACK=YES \
    ERP_DOCKER_NETWORK="$ERP_DOCKER_NETWORK" \
    ROLLBACK_API_TAG="$ROLLBACK_API_TAG" \
    ROLLBACK_WEB_TAG="$ROLLBACK_WEB_TAG" \
    COMPOSE_FILE="$COMPOSE_FILE" \
    ENV_FILE="$ENV_FILE" \
    bash "$ROOT/scripts/vps/spa-login-rollback-api-web.sh"
}

# Construir ANTES de parar os oficiais — falha de build não derruba 3080/3081.
export ERP_DOCKER_NETWORK
echo "compose_build_begin utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build erp-api erp-web
echo "compose_build_ok=YES"

SWAP_STARTED=0
on_rebuild_err() {
  local ec=$?
  echo "SPA_LOGIN_REBUILD_ERR exit=${ec} swap_started=${SWAP_STARTED}" >&2
  if [[ "$SWAP_STARTED" == "1" ]]; then
    attempt_auto_rollback "trap_exit_${ec}" || true
  fi
  exit "$ec"
}
trap on_rebuild_err ERR

# Só inspeciona — NÃO para containers. Falha com return (não exit) para set -e/trap.
assert_no_unknown_port_holders() {
  local port="$1"
  local allowed_csv="$2"
  local ids
  ids="$(docker ps -aq --filter publish="$port" 2>/dev/null || true)"
  if [[ -z "$ids" ]]; then
    echo "port_${port}_holders=none"
    return 0
  fi
  IFS=',' read -r -a allowed_arr <<<"$allowed_csv"
  for id in $ids; do
    local n
    n="$(docker inspect -f '{{.Name}}' "$id" | sed 's#^/##')"
    local ok=0
    for allowed in "${allowed_arr[@]}"; do
      if [[ "$n" == "$allowed" || "$n" =~ ^erp-(api|web)-dev-pre-spa-login- ]]; then
        ok=1
        break
      fi
    done
    if [[ "$ok" != "1" ]]; then
      echo "BLOCKED: port_${port}_unknown_container name=${n}" >&2
      return 6
    fi
    echo "port_${port}_holder_allowed=${n}"
  done
}

# Para apenas holders permitidos. Desconhecido → return 6 (dispara trap se SWAP_STARTED=1).
free_port_holders() {
  local port="$1"
  local allowed_csv="$2"
  local ids
  ids="$(docker ps -aq --filter publish="$port" 2>/dev/null || true)"
  if [[ -z "$ids" ]]; then
    echo "port_${port}_holders=none"
    return 0
  fi
  IFS=',' read -r -a allowed_arr <<<"$allowed_csv"
  for id in $ids; do
    local n
    n="$(docker inspect -f '{{.Name}}' "$id" | sed 's#^/##')"
    local ok=0
    for allowed in "${allowed_arr[@]}"; do
      if [[ "$n" == "$allowed" || "$n" =~ ^erp-(api|web)-dev-pre-spa-login- ]]; then
        ok=1
        break
      fi
    done
    if [[ "$ok" != "1" ]]; then
      echo "BLOCKED: port_${port}_unknown_container name=${n}" >&2
      return 6
    fi
    echo "stop_rm_port_${port}=${n}"
    docker stop "$id" >/dev/null || true
    docker rm "$id" >/dev/null || true
  done
}

# Preflight completo das duas portas ANTES de qualquer stop/rm de oficiais.
assert_no_unknown_port_holders 3080 "erp-api-dev"
assert_no_unknown_port_holders 3081 "erp-web-dev"

# Troca só depois do build + preflight ok — trap cobre falhas de stop/up/health.
SWAP_STARTED=1
echo "compose_swap_begin utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for name in erp-api-dev erp-web-dev; do
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$name"; then
    echo "stop_rm_${name}=YES"
    docker stop "$name" >/dev/null || true
    docker rm "$name" >/dev/null || true
  fi
done

while read -r n; do
  [[ -z "$n" ]] && continue
  echo "stop_rm_residual=${n}"
  docker stop "$n" >/dev/null || true
  docker rm "$n" >/dev/null || true
done < <(docker ps -a --format '{{.Names}}' | grep -E '^erp-(api|web)-dev-pre-spa-login-' || true)

free_port_holders 3080 "erp-api-dev"
free_port_holders 3081 "erp-web-dev"

echo "compose_up_begin utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --force-recreate erp-api

API_OK=0
API_HEALTH_ATTEMPTS="${SPA_LOGIN_API_HEALTH_ATTEMPTS:-10}"
API_HEALTH_SLEEP="${SPA_LOGIN_API_HEALTH_SLEEP:-3}"
for ((i=1; i<=API_HEALTH_ATTEMPTS; i++)); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3080/health 2>/dev/null || true)"
  echo "health_3080_poll_${i}=${code}"
  if [[ "$code" == "200" ]]; then API_OK=1; break; fi
  if (( i < API_HEALTH_ATTEMPTS )); then sleep "$API_HEALTH_SLEEP"; fi
done
if [[ "$API_OK" != "1" ]]; then
  echo 'BLOCKED: health_3080_not_200_after_recreate' >&2
  attempt_auto_rollback 'api_health' || true
  exit 4
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --force-recreate erp-web

WEB_OK=0
WEB_HEALTH_ATTEMPTS="${SPA_LOGIN_WEB_HEALTH_ATTEMPTS:-8}"
WEB_HEALTH_SLEEP="${SPA_LOGIN_WEB_HEALTH_SLEEP:-2}"
for ((i=1; i<=WEB_HEALTH_ATTEMPTS; i++)); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3081/ 2>/dev/null || true)"
  echo "web_3081_poll_${i}=${code}"
  if [[ "$code" == "200" ]]; then WEB_OK=1; break; fi
  if (( i < WEB_HEALTH_ATTEMPTS )); then sleep "$WEB_HEALTH_SLEEP"; fi
done

API_IMAGE="$(docker inspect -f '{{.Config.Image}}' erp-api-dev 2>/dev/null || echo missing)"
WEB_IMAGE="$(docker inspect -f '{{.Config.Image}}' erp-web-dev 2>/dev/null || echo missing)"
WEB_STATUS="$(docker inspect -f '{{.State.Status}}' erp-web-dev 2>/dev/null || echo missing)"
echo "api_image=${API_IMAGE}"
echo "web_image=${WEB_IMAGE}"
echo "web_status=${WEB_STATUS}"

# Confirma binds 3080/3081 nos oficiais.
API_PORTS="$(docker inspect -f '{{json .HostConfig.PortBindings}}' erp-api-dev 2>/dev/null || echo missing)"
WEB_PORTS="$(docker inspect -f '{{json .HostConfig.PortBindings}}' erp-web-dev 2>/dev/null || echo missing)"
echo "api_port_bindings_has_3080=$(echo "$API_PORTS" | grep -q '3080' && echo YES || echo NO)"
echo "web_port_bindings_has_3081=$(echo "$WEB_PORTS" | grep -q '3081' && echo YES || echo NO)"

curl -sS -o /dev/null -w 'health_3080_after=%{http_code}\n' --connect-timeout 5 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_after=000'
curl -sS -o /dev/null -w 'ready_3080_after=%{http_code}\n' --connect-timeout 5 \
  http://127.0.0.1:3080/ready 2>/dev/null || echo 'ready_3080_after=000'
curl -sS -o /dev/null -w 'web_3081_after=%{http_code}\n' --connect-timeout 5 \
  http://127.0.0.1:3081/ 2>/dev/null || echo 'web_3081_after=000'

if [[ "$WEB_OK" != "1" ]]; then
  echo 'BLOCKED: web_3081_not_200' >&2
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'erp-web|NAMES' || true
  docker logs erp-web-dev --tail 60 2>&1 || true
  ss -lntp | grep -E ':3081|:3080' || true
  attempt_auto_rollback 'web_health' || true
  exit 5
fi

SESSION_PROBE="$(curl -sS -m 8 -X POST http://127.0.0.1:3080/api/v1/auth/session \
  -H 'Content-Type: application/json' -d '{}' || true)"
echo "auth_session_probe_len=${#SESSION_PROBE}"
if echo "$SESSION_PROBE" | grep -q 'AUTH_REQUIRED'; then
  echo 'BLOCKED: auth_session_still_requires_token_old_api' >&2
  attempt_auto_rollback 'auth_session_old' || true
  exit 4
fi
if echo "$SESSION_PROBE" | grep -qiE 'email|password|validation|INVALID|required'; then
  echo 'auth_session_endpoint_reachable=YES'
else
  echo "auth_session_probe_body_prefix=${SESSION_PROBE:0:120}"
  echo 'WARN: unexpected auth/session response — check API logs'
fi

HTML="$(curl -sS -m 8 http://127.0.0.1:3081/ || true)"
ASSET="$(printf '%s' "$HTML" | grep -oE '/assets/index-[^"]+\.js' | head -1 || true)"
echo "spa_asset=${ASSET:-missing}"
if [[ -n "$ASSET" ]]; then
  JS="$(curl -sS -m 20 "http://127.0.0.1:3081${ASSET}" || true)"
  if echo "$JS" | grep -q "$EXPECTED_MARKER_SPA"; then
    echo 'spa_login_form_in_bundle=YES'
  else
    echo 'BLOCKED: spa_login_form_missing_in_built_bundle' >&2
    attempt_auto_rollback 'spa_marker_missing' || true
    exit 5
  fi
else
  echo 'BLOCKED: spa_index_asset_not_found' >&2
  attempt_auto_rollback 'spa_asset_missing' || true
  exit 5
fi

META="$(curl -sS -m 5 http://127.0.0.1:3080/api/v1/meta || true)"
echo "meta_len=${#META}"
python3 -c 'import json,sys
try:
  m=json.loads(sys.argv[1]); a=m.get("auth") or {}; s=m.get("authSession") or {}
  print("runtime="+str(m.get("runtime")))
  print("auth_mode="+str(a.get("mode")))
  print("password_login_path="+str(s.get("passwordLoginPath") or ""))
  print("browser_login="+str(s.get("browserLogin")))
except Exception as e:
  print("meta_parse=FAIL"); print(e)
' "$META" 2>/dev/null || echo 'meta_parse=SKIP'

echo "SPA_LOGIN_REBUILD_OK merge_sha8=${MERGE_SHA8}"
echo "rollback_api_tag=${ROLLBACK_API_TAG}"
echo "rollback_web_tag=${ROLLBACK_WEB_TAG}"
echo "rollback_cmd=CONFIRM_SPA_LOGIN_ROLLBACK=YES ERP_DOCKER_NETWORK=${ERP_DOCKER_NETWORK} ROLLBACK_TAG_FILE=${ROLLBACK_TAG_FILE} bash scripts/vps/spa-login-rollback-api-web.sh"
echo "port_3080_preserved=YES"
echo "port_3081_preserved=YES"
echo "NEXT=abrir_https://erp-dev.cpaferroeaco.com.br_hard_refresh_e_validar_campos_email_senha"
echo "SPA_LOGIN_REBUILD_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SWAP_STARTED=0
trap - ERR
