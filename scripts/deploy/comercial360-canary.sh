#!/usr/bin/env bash
set -Eeuo pipefail
: "${IMAGE:?Set IMAGE to the immutable MAIN image tag}"
: "${ENV_FILE:?Set ENV_FILE to the approved VPS environment file}"
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK after VPS precheck}"
CANARY_NAME="${CANARY_NAME:-erp-api-comercial360-canary}"
CANARY_PORT="${CANARY_PORT:-3086}"
# Default alinhado a /api/v1/meta da main pós-#35 (runtime canônico 08B).
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
if [[ ! "$CANARY_PORT" =~ ^[1-9][0-9]{3,4}$ ]] || (( CANARY_PORT < 1024 || CANARY_PORT > 65535 )) || [[ "$CANARY_PORT" == "3080" ]]; then
  echo 'BLOCKED: canary requires an unprivileged isolated port other than 3080' >&2
  exit 1
fi
if [[ "$CANARY_NAME" == "erp-api-dev" ]]; then
  echo 'BLOCKED: canary must not use the official API container name' >&2
  exit 1
fi

command -v docker >/dev/null
[[ -f "$ENV_FILE" ]]
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