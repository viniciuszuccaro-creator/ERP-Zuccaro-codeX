#!/usr/bin/env bash
# Avalia saída sanitizada do Gate C (somente leitura local).
# Não acessa VPS. Não aplica migration. Não inicia canário.
set -Eeuo pipefail

IN="${1:-}"
if [[ -z "$IN" || ! -f "$IN" ]]; then
  echo "Uso: score-gate-c.sh SAIDA_GATE_C.txt" >&2
  exit 2
fi

echo "GATE_C_SCORE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

pass=0
fail=0
warn=0
reasons=()

hit() { grep -Eq "$1" "$IN"; }

check_pass() {
  local label="$1" pattern="$2"
  if hit "$pattern"; then
    echo "PASS $label"
    pass=$((pass + 1))
  else
    echo "FAIL $label"
    fail=$((fail + 1))
    reasons+=("$label")
  fi
}

check_warn() {
  local label="$1" pattern="$2"
  if hit "$pattern"; then
    echo "PASS $label"
    pass=$((pass + 1))
  else
    echo "WARN $label"
    warn=$((warn + 1))
  fi
}

check_pass 'identity_match' 'conexao_api_vs_supabase_db=MATCH'
check_pass 'health_200' 'health_http=200'
check_pass 'ready_200' 'ready_http=200'
check_pass 'meta_runtime_present' 'meta_runtime='
check_pass 'official_image_present' 'official_image='

# Migrations 001-015 exatamente 1x
missing_hist=0
dup=0
for i in $(seq 1 15); do
  id="$(printf '%03d' "$i")"
  if ! hit "^${id}=1$|^${id}_.*=1$"; then
    # também aceita id=1 sem underscore
    if ! grep -Eq "^${id}=1$" "$IN"; then
      missing_hist=$((missing_hist + 1))
    fi
  fi
  if grep -Eq "^${id}=([2-9]|[1-9][0-9]+)$" "$IN"; then
    dup=$((dup + 1))
  fi
done
if ((missing_hist == 0)); then
  echo 'PASS migrations_001_015_once'
  pass=$((pass + 1))
else
  echo "FAIL migrations_001_015_once missing=$missing_hist"
  fail=$((fail + 1))
  reasons+=('migrations_001_015')
fi
if ((dup == 0)); then
  echo 'PASS no_duplicate_migrations'
  pass=$((pass + 1))
else
  echo "FAIL no_duplicate_migrations dups=$dup"
  fail=$((fail + 1))
  reasons+=('duplicate_migrations')
fi

# 016+ não devem aparecer como aplicadas no Gate C histórico atual (warn se aparecerem)
if grep -Eq '^01[6-9]=|^02[0-4]=' "$IN"; then
  echo 'WARN migrations_016_plus_present_on_dev'
  warn=$((warn + 1))
else
  echo 'PASS migrations_016_plus_absent_as_expected'
  pass=$((pass + 1))
fi

check_warn 'backup_metadata' 'backup path=|backups_dir=MISSING'
check_warn 'port_candidate' 'port_3086=|port_3090=|port_3091='
check_warn 'auth_containers' 'supabase-auth|name=.*auth'

if hit 'meta_auth_mode=dev_headers'; then
  echo 'NOTE official_auth=dev_headers (NAO homologa supabase_user)'
elif hit 'meta_auth_mode=supabase_user'; then
  echo 'NOTE official_auth=supabase_user'
else
  echo 'WARN meta_auth_mode_unknown'
  warn=$((warn + 1))
fi

echo "score_pass=$pass score_fail=$fail score_warn=$warn"

if ((fail > 0)); then
  echo "GATE_C_RESULT=BLOQUEADO"
  echo "reasons=$(IFS=,; echo "${reasons[*]}")"
  echo "GATE_C_SCORE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi

# Sem identidade + health/ready + migrations = não aprovado pleno se faltou backup?
# Critério APROVADO: zero fail; backup metadados presente (não MISSING); porta FREE em algum candidato
if hit 'backups_dir=MISSING' || ! hit 'backup path='; then
  echo 'GATE_C_RESULT=PARCIAL'
  echo 'reasons=backup_metadata_incomplete'
  echo "GATE_C_SCORE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

if ! hit 'port_3086=FREE' && ! hit 'port_3090=FREE' && ! hit 'port_3091=FREE'; then
  echo 'GATE_C_RESULT=PARCIAL'
  echo 'reasons=no_free_canary_port_in_snapshot'
  echo "GATE_C_SCORE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

echo 'GATE_C_RESULT=APROVADO'
echo 'note=Auth PR33 e restaurabilidade de backup continuam gates separados'
echo "GATE_C_SCORE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
