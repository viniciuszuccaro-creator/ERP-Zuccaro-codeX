-- Comercial 360 Onda 5 ck2 — tipo comercial no Pedido canônico (aditiva).
-- Derivado do Produto/snapshots; MISTO quando itens divergem. Sem módulo paralelo.

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tipo_comercial TEXT NOT NULL DEFAULT 'REVENDA';

ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS tipo_comercial_snapshot TEXT NOT NULL DEFAULT 'REVENDA';

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
