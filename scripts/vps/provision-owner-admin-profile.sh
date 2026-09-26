#!/usr/bin/env bash
# Vincula a conta real do proprietário a um perfil admin ERP (role + permissoes + empresa).
# Demote o usuário sintético (não privilegiar synth).
# Não imprime UUID, senha, token ou e-mail completo.
#
# Pré-requisito: auth.users já existe para OWNER_EMAIL (login externo já funcionando).
#
# Uso (Web Console VPS):
#   CONFIRM_OWNER_ADMIN_PROFILE=YES \
#     OWNER_EMAIL='vinicius.zuccaro@gmail.com' \
#     SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' \
#     DEMOTE_SYNTH=YES \
#     bash scripts/vps/provision-owner-admin-profile.sh
set -Eeuo pipefail

CONFIRM_OWNER_ADMIN_PROFILE="${CONFIRM_OWNER_ADMIN_PROFILE:-}"
OWNER_EMAIL="${OWNER_EMAIL:-vinicius.zuccaro@gmail.com}"
SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"
DEMOTE_SYNTH="${DEMOTE_SYNTH:-YES}"
OWNER_FULL_NAME="${OWNER_FULL_NAME:-Vinicius Zuccaro}"

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

AUTH_COUNT="$(docker exec -i supabase-db psql -X -U postgres -d postgres -At -v owner_email="$OWNER_EMAIL" <<'SQL'
SELECT count(*)::text
FROM auth.users
WHERE lower(coalesce(email, '')) = lower(:'owner_email');
SQL
)"
AUTH_COUNT="$(echo "$AUTH_COUNT" | tr -d '[:space:]')"
echo "owner_auth_found_count=${AUTH_COUNT}"
if [[ -z "$AUTH_COUNT" || "$AUTH_COUNT" == "0" ]]; then
  echo 'BLOCKED: owner_auth_user_missing (faça um login com a conta real antes)' >&2
  exit 3
fi

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v owner_email="$OWNER_EMAIL" \
  -v owner_full_name="$OWNER_FULL_NAME" \
  -v synth_email="$SYNTH_EMAIL" <<'SQL'
-- Atualiza perfil existente (por auth_user_id ou e-mail)
UPDATE profiles p
SET auth_user_id = COALESCE(
      p.auth_user_id,
      (SELECT u.id FROM auth.users u WHERE lower(coalesce(u.email,'')) = lower(:'owner_email') LIMIT 1)
    ),
    email = lower(:'owner_email'),
    full_name = COALESCE(NULLIF(trim(p.full_name), ''), :'owner_full_name'),
    role = 'admin',
    ativo = true,
    group_id = COALESCE(p.group_id, (SELECT id FROM groups ORDER BY id LIMIT 1)),
    empresa_id = COALESCE(
      p.empresa_id,
      (SELECT e.id FROM empresas e
        WHERE e.group_id = COALESCE(p.group_id, (SELECT id FROM groups ORDER BY id LIMIT 1))
        ORDER BY e.id LIMIT 1)
    ),
    permissoes = jsonb_build_object(
      '*', jsonb_build_array(
        'visualizar','criar','editar','excluir','aprovar','cancelar',
        'importar','exportar','configurar','executar','inativar','restaurar',
        'receber','pagar','baixar','conciliar','estornar','emitir'
      )
    ),
    updated_at = timezone('utc', now())
WHERE lower(p.email) = lower(:'owner_email')
   OR p.auth_user_id IN (
        SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email')
      );

-- Insere se ainda não houver perfil para o auth user
INSERT INTO profiles (
  auth_user_id, email, full_name, role, ativo, group_id, empresa_id, permissoes
)
SELECT
  u.id,
  lower(:'owner_email'),
  :'owner_full_name',
  'admin',
  true,
  (SELECT id FROM groups ORDER BY id LIMIT 1),
  (SELECT e.id FROM empresas e
    WHERE e.group_id = (SELECT id FROM groups ORDER BY id LIMIT 1)
    ORDER BY e.id LIMIT 1),
  jsonb_build_object(
    '*', jsonb_build_array(
      'visualizar','criar','editar','excluir','aprovar','cancelar',
      'importar','exportar','configurar','executar','inativar','restaurar',
      'receber','pagar','baixar','conciliar','estornar','emitir'
    )
  )
FROM auth.users u
WHERE lower(coalesce(u.email,'')) = lower(:'owner_email')
  AND NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = u.id
       OR lower(p.email) = lower(:'owner_email')
  )
LIMIT 1;

SELECT 'owner_admin_ativos=' || count(*)::text AS evidence
FROM profiles p
WHERE (lower(p.email) = lower(:'owner_email')
    OR p.auth_user_id IN (
         SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email')
       ))
  AND p.ativo IS TRUE
  AND p.role = 'admin'
  AND p.group_id IS NOT NULL
  AND p.empresa_id IS NOT NULL
  AND p.permissoes ? '*';

SELECT 'owner_empresas_no_grupo=' || count(*)::text AS evidence
FROM empresas e
WHERE e.group_id = (
  SELECT p.group_id FROM profiles p
  WHERE lower(p.email) = lower(:'owner_email')
     OR p.auth_user_id IN (
          SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'owner_email')
        )
  LIMIT 1
);
SQL

if [[ "$DEMOTE_SYNTH" == "YES" ]]; then
  docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v synth_email="$SYNTH_EMAIL" <<'SQL'
UPDATE profiles p
SET role = 'user',
    permissoes = '{}'::jsonb,
    updated_at = timezone('utc', now())
WHERE lower(p.email) = lower(:'synth_email')
   OR p.auth_user_id IN (
        SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'synth_email')
      );

SELECT 'synth_admin_ativos=' || count(*)::text AS evidence
FROM profiles p
WHERE (lower(p.email) = lower(:'synth_email')
    OR p.auth_user_id IN (
         SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'synth_email')
       ))
  AND p.ativo IS TRUE
  AND p.role = 'admin';
SQL
  echo 'synth_demote=YES'
else
  echo 'synth_demote=SKIP'
fi

echo "OWNER_ADMIN_PROVISION_OK"
echo "NEXT=rebuild_api_web_logout_login_owner"
echo "OWNER_ADMIN_PROVISION_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
