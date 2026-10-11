-- Shared import identity. No backfill, merge, deletion, company grant or operational balance.
DO $$ BEGIN
  IF to_regclass('oportunidades') IS NULL OR to_regclass('produto_empresas') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=current_schema()
      AND tablename='profiles' AND policyname='profiles_auth_bootstrap_select') THEN
    RAISE EXCEPTION 'LEGACY_IDENTITY_REQUIRES_038_042';
  END IF;
  IF EXISTS (SELECT 1 FROM clientes WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL
    GROUP BY group_id,source_system,codigo_legado HAVING count(*)>1) THEN
    RAISE EXCEPTION 'LEGACY_CLIENT_IDENTITY_RECONCILIATION_REQUIRED';
  END IF;
END $$;

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo_legado text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS source_system text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS migration_batch text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM produtos WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL
    GROUP BY group_id,source_system,codigo_legado HAVING count(*)>1) THEN
    RAISE EXCEPTION 'LEGACY_PRODUCT_IDENTITY_RECONCILIATION_REQUIRED';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_legacy_identity_uidx
  ON clientes(group_id,source_system,codigo_legado)
  WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS produtos_legacy_identity_uidx
  ON produtos(group_id,source_system,codigo_legado)
  WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL;
