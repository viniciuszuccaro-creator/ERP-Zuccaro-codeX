import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fields = ['nome_marca', 'descricao', 'pais_origem', 'categoria', 'ativo'];

// Keep interactive creates unchanged; the import owns the source checkpoint.
export function bindMarcaImport({ db, service, audit, rbacGuard, ctx, bytes, sha256 }) {
  if (!db.withTenantContext || !uuid.test(ctx.groupId) || (ctx.empresaId !== null && !uuid.test(ctx.empresaId)) ||
      !ctx.actorId || hash(bytes) !== sha256) throw new Error('MARCA_IMPORT_SCOPE_OR_HASH');
  const scope = Object.freeze({ ...ctx });
  const { destination, source, rows, executable } = JSON.parse(bytes.toString());
  const shared = scope.empresaId === null;
  const nativeId = value => typeof value === 'string' && value.length > 0 && value === value.trim();
  if (destination?.groupId !== scope.groupId || destination.empresaId !== scope.empresaId ||
      executable === false || (shared && (destination.scope !== 'group' || executable !== true)) ||
      source?.system !== 'Base44' || source.entity !== 'Marca' ||
      !Array.isArray(rows) || !rows.length || rows.length !== source.count ||
      rows.some(r => !r || !nativeId(r.id) ||
        typeof r.codigo !== 'string' || !r.codigo || r.codigo !== r.codigo.trim() ||
        typeof r.ativo !== 'boolean' || r.targetEmpresaId !== scope.empresaId || r.fornecedor_id ||
        (shared && (!nativeId(r.sourceGroupId) || !nativeId(r.sourceCompanyId) || !uuid.test(r.originEmpresaId)))) ||
      new Set(rows.map(r => r.id)).size !== rows.length ||
      new Set(rows.map(r => r.codigo.toLowerCase())).size !== rows.length) {
    throw new Error('MARCA_IMPORT_MANIFEST_INVALID');
  }
  const byId = new Map(rows.map(row => [row.id, row]));
  const run = (id, reverse) => {
    const row = byId.get(id);
    if (!row) throw new Error('MARCA_IMPORT_SOURCE_UNKNOWN');
    const requestId = 'legacy-marca:' + hash(JSON.stringify([scope.groupId, scope.empresaId, source.system, id]));
    const context = Object.freeze({ ...scope, requestId });
    return db.withTenantContext(context, () => db.withTransaction(async q => {
      await rbacGuard.assertAllowed(context, 'Cadastros', 'marca', reverse ? 'inativar' : 'criar',
        { allowGlobalWildcard: false, executor: q });
      await q.query("SET LOCAL TIME ZONE 'UTC'");
      await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [requestId]);
      if (shared) {
        const origin = await q.query('SELECT id FROM empresas WHERE group_id=$1 AND id=$2', [scope.groupId, row.originEmpresaId]);
        if (origin.rows.length !== 1) throw new Error('MARCA_IMPORT_ORIGIN_OUTSIDE_GROUP');
      }
      const keys = [scope.groupId, scope.empresaId, requestId];
      const checkpoints = (await q.query(`SELECT action, entity_id, after_data FROM audit_logs
        WHERE group_id=$1 AND empresa_id IS NOT DISTINCT FROM $2 AND request_id=$3 AND entity='Marca'
          AND action IN ('create','link','inactivate')`, keys)).rows;
      const entries = action => checkpoints.filter(r => r.action === action);
      const [creates, links, reversals] = ['create', 'link', 'inactivate'].map(entries);
      const [created] = links;
      if (links.length > 1 || creates.length !== links.length || reversals.length > 1 ||
          checkpoints.some(r => r.entity_id !== created?.entity_id)) {
        throw new Error('MARCA_IMPORT_CHECKPOINT_CONFLICT');
      }
      const snapshot = async target => (await q.query(`SELECT to_jsonb(m)::text AS image
        FROM marcas m WHERE group_id=$1 AND empresa_id IS NOT DISTINCT FROM $2 AND id=$3 FOR UPDATE`,
      [scope.groupId, scope.empresaId, target])).rows[0]?.image;
      const mark = (action, target, afterData) => audit.append({
        ...context, entity: 'Marca', entityId: target, action, afterData,
      }, q);
      if (!created) {
        if (reverse) return { state: 'not_applied' };
        const payload = Object.fromEntries(fields.map(k => [k, row[k]]));
        const record = await service.create(context, {
          ...payload, codigo: row.codigo, codigo_origem: row.codigo, empresa_id: scope.empresaId,
        });
        const image = await snapshot(record.id);
        if (!image || record.empresa_id !== scope.empresaId || record.codigo !== row.codigo || record.codigo_origem !== row.codigo) {
          throw new Error('MARCA_IMPORT_POSTIMAGE_MISMATCH');
        }
        const provenance = shared ? {
          sourceId: row.id, sourceGroupId: row.sourceGroupId, sourceCompanyId: row.sourceCompanyId, originEmpresaId: row.originEmpresaId,
        } : {};
        await mark('link', record.id, { fingerprint: hash(image), manifest: sha256, codigo: record.codigo, ...provenance });
        return { state: 'inserted', id: record.id, codigo: record.codigo };
      }
      const target = created.entity_id;
      if (created.after_data?.manifest !== sha256) throw new Error('MARCA_IMPORT_MANIFEST_CHANGED');
      if (reversals.length) return { state: 'reversed', id: target };
      const image = await snapshot(target);
      if (!image || hash(image) !== created.after_data?.fingerprint) return { state: 'changed', id: target };
      if (!reverse) return { state: 'reused', id: target, codigo: created.after_data.codigo };
      if (JSON.parse(image).ativo) await service.softDelete(context, target);
      await mark('inactivate', target, { ativo: false, previousFingerprint: hash(image) });
      return { state: 'reversed', id: target };
    }));
  };
  return {
    apply: id => run(id, false),
    reverse: id => run(id, true),
    async runManifest({ mode, onCommitted = () => {} }) {
      if (mode !== 'apply' && mode !== 'reverse') throw new Error('MARCA_IMPORT_MODE');
      const totals = {};
      for (const id of byId.keys()) {
        const result = await run(id, mode === 'reverse');
        totals[result.state] = (totals[result.state] ?? 0) + 1;
        await onCommitted(result);
      }
      return totals;
    },
  };
}
