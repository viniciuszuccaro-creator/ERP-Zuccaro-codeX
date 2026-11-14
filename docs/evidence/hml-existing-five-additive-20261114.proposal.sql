-- PRIVATE REVIEW PROPOSAL ONLY. Not a migration and never executed.
-- Removing the guard or changing ROLLBACK requires separate reviewed authorization.
BEGIN;
DO $review_gate$ BEGIN RAISE EXCEPTION 'HML_SCHEMA_PROPOSAL_ONLY_NOT_AUTHORIZED'; END; $review_gate$;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE :"verified_hml_schema".marcas ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE :"verified_hml_schema".marcas ADD COLUMN IF NOT EXISTS codigo_origem TEXT;
ALTER TABLE :"verified_hml_schema".clientes ALTER COLUMN contatos SET DEFAULT '[]'::jsonb;
ROLLBACK;
