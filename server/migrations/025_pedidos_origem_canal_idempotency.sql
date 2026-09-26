-- Comercial 360 Onda 5 — origem/canal/external_id/idempotency no Pedido canônico (aditiva).
-- Sem módulo paralelo. Defaults fail-closed: MANUAL. Unicidade por tenant+origem.

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS canal TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_origem_check'
  ) THEN
    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_origem_check
      CHECK (origem IN (
        'MANUAL','ORCAMENTO','SITE','PORTAL_B2B','APP','CHATBOT','MARKETPLACE','IMPORTACAO'
      ));
  END IF;
END $$;

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_canal_len_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_canal_len_check
  CHECK (canal IS NULL OR char_length(btrim(canal)) BETWEEN 1 AND 80);

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_external_id_len_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_external_id_len_check
  CHECK (external_id IS NULL OR char_length(btrim(external_id)) BETWEEN 1 AND 160);

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_idempotency_key_len_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_idempotency_key_len_check
  CHECK (idempotency_key IS NULL OR char_length(btrim(idempotency_key)) BETWEEN 1 AND 160);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_idempotency
  ON pedidos (group_id, empresa_id, origem, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_external_id
  ON pedidos (group_id, empresa_id, origem, external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';

CREATE INDEX IF NOT EXISTS idx_pedidos_origem_canal
  ON pedidos (group_id, empresa_id, origem, canal, numero DESC);
