#!/usr/bin/env bash
# Avalia se a evidência Gate C já prova backup NOVO pré-Gate E.
# Não acessa VPS. Não restaura dump. Não imprime conteúdo SQL.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE="${1:-$ROOT/docs/vps/evidence/gate-c-2026-09-24.txt}"

echo "BACKUP_NOVO_CHECK_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ -f "$EVIDENCE" ]] || { echo 'BACKUP_NOVO_STATUS=MISSING_EVIDENCE'; exit 2; }

marker_yes=0
marker_no=0
paths=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^backup[[:space:]]+path= ]] || continue
  path="$(echo "$line" | sed -n 's/.*path=\([^ ]*\).*/\1/p')"
  paths+=("$path")
  if echo "$line" | grep -q 'dump_complete_marker=YES'; then
    marker_yes=$((marker_yes + 1))
  else
    marker_no=$((marker_no + 1))
  fi
done <"$EVIDENCE"

echo "backup_lines=${#paths[@]}"
echo "backup_marker_yes=${marker_yes}"
echo "backup_marker_no=${marker_no}"

# Heurística: backup "novo" pré-E deve carregar marcador no nome.
# Backups históricos do Gate C (pre-pr32 / pre-r08 / etc.) NÃO liberam Gate E.
fresh=0
for p in "${paths[@]:-}"; do
  base="$(basename "$p")"
  if echo "$base" | grep -qiE 'pre-gate-e|pre-e-|gate-e-|pre-def-|pre-gates-def'; then
    fresh=$((fresh + 1))
    echo "candidate_fresh_backup=${base}"
  fi
done
echo "fresh_named_backups=${fresh}"

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

echo 'BACKUP_NOVO_STATUS=NAMED_CANDIDATE_PRESENT'
echo 'NOTE: candidato nomeado encontrado na evidência — humano ainda deve confirmar bytes+SHA-256 na VPS'
echo "BACKUP_NOVO_CHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
