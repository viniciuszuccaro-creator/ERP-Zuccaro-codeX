#!/usr/bin/env bash
# Extrai linhas úteis da saída sanitizada do Gate C para o precheck D–F.
# Não acessa VPS. Não imprime segredos além do que já estiver no arquivo de entrada.
set -Eeuo pipefail

IN="${1:-}"
OUT="${2:-/dev/stdout}"
if [[ -z "$IN" || ! -f "$IN" ]]; then
  echo "Uso: extract-gate-c-migrations.sh SAIDA_GATE_C.txt [OUT.txt]" >&2
  exit 2
fi

{
  grep -E '^[0-9]{3}([_=].*)?=[0-9]+$' "$IN" || true
  grep -E '^conexao_api_vs_supabase_db=' "$IN" || true
  grep -E '^meta_auth_mode=|^meta_parse=|^meta_runtime=' "$IN" || true
  grep -E '^port_[0-9]+=|^official_image=|^db_networks=|^official_networks=' "$IN" || true
} >"$OUT"

if [[ "$OUT" != /dev/stdout ]]; then
  echo "extract_ok file=$OUT lines=$(wc -l <"$OUT" | tr -d ' ')"
fi
