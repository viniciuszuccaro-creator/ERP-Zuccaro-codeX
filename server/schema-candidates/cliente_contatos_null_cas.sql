-- CANDIDATE ONLY: NULL ≠ []; limite 200. Revisar grants/rollback antes de uso operacional.
-- Não converte [] existentes em NULL.
ALTER TABLE clientes ALTER COLUMN contatos DROP NOT NULL;
ALTER TABLE clientes ALTER COLUMN contatos DROP DEFAULT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_contatos_array_limit'
  ) THEN
    ALTER TABLE clientes
      ADD CONSTRAINT clientes_contatos_array_limit CHECK (
        contatos IS NULL
        OR CASE
          WHEN jsonb_typeof(contatos) = 'array' THEN jsonb_array_length(contatos) <= 200
          ELSE false
        END
      );
  END IF;
END $$;
COMMENT ON COLUMN clientes.contatos IS
  'Canais ricos MASTER: omit ≠ limpar; [] = limpeza; NULL = desconhecido; CAS via expectedVersion.';
