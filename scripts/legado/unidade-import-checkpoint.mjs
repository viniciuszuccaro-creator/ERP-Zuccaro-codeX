import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const entity = 'UnidadeMedida';
const fields = ['codigo', 'sigla', 'nome_completo', 'tipo_grandeza',
  'unidade_base_conversao', 'fator_conversao_para_base', 'permite_conversao',
  'usa_em_estoque', 'usa_em_compras', 'usa_em_vendas', 'ativo'];

// Adapter for the pinned Base44 manifest; creation still uses TenantCrudService.
export function bindUnidadeImport({ db, service, audit, rbacGuard, ctx, bytes, sha256 }) {
  ctx = Object.freeze({ ...ctx });
  if (!db.withTenantContext || !ctx.groupId || ctx.empresaId != null || !ctx.actorId ||
      hash(bytes) !== sha256) throw new Error('UNIT_IMPORT_SCOPE_OR_HASH');
  const manifest = JSON.parse(bytes.toString());
  const rows = manifest.rows;
  if (manifest.destination?.groupId !== ctx.groupId || manifest.source?.entity !== entity ||
      !Array.isArray(rows) || rows.length !== manifest.source.count || rows.length === 0 ||
      new Set(rows.map(row => row.id)).size !== rows.length ||
      new Set(rows.map(row => row.codigo?.trim().toLowerCase())).size !== rows.length ||
      new Set(rows.map(row => row.sigla?.trim().toUpperCase())).size !== rows.length ||
      rows.some(row => !row.id || !row.codigo?.trim() || !row.sigla?.trim() ||
        row.empresa_id != null || row.ativo !== true || row.usa_em_producao !== false ||
        row.observacoes || row.group_id !== rows[0].group_id || !row.group_id)) {
    throw new Error('UNIT_IMPORT_MANIFEST_INVALID');
  }
  const group = ctx.groupId;
  const run = (id, reverse) => {
    const source = rows.find(row => row.id === id);
    if (!source) throw new Error('UNIT_IMPORT_SOURCE_UNKNOWN');
    const key = 'legacy-unit:' + hash(JSON.stringify([group, sha256, id]));
    const context = Object.freeze({ ...ctx, requestId: key });
    return db.withTenantContext(context, () => db.withTransaction(async q => {
      await rbacGuard.assertAllowed(context, 'Cadastros', 'unidade_medida', reverse ? 'inativar' : 'criar',
        { allowGlobalWildcard: false, executor: q });
      await q.query("SET LOCAL TIME ZONE 'UTC'");
      await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
      const checks = (await q.query(`SELECT action,entity_id,after_data FROM audit_logs
        WHERE group_id=$1 AND empresa_id IS NULL AND entity=$2 AND request_id=$3
          AND action IN ('link','inactivate')`, [group, entity, key])).rows;
      const created = checks.filter(row => row.action === 'link');
      const reverted = checks.filter(row => row.action === 'inactivate');
      if (created.length > 1 || reverted.length > 1 || (!created.length && reverted.length) ||
          (reverted.length && reverted[0].entity_id !== created[0].entity_id)) {
        throw new Error('UNIT_IMPORT_CHECKPOINT_CONFLICT');
      }
      if (reverted.length) return { state: 'reversed', id: created[0].entity_id };
      const snapshot = async id => (await q.query(`SELECT to_jsonb(u)::text AS image
        FROM unidades_medida u WHERE group_id=$1 AND empresa_id IS NULL AND id=$2 FOR UPDATE`,
      [group, id])).rows[0]?.image;
      const mark = (action, id, afterData) => audit.append({
        groupId: group, actorId: context.actorId, requestId: key, entity, entityId: id,
        action, afterData,
      }, q);
      if (!created.length) {
        if (reverse) return { state: 'not_applied' };
        const payload = Object.fromEntries(fields.filter(k => Object.hasOwn(source, k)).map(k => [k, source[k]]));
        const unit = await service.create(context, payload);
        const image = await snapshot(unit.id);
        if (!image) throw new Error('UNIT_IMPORT_POSTIMAGE_MISSING');
        await mark('link', unit.id, { fingerprint: hash(image) });
        return { state: 'inserted', id: unit.id };
      }
      const unitId = created[0].entity_id;
      const image = await snapshot(unitId);
      if (!image || hash(image) !== created[0].after_data?.fingerprint) {
        return { state: 'changed', id: unitId };
      }
      if (!reverse) return { state: 'reused', id: unitId };
      const updated = await q.query(`UPDATE unidades_medida SET ativo=false
        WHERE group_id=$1 AND empresa_id IS NULL AND id=$2 AND ativo RETURNING id`, [group, unitId]);
      if (updated.rows.length !== 1) throw new Error('UNIT_IMPORT_REVERSE_CONFLICT');
      await mark('inactivate', unitId, { ativo: false, previousFingerprint: hash(image) });
      return { state: 'reversed', id: unitId };
    }));
  };
  return {
    apply: id => run(id, false),
    reverse: id => run(id, true),
    async runManifest({ mode, onCommitted = () => {} }) {
      if (mode !== 'apply' && mode !== 'reverse') throw new Error('UNIT_IMPORT_MODE');
      const totals = {};
      for (const { id } of rows) {
        const result = await run(id, mode === 'reverse');
        totals[result.state] = (totals[result.state] ?? 0) + 1;
        await onCommitted(result);
      }
      return totals;
    },
  };
}
