#!/usr/bin/env bash
# Agregador GO/NO-GO Gates D/E/F — local, somente leitura.
# Reporta GATE_E_READY / GATE_D_READY / GATE_F_READY separados.
# Digest pós-build e Auth sintético NÃO bloqueiam GATE_E_READY (evita circularidade),
# mas continuam obrigatórios para D/F.
# GATE_E_READY=YES exige comprovação dos pré-requisitos de E, inclusive 016–024 na main.
# READY ≠ AUTHORIZED ≠ EXECUTED.
# Nunca inicia canário, migration ou promoção. Nunca altera 3080.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE="${1:-$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt}"
MAIN_REF="${MAIN_REF:-origin/main}"
REQUIRED_MAIN_MIGRATIONS=(016 017 018 019 020 021 022 023 024)

echo "GO_NOGO_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

dedupe() {
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
missing_vps="$(echo "$fatias_out" | sed -n 's/^missing_for_gate_e=//p' | head -1)"

scan_out="$(bash "$ROOT/scripts/vps/scan-sanitized-artifacts.sh" || true)"
scan="$(echo "$scan_out" | sed -n 's/^SANITIZE_SCAN_STATUS=//p' | head -1)"
echo "sanitize=${scan:-UNKNOWN}"

pedido_out="$(bash "$ROOT/scripts/vps/print-pedido-codex.sh" || true)"
echo "$pedido_out" | grep -E 'codex_pending_count=|CODEX_PEDIDO_STATUS=|decided_gate_e_strategy=|image_digest_status=|auth_synthetic_status=|gates_def_executed='
pending_codex="$(echo "$pedido_out" | sed -n 's/^codex_pending_count=//p' | head -1)"
digest_status="$(echo "$pedido_out" | sed -n 's/^image_digest_status=//p' | head -1)"
auth_status="$(echo "$pedido_out" | sed -n 's/^auth_synthetic_status=//p' | head -1)"

if grep -q 'RESTORE_ISOLATED_DB_STATUS=OK' \
  "$ROOT/docs/vps/evidence/restore-isolated-db-pending.txt" 2>/dev/null \
  && grep -q 'dev_untouched=YES' \
  "$ROOT/docs/vps/evidence/restore-isolated-db-pending.txt" 2>/dev/null; then
  echo 'backup_restore_isolated=OK_ISOLATED_REAL_DUMP'
elif grep -q 'restore_destructive=NOT_PERFORMED' \
  "$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt" 2>/dev/null; then
  echo 'backup_restore_isolated=NOT_PERFORMED'
elif grep -q 'restore_isolated=VALIDATED_SYNTHETIC\|RESTORE_ISOLATED_STATUS=OK' \
  "$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt" \
  "$ROOT/docs/vps/evidence/restore-isolated-validation.txt" 2>/dev/null; then
  echo 'backup_restore_isolated=VALIDATED_SYNTHETIC'
else
  echo 'backup_restore_isolated=UNKNOWN'
fi

# --- 016–024 devem existir na main (fonte do Gate E) ---
# MAIN_MIGRATIONS_DIR: probe local (testes) sem precisar de ref remota.
main_missing=()
main_present=()
echo "main_ref=${MAIN_REF}"
if [[ -n "${MAIN_MIGRATIONS_DIR:-}" && -d "$MAIN_MIGRATIONS_DIR" ]]; then
  echo "main_migrations_probe=DIR:${MAIN_MIGRATIONS_DIR}"
  main_files="$(find "$MAIN_MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' 2>/dev/null || true)"
  for id in "${REQUIRED_MAIN_MIGRATIONS[@]}"; do
    if echo "$main_files" | grep -qE "^${id}_"; then
      main_present+=("$id")
    else
      main_missing+=("$id")
    fi
  done
elif git -C "$ROOT" rev-parse --verify "$MAIN_REF" >/dev/null 2>&1; then
  echo 'main_migrations_probe=GIT_REF'
  main_files="$(git -C "$ROOT" ls-tree -r --name-only "$MAIN_REF" -- server/migrations 2>/dev/null || true)"
  for id in "${REQUIRED_MAIN_MIGRATIONS[@]}"; do
    if echo "$main_files" | grep -qE "server/migrations/${id}_"; then
      main_present+=("$id")
    else
      main_missing+=("$id")
    fi
  done
else
  echo 'main_ref_status=UNAVAILABLE'
  echo 'main_migrations_probe=UNAVAILABLE'
  main_missing=("${REQUIRED_MAIN_MIGRATIONS[@]}")
fi
if ((${#main_missing[@]})); then
  echo "main_migrations_016_024=PENDING_ABSENT"
  echo "main_missing_migrations=$(IFS=','; echo "${main_missing[*]}")"
else
  echo 'main_migrations_016_024=PRESENT'
  echo 'main_missing_migrations=NONE'
fi
if ((${#main_present[@]})); then
  echo "main_present_migrations=$(IFS=','; echo "${main_present[*]}")"
else
  echo 'main_present_migrations=NONE'
fi

# Schema 016–024 no DEV: preferir evidência Gate E sanitizada (pós-apply).
# missing_for_gate_e do Gate C permanece histórico e não sobrescreve apply comprovado.
GATE_E_EVIDENCE="${GATE_E_EVIDENCE:-$ROOT/docs/vps/evidence/gate-e-webconsole-2026-09-24.txt}"
gate_e_applied=0
if [[ -f "$GATE_E_EVIDENCE" ]] \
  && grep -qE '^GATE_E_STATUS=OK$' "$GATE_E_EVIDENCE" \
  && grep -qE '^GATE_E_MIGRATE_STATUS=OK$' "$GATE_E_EVIDENCE"; then
  echo 'vps_missing_for_gate_e=NONE'
  echo 'vps_schema_016_024=APPLIED'
  echo 'gate_e_executed_evidence=OK'
  gate_e_applied=1
elif [[ -n "$missing_vps" && "$missing_vps" != 'NONE' ]]; then
  echo "vps_missing_for_gate_e=${missing_vps}"
  echo 'vps_schema_016_024=PENDING_NOT_APPLIED'
  echo 'gate_e_executed_evidence=NO'
else
  echo 'vps_missing_for_gate_e=NONE'
  echo 'vps_schema_016_024=APPLIED_OR_UNKNOWN'
  echo 'gate_e_executed_evidence=UNKNOWN'
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
if ((${#main_missing[@]})); then
  e_blockers+=('main_missing_migrations_016_024')
fi

# --- Gate D blockers ---
d_blockers=()
[[ "$gate_c" == 'APROVADO' ]] || d_blockers+=('gate_c_not_aprovado')
[[ "$scan" == 'CLEAN' ]] || d_blockers+=('sanitize_leak_candidate')
if [[ -n "$pending_codex" && "$pending_codex" != '0' ]]; then
  d_blockers+=('codex_confirmacoes_pendentes')
fi
if [[ "$digest_status" == 'PENDING_BUILD_AFTER_MERGE' || -z "$digest_status" ]]; then
  d_blockers+=('image_digest_pending_post_merge')
fi
# REGISTERED remove o blocker de digest; Auth sintético permanece.
if [[ "$auth_status" == 'PENDING_AUTH_GATE' || -z "$auth_status" ]]; then
  d_blockers+=('auth_synthetic_gate_pending')
fi
# AUTH_SYNTHETIC_STATUS=OK remove este blocker; termo Gate D ainda é humano.
if ((gate_e_applied != 1)); then
  d_blockers+=('gate_e_schema_not_applied_yet')
fi

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
  echo 'GATE_E_READY=NO'
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

# Triagem de decisão (nunca autoriza nem executa)
if [[ "$termo" == 'SIGNED_CHECKLIST_OK' ]]; then
  echo 'DECISION_STATE=AUTHORIZED_CHECKLIST'
elif [[ "$scan" == 'CLEAN' && "$gate_c" == 'APROVADO' ]]; then
  echo 'DECISION_STATE=READY_FOR_REVIEW'
else
  echo 'DECISION_STATE=BLOCKED_PACKAGE'
fi
echo 'AUTHORIZATION=NOT_GRANTED'
echo 'EXECUTED=NO'
echo 'EXECUTE_DEF=NO'

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
echo 'NOTE: GATE_*_READY=YES nao autoriza execucao; exige checkbox+assinatura no termo'
echo 'NOTE: READY_FOR_REVIEW != AUTHORIZED != EXECUTED'
echo 'NOTE: digest/Auth nao sao pre-requisitos de GATE_E_READY; 016-024 na main sao'
echo "GO_NOGO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
