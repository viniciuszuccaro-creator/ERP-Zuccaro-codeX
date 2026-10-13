-- Adição compatível: pedidos antigos e conversões mantêm chave nula.
-- Aplicar apenas após gate de destino, backup e reversão; CI usa banco isolado.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS idempotency_key UUID;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payload_fingerprint TEXT;

ALTER TABLE pedidos ADD CONSTRAINT pedidos_idempotency_pair_check
  CHECK ((idempotency_key IS NULL AND payload_fingerprint IS NULL)
    OR (idempotency_key IS NOT NULL AND payload_fingerprint ~ '^[a-f0-9]{64}$'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_idempotency_scope
  ON pedidos(group_id, empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
