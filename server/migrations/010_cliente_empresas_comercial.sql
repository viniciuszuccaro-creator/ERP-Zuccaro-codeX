-- ERP-RUNTIME-05: evolui cliente_empresas existente (sem tabela paralela).
-- Núcleo de elegibilidade comercial por Empresa; sem crédito/preço/pagamento.
-- Migrations 001-009 permanecem imutáveis.

ALTER TABLE cliente_empresas
  ADD COLUMN IF NOT EXISTS situacao_comercial TEXT NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS habilitado_operacao BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT,
  ADD COLUMN IF NOT EXISTS bloqueado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bloqueado_por UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS observacao_comercial TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'ERP',
  ADD COLUMN IF NOT EXISTS legacy_id TEXT,
  ADD COLUMN IF NOT EXISTS legacy_code TEXT,
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS migration_batch TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id);

-- Convergência segura para vínculos inativos anteriores à migration 010.
UPDATE cliente_empresas
SET situacao_comercial = 'INATIVO',
    habilitado_operacao = false
WHERE ativo = false
  AND (
    situacao_comercial IS DISTINCT FROM 'INATIVO'
    OR habilitado_operacao IS DISTINCT FROM false
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_empresas_situacao_comercial'
      AND conrelid = 'cliente_empresas'::regclass
  ) THEN
    ALTER TABLE cliente_empresas
      ADD CONSTRAINT chk_cliente_empresas_situacao_comercial
      CHECK (situacao_comercial IN ('PROSPECT', 'ATIVO', 'INATIVO'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_empresas_habilitacao'
      AND conrelid = 'cliente_empresas'::regclass
  ) THEN
    ALTER TABLE cliente_empresas
      ADD CONSTRAINT chk_cliente_empresas_habilitacao
      CHECK (
        (ativo = false AND habilitado_operacao = false AND situacao_comercial = 'INATIVO')
        OR (
          ativo = true
          AND (
            habilitado_operacao = false
            OR situacao_comercial = 'ATIVO'
          )
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_empresas_bloqueio'
      AND conrelid = 'cliente_empresas'::regclass
  ) THEN
    ALTER TABLE cliente_empresas
      ADD CONSTRAINT chk_cliente_empresas_bloqueio
      CHECK (
        (
          bloqueado = true
          AND motivo_bloqueio IS NOT NULL
          AND btrim(motivo_bloqueio) <> ''
          AND bloqueado_em IS NOT NULL
          AND bloqueado_por IS NOT NULL
        )
        OR (
          bloqueado = false
          AND motivo_bloqueio IS NULL
          AND bloqueado_em IS NULL
          AND bloqueado_por IS NULL
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_empresas_origem'
      AND conrelid = 'cliente_empresas'::regclass
  ) THEN
    ALTER TABLE cliente_empresas
      ADD CONSTRAINT chk_cliente_empresas_origem
      CHECK (
        origem IN (
          'ERP', 'MIGRACAO', 'SITE_CPA', 'B2B', 'PORTAL', 'CHATBOT',
          'WHATSAPP', 'MARKETPLACE', 'APP', 'API'
        )
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cliente_empresas_operacional
  ON cliente_empresas (group_id, empresa_id, ativo, bloqueado, situacao_comercial);

CREATE INDEX IF NOT EXISTS idx_cliente_empresas_legacy
  ON cliente_empresas (group_id, source_system, legacy_id)
  WHERE legacy_id IS NOT NULL;

-- Reafirma proteção consolidada no RUNTIME-04.
ALTER TABLE cliente_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_empresas FORCE ROW LEVEL SECURITY;
