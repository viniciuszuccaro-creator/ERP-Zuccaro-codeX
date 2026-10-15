-- Comercial 360: persiste tabela_preco_id no Orçamento (espelha pedidos/017).
-- Numeração 039: 025–037 reservados Codex; 038 Cadastros já aplicado. Aditiva; sem reaplicar 016/038.
-- Fail-closed: tabela deve existir no grupo e estar vinculada/ativa na empresa.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS tabela_preco_id UUID REFERENCES tabelas_preco(id);

CREATE OR REPLACE FUNCTION assert_orcamento_same_tenant() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM empresas e WHERE e.id = NEW.empresa_id AND e.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa outside group';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM cliente_empresas ce
    WHERE ce.id = NEW.cliente_empresa_id
      AND ce.group_id = NEW.group_id
      AND ce.empresa_id = NEW.empresa_id
      AND ce.ativo
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_empresa outside scope';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM condicoes_pagamento c
    JOIN condicao_pagamento_empresas ce
      ON ce.condicao_pagamento_id = c.id AND ce.group_id = c.group_id
    WHERE c.id = NEW.condicao_pagamento_id
      AND c.group_id = NEW.group_id
      AND ce.empresa_id = NEW.empresa_id
      AND c.ativo AND ce.ativo
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: condicao_pagamento outside scope';
  END IF;
  IF NEW.tabela_preco_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM tabelas_preco t
    JOIN tabela_preco_empresas te
      ON te.tabela_preco_id = t.id AND te.group_id = t.group_id
    WHERE t.id = NEW.tabela_preco_id
      AND t.group_id = NEW.group_id
      AND t.ativo
      AND te.empresa_id = NEW.empresa_id
      AND te.ativo
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: tabela_preco outside scope';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orcamentos_tenant ON orcamentos;
CREATE TRIGGER trg_orcamentos_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id, cliente_empresa_id, condicao_pagamento_id, tabela_preco_id
  ON orcamentos
  FOR EACH ROW EXECUTE PROCEDURE assert_orcamento_same_tenant();

COMMENT ON COLUMN orcamentos.tabela_preco_id IS 'Tabela de preço usada no snapshot de venda do orçamento (opcional; servidor pode preencher).';
