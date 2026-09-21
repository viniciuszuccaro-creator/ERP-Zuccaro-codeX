#!/usr/bin/env bash
set -Eeuo pipefail
: "${ROLLBACK_CONTAINER:?Set ROLLBACK_CONTAINER to the preserved approved runtime container}"
OFFICIAL_CONTAINER="${OFFICIAL_CONTAINER:-erp-api-dev}"
CONFIRM_ROLLBACK="${CONFIRM_ROLLBACK:-NO}"
if [[ "$CONFIRM_ROLLBACK" != "YES" ]]; then
  echo 'DRY-RUN only. Set CONFIRM_ROLLBACK=YES after human authorization.'
  docker inspect "$ROLLBACK_CONTAINER" --format 'rollback={{.Name}} image={{.Config.Image}} status={{.State.Status}}'
  docker inspect "$OFFICIAL_CONTAINER" --format 'official={{.Name}} image={{.Config.Image}} status={{.State.Status}}'
  exit 0
fi
docker inspect "$ROLLBACK_CONTAINER" >/dev/null
docker inspect "$OFFICIAL_CONTAINER" >/dev/null
stamp="$(date +%Y%m%d-%H%M%S)"
docker stop "$OFFICIAL_CONTAINER"
docker rename "$OFFICIAL_CONTAINER" "${OFFICIAL_CONTAINER}-failed-${stamp}"
docker rename "$ROLLBACK_CONTAINER" "$OFFICIAL_CONTAINER"
docker start "$OFFICIAL_CONTAINER"
for _ in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3080/health >/dev/null && curl --fail --silent http://127.0.0.1:3080/ready >/dev/null; then
    echo "ROLLBACK_OK container=$OFFICIAL_CONTAINER"
    exit 0
  fi
  sleep 2
done
echo 'BLOCKED: rollback container did not become ready; preserve both containers and inspect logs.' >&2
exit 1