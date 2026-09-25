#!/usr/bin/env bash
# Rebuild do canário Gate D a partir do HEAD do checkout local (branch com fix).
# NÃO usa a tag MAIN imutável. NÃO altera erp-api-dev / 3080. NÃO autoriza Gate F.
#
# Uso (VPS, após git pull da branch Gate D):
#   ERP_DOCKER_NETWORK=supabase_default \
#   EXPECTED_RUNTIME=ERP-RUNTIME-08B \
#   CANARY_PORT=3086 \
#   ERP_AUTH_MODE=supabase_user \
#   bash scripts/deploy/comercial360-canary-from-checkout.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CANARY_NAME="${CANARY_NAME:-erp-api-comercial360-canary}"
CANARY_PORT="${CANARY_PORT:-3086}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
ERP_AUTH_MODE="${ERP_AUTH_MODE:-supabase_user}"
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK after VPS precheck}"

if [[ -z "${ENV_FROM_CONTAINER:-}" && -z "${ENV_FILE:-}" ]]; then
  ENV_FROM_CONTAINER='erp-api-dev'
fi

if [[ ! "$CANARY_PORT" =~ ^[1-9][0-9]{3,4}$ ]] || (( CANARY_PORT < 1024 || CANARY_PORT > 65535 )) || [[ "$CANARY_PORT" == "3080" ]]; then
  echo 'BLOCKED: canary requires an unprivileged isolated port other than 3080' >&2
  exit 1
fi
if [[ "$CANARY_NAME" == "erp-api-dev" ]]; then
  echo 'BLOCKED: canary must not use the official API container name' >&2
  exit 1
fi

command -v docker >/dev/null
command -v git >/dev/null
[[ -d "$ROOT/server" ]] || { echo 'BLOCKED: server/ missing in checkout' >&2; exit 1; }

GIT_SHA="$(git rev-parse HEAD)"
GIT_SHA8="${GIT_SHA:0:8}"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo DETACHED)"
IMAGE="erp-zuccaro-erp-api:comercial360-gate-d-${GIT_SHA8}"

echo "GATE_D_CANARY_FROM_CHECKOUT_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"
echo "checkout_branch=${BRANCH}"
echo "checkout_sha=${GIT_SHA}"
echo "checkout_sha8=${GIT_SHA8}"
echo "image_tag=${IMAGE}"
echo "NOTE=not_main_immutable_tag"

# Prova 3080 intacta antes
curl -sS -o /dev/null -w 'health_3080_before=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_before=000'

echo "docker_build_begin=${IMAGE}"
docker build -t "$IMAGE" "$ROOT/server"
IMAGE_ID="$(docker image inspect -f '{{.Id}}' "$IMAGE")"
echo "image_id_prefix=${IMAGE_ID:0:19}"
echo "docker_build_ok=YES"

# Recria só o canário (nunca erp-api-dev)
if docker ps -a --format '{{.Names}}' | grep -Fxq "$CANARY_NAME"; then
  echo "canary_rm_existing=${CANARY_NAME}"
  docker rm -f "$CANARY_NAME" >/dev/null
fi

export IMAGE CANARY_NAME CANARY_PORT EXPECTED_RUNTIME ERP_AUTH_MODE ERP_DOCKER_NETWORK
if [[ -n "${ENV_FROM_CONTAINER:-}" ]]; then
  export ENV_FROM_CONTAINER
elif [[ -n "${ENV_FILE:-}" ]]; then
  export ENV_FILE
fi

bash "$ROOT/scripts/deploy/comercial360-canary.sh"

curl -sS -o /dev/null -w 'health_3080_after=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_after=000'

RUNNING_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CANARY_NAME" 2>/dev/null || true)"
echo "PASTE_TO_GIT_BEGIN"
echo "checkout_sha8=${GIT_SHA8}"
echo "image_tag=${IMAGE}"
echo "image_id_prefix=${IMAGE_ID:0:19}"
echo "canary_running_image=${RUNNING_IMAGE}"
echo "canary_port=${CANARY_PORT}"
echo "expected_runtime=${EXPECTED_RUNTIME}"
echo "canary_from_checkout=YES"
echo "main_immutable_tag_used=NO"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"
echo "NOTE=segredos_somente_cofre_local"
echo "PASTE_TO_GIT_END"
echo "GATE_D_CANARY_FROM_CHECKOUT_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
