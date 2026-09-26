-- Comercial 360 Onda 6 — crédito no ClienteEmpresa existente (sem tabela paralela).
-- limite_credito NULL = política não configurada (CreditPort retorna null).
-- Migrations 001-031 permanecem imutáveis.

ALTER TABLE cliente_empresas
  ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS limite_utilizado NUMERIC(18,6) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_empresas_limite_credito'
      AND conrelid = 'cliente_empresas'::regclass
  ) THEN
    ALTER TABLE cliente_empresas
      ADD CONSTRAINT chk_cliente_empresas_limite_credito
      CHECK (limite_credito IS NULL OR limite_credito >= 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_empresas_limite_utilizado'
      AND conrelid = 'cliente_empresas'::regclass
  ) THEN
    ALTER TABLE cliente_empresas
      ADD CONSTRAINT chk_cliente_empresas_limite_utilizado
      CHECK (limite_utilizado >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cliente_empresas_credito
  ON cliente_empresas (group_id, empresa_id)
  WHERE limite_credito IS NOT NULL;
