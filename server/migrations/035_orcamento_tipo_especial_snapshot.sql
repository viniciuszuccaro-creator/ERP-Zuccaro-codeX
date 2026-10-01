-- Contrato aditivo: somente intenção especial explicitamente confirmada no item do Orçamento.
-- Histórico permanece NULL; não inferir ARMADO/CORTE_DOBRA de Produto atual.
-- Não aplicar fora de staging isolado sem gate de migration, backup e rollback aprovado.
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS requer_producao BOOLEAN;
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS tipo_comercial TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamento_itens_tipo_especial_check'
    AND conrelid='orcamento_itens'::regclass) THEN
    ALTER TABLE orcamento_itens ADD CONSTRAINT orcamento_itens_tipo_especial_check
      CHECK ((tipo_comercial IS NULL AND requer_producao IS DISTINCT FROM TRUE)
        OR (tipo_comercial IN ('ARMADO','CORTE_DOBRA') AND requer_producao IS TRUE));
  END IF;
END $$;
