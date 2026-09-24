#!/usr/bin/env bash
# Congela snapshot sanitizado do GO/NO-GO (somente leitura local).
# Não acessa VPS. Não executa D/E/F.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE="${1:-$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt}"
OUT="${2:-$ROOT/docs/vps/evidence/go-nogo-snapshot-2026-09-24.txt}"

mkdir -p "$(dirname "$OUT")"
{
  echo "# Snapshot GO/NO-GO — frente Cursor VPS/HML (sanitizado)"
  echo "# Gerado localmente. Nao e autorizacao. Nao contem segredos."
  echo "# utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# head=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo
  bash "$ROOT/scripts/vps/go-nogo-def.sh" "$EVIDENCE"
  echo
  bash "$ROOT/scripts/vps/print-pedido-codex.sh" | grep -E 'pending_item=|codex_pending_count=|CODEX_PEDIDO_STATUS=|proposed_'
  echo
  echo 'AUTONOMOUS_PREP_STATUS=EXHAUSTED_WAITING_HUMAN_CODEX'
  echo 'EXECUTE_DEF=NO'
} >"$OUT"

echo "snapshot_written=${OUT#"$ROOT"/}"
grep -E 'GO_NOGO=|GATE_[EDF]_READY=|gate_[edf]_blockers=|blockers=|AUTONOMOUS_PREP_STATUS=' "$OUT"
exit 0
