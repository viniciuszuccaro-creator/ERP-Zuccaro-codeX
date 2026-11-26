-- Candidate only. Run inside an explicit transaction with the pinned tenant
-- schema first and pg_catalog second. Pass fornecedor_reader as a psql value
-- for the existing restricted role; this file does not grant table access.
DO $$
BEGIN
  IF current_schema() IS NULL
     OR current_schema() IN ('public', 'pg_catalog', 'information_schema')
     OR current_schemas(false) <> ARRAY[current_schema()::name, 'pg_catalog'::name] THEN
    RAISE EXCEPTION 'FORNECEDOR_SCHEMA_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = to_regclass(format('%I.fornecedores', current_schema()))
      AND relrowsecurity AND relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'FORNECEDOR_RLS_REQUIRED';
  END IF;
END $$;

CREATE POLICY fornecedor_company_read ON fornecedores
FOR SELECT TO :"fornecedor_reader"
USING (
  fornecedores.empresa_id IS NULL
  AND fornecedores.group_id = nullif(current_setting('app.group_id', true), '')::uuid
  AND EXISTS (
    SELECT 1 FROM empresas e
    WHERE e.group_id = fornecedores.group_id
      AND e.id = nullif(current_setting('app.empresa_id', true), '')::uuid
      AND e.status = 'Ativa'
  )
);
