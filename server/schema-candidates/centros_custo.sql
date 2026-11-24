-- Candidate for the existing accounting-master consumer. No grants or backfill.
DO $$
BEGIN
  IF current_schema() IN ('public', 'pg_catalog', 'information_schema')
      OR current_schemas(false) <> ARRAY[current_schema()::name, 'pg_catalog'::name] THEN
    RAISE EXCEPTION 'CENTRO_CUSTO_SCHEMA_ISOLADO_OBRIGATORIO';
  END IF;
END $$;

-- Same company identity key used by migration 040.
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_id_group_scope ON empresas(id, group_id);

CREATE TABLE centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  codigo text NOT NULL CHECK (codigo = btrim(codigo) AND length(codigo) BETWEEN 1 AND 80),
  descricao text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 1 AND 255),
  ativo boolean NOT NULL,
  source_system text,
  legacy_id text,
  UNIQUE (id, group_id, empresa_id),
  FOREIGN KEY (empresa_id, group_id) REFERENCES empresas(id, group_id),
  CHECK ((source_system IS NULL AND legacy_id IS NULL)
    OR (source_system IS NOT NULL AND legacy_id IS NOT NULL
      AND length(btrim(source_system)) BETWEEN 1 AND 80
      AND length(btrim(legacy_id)) BETWEEN 1 AND 120))
);

CREATE UNIQUE INDEX centros_custo_empresa_codigo_uidx
  ON centros_custo(group_id, empresa_id, lower(codigo));
CREATE UNIQUE INDEX centros_custo_empresa_legacy_uidx
  ON centros_custo(group_id, empresa_id, source_system, legacy_id)
  WHERE source_system IS NOT NULL;

ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE centros_custo FORCE ROW LEVEL SECURITY;
REVOKE ALL ON centros_custo FROM PUBLIC;
CREATE POLICY centros_custo_empresa_scope ON centros_custo
  USING (group_id = NULLIF(current_setting('app.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK (group_id = NULLIF(current_setting('app.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::uuid);
