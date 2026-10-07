#!/usr/bin/env bash
# CODEX LEGADO — executor mínimo no PC do proprietário (tem o HD).
# NÃO re-exporta. NÃO pede CADESP. NÃO imprime payload/PII.
# Uso (PowerShell/Git Bash/WSL no PC com D:\BACKUP...):
#   bash scripts/legado/executar-verifier-host-local.sh
# ou:
#   bash scripts/legado/executar-verifier-host-local.sh --reports-dir "/mnt/d/BACKUP ERP ANTIGO - CODEX/04_REPORTS"
set -euo pipefail

EXPECTED_SHA="${EXPECTED_SHA:-18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e}"
LEAF="${EXPORT_LEAF:-legado-empresas-api-20261006T153440Z.json}"
REPORTS_DIR=""
ROOTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reports-dir) REPORTS_DIR="$2"; shift 2 ;;
    --root) ROOTS+=("$2"); shift 2 ;;
    *) echo "BLOCKED=LEGACY_HOST_UNKNOWN_ARG arg=$1"; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERIFIER="$REPO_ROOT/scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs"

if [[ ! -f "$VERIFIER" ]]; then
  echo "BLOCKED=LEGACY_VERIFIER_MISSING"
  exit 3
fi

candidates=()
if [[ -n "$REPORTS_DIR" ]]; then
  candidates+=("$REPORTS_DIR")
fi
for r in \
  "/mnt/d/BACKUP ERP ANTIGO - CODEX/04_REPORTS" \
  "/mnt/c/BACKUP ERP ANTIGO - CODEX/04_REPORTS" \
  "/mnt/e/BACKUP ERP ANTIGO - CODEX/04_REPORTS" \
  "/mnt/f/BACKUP ERP ANTIGO - CODEX/04_REPORTS" \
  "D:/BACKUP ERP ANTIGO - CODEX/04_REPORTS" \
  "E:/BACKUP ERP ANTIGO - CODEX/04_REPORTS" \
  "C:/BACKUP ERP ANTIGO - CODEX/04_REPORTS"; do
  candidates+=("$r")
done
for r in "${ROOTS[@]}"; do
  candidates+=("${r%/}/BACKUP ERP ANTIGO - CODEX/04_REPORTS")
  candidates+=("${r%/}/04_REPORTS")
done

FOUND_REPORTS=""
for d in "${candidates[@]}"; do
  if [[ -d "$d" ]]; then FOUND_REPORTS="$d"; break; fi
done

if [[ -z "$FOUND_REPORTS" ]]; then
  echo "PASTE_TO_GIT_BEGIN"
  echo "executor=host_local"
  echo "executed=false"
  echo "BLOCKED=LEGACY_HOST_REPORTS_DIR_NOT_FOUND"
  echo "HUMAN=informe --reports-dir apontando para 04_REPORTS no HD"
  echo "PASTE_TO_GIT_END"
  exit 4
fi

EXPORT_PATH="$FOUND_REPORTS/$LEAF"
if [[ ! -f "$EXPORT_PATH" ]]; then
  # aceitar cópia com sufixo único (não sobrescrita)
  ALT=$(ls -1 "$FOUND_REPORTS"/"${LEAF%.json}"*.json 2>/dev/null | head -1 || true)
  if [[ -n "${ALT:-}" && -f "$ALT" ]]; then
    EXPORT_PATH="$ALT"
  else
    echo "PASTE_TO_GIT_BEGIN"
    echo "executor=host_local"
    echo "executed=false"
    echo "BLOCKED=LEGACY_HOST_EXPORT_FILE_ABSENT"
    echo "reports_leaf=$(basename "$FOUND_REPORTS")"
    echo "PASTE_TO_GIT_END"
    exit 5
  fi
fi

LOCAL_SHA="$(sha256sum "$EXPORT_PATH" 2>/dev/null | awk '{print $1}')"
if [[ -z "$LOCAL_SHA" ]]; then
  LOCAL_SHA="$(shasum -a 256 "$EXPORT_PATH" | awk '{print $1}')"
fi

echo "PASTE_TO_GIT_HOST_BEGIN"
echo "executor=host_local"
echo "export_leaf=$(basename "$EXPORT_PATH")"
echo "reports_leaf=$(basename "$(dirname "$FOUND_REPORTS")")/$(basename "$FOUND_REPORTS")"
echo "local_sha256=$LOCAL_SHA"
echo "expected_sha256=$EXPECTED_SHA"
if [[ "$LOCAL_SHA" == "$EXPECTED_SHA" ]]; then
  echo "sameFileAsPaste=true"
else
  echo "sameFileAsPaste=false"
fi
echo "PASTE_TO_GIT_HOST_END"

# Verifier (sanitizado; não imprime IDs/CNPJ)
node "$VERIFIER" \
  --export "$EXPORT_PATH" \
  --expected-sha256 "$EXPECTED_SHA" \
  --reports-dir "$FOUND_REPORTS"
