import { createHash } from 'node:crypto';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
const historyClass = 'BAIXA_HISTORICA_SEM_COMPROVANTE';
const entity = 'LegacySupplierSettlementHistory';

export function bindSupplierSettlementRehearsal({ db, audit, authorize, ctx, bytes, expectedSha, targetPin }) {
  if (sha(bytes) !== expectedSha || !db.withTenantContext || typeof authorize !== 'function'
      || !uuid.test(ctx.actorId) || !uuid.test(ctx.groupId) || !uuid.test(ctx.empresaId)) {
    throw new Error('HISTORY_SCOPE_OR_HASH');
  }
  const scope = Object.freeze({ ...ctx });
  const m = JSON.parse(bytes.toString());
  if (m.kind !== 'legacy-supplier-settlement-history-review' || m.executable !== false
      || m.createsPayable !== false || m.confirmsPayment !== false
      || m.destination?.groupId !== scope.groupId || !digest.test(m.sourceArchiveSha256)
      || !Array.isArray(m.rows) || m.rows.length !== m.count || !m.rows.length
      || m.rows.some(r => !uuid.test(r.empresaId) || r.classe !== historyClass
        || ![r.relatorio, r.fornecedor, r.nota, r.dataBaixa].every(n => Number.isSafeInteger(n) && n > 0)
        || !/^([0-9A-F]{2}){1,25}$/.test(r.sequenciaHex)
        || typeof r.valor !== 'string' || !/^\d+(?:\.\d+)?$/.test(r.valor) || !/[1-9]/.test(r.valor))
      || new Set(m.rows.map(r => `${r.relatorio}:${r.sequenciaHex}`)).size !== m.rows.length) {
    throw new Error('HISTORY_INVALID_MANIFEST');
  }
  const rows = m.rows.filter(r => r.empresaId === scope.empresaId);
  if (!rows.length) throw new Error('HISTORY_COMPANY_NOT_PRESENT');
  const pin = { ...targetPin };
  const physicalKeys = ['cluster_id', 'database_oid', 'schema_oid'];
  if (!physicalKeys.every(key => typeof pin[key] === 'string' && /^[1-9]\d*$/.test(pin[key]))
      || typeof pin.role !== 'string' || !pin.role) {
    throw new Error('HISTORY_REHEARSAL_PIN_REQUIRED');
  }

  async function transact(mode, block) {
    const requestId = 'supplier-history:' + sha(JSON.stringify([expectedSha, scope.empresaId, mode,
      block.map(r => [r.relatorio, r.sequenciaHex])]));
    const context = { ...scope, requestId };
    return db.withTenantContext(context, () => db.withTransaction(async q => {
      const { rows: [target] } = await q.query(
        `SELECT current_database() AS db, current_schema() AS schema,
          NOT (rolsuper OR rolbypassrls) AS restricted, current_user AS role, session_user AS login,
          current_schemas(false)::text[] AS schemas, d.oid::text AS database_oid, n.oid::text AS schema_oid,
          (pg_catalog.pg_control_system()).system_identifier::text AS cluster_id
        FROM pg_catalog.pg_roles, pg_catalog.pg_database d, pg_catalog.pg_namespace n
        WHERE rolname = current_user AND d.datname = current_database() AND n.nspname = current_schema()`);
      if (target?.db !== 'erp_history_rehearsal' || target.schema !== m.destination.schema || !target.restricted
          || target.role !== pin.role || target.login !== pin.role
          || target.schemas?.length !== 2 || target.schemas[0] !== m.destination.schema || target.schemas[1] !== 'pg_catalog'
          || physicalKeys.some(key => target[key] !== pin[key])) {
        throw new Error('HISTORY_REHEARSAL_DESTINATION_REQUIRED');
      }
      await authorize(context, mode, q);
      await q.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))", [entity, scope.groupId]);
      const args = [scope.groupId, scope.empresaId, m.sourceArchiveSha256, expectedSha, JSON.stringify(block)];
      const input = `WITH input AS (SELECT r, (r->>'relatorio')::int rel, r->>'sequenciaHex' seq
        FROM jsonb_array_elements($5::jsonb) AS r)`;
      const match = `h.group_id=$1 AND h.empresa_id=$2 AND h.source_archive_sha256=$3
        AND h.source_report=i.rel AND h.source_sequence_hex=i.seq`;
      const exact = 'h.manifest_sha256=$4 AND h.source_snapshot=i.r';
      const reconcile = () => q.query(`${input}
        SELECT count(*)::int AS n, count(*) FILTER (WHERE h.archived)::int AS archived
        FROM input i JOIN legacy_supplier_settlement_history h ON ${match} AND ${exact}`, args);
      let changed;
      if (mode === 'apply') {
        changed = (await q.query(`${input} INSERT INTO legacy_supplier_settlement_history
          (group_id,empresa_id,source_archive_sha256,source_report,source_sequence_hex,supplier_legacy_code,
           fiscal_note_number,legacy_settlement_marker,original_title_amount,manifest_sha256,source_snapshot)
          SELECT $1,$2,$3,rel,seq,(r->>'fornecedor')::int,(r->>'nota')::int,(r->>'dataBaixa')::int,
            (r->>'valor')::numeric,$4,r FROM input ON CONFLICT DO NOTHING`, args)).rowCount;
        const { rows: [state] } = await reconcile();
        if (state.n !== block.length || state.archived) throw new Error('HISTORY_CONFLICT_OR_ARCHIVED');
      } else {
        const { rows: [state] } = await reconcile();
        if (state.n !== block.length) throw new Error('HISTORY_REVERSAL_MISMATCH');
        changed = (await q.query(`${input} UPDATE legacy_supplier_settlement_history h SET archived=true
          FROM input i WHERE ${match} AND ${exact} AND NOT h.archived`, args)).rowCount;
        if ((await reconcile()).rows[0].archived !== block.length) throw new Error('HISTORY_REVERSAL_INCOMPLETE');
      }
      if (changed) await audit.append({ ...context, entity, action: mode === 'apply' ? 'create' : 'inactivate',
        afterData: { manifestSha256: expectedSha, count: changed, archived: mode === 'reverse' } }, q);
      return changed;
    }));
  }
  return async ({ mode, batchSize = 1000, onCommitted = () => {} }) => {
    if (!['apply', 'reverse'].includes(mode) || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
      throw new Error('HISTORY_INVALID_RUN_OPTIONS');
    }
    let changed = 0;
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const count = await transact(mode, rows.slice(offset, offset + batchSize));
      changed += count;
      await onCommitted({ offset, changed: count });
    }
    return { processed: rows.length, changed };
  };
}
