-- Comercial 360 Onda 4 — origem/canal/external_id/idempotency no Orçamento canônico (aditiva).
-- Alinhado ao Pedido 025; sem módulo paralelo. Default MANUAL.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS canal TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS campanha TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_origem_check'
  ) THEN
    ALTER TABLE orcamentos
      ADD CONSTRAINT orcamentos_origem_check
      CHECK (origem IN (
        'MANUAL','SITE','PORTAL_B2B','APP','CHATBOT','MARKETPLACE','IMPORTACAO','CRM'
      ));
  END IF;
END $$;

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_canal_len_check;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_canal_len_check
  CHECK (canal IS NULL OR char_length(btrim(canal)) BETWEEN 1 AND 80);

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_external_id_len_check;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_external_id_len_check
  CHECK (external_id IS NULL OR char_length(btrim(external_id)) BETWEEN 1 AND 160);

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_idempotency_key_len_check;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_idempotency_key_len_check
  CHECK (idempotency_key IS NULL OR char_length(btrim(idempotency_key)) BETWEEN 1 AND 160);

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_campanha_len_check;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_campanha_len_check
  CHECK (campanha IS NULL OR char_length(btrim(campanha)) BETWEEN 1 AND 120);

CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_idempotency
  ON orcamentos (group_id, empresa_id, origem, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_external_id
  ON orcamentos (group_id, empresa_id, origem, external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';

CREATE INDEX IF NOT EXISTS idx_orcamentos_origem_canal
  ON orcamentos (group_id, empresa_id, origem, canal, numero DESC, versao DESC);
