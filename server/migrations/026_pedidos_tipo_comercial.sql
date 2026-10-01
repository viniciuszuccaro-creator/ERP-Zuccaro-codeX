-- Comercial 360 Onda 5 ck2 — tipo comercial no Pedido canônico (aditiva).
-- Derivado do Produto/snapshots; MISTO quando itens divergem. Sem módulo paralelo.

-- Não existe evidência histórica suficiente para inferir tipo pelo Produto atual.
-- Coluna preexistente não comprova proveniência: qualquer histórico exige lote
-- de classificação aprovado antes de uma migration própria, nunca este default.
DO $$
BEGIN
  LOCK TABLE pedidos, pedido_itens IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM pedidos) OR EXISTS (SELECT 1 FROM pedido_itens) THEN
    RAISE EXCEPTION 'PEDIDO_HISTORICAL_TYPE_MAPPING_REQUIRED'
      USING ERRCODE='P0001';
  END IF;
END $$;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tipo_comercial TEXT NOT NULL DEFAULT 'REVENDA';

ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS tipo_comercial_snapshot TEXT NOT NULL DEFAULT 'REVENDA';

-- IF NOT EXISTS não valida uma coluna preexistente incompleta.
ALTER TABLE pedidos ALTER COLUMN tipo_comercial SET NOT NULL;
ALTER TABLE pedido_itens ALTER COLUMN tipo_comercial_snapshot SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_tipo_comercial_check'
  ) THEN
    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_tipo_comercial_check
      CHECK (tipo_comercial IN (
        'REVENDA','ARMADO','CORTE_DOBRA','FABRICADO','KIT','SERVICO','MISTO'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedido_itens_tipo_comercial_snapshot_check'
  ) THEN
    ALTER TABLE pedido_itens
      ADD CONSTRAINT pedido_itens_tipo_comercial_snapshot_check
      CHECK (tipo_comercial_snapshot IN (
        'REVENDA','ARMADO','CORTE_DOBRA','FABRICADO','KIT','SERVICO'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pedidos_tipo_comercial
  ON pedidos (group_id, empresa_id, tipo_comercial, numero DESC);
