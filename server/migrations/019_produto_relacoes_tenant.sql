-- Onda 1: paridade das relacoes de Produto e ownership por empresa.
ALTER TABLE produto_variantes ADD COLUMN IF NOT EXISTS nome TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_variantes_group_sku_ci
  ON produto_variantes(group_id, lower(sku));

CREATE OR REPLACE FUNCTION assert_produto_pim_tenant_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = NEW.produto_id AND p.group_id = NEW.group_id
      AND (p.empresa_id IS NULL OR p.empresa_id IS NOT DISTINCT FROM NEW.empresa_id)
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto_id does not belong to relation tenant';
  END IF;
  IF TG_TABLE_NAME = 'produto_equivalentes' AND NOT EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = (to_jsonb(NEW)->>'produto_equivalente_id')::uuid AND p.group_id = NEW.group_id
      AND (p.empresa_id IS NULL OR p.empresa_id IS NOT DISTINCT FROM NEW.empresa_id)
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto_equivalente_id does not belong to relation tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produto_variantes_refs ON produto_variantes;
CREATE TRIGGER trg_produto_variantes_refs
  BEFORE INSERT OR UPDATE OF group_id, empresa_id, produto_id ON produto_variantes
  FOR EACH ROW EXECUTE PROCEDURE assert_produto_pim_tenant_integrity();
DROP TRIGGER IF EXISTS trg_produto_equivalentes_refs ON produto_equivalentes;
CREATE TRIGGER trg_produto_equivalentes_refs
  BEFORE INSERT OR UPDATE OF group_id, empresa_id, produto_id, produto_equivalente_id ON produto_equivalentes
  FOR EACH ROW EXECUTE PROCEDURE assert_produto_pim_tenant_integrity();
DROP TRIGGER IF EXISTS trg_produto_midias_refs ON produto_midias;
CREATE TRIGGER trg_produto_midias_refs
  BEFORE INSERT OR UPDATE OF group_id, empresa_id, produto_id ON produto_midias
  FOR EACH ROW EXECUTE PROCEDURE assert_produto_pim_tenant_integrity();
