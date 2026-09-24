#!/usr/bin/env bash
# Valida metadados sanitizados de backup pre-gate-e (arquivo de evidência).
# Não lê o dump real. Não restaura. Não acessa VPS.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
META="${1:-$ROOT/docs/vps/evidence/pre-gate-e-backup-latest.txt}"

echo "PRE_GATE_E_META_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "meta_path=${META#"$ROOT"/}"

if [[ ! -f "$META" ]]; then
  echo 'PRE_GATE_E_META_STATUS=MISSING'
  echo 'NOTE: rode create-pre-gate-e-backup.sh na VPS e cole o bloco PASTE_TO_GIT'
  echo "PRE_GATE_E_META_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

# Bloquear conteúdo de dump acidentalmente colado
if grep -qE '^--|^CREATE TABLE|^COPY |^INSERT INTO ' "$META" 2>/dev/null; then
  echo 'PRE_GATE_E_META_STATUS=BLOCKED_LOOKS_LIKE_DUMP'
  echo 'NOTE: evidencia deve ser so metadados; dump real fica na VPS' >&2
  exit 1
fi

line="$(grep -E '^backup path=pre-gate-e-' "$META" | head -1 || true)"
if [[ -z "$line" ]]; then
  echo 'PRE_GATE_E_META_STATUS=NO_PRE_GATE_E_LINE'
  exit 0
fi

echo "found_line=${line}"

bytes="$(echo "$line" | sed -n 's/.*bytes=\([0-9][0-9]*\).*/\1/p')"
sha="$(echo "$line" | sed -n 's/.*sha256=\([a-f0-9]\{64\}\).*/\1/p')"
marker="$(echo "$line" | sed -n 's/.*dump_complete_marker=\([A-Z]*\).*/\1/p')"

echo "parsed_bytes=${bytes:-MISSING}"
echo "parsed_sha256_prefix=${sha:0:12}"
echo "parsed_marker=${marker:-MISSING}"

ok=1
[[ -n "$bytes" && "$bytes" -ge 1000 ]] || ok=0
[[ -n "$sha" && ${#sha} -eq 64 ]] || ok=0
[[ "$marker" == YES ]] || ok=0

if grep -q 'integrity_sha256_recompute_match=YES' "$META" \
  && grep -q 'integrity_tail_complete=YES' "$META" \
  && grep -q 'restore_destructive=NOT_PERFORMED' "$META"; then
  echo 'integrity_flags=YES'
else
  echo 'integrity_flags=INCOMPLETE'
  ok=0
fi

if grep -q 'integrity_file_mode_600=YES' "$META"; then
  echo 'integrity_file_mode_600=YES'
elif grep -q 'AUTHORIZES_GATES_DEF=NO' "$META"; then
  # modo 600 pode estar só no log VPS; não falhar metadados antigos sem a flag
  echo 'integrity_file_mode_600=NOT_IN_META'
else
  echo 'integrity_file_mode_600=NOT_IN_META'
fi

if grep -q 'AUTHORIZES_GATES_DEF=NO' "$META" || grep -q 'EXECUTE_DEF=NO' "$META" || true; then
  echo 'AUTHORIZES_GATES_DEF=NO'
fi

if (( ok == 1 )); then
  echo 'PRE_GATE_E_META_STATUS=OK'
else
  echo 'PRE_GATE_E_META_STATUS=INCOMPLETE'
fi
echo "PRE_GATE_E_META_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
