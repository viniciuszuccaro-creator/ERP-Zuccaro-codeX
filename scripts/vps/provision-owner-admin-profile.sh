#!/usr/bin/env bash
# Vincula a conta real do proprietário a um perfil admin ERP (único) e demove o synth.
# Fail-closed: Auth única, perfil único, grupo/empresa explícitos e conferidos
# ANTES de qualquer UPDATE; backup de profiles; owner + demote synth na MESMA TX;
# permissões explícitas por módulo (SEM wildcard *); aborta se contagens ≠ esperadas.
# Não imprime UUID completo, senha, token ou e-mail completo.
# NÃO executar automaticamente — só na Web Console com confirmação humana.
#
# Uso (Web Console VPS):
#   CONFIRM_OWNER_ADMIN_PROFILE=YES \
#     OWNER_EMAIL='vinicius.zuccaro@gmail.com' \
#     OWNER_GROUP_ID='<uuid-grupo>' \
#     OWNER_EMPRESA_ID='<uuid-empresa>' \
#     SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' \
#     DEMOTE_SYNTH=YES \
#     bash scripts/vps/provision-owner-admin-profile.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIRM_OWNER_ADMIN_PROFILE="${CONFIRM_OWNER_ADMIN_PROFILE:-}"
OWNER_EMAIL="${OWNER_EMAIL:-vinicius.zuccaro@gmail.com}"
SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
DEMOTE_SYNTH="${DEMOTE_SYNTH:-YES}"
OWNER_FULL_NAME="${OWNER_FULL_NAME:-Vinicius Zuccaro}"
OWNER_GROUP_ID="${OWNER_GROUP_ID:-}"
OWNER_EMPRESA_ID="${OWNER_EMPRESA_ID:-}"
EXPECTED_OWNER_ADMIN="${EXPECTED_OWNER_ADMIN:-1}"
EXPECTED_SYNTH_ADMIN="${EXPECTED_SYNTH_ADMIN:-0}"
OWNER_PERMS_FILE="${OWNER_PERMS_FILE:-$ROOT/scripts/vps/owner-admin-permissoes.json}"
OWNER_PROV_BACKUP_DIR="${OWNER_PROV_BACKUP_DIR:-$ROOT/backups/owner-provision}"

UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'

echo "OWNER_ADMIN_PROVISION_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$CONFIRM_OWNER_ADMIN_PROFILE" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_OWNER_ADMIN_PROFILE=YES' >&2
  exit 2
}

OWNER_DOMAIN="${OWNER_EMAIL#*@}"
OWNER_LOCAL_LEN=$(( ${#OWNER_EMAIL} - ${#OWNER_DOMAIN} - 1 ))
echo "owner_email_domain=${OWNER_DOMAIN}"
echo "owner_email_local_len=${OWNER_LOCAL_LEN}"
echo "demote_synth=${DEMOTE_SYNTH}"
echo "expected_owner_admin=${EXPECTED_OWNER_ADMIN}"
echo "expected_synth_admin=${EXPECTED_SYNTH_ADMIN}"

[[ -f "$OWNER_PERMS_FILE" ]] || {
  echo "BLOCKED: owner_perms_file_missing" >&2
  exit 2
}

python3 - "$OWNER_PERMS_FILE" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    data = json.load(f)
if not isinstance(data, dict):
    raise SystemExit('BLOCKED: owner_perms_not_object')
if '*' in data:
    raise SystemExit('BLOCKED: owner_perms_has_wildcard')
for mod in ('Cadastros', 'Comercial', 'Sistema'):
    if mod not in data or not isinstance(data[mod], dict) or not data[mod]:
        raise SystemExit(f'BLOCKED: owner_perms_missing_module_{mod}')
print('owner_perms_modules=' + ','.join(sorted(data.keys())))
print('owner_perms_wildcard=NO')
PY

if [[ -z "$OWNER_GROUP_ID" || -z "$OWNER_EMPRESA_ID" ]]; then
  echo 'BLOCKED: set OWNER_GROUP_ID and OWNER_EMPRESA_ID (explícitos) before any write' >&2
  exit 2
fi
[[ "$OWNER_GROUP_ID" =~ $UUID_RE ]] || {
  echo 'BLOCKED: OWNER_GROUP_ID_invalid_uuid' >&2
  exit 2
}
[[ "$OWNER_EMPRESA_ID" =~ $UUID_RE ]] || {
  echo 'BLOCKED: OWNER_EMPRESA_ID_invalid_uuid' >&2
  exit 2
}
echo "owner_group_id_prefix=${OWNER_GROUP_ID:0:8}"
echo "owner_empresa_id_prefix=${OWNER_EMPRESA_ID:0:8}"

PRECHECK="$(docker exec -i supabase-db psql -X -U postgres -d postgres -At -F '|' \
  -v owner_email="$OWNER_EMAIL" \
  -v owner_group_id="$OWNER_GROUP_ID" \
  -v owner_empresa_id="$OWNER_EMPRESA_ID" \
  -v synth_email="$SYNTH_EMAIL" <<'SQL'
SELECT
  (SELECT count(*)::text FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email')),
  (SELECT count(*)::text FROM profiles p
    WHERE lower(p.email) = lower(:'owner_email')
       OR p.auth_user_id IN (SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email'))),
  (SELECT count(*)::text FROM groups g WHERE g.id = :'owner_group_id'::uuid),
  (SELECT count(*)::text FROM empresas e
    WHERE e.id = :'owner_empresa_id'::uuid AND e.group_id = :'owner_group_id'::uuid),
  (SELECT count(*)::text FROM profiles p
    WHERE lower(p.email) = lower(:'synth_email')
       OR p.auth_user_id IN (SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'synth_email')));
SQL
)"
PRECHECK="$(echo "$PRECHECK" | tr -d '[:space:]')"
IFS='|' read -r AUTH_COUNT PROFILE_COUNT GROUP_OK EMPRESA_OK SYNTH_PROFILE_COUNT <<<"$PRECHECK"

echo "owner_auth_count=${AUTH_COUNT}"
echo "owner_profile_count=${PROFILE_COUNT}"
echo "group_exists_count=${GROUP_OK}"
echo "empresa_in_group_count=${EMPRESA_OK}"
echo "synth_profile_count=${SYNTH_PROFILE_COUNT}"

[[ "$AUTH_COUNT" == "1" ]] || {
  echo "BLOCKED: owner_auth_must_be_unique got=${AUTH_COUNT}" >&2
  exit 3
}
if [[ "$PROFILE_COUNT" != "0" && "$PROFILE_COUNT" != "1" ]]; then
  echo "BLOCKED: owner_profile_must_be_unique got=${PROFILE_COUNT}" >&2
  exit 3
fi
[[ "$GROUP_OK" == "1" ]] || {
  echo 'BLOCKED: OWNER_GROUP_ID_not_found' >&2
  exit 3
}
[[ "$EMPRESA_OK" == "1" ]] || {
  echo 'BLOCKED: OWNER_EMPRESA_ID_not_in_OWNER_GROUP_ID' >&2
  exit 3
}
if [[ "$DEMOTE_SYNTH" == "YES" && "$SYNTH_PROFILE_COUNT" != "0" && "$SYNTH_PROFILE_COUNT" != "1" ]]; then
  echo "BLOCKED: synth_profile_must_be_unique got=${SYNTH_PROFILE_COUNT}" >&2
  exit 3
fi
echo 'precheck_ok=YES'
echo 'precheck_group_empresa_conferidos=YES'

# Backup sanitizado (só tabela profiles) antes de mutar.
STAMP="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$OWNER_PROV_BACKUP_DIR"
BACKUP_NAME="profiles-pre-owner-prov-${STAMP}.sql"
BACKUP_HOST="${OWNER_PROV_BACKUP_DIR}/${BACKUP_NAME}"
docker exec supabase-db pg_dump -U postgres -d postgres \
  --data-only --table=profiles --no-owner --no-privileges \
  -f "/tmp/${BACKUP_NAME}"
docker cp "supabase-db:/tmp/${BACKUP_NAME}" "$BACKUP_HOST"
BACKUP_BYTES="$(wc -c <"$BACKUP_HOST" | tr -d '[:space:]')"
[[ "${BACKUP_BYTES}" -gt 0 ]] || {
  echo 'BLOCKED: backup_profiles_empty' >&2
  exit 3
}
echo "backup_profiles_file=${BACKUP_NAME}"
echo "backup_profiles_bytes=${BACKUP_BYTES}"
echo "rollback_hint=psql -f backups/owner-provision/${BACKUP_NAME} (somente profiles; revisar antes)"

# Copia árvore explícita para o container (lida via pg_read_file na TX).
docker cp "$OWNER_PERMS_FILE" supabase-db:/tmp/owner-admin-permissoes.json

if ! docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v owner_email="$OWNER_EMAIL" \
  -v owner_full_name="$OWNER_FULL_NAME" \
  -v owner_group_id="$OWNER_GROUP_ID" \
  -v owner_empresa_id="$OWNER_EMPRESA_ID" \
  -v synth_email="$SYNTH_EMAIL" \
  -v demote_synth="$DEMOTE_SYNTH" \
  -v expected_owner_admin="$EXPECTED_OWNER_ADMIN" \
  -v expected_synth_admin="$EXPECTED_SYNTH_ADMIN" <<'SQL'
BEGIN;

CREATE TEMP TABLE _owner_prov (
  owner_email text NOT NULL,
  owner_full_name text NOT NULL,
  group_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  synth_email text NOT NULL,
  demote text NOT NULL,
  expected_owner_admin int NOT NULL,
  expected_synth_admin int NOT NULL,
  permissoes jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _owner_prov (
  owner_email, owner_full_name, group_id, empresa_id,
  synth_email, demote, expected_owner_admin, expected_synth_admin, permissoes
) VALUES (
  lower(:'owner_email'),
  :'owner_full_name',
  :'owner_group_id'::uuid,
  :'owner_empresa_id'::uuid,
  lower(:'synth_email'),
  upper(trim(:'demote_synth')),
  :'expected_owner_admin'::int,
  :'expected_synth_admin'::int,
  pg_read_file('/tmp/owner-admin-permissoes.json')::jsonb
);

DO $prov$
DECLARE
  r _owner_prov%ROWTYPE;
  v_auth_count int;
  v_auth_id uuid;
  v_profile_count int;
  v_profile_id uuid;
  v_group_ok int;
  v_empresa_ok int;
  v_synth_count int;
  v_owner_admin int;
  v_synth_admin int;
BEGIN
  SELECT * INTO STRICT r FROM _owner_prov LIMIT 1;

  IF r.permissoes ? '*' THEN
    RAISE EXCEPTION 'BLOCKED: owner_perms_has_wildcard';
  END IF;
  IF NOT (r.permissoes ? 'Cadastros' AND r.permissoes ? 'Comercial' AND r.permissoes ? 'Sistema') THEN
    RAISE EXCEPTION 'BLOCKED: owner_perms_missing_required_modules';
  END IF;

  SELECT count(*), min(id) INTO v_auth_count, v_auth_id
  FROM auth.users
  WHERE lower(coalesce(email, '')) = r.owner_email;

  IF v_auth_count <> 1 OR v_auth_id IS NULL THEN
    RAISE EXCEPTION 'BLOCKED: owner_auth_must_be_unique got=%', v_auth_count;
  END IF;

  SELECT count(*) INTO v_group_ok FROM groups WHERE id = r.group_id;
  IF v_group_ok <> 1 THEN
    RAISE EXCEPTION 'BLOCKED: OWNER_GROUP_ID_not_found';
  END IF;

  SELECT count(*) INTO v_empresa_ok
  FROM empresas WHERE id = r.empresa_id AND group_id = r.group_id;
  IF v_empresa_ok <> 1 THEN
    RAISE EXCEPTION 'BLOCKED: OWNER_EMPRESA_ID_not_in_OWNER_GROUP_ID';
  END IF;

  SELECT count(*) INTO v_profile_count
  FROM profiles p
  WHERE lower(p.email) = r.owner_email OR p.auth_user_id = v_auth_id;

  IF v_profile_count > 1 THEN
    RAISE EXCEPTION 'BLOCKED: owner_profile_must_be_unique got=%', v_profile_count;
  END IF;

  IF v_profile_count = 1 THEN
    SELECT p.id INTO v_profile_id
    FROM profiles p
    WHERE lower(p.email) = r.owner_email OR p.auth_user_id = v_auth_id
    ORDER BY CASE WHEN p.auth_user_id = v_auth_id THEN 0 ELSE 1 END, p.id
    LIMIT 1;

    UPDATE profiles p
    SET auth_user_id = v_auth_id,
        email = r.owner_email,
        full_name = COALESCE(NULLIF(trim(p.full_name), ''), r.owner_full_name),
        role = 'admin',
        ativo = true,
        group_id = r.group_id,
        empresa_id = r.empresa_id,
        permissoes = r.permissoes,
        updated_at = timezone('utc', now())
    WHERE p.id = v_profile_id;
  ELSE
    INSERT INTO profiles (
      auth_user_id, email, full_name, role, ativo, group_id, empresa_id, permissoes
    ) VALUES (
      v_auth_id,
      r.owner_email,
      r.owner_full_name,
      'admin',
      true,
      r.group_id,
      r.empresa_id,
      r.permissoes
    );
  END IF;

  IF r.demote = 'YES' THEN
    SELECT count(*) INTO v_synth_count
    FROM profiles p
    WHERE lower(p.email) = r.synth_email
       OR p.auth_user_id IN (
            SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = r.synth_email
          );
    IF v_synth_count > 1 THEN
      RAISE EXCEPTION 'BLOCKED: synth_profile_must_be_unique got=%', v_synth_count;
    END IF;

    UPDATE profiles p
    SET role = 'user',
        permissoes = '{}'::jsonb,
        updated_at = timezone('utc', now())
    WHERE lower(p.email) = r.synth_email
       OR p.auth_user_id IN (
            SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = r.synth_email
          );
  END IF;

  SELECT count(*) INTO v_owner_admin
  FROM profiles p
  WHERE (lower(p.email) = r.owner_email OR p.auth_user_id = v_auth_id)
    AND p.ativo IS TRUE
    AND p.role = 'admin'
    AND p.group_id = r.group_id
    AND p.empresa_id = r.empresa_id
    AND NOT (p.permissoes ? '*')
    AND p.permissoes ? 'Cadastros'
    AND p.permissoes ? 'Comercial'
    AND p.permissoes ? 'Sistema';

  IF v_owner_admin <> r.expected_owner_admin THEN
    RAISE EXCEPTION 'BLOCKED: owner_admin_count_mismatch got=% expected=%',
      v_owner_admin, r.expected_owner_admin;
  END IF;

  SELECT count(*) INTO v_synth_admin
  FROM profiles p
  WHERE (lower(p.email) = r.synth_email
      OR p.auth_user_id IN (
           SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = r.synth_email
         ))
    AND p.ativo IS TRUE
    AND p.role = 'admin';

  IF r.demote = 'YES' AND v_synth_admin <> r.expected_synth_admin THEN
    RAISE EXCEPTION 'BLOCKED: synth_admin_count_mismatch got=% expected=%',
      v_synth_admin, r.expected_synth_admin;
  END IF;
END
$prov$;

COMMIT;
SQL
then
  echo 'transaction=COMMITTED'
else
  echo 'BLOCKED: transaction_failed_rolled_back' >&2
  echo "RESTORE_FROM_BACKUP=${BACKUP_NAME}" >&2
  exit 4
fi

OWNER_FINAL="$(docker exec -i supabase-db psql -X -U postgres -d postgres -At \
  -v owner_email="$OWNER_EMAIL" \
  -v owner_group_id="$OWNER_GROUP_ID" \
  -v owner_empresa_id="$OWNER_EMPRESA_ID" <<'SQL'
SELECT count(*)::text
FROM profiles p
WHERE (lower(p.email) = lower(:'owner_email')
    OR p.auth_user_id IN (
         SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email')
       ))
  AND p.ativo IS TRUE
  AND p.role = 'admin'
  AND p.group_id = :'owner_group_id'::uuid
  AND p.empresa_id = :'owner_empresa_id'::uuid
  AND NOT (p.permissoes ? '*')
  AND p.permissoes ? 'Cadastros'
  AND p.permissoes ? 'Comercial'
  AND p.permissoes ? 'Sistema';
SQL
)"
OWNER_FINAL="$(echo "$OWNER_FINAL" | tr -d '[:space:]')"

SYNTH_FINAL="$(docker exec -i supabase-db psql -X -U postgres -d postgres -At \
  -v synth_email="$SYNTH_EMAIL" <<'SQL'
SELECT count(*)::text
FROM profiles p
WHERE (lower(p.email) = lower(:'synth_email')
    OR p.auth_user_id IN (
         SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'synth_email')
       ))
  AND p.ativo IS TRUE
  AND p.role = 'admin';
SQL
)"
SYNTH_FINAL="$(echo "$SYNTH_FINAL" | tr -d '[:space:]')"

echo "owner_admin_ativos=${OWNER_FINAL}"
echo "synth_admin_ativos=${SYNTH_FINAL}"
echo "owner_perms_wildcard=NO"

[[ "$OWNER_FINAL" == "$EXPECTED_OWNER_ADMIN" ]] || {
  echo "BLOCKED: postcheck_owner_admin_mismatch got=${OWNER_FINAL} expected=${EXPECTED_OWNER_ADMIN}" >&2
  exit 5
}
if [[ "$DEMOTE_SYNTH" == "YES" ]]; then
  [[ "$SYNTH_FINAL" == "$EXPECTED_SYNTH_ADMIN" ]] || {
    echo "BLOCKED: postcheck_synth_admin_mismatch got=${SYNTH_FINAL} expected=${EXPECTED_SYNTH_ADMIN}" >&2
    exit 5
  }
  echo 'synth_demote=YES'
else
  echo 'synth_demote=SKIP'
fi

echo "OWNER_ADMIN_PROVISION_OK"
echo "NEXT=rebuild_api_web_logout_login_owner"
echo "OWNER_ADMIN_PROVISION_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
