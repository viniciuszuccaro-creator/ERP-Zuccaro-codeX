#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3086}"
: "${EXPECTED_RUNTIME:?Set EXPECTED_RUNTIME to the reviewed runtime metadata}"
command -v curl >/dev/null
command -v node >/dev/null
health="$(curl --fail --silent "$BASE_URL/health")"
ready="$(curl --fail --silent "$BASE_URL/ready")"
meta="$(curl --fail --silent "$BASE_URL/api/v1/meta")"
node -e "const m=JSON.parse(process.argv[1]); if(m.runtime!==process.argv[2]) process.exit(1); const e=m.httpEntities||[]; for(const x of ['Orcamento','Pedido']) if(!e.includes(x)) process.exit(1)" "$meta" "$EXPECTED_RUNTIME"
printf 'SMOKE_OK base=%s runtime=%s health=%s ready=%s\n' "$BASE_URL" "$EXPECTED_RUNTIME" "$health" "$ready"
echo 'Authenticated quotation/order mutation smoke remains a manual authorized gate with synthetic tenant headers.'