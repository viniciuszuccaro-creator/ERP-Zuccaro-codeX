#!/usr/bin/env bash
# Rebuild erp-api-dev + erp-web-dev com o formulário e-mail/senha (PR #45).
# Não mexe no Supabase. Não usa down -v. Exige merge na main com o endpoint
# POST /api/v1/auth/session e o formulário erp-login-email no SPA.
#
# Uso (Web Console VPS, após merge #45):
#   CONFIRM_SPA_LOGIN_REBUILD=YES \
#   ERP_DOCKER_NETWORK=supabase_default \
#   bash scripts/vps/spa-login-rebuild-api-web.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_SPA_LOGIN_REBUILD="${CONFIRM_SPA_LOGIN_REBUILD:-}"
EXPECTED_MARKER_API='passwordLoginPath'
EXPECTED_MARKER_SPA='erp-login-email'
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.erp.yml}"
ENV_FILE="${ENV_FILE:-.env.erp.dev}"

echo "SPA_LOGIN_REBUILD_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

[[ "$CONFIRM_SPA_LOGIN_REBUILD" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_SPA_LOGIN_REBUILD=YES after PR #45 merged' >&2
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

git fetch origin main
git checkout --detach origin/main
MERGE_SHA="$(git rev-parse HEAD)"
MERGE_SHA8="${MERGE_SHA:0:8}"
echo "merge_sha=${MERGE_SHA}"
echo "merge_sha8=${MERGE_SHA8}"

if ! grep -q "$EXPECTED_MARKER_API" "$ROOT/server/src/api/router.ts"; then
  echo 'BLOCKED: auth_session_endpoint_missing_on_main' >&2
  echo 'HINT=merge_PR_45_first' >&2
  exit 3
fi
if ! grep -q "$EXPECTED_MARKER_SPA" "$ROOT/src/components/UserNotRegisteredError.jsx"; then
  echo 'BLOCKED: spa_login_form_missing_on_main' >&2
  echo 'HINT=merge_PR_45_first' >&2
  exit 3
fi
echo 'login_markers_on_main=YES'

# Preserve official containers by renaming before recreate (rollback names).
STAMP="$(date -u +%Y%m%d-%H%M%S)"
for name in erp-api-dev erp-web-dev; do
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$name"; then
    rollback="${name}-pre-spa-login-${STAMP}"
    echo "rename_${name}=${rollback}"
    docker rename "$name" "$rollback"
    docker update --restart=no "$rollback" >/dev/null || true
    docker stop "$rollback" >/dev/null || true
  else
    echo "rename_${name}=SKIP_NOT_FOUND"
  fi
done

export ERP_DOCKER_NETWORK
echo "compose_build_begin utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build erp-api erp-web
echo "compose_up_begin utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps erp-api
# Wait health before web (depends_on health in compose)
for i in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3080/health 2>/dev/null || true)"
  echo "health_3080_poll_${i}=${code}"
  [[ "$code" == "200" ]] && break
  sleep 3
done
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps erp-web

API_IMAGE="$(docker inspect -f '{{.Config.Image}}' erp-api-dev 2>/dev/null || echo missing)"
WEB_IMAGE="$(docker inspect -f '{{.Config.Image}}' erp-web-dev 2>/dev/null || echo missing)"
echo "api_image=${API_IMAGE}"
echo "web_image=${WEB_IMAGE}"

curl -sS -o /dev/null -w 'health_3080_after=%{http_code}\n' --connect-timeout 5 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_after=000'
curl -sS -o /dev/null -w 'ready_3080_after=%{http_code}\n' --connect-timeout 5 \
  http://127.0.0.1:3080/ready 2>/dev/null || echo 'ready_3080_after=000'
curl -sS -o /dev/null -w 'web_3081_after=%{http_code}\n' --connect-timeout 5 \
  http://127.0.0.1:3081/ 2>/dev/null || echo 'web_3081_after=000'

# Prove API route is public (empty body → validation, not AUTH_REQUIRED).
SESSION_PROBE="$(curl -sS -m 8 -X POST http://127.0.0.1:3080/api/v1/auth/session \
  -H 'Content-Type: application/json' -d '{}' || true)"
echo "auth_session_probe_len=${#SESSION_PROBE}"
if echo "$SESSION_PROBE" | grep -q 'AUTH_REQUIRED'; then
  echo 'BLOCKED: auth_session_still_requires_token_old_api' >&2
  exit 4
fi
if echo "$SESSION_PROBE" | grep -qiE 'email|password|validation|INVALID|required'; then
  echo 'auth_session_endpoint_reachable=YES'
else
  echo "auth_session_probe_body_prefix=${SESSION_PROBE:0:120}"
  echo 'WARN: unexpected auth/session response — check API logs'
fi

# Prove SPA bundle exposes login field id (download index html → asset).
HTML="$(curl -sS -m 8 http://127.0.0.1:3081/ || true)"
ASSET="$(printf '%s' "$HTML" | grep -oE '/assets/index-[^"]+\.js' | head -1 || true)"
echo "spa_asset=${ASSET:-missing}"
if [[ -n "$ASSET" ]]; then
  JS="$(curl -sS -m 20 "http://127.0.0.1:3081${ASSET}" || true)"
  if echo "$JS" | grep -q "$EXPECTED_MARKER_SPA"; then
    echo 'spa_login_form_in_bundle=YES'
  else
    echo 'BLOCKED: spa_login_form_missing_in_built_bundle' >&2
    exit 5
  fi
else
  echo 'BLOCKED: spa_index_asset_not_found' >&2
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
echo "NEXT=abrir_https://erp-dev.cpaferroeaco.com.br_hard_refresh_e_validar_campos_email_senha"
echo "HINT_AUTH=se_login_falhar_reactivar_perfil_sintetico_com_provision-gate-d-auth-synthetic.sh"
echo "SPA_LOGIN_REBUILD_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
