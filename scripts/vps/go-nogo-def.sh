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
case "$termo" in
  SIGNED_CHECKLIST_OK) ;;
  FACTS_READY_WAITING_SIGNATURE) blockers+=('termo_waiting_signature') ;;
  *) blockers+=('termo_waiting_signature') ;;
esac

bk_out="$(bash "$ROOT/scripts/vps/check-backup-novo-gate-e.sh" "$EVIDENCE" \
  "$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt" || true)"
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

scan_out="$(bash "$ROOT/scripts/vps/scan-sanitized-artifacts.sh" || true)"
scan="$(echo "$scan_out" | sed -n 's/^SANITIZE_SCAN_STATUS=//p' | head -1)"
echo "sanitize=${scan:-UNKNOWN}"
[[ "$scan" == 'CLEAN' ]] || blockers+=('sanitize_leak_candidate')

pedido_out="$(bash "$ROOT/scripts/vps/print-pedido-codex.sh" || true)"
echo "$pedido_out" | grep -E 'codex_pending_count=|CODEX_PEDIDO_STATUS=|decided_gate_e_strategy=|image_digest_status=|auth_synthetic_status=|gates_def_executed='
pending_codex="$(echo "$pedido_out" | sed -n 's/^codex_pending_count=//p' | head -1)"
pedido_status="$(echo "$pedido_out" | sed -n 's/^CODEX_PEDIDO_STATUS=//p' | head -1)"
if [[ -n "$pending_codex" && "$pending_codex" != '0' ]]; then
  blockers+=('codex_confirmacoes_pendentes')
fi
# Pendências operacionais mesmo com §4 documentado
if echo "$pedido_out" | grep -q 'image_digest_status=PENDING_BUILD_AFTER_MERGE'; then
  blockers+=('image_digest_pending_post_merge')
fi
if echo "$pedido_out" | grep -q 'auth_synthetic_status=PENDING_AUTH_GATE'; then
  blockers+=('auth_synthetic_gate_pending')
fi

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
  echo 'AUTHORIZATION=NOT_GRANTED'
else
  echo 'blockers=NONE'
  echo 'GO_NOGO=YES_PENDING_HUMAN_FINAL'
  echo 'EXECUTE_DEF=NO'
  echo 'AUTHORIZATION=NOT_GRANTED'
  echo 'NOTE: YES_PENDING_HUMAN_FINAL nao autoriza migration/canario/promocao'
  echo 'NOTE: exige checkbox do gate no termo + assinatura + comando VPS explicito'
fi

echo "GO_NOGO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
