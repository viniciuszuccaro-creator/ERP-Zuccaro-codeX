import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Generalizes the existing private HML local-read CAS template. No endpoint,
// connection, role change or automatic execution; profiles/audit_logs stay canonical.
const catalog = JSON.parse(readFileSync(new URL('./owner-admin-permissoes.json', import.meta.url), 'utf8'));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';

/** Narrow SQL capability for the existing organizational editor; never runs SQL itself. */
export function prepareHmlOrganizacionalSqlPermissions(expected, empresaIds) {
  assert.ok(/^hml[a-z0-9_]+$/.test(expected.database) && /^hml[a-z0-9_]+$/.test(expected.schema));
  assert.ok(/^[a-z][a-z0-9_]+$/.test(expected.role) && /^\d+$/.test(expected.schemaOid)
    && /^\d+$/.test(expected.clusterIdentifier));
  for (const k of ['groupId', 'profileId', 'authUserId']) assert.ok(uuid(expected[k]));
  assert.ok(Array.isArray(empresaIds) && empresaIds.length === 2 && new Set(empresaIds).size === 2 && empresaIds.every(uuid));
  const schema = `"${expected.schema}"`, role = `"${expected.role}"`;
  const group = literal(expected.groupId) + '::uuid';
  const companies = empresaIds.map(id => literal(id) + '::uuid').join(',');
  const groupContext = `current_setting('app.group_id',true)=${literal(expected.groupId)}`;
  const predicate = {
    groups: `id=${group} AND ${groupContext} AND coalesce(current_setting('app.empresa_id',true),'')=''`,
    empresas: `group_id=${group} AND id IN (${companies}) AND ${groupContext}
      AND (coalesce(current_setting('app.empresa_id',true),'')='' OR id::text=current_setting('app.empresa_id',true))`,
  };
  const columns = { groups: ['nome_do_grupo', 'razao_social_grupo', 'cnpj_grupo', 'observacoes', 'updated_at'],
    empresas: ['razao_social', 'nome_fantasia', 'cnpj', 'updated_at'] };
  const guard = `DO $hml_org$
BEGIN
 IF current_database()<>${literal(expected.database)}
  OR (SELECT oid::text FROM pg_namespace WHERE nspname=${literal(expected.schema)}) IS DISTINCT FROM ${literal(expected.schemaOid)}
  OR (SELECT system_identifier::text FROM pg_control_system())<>${literal(expected.clusterIdentifier)}
  OR NOT EXISTS(SELECT 1 FROM ${schema}.profiles WHERE id=${literal(expected.profileId)}::uuid
    AND auth_user_id=${literal(expected.authUserId)}::uuid AND group_id=${group} AND empresa_id IS NULL AND ativo AND role='user')
  OR (SELECT count(*) FROM ${schema}.empresas WHERE group_id=${group} AND id IN (${companies}))<>2
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(expected.role)} AND NOT rolsuper AND NOT rolbypassrls)
 THEN RAISE EXCEPTION 'HML_ORGANIZACIONAL_TARGET_MISMATCH'; END IF;
END $hml_org$;`;
  const changes = Object.entries(columns).map(([table, cols]) => `GRANT UPDATE (${cols.join(',')}) ON ${schema}.${table} TO ${role};
CREATE POLICY hml_org_edit ON ${schema}.${table} FOR UPDATE TO ${role}
 USING (${predicate[table]}) WITH CHECK (${predicate[table]});`).join('\n');
  const reverse = Object.entries(columns).map(([table, cols]) => `DROP POLICY hml_org_edit ON ${schema}.${table};
REVOKE UPDATE (${cols.join(',')}) ON ${schema}.${table} FROM ${role};`).join('\n');
  return { kind: 'HML_ORGANIZACIONAL_SQL_PLAN_NOT_EXECUTED', guardSql: guard, sql: guard + '\n' + changes,
    reverseSql: guard + '\n' + reverse, columns, empresaIds: [...empresaIds], target: { ...expected },
    sqlSha256: digest(guard + '\n' + changes), changesRole: false, operationalAuthorized: false,
    requiresBackupRestoreReviewAndAbsentColumnPrivileges: true, requiresPostimageCasBeforeReversal: true };
}

/** Schema preparation only: assignment stays in OrganizacionalService, never in application startup. */
export function prepareHmlOrganizacionalCodeSchema(expected, empresaIds) {
  const { guardSql } = prepareHmlOrganizacionalSqlPermissions(expected, empresaIds);
  const schema = `"${expected.schema}"`;
  const sql = `${guardSql}
ALTER TABLE ${schema}.groups ADD COLUMN codigo text NULL;
ALTER TABLE ${schema}.empresas ADD COLUMN codigo text NULL;
CREATE UNIQUE INDEX groups_codigo_unique ON ${schema}.groups(codigo);
CREATE UNIQUE INDEX empresas_group_codigo_unique ON ${schema}.empresas(group_id,codigo);`;
  const reverseSql = `${guardSql}
DO $hml_code_reverse$ BEGIN
 IF EXISTS(SELECT 1 FROM ${schema}.groups WHERE codigo IS NOT NULL)
 OR EXISTS(SELECT 1 FROM ${schema}.empresas WHERE codigo IS NOT NULL)
 THEN RAISE EXCEPTION 'CODES_REQUIRE_AUDITED_CAS_REVERSAL_FIRST'; END IF;
END $hml_code_reverse$;
ALTER TABLE ${schema}.empresas DROP COLUMN codigo;
ALTER TABLE ${schema}.groups DROP COLUMN codigo;`;
  return { kind: 'HML_ORGANIZACIONAL_CODE_SCHEMA_NOT_EXECUTED', sql, reverseSql,
    sqlSha256: digest(sql), target: { ...expected }, empresaIds: [...empresaIds],
    changesGrants: false, automaticBackfill: false, operationalAuthorized: false,
    requiresAbsentColumnsBackupRestoreReview: true };
}

/** Nullable declarations only; no defaults, population, tax activation or new policy. */
export function prepareHmlOrganizacionalFiscalSchema(expected, empresaIds) {
  const { guardSql } = prepareHmlOrganizacionalSqlPermissions(expected, empresaIds);
  const s = `"${expected.schema}"`, role = `"${expected.role}"`;
  const sql = `${guardSql}
ALTER TABLE ${s}.groups ADD COLUMN inscricao_estadual text NULL CHECK (char_length(inscricao_estadual)<=40);
ALTER TABLE ${s}.empresas ADD COLUMN inscricao_estadual text NULL CHECK (char_length(inscricao_estadual)<=40);
ALTER TABLE ${s}.empresas ADD COLUMN regime_tributario text NULL CHECK (regime_tributario IN ('Simples Nacional','Lucro Presumido','Lucro Real','MEI'));
GRANT UPDATE (inscricao_estadual) ON ${s}.groups TO ${role};
GRANT UPDATE (inscricao_estadual,regime_tributario) ON ${s}.empresas TO ${role};`;
  const reverseSql = `${guardSql}
DO $hml_fiscal_reverse$ BEGIN
 IF EXISTS(SELECT 1 FROM ${s}.groups WHERE inscricao_estadual IS NOT NULL)
 OR EXISTS(SELECT 1 FROM ${s}.empresas WHERE inscricao_estadual IS NOT NULL OR regime_tributario IS NOT NULL)
 THEN RAISE EXCEPTION 'FISCAL_VALUES_REQUIRE_AUDITED_CAS_REVERSAL_FIRST'; END IF;
END $hml_fiscal_reverse$;
REVOKE UPDATE (inscricao_estadual) ON ${s}.groups FROM ${role};
REVOKE UPDATE (inscricao_estadual,regime_tributario) ON ${s}.empresas FROM ${role};
ALTER TABLE ${s}.empresas DROP COLUMN regime_tributario,DROP COLUMN inscricao_estadual;
ALTER TABLE ${s}.groups DROP COLUMN inscricao_estadual;`;
  return { kind: 'HML_ORGANIZACIONAL_FISCAL_SCHEMA_NOT_EXECUTED', sql, reverseSql,
    sqlSha256: digest(sql), target: { ...expected }, empresaIds: [...empresaIds],
    columns: { groups: ['inscricao_estadual'], empresas: ['inscricao_estadual', 'regime_tributario'] },
    createsRolesOrPolicies: false, populatesValues: false, operationalAuthorized: false };
}
function validateTree(value) {
  assert.ok(value && typeof value === 'object', 'PERMISSION_TREE_REQUIRED');
  if (Array.isArray(value)) {
    assert.ok(value.every(action => typeof action === 'string' && action.length > 0 && action !== '*'), 'ACTION_INVALID');
  } else for (const [key, child] of Object.entries(value)) {
    assert.ok(key !== '*' && key.length > 0, 'WILDCARD_DENIED');
    validateTree(child);
  }
}
function isSubset(before, after) {
  if (Array.isArray(before)) return Array.isArray(after) && before.every(action => after.includes(action));
  return after && !Array.isArray(after) && Object.entries(before).every(([key, child]) =>
    Object.hasOwn(after, key) && isSubset(child, after[key]));
}

export function prepareHmlOwnerPermissions({ before, expected, requestId, approvalRef,
  direction = 'grant', restorePermissions, originalRequestId }) {
  assert.ok(expected && /^hml[a-z0-9_]+$/.test(expected.database)
    && /^hml[a-z0-9_]+$/.test(expected.schema) && /^\d+$/.test(expected.schemaOid)
    && /^\d+$/.test(expected.clusterIdentifier), 'HML_TARGET_REQUIRED');
  for (const key of ['profileId', 'authUserId', 'groupId']) assert.ok(uuid(expected[key]), 'IDENTITY_REQUIRED');
  assert.ok(before?.id === expected.profileId && before.auth_user_id === expected.authUserId
    && before.group_id === expected.groupId && before.empresa_id === null
    && before.role === 'user' && before.ativo === true, 'PROFILE_BINDING_REQUIRED');
  assert.match(requestId, /^HML-owner-(grant|reverse)-[a-zA-Z0-9-]{8,100}$/);
  assert.match(approvalRef, /^OWNER_AUTHORIZED_HML_FULL_[A-Z0-9_-]{8,100}$/);
  assert.ok(['grant', 'reverse'].includes(direction) && requestId.startsWith(`HML-owner-${direction}-`));
  validateTree(before.permissoes); validateTree(catalog);
  const next = direction === 'grant' ? structuredClone(catalog) : structuredClone(restorePermissions);
  validateTree(next);
  if (direction === 'grant') assert.ok(isSubset(before.permissoes, next), 'EXISTING_CAPABILITY_WOULD_BE_LOST');
  else assert.match(originalRequestId, /^HML-owner-grant-[a-zA-Z0-9-]{8,100}$/);
  const schema = `"${expected.schema}"`;
  const tag = '$hml_owner_' + digest({ before, next, requestId }).slice(0, 24) + '$';
  assert.ok(!JSON.stringify({ before, next, requestId, approvalRef }).includes(tag));
  const reverseGuard = direction === 'reverse' ? `
  IF NOT EXISTS(SELECT 1 FROM ${schema}.audit_logs WHERE entity='Profile' AND entity_id=p.id::text
    AND group_id=p.group_id AND actor_id=p.id AND request_id=${literal(originalRequestId)}
    AND after_data->'profile'=${json(before)} AND before_data->'profile'->'permissoes'=${json(next)})
    THEN RAISE EXCEPTION 'HML_ORIGINAL_PERMISSION_RECEIPT_REQUIRED'; END IF;` : '';
  const sql = `SET LOCAL standard_conforming_strings=on;
SET LOCAL search_path TO pg_catalog,${schema},pg_temp;
DO ${tag}
DECLARE p ${schema}.profiles%ROWTYPE; changed ${schema}.profiles%ROWTYPE;
BEGIN
  IF pg_catalog.current_database()<>${literal(expected.database)} OR pg_catalog.current_schema()<>'pg_catalog'
    OR (SELECT oid::text FROM pg_catalog.pg_namespace WHERE nspname=${literal(expected.schema)}) IS DISTINCT FROM ${literal(expected.schemaOid)}
    OR (SELECT system_identifier::text FROM pg_catalog.pg_control_system())<>${literal(expected.clusterIdentifier)}
    THEN RAISE EXCEPTION 'HML_PHYSICAL_TARGET_MISMATCH'; END IF;
  SELECT * INTO STRICT p FROM ${schema}.profiles WHERE id=${literal(before.id)}::uuid FOR UPDATE;
  IF p.auth_user_id IS DISTINCT FROM ${literal(expected.authUserId)}::uuid OR p.group_id IS DISTINCT FROM ${literal(expected.groupId)}::uuid
    OR p.empresa_id IS NOT NULL OR p.role IS DISTINCT FROM 'user' OR p.ativo IS DISTINCT FROM true
    THEN RAISE EXCEPTION 'HML_PROFILE_BINDING_CHANGED'; END IF;
  IF p.permissoes=${json(next)} AND EXISTS(SELECT 1 FROM ${schema}.audit_logs
    WHERE entity='Profile' AND entity_id=p.id::text AND group_id=p.group_id AND actor_id=p.id
      AND request_id=${literal(requestId)} AND action='update'
      AND before_data->'profile'=${json(before)} AND after_data->'profile'=pg_catalog.to_jsonb(p)
      AND after_data->>'approval'=${literal(approvalRef)}) THEN RETURN; END IF;
  IF pg_catalog.to_jsonb(p)<>${json(before)} THEN RAISE EXCEPTION 'HML_PROFILE_CAS_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM ${schema}.audit_logs WHERE request_id=${literal(requestId)})
    THEN RAISE EXCEPTION 'HML_PROFILE_REPLAY_CONFLICT'; END IF;
  ${reverseGuard}
  UPDATE ${schema}.profiles SET permissoes=${json(next)} WHERE id=p.id AND group_id=p.group_id RETURNING * INTO STRICT changed;
  INSERT INTO ${schema}.audit_logs(group_id,empresa_id,actor_id,entity,entity_id,action,before_data,after_data,request_id)
  VALUES(p.group_id,NULL,p.id,'Profile',p.id::text,'update',pg_catalog.jsonb_build_object('profile',pg_catalog.to_jsonb(p)),
    pg_catalog.jsonb_build_object('profile',pg_catalog.to_jsonb(changed),'approval',${literal(approvalRef)},
      'reason','OWNER_AUTHORIZED_HML_FULL_EXPLICIT_CATALOG','direction',${literal(direction)},
      'database_executor',current_user,'execution_origin','EXISTING_HML_ADMIN_CHANNEL'),${literal(requestId)});
END ${tag};`;
  return { kind: 'HML_OWNER_PERMISSION_PLAN_NOT_EXECUTED', beforeSha256: digest(before),
    catalogSha256: digest(catalog), nextPermissions: next, sql, sqlSha256: digest(sql),
    direction, requestId, approvalRef, target: structuredClone(expected),
    changesRole: false, changesSqlGrants: false, operationalAuthorized: false };
}
