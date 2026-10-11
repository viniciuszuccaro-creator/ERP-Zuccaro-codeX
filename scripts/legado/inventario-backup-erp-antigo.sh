#!/usr/bin/env bash
# Inventário SOMENTE LEITURA do backup do ERP antigo.
# Não altera a origem. Não imprime conteúdo de arquivos. Não copia dados para o repo.
set -Eeuo pipefail

FOLDER_NAME="${FOLDER_NAME:-BACKUP ERP ANTIGO - CODEX}"
REPORT=""
ROOTS=()

usage() {
  cat <<'EOF'
Uso: inventario-backup-erp-antigo.sh [--root DIR]... [--folder NOME] [--report FILE]
  --root DIR     ponto de montagem extra para procurar a pasta
  --folder NOME  nome da pasta (padrão: BACKUP ERP ANTIGO - CODEX)
  --report FILE  grava JSON sanitizado (agregados + hashes; sem conteúdo)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOTS+=("$2"); shift 2 ;;
    --folder) FOLDER_NAME="$2"; shift 2 ;;
    --report) REPORT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "BLOCKED: argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
done

DEFAULT_ROOTS=(
  /mnt
  /media
  /run/media
  /Volumes
  /mnt/d /mnt/e /mnt/f /mnt/g /mnt/h
  /mnt/host/d /mnt/host/e /mnt/host/f
)

ROOTS_EFFECTIVE=()
for r in "${DEFAULT_ROOTS[@]}"; do
  [[ -d "$r" ]] || continue
  ROOTS_EFFECTIVE+=("$r")
done
if ((${#ROOTS[@]} > 0)); then
  for r in "${ROOTS[@]}"; do
    [[ -d "$r" ]] || continue
    ROOTS_EFFECTIVE+=("$r")
  done
fi

find_backup_dir() {
  local root candidate
  for root in "${ROOTS_EFFECTIVE[@]}"; do
    candidate="${root}/${FOLDER_NAME}"
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    while IFS= read -r -d '' candidate; do
      printf '%s\n' "$candidate"
      return 0
    done < <(find "$root" -mindepth 2 -maxdepth 3 -type d -name "$FOLDER_NAME" -print0 2>/dev/null || true)
  done
  return 1
}

echo "LEGADO_INVENTARIO_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "folder_name=${FOLDER_NAME}"
echo "roots_scanned=${#ROOTS_EFFECTIVE[@]}"

BACKUP_DIR=""
if BACKUP_DIR="$(find_backup_dir)"; then
  echo "backup_dir_found=YES"
  parent="$(basename "$(dirname "$BACKUP_DIR")")"
  leaf="$(basename "$BACKUP_DIR")"
  echo "backup_leaf=${parent}/${leaf}"
else
  echo "backup_dir_found=NO"
  echo 'BLOCKED: pasta do backup nao encontrada nos roots. Monte o HD e/ou passe --root.'
  echo "LEGADO_INVENTARIO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi

export BACKUP_DIR REPORT FOLDER_NAME
node "$(dirname "${BASH_SOURCE[0]}")/inventario-backup-erp-antigo.mjs"
echo "LEGADO_INVENTARIO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo 'NOTA: nao importar; Onda 25 exige staging e autorizacao.'
