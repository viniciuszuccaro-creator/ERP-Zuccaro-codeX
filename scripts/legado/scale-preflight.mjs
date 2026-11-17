import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Read-only assessment of an existing pinned plan; never changes its applicability or writes a client. */
export async function assessPreparedClientScale(db, prepared, authorize) {
  const { manifest, batches } = prepared;
  assert.equal(manifest.kind, 'canonical_client_import_v1');
  assert.equal(manifest.context.scopeType, 'grupo');
  assert.equal(manifest.context.empresaId, null);
  assert.ok(db.withTenantContext && typeof authorize === 'function');
  assert.ok(batches.length > 0 && batches.every(b => b.items.length > 0 && b.items.length <= 1000));
  const keys = batches.flatMap(b => b.items.map(({ payload: p }) => ({
    native: p.codigo_legado, codigo: p.codigo, documento: p.documento,
  })));
  assert.ok(keys.every(k => [k.native,k.codigo,k.documento].every(v => typeof v === 'string' && v.length > 0)));
  assert.equal(new Set(keys.map(k => k.native)).size, keys.length);
  const stop = new Error('READ_ONLY_ASSESSMENT_ROLLBACK');
  let result;
  try {
    await db.withTenantContext(manifest.context, () => db.withTransaction(async q => {
      await q.query('SET TRANSACTION READ ONLY');
      await q.query("SET LOCAL statement_timeout='15s'");
      await q.query("SET LOCAL lock_timeout='2s'");
      const physical = (await q.query(`SELECT pg_catalog.current_database() AS database,pg_catalog.current_schema() AS schema,current_user AS principal,
        (SELECT oid::int FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()) AS "databaseOid",
        (SELECT oid::int FROM pg_catalog.pg_namespace WHERE nspname=pg_catalog.current_schema()) AS "schemaOid",
        (SELECT system_identifier::text FROM pg_catalog.pg_control_system()) AS "clusterIdentifier"`)).rows[0];
      assert.deepEqual(physical, manifest.target, 'LEGACY_PHYSICAL_TARGET_MISMATCH');
      const role = (await q.query('SELECT rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user')).rows[0];
      assert.ok(role && !role.rolsuper && !role.rolbypassrls, 'APPLICATION_ROLE_REQUIRED');
      const permissions = {};
      for (const action of ['visualizar','criar','importar','inativar']) {
        try { await authorize(manifest.context, action, q); permissions[action] = true; }
        catch (error) { if (error?.statusCode !== 403) throw error; permissions[action] = false; }
      }
      const rows = (await q.query(`SELECT id,codigo,codigo_legado,source_system,documento_normalizado,ativo
        FROM clientes WHERE group_id=$1 ORDER BY id`, [manifest.context.groupId])).rows;
      const conflicts = (await q.query(`WITH incoming AS (
        SELECT * FROM pg_catalog.jsonb_to_recordset($1::jsonb) AS x(native text,codigo text,documento text)
      ) SELECT i.native,c.id,c.ativo,
        c.source_system=$3 AND c.codigo_legado=i.native AS same_identity,
        c.codigo=i.codigo AS same_code,
        c.documento_normalizado=pg_catalog.regexp_replace(i.documento,'[^0-9]','','g') AS same_document
        FROM incoming i JOIN clientes c ON c.group_id=$2 AND (
          (c.source_system=$3 AND c.codigo_legado=i.native) OR c.codigo=i.codigo OR
          c.documento_normalizado=pg_catalog.regexp_replace(i.documento,'[^0-9]','','g'))
        ORDER BY i.native,c.id`, [JSON.stringify(keys),manifest.context.groupId,manifest.sourceSystem])).rows;
      const indexes = (await q.query(`SELECT indexname,indexdef FROM pg_catalog.pg_indexes
        WHERE schemaname=pg_catalog.current_schema() AND tablename='clientes' ORDER BY indexname`)).rows;
      const duplicateIdentity = (await q.query(`SELECT count(*)::int AS n FROM (
        SELECT group_id,source_system,codigo_legado FROM clientes
        WHERE group_id=$1 AND source_system IS NOT NULL AND codigo_legado IS NOT NULL
        GROUP BY group_id,source_system,codigo_legado HAVING count(*)>1) x`, [manifest.context.groupId])).rows[0].n;
      const storage = (await q.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
        pg_catalog.has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
        pg_catalog.has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
        pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE') AS can_update
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=pg_catalog.current_schema() AND c.relname IN ('clientes','audit_logs','entity_code_sequences')
        ORDER BY c.relname`)).rows;
      result = { kind:'PREPARED_SCALE_READ_ONLY_ASSESSMENT',at:new Date().toISOString(),
        target:physical,permissions,selected:keys.length,batchSizes:batches.map(b=>b.items.length),
        existing:rows.length,active:rows.filter(r=>r.ativo).length,inactive:rows.filter(r=>!r.ativo).length,
        destinationIdentitySnapshotSha256:sha(rows),duplicateIdentity,indexes,storage,conflicts,
        conflictingSelected:new Set(conflicts.map(c=>c.native)).size,
        readOnlyRollback:true,businessWrites:0,applicable:false,
        notProven:['FIELD_AND_LINK_COMPLETENESS','PARTIAL_ACTIVE_LOAD_AUTHORIZATION','CURRENT_RECOVERABLE_BACKUP'] };
      throw stop;
    }));
  } catch (error) { if (error !== stop) throw error; }
  assert.ok(result);
  return result;
}
