#!/usr/bin/env bash
# Dry-run de rollback — SOMENTE LEITURA.
# - Modo arquivo: avalia linhas de rollback na saída do Gate C.
# - Modo docker: inspeciona containers se Docker estiver disponível (não stop/rename/start).
# Nunca define CONFIRM_ROLLBACK=YES. Nunca toca a 3080.
set -Eeuo pipefail

MODE='file'
IN=''
OFFICIAL="${OFFICIAL_CONTAINER:-erp-api-dev}"
ROLLBACK_HINT="${ROLLBACK_CONTAINER:-}"

usage() {
  cat <<'EOF'
Uso:
  rollback-dry-run-check.sh --from-gate-c-output FILE
  rollback-dry-run-check.sh --docker [--official NAME] [--rollback NAME]

Somente leitura. Exit 0 = artefatos aparentes; exit 1 = bloqueado.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-gate-c-output) MODE='file'; IN="$2"; shift 2 ;;
    --docker) MODE='docker'; shift ;;
    --official) OFFICIAL="$2"; shift 2 ;;
    --rollback) ROLLBACK_HINT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "BLOCKED: argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
done

echo "ROLLBACK_DRYRUN_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ) mode=$MODE"
blocked=0
warn=0

if [[ "$MODE" == 'file' ]]; then
  [[ -f "$IN" ]] || { echo "BLOCKED: arquivo ausente: $IN" >&2; exit 1; }
  if grep -Eiq 'rollback|runtime07b|07b' "$IN"; then
    echo 'PASS rollback_mentions_in_gate_c'
  else
    echo 'FAIL rollback_mentions_in_gate_c'
    blocked=1
  fi
  if grep -Eq 'official_image=.*runtime07b|official_image=.*07b|image=.*runtime07b' "$IN"; then
    echo 'PASS official_or_image_07b_referenced'
  else
    echo 'WARN official_07b_image_not_explicit'
    warn=1
  fi
  if grep -Eq 'CONFIRM_ROLLBACK=YES|docker stop|docker rename' "$IN"; then
    echo 'FAIL gate_c_output_looks_like_write_ops'
    blocked=1
  else
    echo 'PASS no_write_ops_in_gate_c_output'
  fi
fi

if [[ "$MODE" == 'docker' ]]; then
  if ! command -v docker >/dev/null; then
    echo 'BLOCKED: docker indisponivel neste ambiente'
    exit 1
  fi
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$OFFICIAL"; then
    docker inspect "$OFFICIAL" --format 'official={{.Name}} image={{.Config.Image}} status={{.State.Status}}'
    echo 'PASS official_container_inspectable'
  else
    echo "FAIL official_missing name=$OFFICIAL"
    blocked=1
  fi

  # Candidatos de rollback: nome explícito ou heurística
  candidates=()
  if [[ -n "$ROLLBACK_HINT" ]]; then
    candidates+=("$ROLLBACK_HINT")
  fi
  while IFS= read -r n; do
    candidates+=("$n")
  done < <(docker ps -a --format '{{.Names}}' | awk 'BEGIN{IGNORECASE=1} /rollback|07b|runtime07b|failed/ {print}')

  found=0
  for c in "${candidates[@]+"${candidates[@]}"}"; do
    [[ -z "$c" ]] && continue
    if docker ps -a --format '{{.Names}}' | grep -Fxq "$c"; then
      docker inspect "$c" --format 'rollback_candidate={{.Name}} image={{.Config.Image}} status={{.State.Status}}'
      found=1
    fi
  done
  if ((found > 0)); then
    echo 'PASS rollback_candidate_inspectable'
  else
    echo 'FAIL no_rollback_candidate'
    blocked=1
  fi
  echo 'NOTE: dry-run only; CONFIRM_ROLLBACK not set; 3080 not touched'
fi

echo "warn=$warn blocked=$blocked"
if ((blocked > 0)); then
  echo 'ROLLBACK_DRYRUN_BLOCKED'
  echo "ROLLBACK_DRYRUN_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi
echo 'ROLLBACK_DRYRUN_OK'
echo "ROLLBACK_DRYRUN_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
