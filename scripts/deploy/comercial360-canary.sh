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

if [[ -z "${ENV_FROM_CONTAINER:-}" && -z "${ENV_FILE:-}" ]]; then
  echo 'BLOCKED: set ENV_FILE=/path/.env or ENV_FROM_CONTAINER=erp-api-dev' >&2
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

  # Overlay Auth real do Supabase self-hosted (erp-api-dev costuma ter stub / URL kong)
  SUPA_ENV="${SUPABASE_ENV_FILE:-/root/supabase/docker/.env}"
  if [[ -f "$SUPA_ENV" ]]; then
    env_get_supa() {
      local key="$1" line
      line="$(grep -E "^${key}=" "$SUPA_ENV" 2>/dev/null | tail -1 || true)"
      [[ -n "$line" ]] || return 0
      line="${line#${key}=}"
      line="${line%$'\r'}"
      if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"
      elif [[ "$line" =~ ^\'.*\'$ ]]; then line="${line:1:${#line}-2}"; fi
      printf '%s' "$line"
    }
    REAL_ANON="$(env_get_supa ANON_KEY)"
    [[ -z "$REAL_ANON" ]] && REAL_ANON="$(env_get_supa SUPABASE_ANON_KEY)"
    # URL interna Docker (canário na mesma rede); host usa 127.0.0.1:8000 no smoke Bearer
    KONG_NAME="$(docker ps --format '{{.Names}}' | grep -Ei '^kong$|supabase-kong' | head -1 || true)"
    [[ -z "$KONG_NAME" ]] && KONG_NAME='kong'
    if [[ -n "$REAL_ANON" && ${#REAL_ANON} -ge 40 ]]; then
      grep -vE '^(SUPABASE_ANON_KEY|SUPABASE_URL)=' "$TMP_ENV" >"${TMP_ENV}.new" || true
      mv "${TMP_ENV}.new" "$TMP_ENV"
      printf 'SUPABASE_ANON_KEY=%s\n' "$REAL_ANON" >>"$TMP_ENV"
      printf 'SUPABASE_URL=http://%s:8000\n' "$KONG_NAME" >>"$TMP_ENV"
      echo "supabase_overlay=YES"
      echo "supabase_anon_len=${#REAL_ANON}"
      echo "supabase_url_host=${KONG_NAME}"
    else
      echo "supabase_overlay=SKIP_anon_short_or_missing"
    fi
  else
    echo "supabase_overlay=SKIP_env_missing"
  fi
elif [[ -n "${ENV_FILE:-}" ]]; then
  [[ -f "$ENV_FILE" ]] || { echo "BLOCKED: ENV_FILE missing path_set=YES" >&2; exit 1; }
  echo "env_from_file=YES"
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

# Valida /meta: node (CI) ou python3 (VPS sem Node no host)
verify_canary_meta() {
  local meta_json="$1"
  local expected="$2"
  if command -v node >/dev/null 2>&1; then
    node -e "try { const m=JSON.parse(process.argv[1]); if(m.runtime===process.argv[2] && m.auth?.mode==='supabase_user') process.exit(0) } catch {} process.exit(1)" \
      "$meta_json" "$expected"
    return $?
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; m=json.loads(sys.argv[1]); auth=m.get("auth") or {}; sys.exit(0 if m.get("runtime")==sys.argv[2] and auth.get("mode")=="supabase_user" else 1)' \
      "$meta_json" "$expected"
    return $?
  fi
  echo 'BLOCKED: need node or python3 to verify canary /meta' >&2
  return 1
}

print_meta_hint() {
  local meta_json="$1"
  if command -v node >/dev/null 2>&1; then
    node -e "try{const m=JSON.parse(process.argv[1]);console.log('meta_runtime='+(m.runtime||''));console.log('meta_auth_mode='+(m.auth&&m.auth.mode||''))}catch{console.log('meta_parse=FAIL')}" \
      "$meta_json" >&2 || true
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys
try:
 m=json.loads(sys.argv[1]); a=m.get("auth") or {}
 print("meta_runtime="+str(m.get("runtime") or ""))
 print("meta_auth_mode="+str(a.get("mode") or ""))
except Exception:
 print("meta_parse=FAIL")' "$meta_json" >&2 || true
  fi
}

for _ in $(seq 1 30); do
  if curl --fail --silent "http://127.0.0.1:${CANARY_PORT}/health" >/dev/null && \
     curl --fail --silent "http://127.0.0.1:${CANARY_PORT}/ready" >/dev/null; then
    meta="$(curl --fail --silent "http://127.0.0.1:${CANARY_PORT}/api/v1/meta")"
    if ! verify_canary_meta "$meta" "$EXPECTED_RUNTIME"; then
      print_meta_hint "$meta"
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
