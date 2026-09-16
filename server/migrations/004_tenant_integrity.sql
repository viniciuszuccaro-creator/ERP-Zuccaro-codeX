-- ERP-RUNTIME-02: integridade group/empresa + reforco em marcas
-- Migrations 001-003 sao IMUTAVEIS.

CREATE OR REPLACE FUNCTION assert_empresa_belongs_to_group()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.group_id IS NULL THEN
    RAISE EXCEPTION 'group_id is required when empresa_id is set';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM empresas e
    WHERE e.id = NEW.empresa_id
      AND e.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: empresa_id % does not belong to group_id %',
      NEW.empresa_id, NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marcas_tenant_integrity ON marcas;
CREATE TRIGGER trg_marcas_tenant_integrity
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON marcas
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

-- profiles tambem quando ambos preenchidos
DROP TRIGGER IF EXISTS trg_profiles_tenant_integrity ON profiles;
CREATE TRIGGER trg_profiles_tenant_integrity
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON profiles
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();
