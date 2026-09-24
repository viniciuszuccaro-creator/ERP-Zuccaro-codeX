#!/usr/bin/env bash
# Precheck Gates D–F — SOMENTE LEITURA / validação local.
# NÃO inicia canário, NÃO aplica migration, NÃO promove 3080, NÃO lê .env.
set -Eeuo pipefail

MODE='local'
APPLIED_FILE=''
CANDIDATE_DIR=''
CANDIDATE_LIST=''
EXPECT_MIN_APPLIED=15

usage() {
  cat <<'EOF'
Uso:
  gate-d-f-precheck.sh --local
      Valida presença dos scripts de deploy no checkout (sem Docker/VPS).

  gate-d-f-precheck.sh --from-gate-c-output FILE [--candidate-migrations DIR]
      [--candidate-list FILE]
      Lê saída sanitizada do Gate C (linhas id=count) e calcula migrations
      faltantes. DIR padrão: server/migrations. LIST: arquivo com nomes
      016_....sql (ex.: docs/vps/migrations-candidatas-comercial360.txt).
      Não aplica nada.

Saída: PRECHECK_OK ou PRECHECK_BLOCKED com motivos. Exit 0 só se OK/parcial
documentada sem bloqueio duro; exit 1 se bloqueado.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) MODE='local'; shift ;;
    --from-gate-c-output) MODE='from_gate_c'; APPLIED_FILE="$2"; shift 2 ;;
    --candidate-migrations) CANDIDATE_DIR="$2"; shift 2 ;;
    --candidate-list) CANDIDATE_LIST="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "BLOCKED: argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CANDIDATE_DIR="${CANDIDATE_DIR:-$ROOT/server/migrations}"

echo "GATE_DF_PRECHECK_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ) mode=$MODE"

blocked=0
warn=0

check_deploy_scripts() {
  local s
  for s in comercial360-canary.sh comercial360-smoke.sh comercial360-rollback.sh; do
    if [[ -f "$ROOT/scripts/deploy/$s" ]]; then
      echo "deploy_script_$s=PRESENT"
    else
      echo "deploy_script_$s=MISSING_NOTE: scripts vivem na PR #33 ate o merge"
      warn=1
    fi
  done
  if [[ -f "$ROOT/docs/COMERCIAL_360_V1_DEPLOY.md" ]]; then
    echo 'deploy_doc=PRESENT'
  else
    echo 'deploy_doc=MISSING_NOTE: documentacao canario na PR #33 / GATES_D_F_PREPARACAO_CANARIO.md'
    warn=1
  fi
  if [[ -f "$ROOT/docs/PACOTE_DECISAO_GATES_D_E_F.md" ]]; then
    echo 'cursor_df_doc=PRESENT'
    echo 'pacote_decisao=PRESENT'
  elif [[ -f "$ROOT/docs/GATES_D_F_PREPARACAO_CANARIO.md" ]]; then
    echo 'cursor_df_doc=PRESENT'
    echo 'pacote_decisao=LEGACY_GATES_D_F_DOC'
  else
    echo 'cursor_df_doc=MISSING'
    blocked=1
  fi
  if [[ -f "$ROOT/scripts/vps/gate-c-read-only.sh" ]]; then
    echo 'gate_c_script=PRESENT'
  else
    echo 'gate_c_script=MISSING'
    blocked=1
  fi
  if [[ -f "$ROOT/docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md" ]]; then
    echo 'contrato_cursor_codex=PRESENT'
  else
    echo 'contrato_cursor_codex=MISSING'
    warn=1
  fi
}

list_candidate_ids() {
  local f base id line
  if [[ -n "$CANDIDATE_LIST" ]]; then
    [[ -f "$CANDIDATE_LIST" ]] || { echo "BLOCKED: candidate-list ausente: $CANDIDATE_LIST" >&2; return 1; }
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      base="$(basename "$line")"
      id="${base%%_*}"
      id="${id%%.sql}"
      if [[ "$id" =~ ^[0-9]{3}$ ]]; then
        printf '%s\n' "$id"
      fi
    done <"$CANDIDATE_LIST" | sort -u
    return 0
  fi
  for f in "$CANDIDATE_DIR"/*.sql; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f")"
    id="${base%%_*}"
    if [[ "$id" =~ ^[0-9]{3}$ ]]; then
      printf '%s\n' "$id"
    fi
  done | sort -u
}

if [[ "$MODE" == 'local' ]]; then
  check_deploy_scripts
  candidates="$(list_candidate_ids | tr '\n' ',' | sed 's/,$//')"
  echo "candidate_migrations_in_checkout=$candidates"
  echo "note=sem saida Gate C; faltantes DEV desconhecidos neste modo"
  echo "hard_rules=nao_executar_canario;nao_aplicar_016plus;3080_preservada"
fi

if [[ "$MODE" == 'from_gate_c' ]]; then
  [[ -f "$APPLIED_FILE" ]] || { echo "BLOCKED: arquivo Gate C ausente: $APPLIED_FILE" >&2; exit 1; }
  check_deploy_scripts

  # Aceita linhas "001=1" ou "001_foundation.sql=1" → normaliza para 001
  mapfile -t applied_lines < <(grep -E '^[0-9]{3}' "$APPLIED_FILE" | sed -E 's/^([0-9]{3}).*/\1/' | sort -u)
  echo "applied_count=${#applied_lines[@]}"
  if ((${#applied_lines[@]} < EXPECT_MIN_APPLIED)); then
    echo "BLOCKED: aplicadas < $EXPECT_MIN_APPLIED — Gate C incompleto ou arquivo errado"
    blocked=1
  fi

  declare -A APPLIED
  for id in "${applied_lines[@]}"; do
    APPLIED["$id"]=1
  done

  # Duplicatas no bruto (id=N com N!=1), aceita sufixo _nome.sql
  while read -r line; do
    [[ "$line" =~ ^([0-9]{3})([_=].*)?=([0-9]+)$ ]] || continue
    id="${BASH_REMATCH[1]}"
    n="${BASH_REMATCH[3]}"
    if [[ "$n" != '1' ]]; then
      echo "BLOCKED: migration duplicada ou anomala ${id}=${n}"
      blocked=1
    fi
  done < <(grep -E '^[0-9]{3}([_=].*)?=[0-9]+$' "$APPLIED_FILE" || true)

  missing=()
  unexpected=()
  while read -r id; do
    if [[ -z "${APPLIED[$id]:-}" ]]; then
      # só reporta faltantes >=016 como candidatas de Gate E
      if ((10#$id >= 16)); then
        missing+=("$id")
      else
        echo "BLOCKED: migration historica ausente no DEV: $id"
        blocked=1
      fi
    fi
  done < <(list_candidate_ids)

  for id in "${!APPLIED[@]}"; do
    if ! list_candidate_ids | grep -Fxq "$id"; then
      unexpected+=("$id")
    fi
  done

  if ((${#missing[@]} > 0)); then
    echo "missing_for_gate_e=$(IFS=,; echo "${missing[*]}")"
    echo 'note=Gate E so apos Gate C APROVADO + backup novo + autorizacao; nao aplicar agora'
  else
    echo 'missing_for_gate_e=NONE'
  fi
  if ((${#unexpected[@]} > 0)); then
    echo "unexpected_on_dev=$(IFS=,; echo "${unexpected[*]}")"
    echo 'BLOCKED: migration no DEV ausente do checkout candidato — investigar'
    blocked=1
  fi

  if grep -q 'conexao_api_vs_supabase_db=MATCH' "$APPLIED_FILE"; then
    echo 'identity_match=YES'
  elif grep -q 'conexao_api_vs_supabase_db=' "$APPLIED_FILE"; then
    echo 'identity_match=NO'
    blocked=1
  else
    echo 'identity_match=UNKNOWN'
    warn=1
  fi

  if grep -q 'meta_auth_mode=dev_headers' "$APPLIED_FILE"; then
    echo 'official_auth_mode=dev_headers'
    echo 'note=dev_headers NAO homologa Auth supabase_user do canario'
  fi
  if grep -q 'meta_auth_mode=supabase_user' "$APPLIED_FILE"; then
    echo 'official_auth_mode=supabase_user'
  fi
fi

echo "warn=$warn blocked=$blocked"
if ((blocked > 0)); then
  echo 'PRECHECK_BLOCKED'
  echo "GATE_DF_PRECHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi
if ((warn > 0)); then
  echo 'PRECHECK_OK_WITH_WARNINGS'
else
  echo 'PRECHECK_OK'
fi
echo "GATE_DF_PRECHECK_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo 'NOTA: este script nao inicia canario nem aplica migration.'
