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
echo 'proposed_order=comercial_first_then_produto'
echo 'proposed_strategy=fatias_separadas_com_test_postgres_entre_fatias'
echo 'alt_strategy=016_024_juntas_se_codex_confirmar'
echo 'apply_source=main_pos_merge_only'
echo 'APPLY_NOW=NO'
echo 'GATE_E_PLAN_STATUS=PROPOSED_AWAITING_CODEX'
echo "GATE_E_FATIAS_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
