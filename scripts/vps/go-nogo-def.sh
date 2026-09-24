#!/usr/bin/env bash
# Agregador GO/NO-GO Gates D/E/F — local, somente leitura.
# Reporta GATE_E_READY / GATE_D_READY / GATE_F_READY separados.
# Digest pós-build e Auth sintético NÃO bloqueiam GATE_E_READY (evita circularidade).
# Nunca inicia canário, migration ou promoção. Nunca altera 3080.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE="${1:-$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt}"

echo "GO_NOGO_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

dedupe() {
  # Sem argumentos → NONE (evita GATE_*_READY=NO com blockers vazios)
  if (($# == 0)); then
    echo 'NONE'
    return 0
  fi
  local -a out=()
  local seen='|' b
  for b in "$@"; do
    [[ -n "$b" ]] || continue
    case "$seen" in
      *"|$b|"*) ;;
      *) out+=("$b"); seen="${seen}${b}|" ;;
    esac
  done
  if ((${#out[@]} == 0)); then
    echo 'NONE'
  else
    local IFS=','; echo "${out[*]}"
  fi
}

score_out="$(bash "$ROOT/scripts/vps/score-gate-c.sh" "$EVIDENCE" || true)"
gate_c="$(echo "$score_out" | sed -n 's/^GATE_C_RESULT=//p' | head -1)"
echo "gate_c=${gate_c:-UNKNOWN}"

termo_out="$(bash "$ROOT/scripts/vps/validate-termo-autorizacao.sh" || true)"
termo="$(echo "$termo_out" | sed -n 's/^TERMO_STATUS=//p' | head -1)"
echo "termo=${termo:-UNKNOWN}"

bk_out="$(bash "$ROOT/scripts/vps/check-backup-novo-gate-e.sh" "$EVIDENCE" \
  "$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt" || true)"
bk="$(echo "$bk_out" | sed -n 's/^BACKUP_NOVO_STATUS=//p' | head -1)"
echo "backup_novo=${bk:-UNKNOWN}"

rb_out="$(bash "$ROOT/scripts/vps/rollback-dry-run-check.sh" --from-gate-c-output "$EVIDENCE" || true)"
if echo "$rb_out" | grep -q 'ROLLBACK_DRYRUN_OK'; then
  echo 'rollback_dryrun=OK'
  rb_ok=1
else
  echo 'rollback_dryrun=BLOCKED'
  rb_ok=0
fi

fatias_out="$(bash "$ROOT/scripts/vps/print-gate-e-fatias.sh" || true)"
echo "$fatias_out" | grep -E 'missing_for_gate_e=|proposed_fatia_|proposed_strategy=|GATE_E_PLAN_STATUS='

scan_out="$(bash "$ROOT/scripts/vps/scan-sanitized-artifacts.sh" || true)"
scan="$(echo "$scan_out" | sed -n 's/^SANITIZE_SCAN_STATUS=//p' | head -1)"
echo "sanitize=${scan:-UNKNOWN}"

pedido_out="$(bash "$ROOT/scripts/vps/print-pedido-codex.sh" || true)"
echo "$pedido_out" | grep -E 'codex_pending_count=|CODEX_PEDIDO_STATUS=|decided_gate_e_strategy=|image_digest_status=|auth_synthetic_status=|gates_def_executed='
pending_codex="$(echo "$pedido_out" | sed -n 's/^codex_pending_count=//p' | head -1)"
digest_status="$(echo "$pedido_out" | sed -n 's/^image_digest_status=//p' | head -1)"
auth_status="$(echo "$pedido_out" | sed -n 's/^auth_synthetic_status=//p' | head -1)"

# restore ainda não testado (evidência pre-gate-e)
restore_tested=0
if grep -q 'restore_destructive=NOT_PERFORMED' \
  "$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt" 2>/dev/null; then
  echo 'backup_restore_isolated=NOT_PERFORMED'
else
  echo 'backup_restore_isolated=UNKNOWN'
fi

# --- Gate E blockers (sem digest/Auth sintético) ---
e_blockers=()
[[ "$gate_c" == 'APROVADO' ]] || e_blockers+=('gate_c_not_aprovado')
[[ "$bk" == 'NAMED_CANDIDATE_PRESENT' ]] || e_blockers+=('backup_novo_ausente')
(( rb_ok == 1 )) || e_blockers+=('rollback_dryrun_blocked')
[[ "$scan" == 'CLEAN' ]] || e_blockers+=('sanitize_leak_candidate')
if [[ -n "$pending_codex" && "$pending_codex" != '0' ]]; then
  e_blockers+=('codex_confirmacoes_pendentes')
fi
# Aviso, não bloqueio circular: restore isolado ainda não feito
echo 'gate_e_warn=backup_restore_isolated_not_performed'

# --- Gate D blockers (exige digest + Auth; E schema assumido pós-autorização humana) ---
d_blockers=()
[[ "$gate_c" == 'APROVADO' ]] || d_blockers+=('gate_c_not_aprovado')
[[ "$scan" == 'CLEAN' ]] || d_blockers+=('sanitize_leak_candidate')
if [[ -n "$pending_codex" && "$pending_codex" != '0' ]]; then
  d_blockers+=('codex_confirmacoes_pendentes')
fi
if [[ "$digest_status" == 'PENDING_BUILD_AFTER_MERGE' || -z "$digest_status" ]]; then
  d_blockers+=('image_digest_pending_post_merge')
fi
if [[ "$auth_status" == 'PENDING_AUTH_GATE' || -z "$auth_status" ]]; then
  d_blockers+=('auth_synthetic_gate_pending')
fi
# Schema 016+ ainda não aplicado nesta frente
d_blockers+=('gate_e_schema_not_applied_yet')

# --- Gate F blockers ---
f_blockers=()
[[ "$gate_c" == 'APROVADO' ]] || f_blockers+=('gate_c_not_aprovado')
(( rb_ok == 1 )) || f_blockers+=('rollback_dryrun_blocked')
if [[ "$digest_status" == 'PENDING_BUILD_AFTER_MERGE' || -z "$digest_status" ]]; then
  f_blockers+=('image_digest_pending_post_merge')
fi
f_blockers+=('gate_d_not_aprovado_yet')
f_blockers+=('3080_remains_r07b_until_f')

if ((${#e_blockers[@]})); then e_list="$(dedupe "${e_blockers[@]}")"; else e_list='NONE'; fi
if ((${#d_blockers[@]})); then d_list="$(dedupe "${d_blockers[@]}")"; else d_list='NONE'; fi
if ((${#f_blockers[@]})); then f_list="$(dedupe "${f_blockers[@]}")"; else f_list='NONE'; fi

if [[ "$e_list" == 'NONE' ]]; then
  echo 'GATE_E_READY=YES'
else
  echo "GATE_E_READY=NO"
fi
echo "gate_e_blockers=${e_list}"

if [[ "$d_list" == 'NONE' ]]; then
  echo 'GATE_D_READY=YES'
else
  echo 'GATE_D_READY=NO'
fi
echo "gate_d_blockers=${d_list}"

if [[ "$f_list" == 'NONE' ]]; then
  echo 'GATE_F_READY=YES'
else
  echo 'GATE_F_READY=NO'
fi
echo "gate_f_blockers=${f_list}"

# Agregado legado (não autoriza execução)
all_blockers=()
[[ "$termo" == 'SIGNED_CHECKLIST_OK' ]] || all_blockers+=('termo_waiting_signature')
if [[ "$e_list" != 'NONE' ]]; then
  all_blockers+=('gate_e_not_ready')
fi
if [[ "$d_list" != 'NONE' ]]; then
  all_blockers+=('gate_d_not_ready')
fi
if [[ "$f_list" != 'NONE' ]]; then
  all_blockers+=('gate_f_not_ready')
fi
if ((${#all_blockers[@]})); then agg="$(dedupe "${all_blockers[@]}")"; else agg='NONE'; fi
echo "blockers=${agg}"
echo 'GO_NOGO=NO'
echo 'EXECUTE_DEF=NO'
echo 'AUTHORIZATION=NOT_GRANTED'
echo 'NOTE: GATE_*_READY=YES nao autoriza execucao; exige checkbox+assinatura no termo'
echo 'NOTE: digest/Auth nao sao pre-requisitos de GATE_E_READY'
echo "GO_NOGO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
