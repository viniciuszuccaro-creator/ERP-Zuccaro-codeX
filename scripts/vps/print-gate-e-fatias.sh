#!/usr/bin/env bash
# Plano de fatias Gate E — SOMENTE LEITURA / local.
# Não aplica SQL. Não acessa VPS.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LIST="${1:-$ROOT/docs/vps/migrations-candidatas-comercial360.txt}"
EVIDENCE="${2:-$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt}"

echo "GATE_E_FATIAS_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ -f "$LIST" ]] || { echo 'BLOCKED: candidate-list ausente' >&2; exit 2; }

missing=''
if [[ -f "$EVIDENCE" ]]; then
  pre="$(bash "$ROOT/scripts/vps/gate-d-f-precheck.sh" --from-gate-c-output "$EVIDENCE" --candidate-list "$LIST" || true)"
  missing="$(echo "$pre" | sed -n 's/^missing_for_gate_e=//p' | head -1)"
fi
missing="${missing:-NONE}"
echo "missing_for_gate_e=${missing}"

# Fatias propostas (espelho documental PR #33; confirmação Codex obrigatória)
fatia_comercial='016,017'
fatia_produto='018,019,020,021,022,023,024'
echo "proposed_fatia_comercial=${fatia_comercial}"
echo "proposed_fatia_produto_dam_canais=${fatia_produto}"
echo 'proposed_order=comercial_then_produto_review_only'
echo 'proposed_strategy=016_024_single_invocation_main_order'
echo 'review_slices_only=YES'
echo 'NOTE: migrator atual aplica todos os pendentes numa invocacao; fatias nao sao duas execucoes'
echo 'alt_strategy=none_without_migrator_change'
echo 'apply_source=main_pos_merge_only'
echo 'APPLY_NOW=NO'
echo 'AUTHORIZES_GATES_DEF=NO'
GATE_E_EVIDENCE="${GATE_E_EVIDENCE:-$ROOT/docs/vps/evidence/gate-e-webconsole-2026-09-24.txt}"
if [[ -f "$GATE_E_EVIDENCE" ]] \
  && grep -qE '^GATE_E_STATUS=OK$' "$GATE_E_EVIDENCE" \
  && grep -qE '^GATE_E_MIGRATE_STATUS=OK$' "$GATE_E_EVIDENCE"; then
  echo 'GATE_E_PLAN_STATUS=EXECUTED_OK'
  echo 'NOTE: missing_for_gate_e acima espelha Gate C historico; schema DEV ja aplicado (evidencia Gate E)'
else
  echo 'GATE_E_PLAN_STATUS=PROPOSED_AWAITING_AUTHORIZATION'
fi
echo "GATE_E_FATIAS_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
