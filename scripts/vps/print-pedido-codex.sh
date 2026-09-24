#!/usr/bin/env bash
# Lista confirmações Codex ainda abertas no contrato Cursor↔Codex.
# Não edita PR #33. Não acessa VPS.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRATO="${1:-$ROOT/docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md}"

echo "CODEX_PEDIDO_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ -f "$CONTRATO" ]] || { echo 'CODEX_PEDIDO_STATUS=MISSING_CONTRATO'; exit 2; }

# Extrai apenas a seção 4 (até próximo ##)
section="$(awk '
  /^## 4\. Confirmações pedidas ao Codex/ {p=1; next}
  /^## / { if (p) exit }
  p { print }
' "$CONTRATO")"

pending=0
done=0
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ ^\-[[:space:]]\[[[:space:]]\] ]]; then
    pending=$((pending + 1))
    item="$(echo "$line" | sed 's/^- \[[[:space:]xX]*\][[:space:]]*//')"
    echo "pending_item=${item}"
  elif [[ "$line" =~ ^\-[[:space:]]\[[xX]\] ]]; then
    done=$((done + 1))
    item="$(echo "$line" | sed 's/^- \[[[:space:]xX]*\][[:space:]]*//')"
    echo "done_item=${item}"
  fi
done <<<"$section"

echo "codex_pending_count=${pending}"
echo "codex_done_count=${done}"
echo "codex_pr=33"
echo "proposed_EXPECTED_RUNTIME=ERP-RUNTIME-08B"
echo "proposed_auth_mode=supabase_user"
echo "proposed_gate_e_strategy=fatias_comercial_016_017_then_produto_018_024"

if (( pending > 0 )); then
  echo 'CODEX_PEDIDO_STATUS=WAITING_CODEX'
else
  echo 'CODEX_PEDIDO_STATUS=ALL_CHECKED_LOCAL'
fi
echo 'EXECUTE_DEF=NO'
echo "CODEX_PEDIDO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
