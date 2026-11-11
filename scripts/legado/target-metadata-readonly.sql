-- Prepared only. Execute solely after authorization of the exact destination and read-only principal.
-- No business rows, secrets, migrations, grants, backups, restore or operational mutation.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_database() AS database_name, current_user AS session_role,
       current_schema() AS schema_name, version() AS database_version;
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
FROM pg_catalog.pg_roles WHERE rolname = current_user;
SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('schema_migrations', 'clientes', 'cliente_empresas', 'cliente_locais',
                    'fornecedores', 'produtos', 'unidades_medida', 'audit_logs', 'profiles')
ORDER BY table_schema, table_name, ordinal_position;
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_catalog.pg_get_userbyid(c.relowner) AS table_owner
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relkind = 'r'
ORDER BY c.relname;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies WHERE schemaname = current_schema()
ORDER BY tablename, policyname;
-- Missing/inaccessible journal is a blocking error, not evidence of an empty destination.
SELECT id, applied_at FROM schema_migrations ORDER BY id;
ROLLBACK;
