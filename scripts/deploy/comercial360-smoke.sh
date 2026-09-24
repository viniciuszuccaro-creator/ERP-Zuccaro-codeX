#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3086}"
: "${EXPECTED_RUNTIME:?Set EXPECTED_RUNTIME to the reviewed runtime metadata}"
command -v curl >/dev/null
command -v node >/dev/null
health="$(curl --fail --silent "$BASE_URL/health")"
ready="$(curl --fail --silent "$BASE_URL/ready")"
meta="$(curl --fail --silent "$BASE_URL/api/v1/meta")"
if ! node -e "try { const m=JSON.parse(process.argv[1]); const e=m.httpEntities||[]; if(m.runtime===process.argv[2] && m.auth?.mode==='supabase_user' && ['Orcamento','Pedido'].every(x=>e.includes(x))) process.exit(0) } catch {} process.exit(1)" "$meta" "$EXPECTED_RUNTIME"; then
  echo 'BLOCKED: smoke runtime, verified Auth mode or commercial entities mismatch' >&2
  exit 1
fi
printf 'SMOKE_OK base=%s runtime=%s health=%s ready=%s\n' "$BASE_URL" "$EXPECTED_RUNTIME" "$health" "$ready"
echo 'Authenticated quotation/order mutation smoke remains a manual authorized gate with synthetic tenant headers.'