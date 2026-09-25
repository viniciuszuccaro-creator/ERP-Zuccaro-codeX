#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3086}"
: "${EXPECTED_RUNTIME:?Set EXPECTED_RUNTIME to the reviewed runtime metadata}"
command -v curl >/dev/null

verify_smoke_meta() {
  local meta_json="$1"
  local expected="$2"
  if command -v node >/dev/null 2>&1; then
    node -e "try { const m=JSON.parse(process.argv[1]); const e=m.httpEntities||[]; if(m.runtime===process.argv[2] && m.auth?.mode==='supabase_user' && ['Orcamento','Pedido'].every(x=>e.includes(x))) process.exit(0) } catch {} process.exit(1)" \
      "$meta_json" "$expected"
    return $?
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys
m=json.loads(sys.argv[1]); auth=m.get("auth") or {}; ents=m.get("httpEntities") or []
ok = m.get("runtime")==sys.argv[2] and auth.get("mode")=="supabase_user" and all(x in ents for x in ("Orcamento","Pedido"))
sys.exit(0 if ok else 1)' "$meta_json" "$expected"
    return $?
  fi
  echo 'BLOCKED: need node or python3 to verify smoke /meta' >&2
  return 1
}

health="$(curl --fail --silent "$BASE_URL/health")"
ready="$(curl --fail --silent "$BASE_URL/ready")"
meta="$(curl --fail --silent "$BASE_URL/api/v1/meta")"
if ! verify_smoke_meta "$meta" "$EXPECTED_RUNTIME"; then
  echo 'BLOCKED: smoke runtime, verified Auth mode or commercial entities mismatch' >&2
  exit 1
fi
printf 'SMOKE_OK base=%s runtime=%s health=%s ready=%s\n' "$BASE_URL" "$EXPECTED_RUNTIME" "$health" "$ready"
echo 'Authenticated quotation/order mutation smoke remains a manual authorized gate with synthetic tenant headers.'
