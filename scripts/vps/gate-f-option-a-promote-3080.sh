#!/usr/bin/env bash
# Gate F opção A — promoção 3080 com a imagem MAIN que passou mutação no canário.
# Preserva R07B renomeando erp-api-dev. Exige CONFIRM_GATE_F_PROMOTE=YES.
# Não promove 2fc2fc80. Não apaga containers/backups.
#
# Uso (VPS, após GATE_D_MUTATION_SMOKE=OK em comercial360-main-894b0db8):
#   CONFIRM_GATE_F_PROMOTE=YES \
#   IMAGE='erp-zuccaro-erp-api:comercial360-main-894b0db8' \
#   ERP_DOCKER_NETWORK='supabase_default' \
#   bash scripts/vps/gate-f-option-a-promote-3080.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_GATE_F_PROMOTE="${CONFIRM_GATE_F_PROMOTE:-}"
FORBIDDEN_SHA8='2fc2fc80'
REQUIRED_SHA8="${REQUIRED_SHA8:-894b0db8}"
IMAGE="${IMAGE:-erp-zuccaro-erp-api:comercial360-main-${REQUIRED_SHA8}}"
OFFICIAL_NAME="${OFFICIAL_NAME:-erp-api-dev}"
CANARY_NAME="${CANARY_NAME:-erp-api-comercial360-canary}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
ERP_AUTH_MODE="${ERP_AUTH_MODE:-supabase_user}"

echo "GATE_F_PROMOTE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "opcao_digest=A"
echo "required_sha8=${REQUIRED_SHA8}"

[[ "$CONFIRM_GATE_F_PROMOTE" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_GATE_F_PROMOTE=YES after mutation OK on MAIN tag' >&2
  exit 2
}
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK}"

case "$IMAGE" in
  *comercial360-main-"${REQUIRED_SHA8}"*) ;;
  *)
    echo "BLOCKED: IMAGE must be comercial360-main-${REQUIRED_SHA8}" >&2
    echo "image_got=${IMAGE}" >&2
    exit 3
    ;;
esac
case "$IMAGE" in
  *"${FORBIDDEN_SHA8}"*)
    echo 'BLOCKED: refusing forbidden MAIN tag without orcamento fix' >&2
    exit 3
    ;;
esac

command -v docker >/dev/null
docker image inspect "$IMAGE" >/dev/null || {
  echo "BLOCKED: image_not_found tag=${IMAGE}" >&2
  exit 3
}

# Canário deve estar na mesma imagem
if ! docker ps --format '{{.Names}}' | grep -Fxq "$CANARY_NAME"; then
  echo "BLOCKED: canary_not_running name=${CANARY_NAME}" >&2
  exit 4
fi
CANARY_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CANARY_NAME")"
echo "canary_image=${CANARY_IMAGE}"
[[ "$CANARY_IMAGE" == "$IMAGE" ]] || {
  echo 'BLOCKED: canary_image_mismatch_vs_promote_image' >&2
  exit 4
}

# Meta canário
canary_meta="$(curl -sS --fail --connect-timeout 5 "http://127.0.0.1:3086/api/v1/meta" 2>/dev/null || true)"
if ! python3 -c 'import json,sys; m=json.loads(sys.argv[1]); a=m.get("auth") or {}; sys.exit(0 if m.get("runtime")==sys.argv[2] and a.get("mode")=="supabase_user" else 1)' \
  "$canary_meta" "$EXPECTED_RUNTIME" 2>/dev/null; then
  echo 'BLOCKED: canary_meta_runtime_or_auth_mismatch' >&2
  exit 4
fi
echo "canary_meta_ok=YES"

if ! docker ps --format '{{.Names}}' | grep -Fxq "$OFFICIAL_NAME"; then
  echo "BLOCKED: official_not_running name=${OFFICIAL_NAME}" >&2
  exit 5
fi

OFFICIAL_BEFORE="$(docker inspect -f '{{.Config.Image}}' "$OFFICIAL_NAME")"
echo "official_image_before=${OFFICIAL_BEFORE}"
curl -sS -o /dev/null -w 'health_3080_before=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_before=000'

STAMP="$(date -u +%Y%m%d-%H%M%S)"
ROLLBACK_NAME="${OFFICIAL_NAME}-r07b-pre-f-${STAMP}"

# Env do oficial + overlay Supabase (mesmo padrão do canário)
TMP_ENV="$(mktemp /tmp/gate-f-promote-env.XXXXXX)"
cleanup() { rm -f "$TMP_ENV"; }
trap cleanup EXIT
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$OFFICIAL_NAME" >"$TMP_ENV"
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
  KONG_NAME="$(docker ps --format '{{.Names}}' | grep -Ei '^kong$|supabase-kong' | head -1 || true)"
  [[ -z "$KONG_NAME" ]] && KONG_NAME='kong'
  if [[ -n "$REAL_ANON" && ${#REAL_ANON} -ge 40 ]]; then
    grep -vE '^(SUPABASE_ANON_KEY|SUPABASE_URL)=' "$TMP_ENV" >"${TMP_ENV}.new" || true
    mv "${TMP_ENV}.new" "$TMP_ENV"
    printf 'SUPABASE_ANON_KEY=%s\n' "$REAL_ANON" >>"$TMP_ENV"
    printf 'SUPABASE_URL=http://%s:8000\n' "$KONG_NAME" >>"$TMP_ENV"
    echo "supabase_overlay=YES"
  else
    echo "supabase_overlay=SKIP"
  fi
fi
echo "env_keys_count=$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$TMP_ENV" || true)"

echo "rollback_preserve_as=${ROLLBACK_NAME}"
docker stop "$OFFICIAL_NAME" >/dev/null
docker rename "$OFFICIAL_NAME" "$ROLLBACK_NAME"
echo "official_renamed_to_rollback=YES"

docker run -d --name "$OFFICIAL_NAME" --restart unless-stopped \
  --env-file "$TMP_ENV" \
  -e NODE_ENV=production -e ERP_ENV=dev -e PORT=3080 \
  -e "ERP_AUTH_MODE=${ERP_AUTH_MODE}" \
  --network "$ERP_DOCKER_NETWORK" \
  -p '127.0.0.1:3080:3080' \
  "$IMAGE" >/dev/null

echo "official_started_image=${IMAGE}"

ready=NO
for _ in $(seq 1 40); do
  if curl --fail --silent "http://127.0.0.1:3080/health" >/dev/null \
     && curl --fail --silent "http://127.0.0.1:3080/ready" >/dev/null; then
    meta="$(curl --fail --silent "http://127.0.0.1:3080/api/v1/meta")"
    if python3 -c 'import json,sys; m=json.loads(sys.argv[1]); a=m.get("auth") or {}; sys.exit(0 if m.get("runtime")==sys.argv[2] and a.get("mode")=="supabase_user" else 1)' \
      "$meta" "$EXPECTED_RUNTIME" 2>/dev/null; then
      ready=YES
      break
    fi
  fi
  sleep 2
done

OFFICIAL_AFTER="$(docker inspect -f '{{.Config.Image}}' "$OFFICIAL_NAME" 2>/dev/null || true)"
echo "official_image_after=${OFFICIAL_AFTER}"
curl -sS -o /dev/null -w 'health_3080_after=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_after=000'

if [[ "$ready" != "YES" ]]; then
  echo 'BLOCKED: promoted_official_not_ready_meta_mismatch' >&2
  echo "HINT=rollback_container=${ROLLBACK_NAME} use CONFIRM_ROLLBACK=YES comercial360-rollback.sh" >&2
  docker logs --tail 80 "$OFFICIAL_NAME" >&2 || true
  exit 8
fi

echo "PASTE_TO_GIT_BEGIN"
echo "merge_sha8=${REQUIRED_SHA8}"
echo "promote_image=${IMAGE}"
echo "official_image_before=${OFFICIAL_BEFORE}"
echo "official_image_after=${OFFICIAL_AFTER}"
echo "rollback_container=${ROLLBACK_NAME}"
echo "canary_image=${CANARY_IMAGE}"
echo "expected_runtime=${EXPECTED_RUNTIME}"
echo "auth_mode=${ERP_AUTH_MODE}"
echo "GATE_F_PROMOTE_STATUS=OK"
echo "EXECUTE_GATE_F=EXECUTED_OK"
echo "alter_3080=PERFORMED"
echo "NOTE=segredos_somente_cofre_local"
echo "NOTE2=next_reprovision_auth_and_smoke_on_3080"
echo "PASTE_TO_GIT_END"
echo "GATE_F_PROMOTE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
