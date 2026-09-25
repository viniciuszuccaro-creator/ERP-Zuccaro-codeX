#!/usr/bin/env bash
# Gate F opção A — fase 1: build MAIN nova + canário 3086 (sem promover 3080).
# Exige merge do fix na main (SHA ≠ 2fc2fc80) e map Orçamento com descricao_snapshot.
# Mutação: rodar provision + gate-d-smoke-mutation-orc-ped.sh na mesma sessão (SYNTH_PASS).
#
# Uso (VPS, após merge PR #37):
#   CONFIRM_GATE_F_BUILD_RESMOKE=YES \
#   ERP_DOCKER_NETWORK=supabase_default \
#   bash scripts/vps/gate-f-option-a-build-canary.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONFIRM_GATE_F_BUILD_RESMOKE="${CONFIRM_GATE_F_BUILD_RESMOKE:-}"
FORBIDDEN_SHA8='2fc2fc80'
CANARY_NAME="${CANARY_NAME:-erp-api-comercial360-canary}"
CANARY_PORT="${CANARY_PORT:-3086}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-ERP-RUNTIME-08B}"
ERP_AUTH_MODE="${ERP_AUTH_MODE:-supabase_user}"

echo "GATE_F_BUILD_CANARY_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_PROMOTE=NO"
echo "opcao_digest=A"

[[ "$CONFIRM_GATE_F_BUILD_RESMOKE" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_GATE_F_BUILD_RESMOKE=YES' >&2
  exit 2
}

: "${ERP_DOCKER_NETWORK:?Set ERP_DOCKER_NETWORK}"

command -v docker >/dev/null
command -v git >/dev/null
[[ -d "$ROOT/server" ]] || { echo 'BLOCKED: server/ missing' >&2; exit 1; }

curl -sS -o /dev/null -w 'health_3080_before=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_before=000'

git fetch origin main
git checkout --detach origin/main
MERGE_SHA="$(git rev-parse HEAD)"
MERGE_SHA8="${MERGE_SHA:0:8}"
echo "merge_sha=${MERGE_SHA}"
echo "merge_sha8=${MERGE_SHA8}"

if [[ "$MERGE_SHA8" == "$FORBIDDEN_SHA8" ]]; then
  echo 'BLOCKED: main_still_2fc2fc80_without_orcamento_map_fix' >&2
  echo 'HINT=merge_PR_37_first' >&2
  exit 3
fi

# Prova mínima do fix no tree (sem imprimir código sensível)
if ! grep -q 'descricao_snapshot' "$ROOT/server/src/repositories/postgresOrcamentoRepository.ts"; then
  echo 'BLOCKED: orcamento_map_fix_missing_on_main' >&2
  exit 3
fi
echo 'orcamento_map_fix_present=YES'

IMAGE="erp-zuccaro-erp-api:comercial360-main-${MERGE_SHA8}"
echo "image_tag=${IMAGE}"

echo "docker_build_begin=${IMAGE}"
docker build -t "$IMAGE" "$ROOT/server"
IMAGE_ID="$(docker image inspect -f '{{.Id}}' "$IMAGE")"
echo "image_id_prefix=${IMAGE_ID:0:19}"
echo "docker_build_ok=YES"

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CANARY_NAME"; then
  echo "canary_rm_existing=${CANARY_NAME}"
  docker rm -f "$CANARY_NAME" >/dev/null
fi

export IMAGE CANARY_NAME CANARY_PORT EXPECTED_RUNTIME ERP_AUTH_MODE ERP_DOCKER_NETWORK
export ENV_FROM_CONTAINER="${ENV_FROM_CONTAINER:-erp-api-dev}"
bash "$ROOT/scripts/deploy/comercial360-canary.sh"

BASE_URL="http://127.0.0.1:${CANARY_PORT}" EXPECTED_RUNTIME="$EXPECTED_RUNTIME" \
  bash "$ROOT/scripts/deploy/comercial360-smoke.sh"

RUNNING_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CANARY_NAME" 2>/dev/null || true)"
curl -sS -o /dev/null -w 'health_3080_after=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080_after=000'

echo "PASTE_TO_GIT_BEGIN"
echo "merge_sha8=${MERGE_SHA8}"
echo "image_tag=${IMAGE}"
echo "image_id_prefix=${IMAGE_ID:0:19}"
echo "canary_running_image=${RUNNING_IMAGE}"
echo "canary_port=${CANARY_PORT}"
echo "forbidden_sha8_rejected=YES"
echo "orcamento_map_fix_present=YES"
echo "GATE_F_BUILD_CANARY=OK"
echo "AUTHORIZES_PROMOTE=NO"
echo "alter_3080=NOT_PERFORMED"
echo "NOTE=next_reprovision_auth_and_mutation_smoke"
echo "NOTE2=segredos_somente_cofre_local"
echo "PASTE_TO_GIT_END"

cat <<EOF
# Próximo (mesma sessão VPS — mutação; 3080 ainda intacta):
SYNTH_PASS="\$(openssl rand -base64 24)"
SYNTH_EMAIL='gate-d.synth@dev.synthetic.local'
SYNTH_EMAIL="\$SYNTH_EMAIL" SYNTH_PASS="\$SYNTH_PASS" \\
  bash scripts/vps/provision-gate-d-auth-synthetic.sh
SYNTH_EMAIL="\$SYNTH_EMAIL" SYNTH_PASS="\$SYNTH_PASS" \\
  bash scripts/vps/gate-d-smoke-mutation-orc-ped.sh
unset SYNTH_PASS
# Esperado: canary_image=...comercial360-main-${MERGE_SHA8} · ped_convert=201 · GATE_D_MUTATION_SMOKE=OK
# Só então promoção 3080 (CONFIRM_GATE_F_PROMOTE) — cartão F §4.
EOF

echo "GATE_F_BUILD_CANARY_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
