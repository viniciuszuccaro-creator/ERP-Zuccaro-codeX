-- CANDIDATE ONLY: no migration number, automatic application, grants or backfill.
-- Review target identity, role privileges and rollback before operational use.
ALTER TABLE clientes ADD COLUMN contatos jsonb;
ALTER TABLE clientes ADD CONSTRAINT clientes_contatos_array_limit CHECK (
  contatos IS NULL OR CASE WHEN jsonb_typeof(contatos) = 'array'
    THEN jsonb_array_length(contatos) <= 200 ELSE false END
);
