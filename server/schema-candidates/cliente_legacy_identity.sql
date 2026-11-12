-- CANDIDATE ONLY: exact Cliente index from 043, without unrelated domains.
-- Target/role review, current duplicates, backup and specific approval required.
-- A name alone never proves an existing index has the reviewed definition.
DO $$ BEGIN
  IF to_regclass('clientes_legacy_identity_uidx') IS NOT NULL THEN
    RAISE EXCEPTION 'LEGACY_CLIENT_INDEX_DEFINITION_REVIEW_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM clientes WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL
    GROUP BY group_id,source_system,codigo_legado HAVING count(*)>1) THEN
    RAISE EXCEPTION 'LEGACY_CLIENT_IDENTITY_RECONCILIATION_REQUIRED';
  END IF;
END $$;

CREATE UNIQUE INDEX clientes_legacy_identity_uidx
  ON clientes(group_id,source_system,codigo_legado)
  WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL;
