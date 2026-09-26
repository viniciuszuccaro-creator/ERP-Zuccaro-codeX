#!/usr/bin/env bash
# Rollback executável de erp-api-dev / erp-web-dev para tags pré-rebuild.
# Preserva container_name oficiais e bind 127.0.0.1:3080 / 127.0.0.1:3081.
# Não usa down -v. Não mexe no Supabase.
#
# Uso:
#   CONFIRM_SPA_LOGIN_ROLLBACK=YES \
#     ROLLBACK_API_TAG='erp-zuccaro-erp-api:pre-spa-login-YYYYMMDD-HHMMSS' \
#     ROLLBACK_WEB_TAG='erp-zuccaro-erp-web:pre-spa-login-YYYYMMDD-HHMMSS' \
#     ERP_DOCKER_NETWORK=supabase_default \
#     bash scripts/vps/spa-login-rollback-api-web.sh
#
# Ou:
#   CONFIRM_SPA_LOGIN_ROLLBACK=YES ERP_DOCKER_NETWORK=supabase_default \
#     ROLLBACK_TAG_FILE=/opt/erp-zuccaro/.spa-login-rollback-tags \
#     bash scripts/vps/spa-login-rollback-api-web.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_SPA_LOGIN_ROLLBACK="${CONFIRM_SPA_LOGIN_ROLLBACK:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.erp.yml}"
ENV_FILE="${ENV_FILE:-.env.erp.dev}"
ROLLBACK_TAG_FILE="${ROLLBACK_TAG_FILE:-$ROOT/.spa-login-rollback-tags}"
ROLLBACK_API_TAG="${ROLLBACK_API_TAG:-}"
ROLLBACK_WEB_TAG="${ROLLBACK_WEB_TAG:-}"
COMPOSE_API_IMAGE="${COMPOSE_API_IMAGE:-erp-zuccaro-erp-api}"
COMPOSE_WEB_IMAGE="${COMPOSE_WEB_IMAGE:-erp-zuccaro-erp-web}"

echo "SPA_LOGIN_ROLLBACK_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$CONFIRM_SPA_LOGIN_ROLLBACK" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_SPA_LOGIN_ROLLBACK=YES' >&2
  exit 2
}
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK}"
command -v docker >/dev/null
[[ -f "$ROOT/$COMPOSE_FILE" ]] || { echo "BLOCKED: compose_missing" >&2; exit 1; }
[[ -f "$ROOT/$ENV_FILE" ]] || { echo "BLOCKED: env_file_missing" >&2; exit 1; }

if [[ -z "$ROLLBACK_API_TAG" || -z "$ROLLBACK_WEB_TAG" ]]; then
  if [[ -f "$ROLLBACK_TAG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ROLLBACK_TAG_FILE"
  fi
fi
[[ -n "${ROLLBACK_API_TAG:-}" && -n "${ROLLBACK_WEB_TAG:-}" ]] || {
  echo 'BLOCKED: set ROLLBACK_API_TAG and ROLLBACK_WEB_TAG (or ROLLBACK_TAG_FILE)' >&2
  exit 2
}

echo "rollback_api_tag=${ROLLBACK_API_TAG}"
echo "rollback_web_tag=${ROLLBACK_WEB_TAG}"

docker image inspect "$ROLLBACK_API_TAG" >/dev/null 2>&1 || {
  echo "BLOCKED: rollback_api_image_missing" >&2
  exit 3
}
docker image inspect "$ROLLBACK_WEB_TAG" >/dev/null 2>&1 || {
  echo "BLOCKED: rollback_web_image_missing" >&2
  exit 3
}

# Aponta as tags que o compose usa para as imagens de rollback (sem rebuild).
docker tag "$ROLLBACK_API_TAG" "$COMPOSE_API_IMAGE"
docker tag "$ROLLBACK_WEB_TAG" "$COMPOSE_WEB_IMAGE"
echo "compose_image_retarget=YES api=${COMPOSE_API_IMAGE} web=${COMPOSE_WEB_IMAGE}"

free_official_port() {
  local port="$1"
  local allowed_names="$2" # espaço-separado
  local ids
  ids="$(docker ps -aq --filter publish="$port" 2>/dev/null || true)"
  if [[ -z "$ids" ]]; then
    echo "port_${port}_holders=none"
    return 0
  fi
  for id in $ids; do
    local n
    n="$(docker inspect -f '{{.Name}}' "$id" | sed 's#^/##')"
    local ok=0
    for allowed in $allowed_names; do
      if [[ "$n" == "$allowed" ]]; then ok=1; break; fi
    done
    if [[ "$ok" != "1" ]]; then
      echo "BLOCKED: port_${port}_unknown_container name=${n}" >&2
      echo 'HINT: remova/identifique o holder manualmente; rollback recusa containers não oficiais' >&2
      exit 6
    fi
    echo "stop_rm_port_${port}=${n}"
    docker stop "$id" >/dev/null || true
    docker rm "$id" >/dev/null || true
  done
}

for name in erp-api-dev erp-web-dev; do
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$name"; then
    echo "stop_rm_${name}=YES"
    docker stop "$name" >/dev/null || true
    docker rm "$name" >/dev/null || true
  fi
done
# Somente oficiais (ou já removidos acima). Qualquer outro holder → BLOCKED.
free_official_port 3080 "erp-api-dev"
free_official_port 3081 "erp-web-dev"

export ERP_DOCKER_NETWORK
echo "compose_up_rollback_begin utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --no-build --force-recreate erp-api

API_OK=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3080/health 2>/dev/null || true)"
  echo "health_3080_poll_${i}=${code}"
  if [[ "$code" == "200" ]]; then API_OK=1; break; fi
  sleep 3
done
[[ "$API_OK" == "1" ]] || {
  echo 'BLOCKED: rollback_api_health_not_200' >&2
  exit 4
}

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --no-build --force-recreate erp-web

WEB_OK=0
for i in 1 2 3 4 5 6 7 8; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3081/ 2>/dev/null || true)"
  echo "web_3081_poll_${i}=${code}"
  if [[ "$code" == "200" ]]; then WEB_OK=1; break; fi
  sleep 2
done
[[ "$WEB_OK" == "1" ]] || {
  echo 'BLOCKED: rollback_web_not_200' >&2
  exit 5
}

# Confirma binds oficiais.
API_PORTS="$(docker inspect -f '{{json .HostConfig.PortBindings}}' erp-api-dev 2>/dev/null || echo missing)"
WEB_PORTS="$(docker inspect -f '{{json .HostConfig.PortBindings}}' erp-web-dev 2>/dev/null || echo missing)"
echo "api_port_bindings_has_3080=$(echo "$API_PORTS" | grep -q '3080' && echo YES || echo NO)"
echo "web_port_bindings_has_3081=$(echo "$WEB_PORTS" | grep -q '3081' && echo YES || echo NO)"
curl -sS -o /dev/null -w 'health_3080_after=%{http_code}\n' --connect-timeout 5 http://127.0.0.1:3080/health || echo 'health_3080_after=000'
curl -sS -o /dev/null -w 'web_3081_after=%{http_code}\n' --connect-timeout 5 http://127.0.0.1:3081/ || echo 'web_3081_after=000'
echo "port_3080_preserved=YES"
echo "port_3081_preserved=YES"
echo "SPA_LOGIN_ROLLBACK_OK"
echo "SPA_LOGIN_ROLLBACK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
