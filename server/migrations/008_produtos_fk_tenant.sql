-- ERP-RUNTIME-03: integridade FK tenant-scoped para produtos
-- Impede Produto do Grupo A referenciar Marca/Unidade/GrupoProduto/Setor do Grupo B.

CREATE OR REPLACE FUNCTION assert_produto_fk_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.marca_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marcas m
      WHERE m.id = NEW.marca_id AND m.group_id = NEW.group_id
    ) THEN
      RAISE EXCEPTION 'TENANT_FK_MISMATCH: marca_id % does not belong to group_id %',
        NEW.marca_id, NEW.group_id;
    END IF;
  END IF;

  IF NEW.unidade_medida_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM unidades_medida u
      WHERE u.id = NEW.unidade_medida_id AND u.group_id = NEW.group_id
    ) THEN
      RAISE EXCEPTION 'TENANT_FK_MISMATCH: unidade_medida_id % does not belong to group_id %',
        NEW.unidade_medida_id, NEW.group_id;
    END IF;
  END IF;

  IF NEW.grupo_produto_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM grupos_produto g
      WHERE g.id = NEW.grupo_produto_id AND g.group_id = NEW.group_id
    ) THEN
      RAISE EXCEPTION 'TENANT_FK_MISMATCH: grupo_produto_id % does not belong to group_id %',
        NEW.grupo_produto_id, NEW.group_id;
    END IF;
  END IF;

  IF NEW.setor_atividade_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM setores_atividade s
      WHERE s.id = NEW.setor_atividade_id AND s.group_id = NEW.group_id
    ) THEN
      RAISE EXCEPTION 'TENANT_FK_MISMATCH: setor_atividade_id % does not belong to group_id %',
        NEW.setor_atividade_id, NEW.group_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produtos_fk_tenant ON produtos;
CREATE TRIGGER trg_produtos_fk_tenant
  BEFORE INSERT OR UPDATE OF group_id, marca_id, unidade_medida_id, grupo_produto_id, setor_atividade_id
  ON produtos
  FOR EACH ROW EXECUTE PROCEDURE assert_produto_fk_same_tenant();
