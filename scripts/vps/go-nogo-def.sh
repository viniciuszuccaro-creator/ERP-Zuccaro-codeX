#!/usr/bin/env bash
# Agregador GO/NO-GO Gates D/E/F — local, somente leitura.
# Nunca inicia canário, migration ou promoção.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE="${1:-$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt}"

echo "GO_NOGO_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

blockers=()

score_out="$(bash "$ROOT/scripts/vps/score-gate-c.sh" "$EVIDENCE" || true)"
gate_c="$(echo "$score_out" | sed -n 's/^GATE_C_RESULT=//p' | head -1)"
echo "gate_c=${gate_c:-UNKNOWN}"
[[ "$gate_c" == 'APROVADO' ]] || blockers+=('gate_c_not_aprovado')

termo_out="$(bash "$ROOT/scripts/vps/validate-termo-autorizacao.sh" || true)"
termo="$(echo "$termo_out" | sed -n 's/^TERMO_STATUS=//p' | head -1)"
echo "termo=${termo:-UNKNOWN}"
[[ "$termo" == 'SIGNED_CHECKLIST_OK' ]] || blockers+=('termo_waiting_signature')

bk_out="$(bash "$ROOT/scripts/vps/check-backup-novo-gate-e.sh" "$EVIDENCE" || true)"
bk="$(echo "$bk_out" | sed -n 's/^BACKUP_NOVO_STATUS=//p' | head -1)"
echo "backup_novo=${bk:-UNKNOWN}"
[[ "$bk" == 'NAMED_CANDIDATE_PRESENT' ]] || blockers+=('backup_novo_ausente')

rb_out="$(bash "$ROOT/scripts/vps/rollback-dry-run-check.sh" --from-gate-c-output "$EVIDENCE" || true)"
if echo "$rb_out" | grep -q 'ROLLBACK_DRYRUN_OK'; then
  echo 'rollback_dryrun=OK'
else
  echo 'rollback_dryrun=BLOCKED'
  blockers+=('rollback_dryrun_blocked')
fi

fatias_out="$(bash "$ROOT/scripts/vps/print-gate-e-fatias.sh" || true)"
echo "$fatias_out" | grep -E 'missing_for_gate_e=|proposed_fatia_|GATE_E_PLAN_STATUS='
# Codex ainda não confirmou EXPECTED_RUNTIME / fatias / supabase_user neste pacote
blockers+=('codex_expected_runtime_pending')
blockers+=('auth_supabase_user_pending')

# Dedupe preservando ordem
deduped=()
seen='|'
for b in "${blockers[@]}"; do
  case "$seen" in
    *"|$b|"*) ;;
    *) deduped+=("$b"); seen="${seen}${b}|" ;;
  esac
done

if ((${#deduped[@]} > 0)); then
  IFS=','; echo "blockers=${deduped[*]}"; unset IFS
  echo 'GO_NOGO=NO'
  echo 'EXECUTE_DEF=NO'
else
  echo 'blockers=NONE'
  echo 'GO_NOGO=YES_PENDING_HUMAN_FINAL'
  echo 'EXECUTE_DEF=NO'
  echo 'NOTE: checklist local limpo — execução ainda exige autorização humana na VPS'
fi

echo "GO_NOGO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
