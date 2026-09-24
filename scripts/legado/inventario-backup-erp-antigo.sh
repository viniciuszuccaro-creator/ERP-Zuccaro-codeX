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
python3 - <<'PY'
import hashlib, json, os, time
from collections import Counter
from pathlib import Path

backup = Path(os.environ["BACKUP_DIR"])
report = os.environ.get("REPORT") or ""
folder_name = os.environ.get("FOLDER_NAME") or "BACKUP ERP ANTIGO - CODEX"

def classify(path: Path):
    ext = path.suffix.lower().lstrip(".") or "sem_extensao"
    mapping = {
        "sql": "sql_texto",
        "gz": "arquivo_gzip",
        "zip": "arquivo_zip",
        "bak": "backup_nativo_possivel",
        "dump": "dump_binario_possivel",
        "dmp": "dump_binario_possivel",
        "mdf": "sqlserver_data_log",
        "ldf": "sqlserver_data_log",
        "csv": "planilha_texto",
        "tsv": "planilha_texto",
        "xlsx": "planilha_office",
        "xls": "planilha_office",
        "rar": "arquivo_compactado",
        "7z": "arquivo_compactado",
    }
    return ext, mapping.get(ext, f"ext_{ext}")

def safe_name(name: str) -> str:
    import re
    return re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+", "REDACTED_EMAIL", name)

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

files = sorted(p for p in backup.rglob("*") if p.is_file())
print(f"file_count={len(files)}")
ext_count = Counter()
fmt_count = Counter()
items = []
bytes_total = 0
for path in files:
    digest = sha256_file(path)
    size = path.stat().st_size
    bytes_total += size
    ext, fmt = classify(path)
    ext_count[ext] += 1
    fmt_count[fmt] += 1
    mtime = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(path.stat().st_mtime))
    name = safe_name(path.name)
    print(f"file name={name} bytes={size} sha256={digest} format={fmt} mtime_utc={mtime}")
    items.append({
        "name": name,
        "bytes": size,
        "sha256": digest,
        "format": fmt,
        "mtime_utc": mtime,
    })

print(f"bytes_total={bytes_total}")
print("--- EXTENSOES ---")
for k in sorted(ext_count):
    print(f"ext_{k}={ext_count[k]}")
print("--- FORMATOS ---")
for k in sorted(fmt_count):
    print(f"format_{k}={fmt_count[k]}")

if report:
    Path(report).parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "folder_name": folder_name,
        "file_count": len(files),
        "bytes_total": bytes_total,
        "files": items,
        "note": "Somente metadados. Sem conteudo. Nao commitar dumps.",
    }
    Path(report).write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print("report_written=YES")
PY

echo "LEGADO_INVENTARIO_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo 'NOTA: nao importar; Onda 25 exige staging e autorizacao.'
