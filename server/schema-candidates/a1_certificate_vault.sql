-- HML candidate only. Not a journal migration and never executed by API startup.
-- Maintenance must set search_path to the verified HML schema and app.a1_app_role
-- to the existing non-superuser/NOBYPASSRLS application role after owner approval.
DO $gate$
BEGIN
 IF current_schema() !~ '^hml[a-z0-9_]+$'
 OR current_database() !~ '^(hml[a-z0-9_]+|erp_test)$'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_setting('app.a1_app_role',true)
   AND NOT rolsuper AND NOT rolbypassrls)
 THEN RAISE EXCEPTION 'A1_HML_SCHEMA_GATE_REQUIRED'; END IF;
END $gate$;

CREATE TABLE a1_certificate_vault (
 id uuid PRIMARY KEY,
 group_id uuid NOT NULL REFERENCES groups(id),
 empresa_id uuid NOT NULL REFERENCES empresas(id),
 operation_id uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES profiles(id),
 issuer_cnpj text NOT NULL CHECK (issuer_cnpj ~ '^[0-9]{14}$'),
 fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
 valid_from timestamptz NOT NULL,
 valid_to timestamptz NOT NULL CHECK (valid_to>valid_from),
 trust_version text NOT NULL CHECK (trust_version ~ '^[A-Za-z0-9_-]{1,80}$'),
 state text NOT NULL CHECK (state IN ('ACTIVE','REVOKED_LOCAL','SUPERSEDED')),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
 encrypted_envelope jsonb NOT NULL CHECK (
   jsonb_typeof(encrypted_envelope)='object'
   AND encrypted_envelope ?& ARRAY['version','algorithm','keyId','nonce','tag','ciphertext']
   AND encrypted_envelope-ARRAY['version','algorithm','keyId','nonce','tag','ciphertext']='{}'::jsonb
   AND encrypted_envelope->'version'='1'::jsonb
   AND encrypted_envelope->>'algorithm'='aes-256-gcm'
   AND pg_column_size(encrypted_envelope)<=12000000),
 UNIQUE(group_id,empresa_id,operation_id)
);
CREATE UNIQUE INDEX a1_certificate_one_active ON a1_certificate_vault(group_id,empresa_id) WHERE state='ACTIVE';
ALTER TABLE a1_certificate_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE a1_certificate_vault FORCE ROW LEVEL SECURITY;
REVOKE ALL ON a1_certificate_vault FROM PUBLIC;

DO $policies$
DECLARE
 role_name text := current_setting('app.a1_app_role');
 predicate text := $predicate$
 group_id::text=current_setting('app.group_id',true)
 AND empresa_id::text=current_setting('app.empresa_id',true)
 AND EXISTS(SELECT 1 FROM empresas e WHERE e.id=a1_certificate_vault.empresa_id AND e.group_id=a1_certificate_vault.group_id)
 $predicate$;
BEGIN
 EXECUTE format('CREATE POLICY a1_read ON a1_certificate_vault FOR SELECT TO %I USING (%s)',role_name,predicate);
 EXECUTE format('CREATE POLICY a1_insert ON a1_certificate_vault FOR INSERT TO %I WITH CHECK (%s)',role_name,predicate);
 EXECUTE format('CREATE POLICY a1_change ON a1_certificate_vault FOR UPDATE TO %I USING (%s) WITH CHECK (%s)',role_name,predicate,predicate);
 EXECUTE format('GRANT SELECT ON a1_certificate_vault TO %I',role_name);
 EXECUTE format('GRANT INSERT (id,group_id,empresa_id,operation_id,created_by,issuer_cnpj,fingerprint,valid_from,valid_to,trust_version,state,encrypted_envelope) ON a1_certificate_vault TO %I',role_name);
 EXECUTE format('GRANT UPDATE (state,revision,encrypted_envelope) ON a1_certificate_vault TO %I',role_name);
END $policies$;
