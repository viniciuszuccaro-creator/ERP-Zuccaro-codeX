#!/usr/bin/env bash
# Imprime o status do pacote D/E a partir da evidência Gate C versionada.
# Não acessa VPS. Não aplica migration. Não inicia canário.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE="${1:-$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt}"
LIST="$ROOT/docs/vps/migrations-candidatas-comercial360.txt"

echo "AUTH_PACKAGE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ -f "$EVIDENCE" ]] || { echo "BLOCKED: evidência Gate C ausente: $EVIDENCE" >&2; exit 1; }

score_out="$(bash "$ROOT/scripts/vps/score-gate-c.sh" "$EVIDENCE")"
echo "$score_out" | grep -E 'GATE_C_RESULT=|score_|PASS identity|WARN meta|NOTE official'
if ! echo "$score_out" | grep -q 'GATE_C_RESULT=APROVADO'; then
  echo 'PACKAGE_STATUS=BLOCKED_GATE_C'
  exit 1
fi

pre_out="$(bash "$ROOT/scripts/vps/gate-d-f-precheck.sh" --from-gate-c-output "$EVIDENCE" --candidate-list "$LIST" || true)"
echo "$pre_out" | grep -E 'missing_for_gate_e=|identity_match=|PRECHECK_'
rb_out="$(bash "$ROOT/scripts/vps/rollback-dry-run-check.sh" --from-gate-c-output "$EVIDENCE")"
echo "$rb_out" | grep -E 'ROLLBACK_DRYRUN_'

echo 'proposed_EXPECTED_RUNTIME=ERP-RUNTIME-08B'
echo 'proposed_ERP_DOCKER_NETWORK=supabase_default'
echo 'proposed_CANARY_PORT_CANDIDATES=3086,3090,3091'
echo 'blocked_until=codex_EXPECTED_RUNTIME+auth_supabase_user+human_auth+new_backup'
echo 'PACKAGE_STATUS=READY_FOR_HUMAN_DECISION'
echo 'NOTE: do not run canary or apply 016+'
echo "AUTH_PACKAGE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
