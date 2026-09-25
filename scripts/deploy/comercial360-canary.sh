#!/usr/bin/env bash
set -Eeuo pipefail
: "${IMAGE:?Set IMAGE to the immutable MAIN image tag}"
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK after VPS precheck}"
# ENV_FILE=/caminho/.env  OU  ENV_FROM_CONTAINER=erp-api-dev (sem cat no chat)
CANARY_NAME="${CANARY_NAME:-erp-api-comercial360-canary}"
CANARY_PORT="${CANARY_PORT:-3086}"
# Default alinhado a /api/v1/meta da main pós-#35 (runtime canônico 08B).
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
TMP_ENV=""
cleanup_tmp_env() {
  if [[ -n "$TMP_ENV" && -f "$TMP_ENV" ]]; then
    rm -f "$TMP_ENV"
  fi
}
trap cleanup_tmp_env EXIT

if [[ ! "$CANARY_PORT" =~ ^[1-9][0-9]{3,4}$ ]] || (( CANARY_PORT < 1024 || CANARY_PORT > 65535 )) || [[ "$CANARY_PORT" == "3080" ]]; then
  echo 'BLOCKED: canary requires an unprivileged isolated port other than 3080' >&2
  exit 1
fi
if [[ "$CANARY_NAME" == "erp-api-dev" ]]; then
  echo 'BLOCKED: canary must not use the official API container name' >&2
  exit 1
fi

command -v docker >/dev/null

if [[ -n "${ENV_FROM_CONTAINER:-}" ]]; then
  if ! docker ps --format '{{.Names}}' | grep -Fxq "$ENV_FROM_CONTAINER"; then
    echo "BLOCKED: ENV_FROM_CONTAINER not running: $ENV_FROM_CONTAINER" >&2
    exit 1
  fi
  TMP_ENV="$(mktemp /tmp/canary-env.XXXXXX)"
  # Copia só KEY=VALUE do container oficial — não imprime valores
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$ENV_FROM_CONTAINER" >"$TMP_ENV"
  ENV_FILE="$TMP_ENV"
  echo "env_from_container=${ENV_FROM_CONTAINER}"
  echo "env_keys_count=$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$TMP_ENV" || true)"
elif [[ -n "${ENV_FILE:-}" ]]; then
  [[ -f "$ENV_FILE" ]] || { echo "BLOCKED: ENV_FILE missing path_set=YES" >&2; exit 1; }
  echo "env_from_file=YES"
else
  echo 'BLOCKED: set ENV_FILE=/path/.env or ENV_FROM_CONTAINER=erp-api-dev' >&2
  exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CANARY_NAME"; then
  echo "BLOCKED: canary container already exists: $CANARY_NAME" >&2
  exit 1
fi
if command -v ss >/dev/null && ss -ltn | awk '{print $4}' | grep -Eq "[:.]${CANARY_PORT}$"; then
  echo "BLOCKED: canary port is already in use: $CANARY_PORT" >&2
  exit 1
fi
docker run -d --name "$CANARY_NAME" --restart no --env-file "$ENV_FILE" \
  -e NODE_ENV=production -e ERP_ENV=dev -e PORT=3080 \
  -e "ERP_AUTH_MODE=${ERP_AUTH_MODE:-supabase_user}" \
  --network "$ERP_DOCKER_NETWORK" -p "127.0.0.1:${CANARY_PORT}:3080" "$IMAGE" >/dev/null
echo "canary_auth_mode_override=${ERP_AUTH_MODE:-supabase_user}"
for _ in $(seq 1 30); do
  if curl --fail --silent "http://127.0.0.1:${CANARY_PORT}/health" >/dev/null && \
     curl --fail --silent "http://127.0.0.1:${CANARY_PORT}/ready" >/dev/null; then
    meta="$(curl --fail --silent "http://127.0.0.1:${CANARY_PORT}/api/v1/meta")"
    if ! node -e "try { const m=JSON.parse(process.argv[1]); if(m.runtime===process.argv[2] && m.auth?.mode==='supabase_user') process.exit(0) } catch {} process.exit(1)" "$meta" "$EXPECTED_RUNTIME"; then
      node -e "try{const m=JSON.parse(process.argv[1]);console.log('meta_runtime='+(m.runtime||''));console.log('meta_auth_mode='+(m.auth&&m.auth.mode||''))}catch{console.log('meta_parse=FAIL')}" "$meta" >&2 || true
      echo 'BLOCKED: canary runtime or verified Auth mode mismatch' >&2
      exit 1
    fi
    echo "CANARY_READY name=$CANARY_NAME port=$CANARY_PORT image=$IMAGE runtime=$EXPECTED_RUNTIME"
    exit 0
  fi
  sleep 2
done
docker logs --tail 100 "$CANARY_NAME" >&2 || true
echo "BLOCKED: canary did not become ready" >&2
exit 1
