-- Candidate for an isolated rehearsal only. No payable or payment is created.
DO $$
BEGIN
  IF current_schema() IN ('public', 'pg_catalog', 'information_schema')
    OR current_schemas(false) <> ARRAY[current_schema()::name, 'pg_catalog'::name] THEN
    RAISE EXCEPTION 'HISTORY_REQUIRES_ISOLATED_SCHEMA';
  END IF;
END $$;

CREATE TABLE legacy_supplier_settlement_history (
  group_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  source_archive_sha256 text NOT NULL CHECK (source_archive_sha256 ~ '^[a-f0-9]{64}$'),
  source_report integer NOT NULL,
  source_sequence_hex text NOT NULL CHECK (source_sequence_hex ~ '^([0-9A-F]{2}){1,25}$'),
  supplier_legacy_code integer NOT NULL CHECK (supplier_legacy_code > 0),
  fiscal_note_number integer NOT NULL CHECK (fiscal_note_number > 0),
  legacy_settlement_marker integer NOT NULL CHECK (legacy_settlement_marker > 0),
  original_title_amount numeric NOT NULL CHECK (original_title_amount > 0),
  archived boolean NOT NULL DEFAULT false,
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  source_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(source_snapshot) = 'object'
    AND coalesce(source_snapshot->>'classe', '') = 'BAIXA_HISTORICA_SEM_COMPROVANTE'
  ),
  PRIMARY KEY (group_id, source_archive_sha256, source_report, source_sequence_hex),
  FOREIGN KEY (empresa_id, group_id) REFERENCES empresas(id, group_id)
);

ALTER TABLE legacy_supplier_settlement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_supplier_settlement_history FORCE ROW LEVEL SECURITY;
-- No policies or grants are published by this candidate. Access fails closed.
