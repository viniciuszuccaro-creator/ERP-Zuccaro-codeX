-- Assisted Review storage candidate. Apply only under an explicit schema/ACL gate.
CREATE TABLE legacy_client_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id),
  source_system text NOT NULL,
  native_key text NOT NULL,
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  correction jsonb CHECK (correction IS NULL OR jsonb_typeof(correction) = 'object'),
  archived boolean NOT NULL DEFAULT false,
  UNIQUE (group_id, source_system, native_key)
);

ALTER TABLE legacy_client_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_client_review FORCE ROW LEVEL SECURITY;
CREATE POLICY legacy_client_review_group ON legacy_client_review
  USING (group_id = NULLIF(current_setting('app.group_id', true), '')::uuid
    AND NULLIF(current_setting('app.empresa_id', true), '') IS NULL)
  WITH CHECK (group_id = NULLIF(current_setting('app.group_id', true), '')::uuid
    AND NULLIF(current_setting('app.empresa_id', true), '') IS NULL);
