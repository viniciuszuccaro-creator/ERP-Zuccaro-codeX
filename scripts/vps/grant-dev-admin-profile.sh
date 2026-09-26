#!/usr/bin/env bash
# Garante profile synth com empresa + role admin (RBAC backend) para teste DEV.
# ATENÇÃO: NÃO use para privilegiar o synth no lugar do proprietário real.
# Preferir: scripts/vps/provision-owner-admin-profile.sh (owner admin + demote synth).
# Não imprime UUID/senha.
#
# Uso:
#   CONFIRM_DEV_ADMIN_PROFILE=YES \
#     SYNTH_EMAIL='gate-d.synth@dev.synthetic.local' \
#     bash scripts/vps/grant-dev-admin-profile.sh
set -Eeuo pipefail

CONFIRM_DEV_ADMIN_PROFILE="${CONFIRM_DEV_ADMIN_PROFILE:-}"
SYNTH_EMAIL="${SYNTH_EMAIL:-gate-d.synth@dev.synthetic.local}"

echo "DEV_ADMIN_PROFILE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "WARN=prefer_provision_owner_admin_profile_for_real_account"
[[ "$CONFIRM_DEV_ADMIN_PROFILE" == "YES" ]] || {
  echo 'BLOCKED: set CONFIRM_DEV_ADMIN_PROFILE=YES' >&2
  exit 2
}

docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v synth_email="$SYNTH_EMAIL" <<'SQL'
UPDATE profiles p
SET ativo = true,
    role = 'admin',
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
WHERE lower(p.email) = lower(:'synth_email')
   OR p.auth_user_id IN (
        SELECT id FROM auth.users WHERE lower(coalesce(email,'')) = lower(:'synth_email')
      );

SELECT 'profiles_admin_ativos='||count(*)::text
FROM profiles p
WHERE (lower(p.email)=lower(:'synth_email') OR p.auth_user_id IN (
        SELECT id FROM auth.users WHERE lower(coalesce(email,''))=lower(:'synth_email')
      ))
  AND p.ativo IS TRUE
  AND p.role = 'admin'
  AND p.empresa_id IS NOT NULL
  AND p.group_id IS NOT NULL;
SQL

echo "DEV_ADMIN_PROFILE_OK"
echo "NEXT=logout_login_ou_hard_refresh_apos_rebuild_web"
echo "DEV_ADMIN_PROFILE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
