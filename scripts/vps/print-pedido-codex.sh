#!/usr/bin/env bash
# Lista confirmações Codex no contrato Cursor↔Codex (§4).
# Não edita PR #33. Não acessa VPS. Não autoriza D/E/F.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRATO="${1:-$ROOT/docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md}"

echo "CODEX_PEDIDO_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ -f "$CONTRATO" ]] || { echo 'CODEX_PEDIDO_STATUS=MISSING_CONTRATO'; exit 2; }

# Extrai apenas a seção 4 (até próximo ## de mesmo nível ou EOF)
section="$(awk '
  /^## 4\./ {p=1; next}
  /^## [0-9]/ { if (p) exit }
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
echo "decided_EXPECTED_RUNTIME=ERP-RUNTIME-08B"
echo "decided_auth_mode_criterion=supabase_user"
# Migrator atual: uma invocação aplica todos os pendentes; fatias = revisão.
echo "decided_gate_e_strategy=016_024_single_invocation_main_order"
echo "review_slices=016_017,018_024"
echo "image_digest_status=PENDING_BUILD_AFTER_MERGE"
echo "auth_synthetic_status=PENDING_AUTH_GATE"
echo "gates_def_executed=NO"
echo "EXECUTE_DEF=NO"
echo "AUTHORIZES_GATES_DEF=NO"

if (( pending > 0 )); then
  echo 'CODEX_PEDIDO_STATUS=WAITING_CODEX'
elif (( done >= 5 )); then
  echo 'CODEX_PEDIDO_STATUS=DECISIONS_DOCUMENTED'
  echo 'NOTE: decisoes §4 documentadas; digest/Auth/gates D-E-F ainda operacionais pendentes'
else
  echo 'CODEX_PEDIDO_STATUS=INCOMPLETE_SECTION'
fi
echo "CODEX_PEDIDO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
