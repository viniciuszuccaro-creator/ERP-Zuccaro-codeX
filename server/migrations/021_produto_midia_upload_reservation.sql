-- Reserve a Storage key before signing; no object is deleted by this migration.
ALTER TABLE produto_midias
  ADD COLUMN IF NOT EXISTS upload_attempt_id UUID,
  ADD COLUMN IF NOT EXISTS upload_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS upload_request_id TEXT,
  ADD COLUMN IF NOT EXISTS upload_expires_at TIMESTAMPTZ;

ALTER TABLE produto_midias DROP CONSTRAINT IF EXISTS produto_midias_status_check;
ALTER TABLE produto_midias ADD CONSTRAINT produto_midias_status_check
  CHECK (status IN ('PENDENTE_UPLOAD','QUARENTENA','APROVADO','REJEITADO','INATIVO'));

ALTER TABLE produto_midias ADD CONSTRAINT produto_midias_pending_upload_check
  CHECK (status <> 'PENDENTE_UPLOAD' OR (
    ativo AND upload_attempt_id IS NOT NULL AND upload_actor_id IS NOT NULL
    AND length(upload_actor_id) > 0 AND upload_request_id IS NOT NULL
    AND length(upload_request_id) > 0 AND upload_expires_at IS NOT NULL
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_midias_upload_attempt
  ON produto_midias(upload_attempt_id) WHERE upload_attempt_id IS NOT NULL;

COMMENT ON COLUMN produto_midias.upload_attempt_id IS
  'Immutable upload attempt provenance; never an authorization token.';
COMMENT ON COLUMN produto_midias.upload_expires_at IS
  'Reservation expiry; cleanup requires a separate authorized reconciliation gate.';
