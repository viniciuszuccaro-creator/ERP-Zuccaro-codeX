-- Comercial 360 Onda 4 — versionamento aditivo do Orçamento canônico (016).
-- Mesmo numero comercial; versao incrementa; no máximo um EM_ABERTO por numero/empresa.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS orcamento_raiz_id UUID,
  ADD COLUMN IF NOT EXISTS supersedido_por_id UUID;

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_status_check;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('EM_ABERTO', 'CANCELADO', 'SUPERSEDIDO'));

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_empresa_id_numero_key;
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_empresa_numero_versao_key;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_empresa_numero_versao_key UNIQUE (empresa_id, numero, versao);

CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_open_numero
  ON orcamentos (empresa_id, numero)
  WHERE status = 'EM_ABERTO';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_raiz_fk'
  ) THEN
    ALTER TABLE orcamentos
      ADD CONSTRAINT orcamentos_raiz_fk
      FOREIGN KEY (orcamento_raiz_id, group_id, empresa_id)
      REFERENCES orcamentos (id, group_id, empresa_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_supersedido_por_fk'
  ) THEN
    ALTER TABLE orcamentos
      ADD CONSTRAINT orcamentos_supersedido_por_fk
      FOREIGN KEY (supersedido_por_id, group_id, empresa_id)
      REFERENCES orcamentos (id, group_id, empresa_id);
  END IF;
END $$;

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_versao_pos_check;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_versao_pos_check CHECK (versao >= 1);

CREATE INDEX IF NOT EXISTS idx_orcamentos_raiz_versoes
  ON orcamentos (group_id, empresa_id, orcamento_raiz_id, versao DESC);
