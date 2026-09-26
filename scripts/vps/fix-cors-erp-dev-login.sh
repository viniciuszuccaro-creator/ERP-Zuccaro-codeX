#!/usr/bin/env bash
# Corrige CORS do erp-api-dev para o host HTTPS público (login SPA).
# Sem isso, o browser em https://erp-dev… recebe 500 "Internal server error"
# no POST /api/v1/auth/session (Origin não estava na allowlist).
#
# Uso (Web Console):
#   CONFIRM_CORS_ERP_DEV=YES bash scripts/vps/fix-cors-erp-dev-login.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_CORS_ERP_DEV="${CONFIRM_CORS_ERP_DEV:-}"
ENV_FILE="${ENV_FILE:-.env.erp.dev}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.erp.yml}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://erp-dev.cpaferroeaco.com.br}"

echo "CORS_ERP_DEV_FIX_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

[[ "$CONFIRM_CORS_ERP_DEV" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_CORS_ERP_DEV=YES' >&2
  exit 2
}
: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK}"
[[ -f "$ENV_FILE" ]] || { echo "BLOCKED: env_file_missing" >&2; exit 1; }

python3 - "$ENV_FILE" "$PUBLIC_ORIGIN" <<'PY'
from pathlib import Path
import re, sys
path, public = Path(sys.argv[1]), sys.argv[2]
text = path.read_text()
need = [
  'http://127.0.0.1:3081',
  'http://localhost:3081',
  'http://localhost:5173',
  public,
]
m = re.search(r'^CORS_ORIGINS=(.*)$', text, re.M)
if m:
  existing = [x.strip() for x in m.group(1).split(',') if x.strip()]
  merged = []
  for x in existing + need:
    if x not in merged:
      merged.append(x)
  text = re.sub(r'^CORS_ORIGINS=.*$', 'CORS_ORIGINS=' + ','.join(merged), text, count=1, flags=re.M)
else:
  merged = need
  text = text.rstrip() + '\nCORS_ORIGINS=' + ','.join(merged) + '\n'
path.write_text(text)
print('cors_origins_count=' + str(len(merged)))
print('cors_has_public=' + ('YES' if public in merged else 'NO'))
PY

export ERP_DOCKER_NETWORK
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --force-recreate erp-api

for i in 1 2 3 4 5 6 7 8; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3080/health 2>/dev/null || true)"
  echo "health_3080_poll_${i}=${code}"
  [[ "$code" == "200" ]] && break
  sleep 2
done

META_CORS="$(curl -sS -m 8 http://127.0.0.1:3080/api/v1/meta | python3 -c 'import json,sys; print(",".join((json.load(sys.stdin).get("config") or {}).get("corsOrigins") or []))' 2>/dev/null || true)"
echo "meta_cors=${META_CORS}"
case ",${META_CORS}," in
  *",${PUBLIC_ORIGIN},"*) echo 'meta_cors_public=YES' ;;
  *) echo 'BLOCKED: meta_cors_missing_public_origin' >&2; exit 4 ;;
esac

# Com Origin do browser: não pode ser 500 (antes era CORS_ORIGIN_DENIED → Internal server error)
PROBE="$(curl -sS -m 8 -X POST http://127.0.0.1:3080/api/v1/auth/session \
  -H 'Content-Type: application/json' \
  -H "Origin: ${PUBLIC_ORIGIN}" \
  -d '{"email":"probe@example.com","password":"senha-forte-123"}' \
  -w '|http=%{http_code}' || true)"
echo "probe_with_origin_len=${#PROBE}"
echo "probe_with_origin_tail=${PROBE: -80}"
if echo "$PROBE" | grep -q 'Internal server error'; then
  echo 'BLOCKED: still_internal_server_error_with_origin' >&2
  exit 5
fi
if echo "$PROBE" | grep -qE 'AUTH_INVALID_CREDENTIALS|AUTH_LOGIN_INVALID|AUTH_NO_ACTIVE_PROFILE|AUTH_UNAVAILABLE'; then
  echo 'probe_auth_error_expected=YES'
else
  echo 'WARN: unexpected probe body — check API logs'
fi

echo "CORS_ERP_DEV_FIX_OK"
echo "NEXT=hard_refresh_browser_e_tentar_login_de_novo"
echo "CORS_ERP_DEV_FIX_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
