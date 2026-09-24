#!/usr/bin/env bash
# Avalia se há backup NOVO pré-Gate E (evidência sanitizada).
# Não acessa VPS. Não restaura dump. Não imprime conteúdo SQL.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILES=("$@")
if ((${#FILES[@]} == 0)); then
  FILES=(
    "$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt"
    "$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt"
  )
fi

echo "BACKUP_NOVO_CHECK_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

marker_yes=0
marker_no=0
paths=()
fresh=0
fresh_with_full_sha=0

for EVIDENCE in "${FILES[@]}"; do
  [[ -f "$EVIDENCE" ]] || continue
  echo "evidence_file=${EVIDENCE#"$ROOT"/}"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^backup[[:space:]]+path= ]] || continue
    path="$(echo "$line" | sed -n 's/.*path=\([^ ]*\).*/\1/p')"
    paths+=("$path")
    if echo "$line" | grep -q 'dump_complete_marker=YES'; then
      marker_yes=$((marker_yes + 1))
    else
      marker_no=$((marker_no + 1))
    fi
    base="$(basename "$path")"
    if echo "$base" | grep -qiE 'pre-gate-e|pre-e-|gate-e-|pre-def-|pre-gates-def'; then
      fresh=$((fresh + 1))
      echo "candidate_fresh_backup=${base}"
      if echo "$line" | grep -qE 'sha256=[a-f0-9]{64}'; then
        fresh_with_full_sha=$((fresh_with_full_sha + 1))
      fi
    fi
  done <"$EVIDENCE"
done

echo "backup_lines=${#paths[@]}"
echo "backup_marker_yes=${marker_yes}"
echo "backup_marker_no=${marker_no}"
echo "fresh_named_backups=${fresh}"
echo "fresh_with_full_sha256=${fresh_with_full_sha}"

if ((${#paths[@]} == 0)); then
  echo 'BACKUP_NOVO_STATUS=MISSING_EVIDENCE'
  echo "BACKUP_NOVO_CHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

if (( marker_yes < 1 )); then
  echo 'BACKUP_NOVO_STATUS=NO_COMPLETE_MARKER'
  echo 'NOTE: criar backup novo com dump_complete_marker=YES antes do Gate E'
  echo "BACKUP_NOVO_CHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

if (( fresh < 1 )); then
  echo 'BACKUP_NOVO_STATUS=STALE_NEED_NEW'
  echo 'NOTE: evidência Gate C tem backups históricos; Gate E exige backup NOVO nomeado (ex. pre-gate-e-YYYYMMDD)'
  echo "BACKUP_NOVO_CHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

# Preferir evidência com SHA-256 completo + flags de integridade
meta_latest="$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt"
if [[ -f "$meta_latest" ]]; then
  meta_out="$(bash "$ROOT/scripts/vps/verify-pre-gate-e-backup-meta.sh" "$meta_latest" || true)"
  echo "$meta_out" | grep -E 'PRE_GATE_E_META_STATUS=|integrity_flags='
  if echo "$meta_out" | grep -q 'PRE_GATE_E_META_STATUS=OK'; then
    echo 'BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT'
    echo 'NOTE: metadados pre-gate-e OK — dump real permanece na VPS; humano confirma caminho'
    echo "BACKUP_NOVO_CHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    exit 0
  fi
fi

if (( fresh_with_full_sha >= 1 )); then
  echo 'BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT'
  echo 'NOTE: candidato nomeado com sha256 completo na evidencia'
  echo "BACKUP_NOVO_CHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

echo 'BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT'
echo 'NOTE: candidato nomeado encontrado — preferivel colar evidencia com sha256 completo + integrity_*'
echo "BACKUP_NOVO_CHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
