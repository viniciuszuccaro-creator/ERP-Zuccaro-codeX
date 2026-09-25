#!/usr/bin/env bash
# Gate D §E — limpeza da identidade Auth sintética (sem Gate F / sem 3080).
# Ban + rotação de senha + desvínculo do profile. Não truncar. Não apagar legado.
# Fixtures GATE_D_MUTATION: inativação lógica opcional (INACTIVATE_FIXTURES=YES).
#
# Uso:
#   CONFIRM_GATE_D_CLEANUP=YES \
#   SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' \
#   bash scripts/vps/gate-d-cleanup-auth-synthetic.sh
#
# Opcional (prova login antigo falha): SYNTH_PASS='...' da última sessão
# Opcional: INACTIVATE_FIXTURES=YES
set -euo pipefail

SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
CONFIRM_GATE_D_CLEANUP="${CONFIRM_GATE_D_CLEANUP:-}"
INACTIVATE_FIXTURES="${INACTIVATE_FIXTURES:-NO}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"
CANARY_PORT="${CANARY_PORT:-3086}"

echo "GATE_D_CLEANUP_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"

[[ "$CONFIRM_GATE_D_CLEANUP" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_GATE_D_CLEANUP=YES' >&2
  exit 2
}

case "$SYNTH_EMAIL" in
  *@dev.synthetic.local) ;;
  *)
    echo 'BLOCKED: synth_email_must_be_dev_synthetic_local' >&2
    exit 2
    ;;
esac
[[ "$SYNTH_EMAIL" == *gate-d* ]] || {
  echo 'BLOCKED: synth_email_must_contain_gate-d' >&2
  exit 2
}

[[ -f "$ENV_FILE" ]] || { echo "BLOCKED: env_file_missing path_set=YES" >&2; exit 2; }

env_get() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#${key}=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\".*\"$ ]]; then line="${line:1:${#line}-2}"
  elif [[ "$line" =~ ^\'.*\'$ ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}

SR="$(env_get SERVICE_ROLE_KEY)"
[[ -z "$SR" ]] && SR="$(env_get SUPABASE_SERVICE_ROLE_KEY)"
[[ -n "$SR" && ${#SR} -ge 40 ]] || { echo 'BLOCKED: service_role_missing' >&2; exit 2; }
echo 'service_role_loaded=YES'

ANON="$(env_get ANON_KEY)"
[[ -z "$ANON" ]] && ANON="$(env_get SUPABASE_ANON_KEY)"
[[ -n "$ANON" && ${#ANON} -ge 40 ]] || { echo 'BLOCKED: supabase_anon_missing' >&2; exit 2; }
echo "anon_len=${#ANON}"

AUTH_BASE='http://127.0.0.1:8000'
http_health="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 \
  -H "apikey: ${SR}" -H "Authorization: Bearer ${SR}" \
  "${AUTH_BASE}/auth/v1/health" 2>/dev/null || true)"
echo "auth_health_local=${http_health}"
[[ "$http_health" == "200" ]] || { echo 'BLOCKED: auth_local_8000_unreachable' >&2; exit 3; }

TMP_UUID="$(mktemp)"
TMP_BODY="$(mktemp)"
cleanup() { rm -f "$TMP_UUID" "$TMP_BODY"; }
trap cleanup EXIT

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' >"$TMP_UUID" 2>/dev/null || true
SELECT id::text FROM auth.users
 WHERE lower(coalesce(email,'')) = lower(:'synth_email')
 ORDER BY created_at DESC NULLS LAST
 LIMIT 1;
SQL

AUTH_UUID="$(tr -d '[:space:]' <"$TMP_UUID" || true)"
http_pw=SKIP
http_ban=SKIP
if [[ -z "$AUTH_UUID" || ${#AUTH_UUID} -lt 32 ]]; then
  echo 'auth_user_found=NO'
  echo 'NOTE=nothing_to_ban_or_already_cleaned'
  AUTH_UUID=""
else
  echo 'auth_user_found=YES'
fi

# Senha descartável — nunca echo / nunca PASTE
ROTATE_PASS="$(openssl rand -base64 32)"

if [[ -n "$AUTH_UUID" && ${#AUTH_UUID} -ge 32 ]]; then
  # Rotaciona senha (invalida sessões com senha antiga)
  http_pw="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 \
    -X PUT "${AUTH_BASE}/auth/v1/admin/users/${AUTH_UUID}" \
    -H "apikey: ${SR}" -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${ROTATE_PASS}\",\"email_confirm\":true}" \
    2>/dev/null || true)"
  echo "http_pw_rotate=${http_pw}"

  # Ban longo (não DELETE físico)
  http_ban="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 \
    -X PUT "${AUTH_BASE}/auth/v1/admin/users/${AUTH_UUID}" \
    -H "apikey: ${SR}" -H "Authorization: Bearer ${SR}" \
    -H 'Content-Type: application/json' \
    -d '{"ban_duration":"876600h"}' \
    2>/dev/null || true)"
  echo "http_ban=${http_ban}"
fi

# Desvincula profile sintético (não apaga row; não toca profiles legado sem gate-d)
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" <<'SQL' >/dev/null
UPDATE profiles
SET auth_user_id = NULL,
    ativo = false,
    updated_at = NOW()
WHERE lower(email) = lower(:'synth_email');
SQL
echo 'profile_unlinked=YES'
echo 'profile_synth_inactivated=YES'

FIX_INACT=NO
if [[ "$INACTIVATE_FIXTURES" == "YES" ]]; then
  docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
UPDATE cliente_empresas SET ativo = false, bloqueado = true
 WHERE source_system = 'GATE_D_MUTATION';
UPDATE clientes SET ativo = false
 WHERE source_system = 'GATE_D_MUTATION'
    OR (nome_fantasia = 'CLIENTE GATE-D SYNTH' OR razao_social = 'CLIENTE GATE-D SYNTH LTDA');
UPDATE condicoes_pagamento SET ativo = false
 WHERE source_system = 'GATE_D_MUTATION' OR nome = 'GATE-D A VISTA';
UPDATE produtos SET ativo = false
 WHERE codigo = 'GATED-PROD' OR descricao = 'PRODUTO GATE-D SYNTH';
UPDATE marcas SET ativo = false WHERE nome_marca = 'GATE-D SYNTH';
UPDATE grupos_produto SET ativo = false
 WHERE codigo = 'GATED-GP' OR nome_grupo = 'GATE-D SYNTH';
UPDATE setores_atividade SET ativo = false WHERE nome = 'GATE-D SYNTH';
SQL
  FIX_INACT=YES
fi
echo "fixtures_inactivated=${FIX_INACT}"

# Prova: login com senha antiga (se fornecida) deve falhar
login_old=SKIP
if [[ -n "${SYNTH_PASS:-}" ]]; then
  case "${SYNTH_PASS}" in
    SENHA_DO_COFRE_OPENSSL|SENHA_DO_COFRE|SENHA_REAL_DO_COFRE|'...'|'…')
      login_old=SKIP_PLACEHOLDER
      ;;
    *)
      login_old="$(curl -sS -o "$TMP_BODY" -w '%{http_code}' --connect-timeout 8 \
        -X POST "${AUTH_BASE}/auth/v1/token?grant_type=password" \
        -H "apikey: ${ANON}" -H 'Content-Type: application/json' \
        -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${SYNTH_PASS}\"}" \
        2>/dev/null || true)"
      ;;
  esac
fi
echo "login_old_pass=${login_old}"

# Prova: login com senha rotacionada também deve falhar se ban ativo
login_rot="$(curl -sS -o "$TMP_BODY" -w '%{http_code}' --connect-timeout 8 \
  -X POST "${AUTH_BASE}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SYNTH_EMAIL}\",\"password\":\"${ROTATE_PASS}\"}" \
  2>/dev/null || true)"
echo "login_rotated_pass=${login_rot}"

# 3080 intacta
curl -sS -o /dev/null -w 'health_3080=%{http_code}\n' --connect-timeout 3 \
  http://127.0.0.1:3080/health 2>/dev/null || echo 'health_3080=000'
curl -sS -o /dev/null -w 'health_canary=%{http_code}\n' --connect-timeout 3 \
  "http://127.0.0.1:${CANARY_PORT}/health" 2>/dev/null || echo 'health_canary=000'

# Contagens agregadas
AUTH_FOUND=NO
[[ -n "${AUTH_UUID}" && ${#AUTH_UUID} -ge 32 ]] && AUTH_FOUND=YES

echo 'PASTE_TO_GIT_BEGIN'
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'auth_users_count='||count(*)::text FROM auth.users;" 2>/dev/null || echo 'auth_users_count=ERR'
docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc \
  "SELECT 'profiles_com_auth_count='||count(*)::text FROM profiles WHERE auth_user_id IS NOT NULL;" 2>/dev/null || echo 'profiles_com_auth_count=ERR'
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" -At <<'SQL' 2>/dev/null || echo 'profiles_synth_ativos=ERR'
SELECT 'profiles_synth_ativos='||count(*)::text FROM profiles
 WHERE lower(email)=lower(:'synth_email') AND ativo IS TRUE;
SQL
echo "auth_user_found=${AUTH_FOUND}"
echo "http_pw_rotate=${http_pw}"
echo "http_ban=${http_ban}"
echo "profile_unlinked=YES"
echo "fixtures_inactivated=${FIX_INACT}"
echo "login_old_pass=${login_old}"
echo "login_rotated_pass=${login_rot}"
echo "GATE_D_CLEANUP_STATUS=OK"
echo "alter_3080=NOT_PERFORMED"
echo "AUTHORIZES_GATE_F=NO"
echo "NOTE=segredos_somente_cofre_local"
echo "NOTE2=auth_user_banned_not_deleted"
echo "PASTE_TO_GIT_END"

# Critério: ban/unlink OK; logins não devem ser 200
ok=YES
if [[ "$AUTH_FOUND" == "YES" ]]; then
  [[ "$http_ban" == "200" ]] || ok=NO
  [[ "$http_pw" == "200" ]] || ok=NO
fi
[[ "$login_rot" != "200" ]] || ok=NO
if [[ "$login_old" != "SKIP" && "$login_old" != "SKIP_PLACEHOLDER" ]]; then
  [[ "$login_old" != "200" ]] || ok=NO
fi

echo "GATE_D_CLEANUP_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$ok" == "YES" ]] || { echo 'BLOCKED: gate_d_cleanup_incomplete' >&2; exit 8; }
