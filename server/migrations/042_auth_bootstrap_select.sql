-- Verified provider identity only; no operational role, grants or data policies.
-- The backend Auth connection sets app.auth_user_id transaction-locally after verification.
DROP POLICY IF EXISTS profiles_auth_bootstrap_select ON profiles;
CREATE POLICY profiles_auth_bootstrap_select ON profiles FOR SELECT
USING (ativo AND auth_user_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);

DROP POLICY IF EXISTS empresas_auth_bootstrap_select ON empresas;
CREATE POLICY empresas_auth_bootstrap_select ON empresas FOR SELECT
USING (status = 'Ativa' AND EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.ativo AND p.auth_user_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid
    AND p.group_id = empresas.group_id AND (p.empresa_id IS NULL OR p.empresa_id = empresas.id)
));

DROP POLICY IF EXISTS groups_auth_bootstrap_select ON groups;
CREATE POLICY groups_auth_bootstrap_select ON groups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.ativo AND p.auth_user_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid
    AND p.group_id = groups.id AND (p.empresa_id IS NULL OR EXISTS (
      SELECT 1 FROM empresas e WHERE e.id = p.empresa_id AND e.group_id = groups.id AND e.status = 'Ativa'
    ))
));
