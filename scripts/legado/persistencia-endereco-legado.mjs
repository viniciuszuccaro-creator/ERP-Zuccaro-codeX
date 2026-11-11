import { createHash } from 'node:crypto';

const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
};
export const fingerprintEnderecoLegado = value =>
  createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function failure(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

/** Reuses the existing isolated pilot map. No DDL, connection or operational activation. */
export function criarRegistroEnderecoPilotoPostgres(client, { groupId, clienteId } = {}) {
  if (typeof client?.query !== 'function' || !groupId || !clienteId) {
    failure('LEGACY_ADDRESS_REGISTRY_CONTRACT_REQUIRED');
  }
  const one = async (sql, values) => {
    const result = await client.query(sql, values);
    if (result.rowCount !== 1) failure('LEGACY_ADDRESS_MAP_SCOPE_DENIED');
    return result;
  };
  return {
    load: async key => {
      const result = await client.query(
        'SELECT * FROM pilot_worker_map WHERE group_id=$1 AND source_key=$2 FOR UPDATE', [groupId, key]);
      if (result.rows.length > 1) failure('LEGACY_ADDRESS_MAP_AMBIGUOUS');
      const saved = result.rows[0];
      return saved && { clienteId: saved.cliente_id, fingerprint: saved.source_fingerprint,
        payloadHash: saved.payload_hash, targetId: saved.target_id, snapshot: saved.snapshot,
        raw: saved.raw_source_json, transformation: saved.transformation_json, state: saved.state };
    },
    lockTarget: id => one(
      'SELECT id FROM cliente_locais WHERE group_id=$1 AND cliente_id=$2 AND id=$3 FOR UPDATE',
      [groupId, clienteId, id]),
    findByLegacyId: async id => (await client.query(
      'SELECT id FROM cliente_locais WHERE group_id=$1 AND cliente_id=$2 AND legacy_id=$3',
      [groupId, clienteId, id])).rows,
    insert: (key, value) => {
      if (value.clienteId !== clienteId || value.state !== 'APPLIED') failure('LEGACY_ADDRESS_MAP_SCOPE_DENIED');
      return one(`INSERT INTO pilot_worker_map
        (group_id,source_key,cliente_id,source_fingerprint,payload_hash,payload_json,raw_source_json,
         target_id,snapshot,revision,state,transformation_json)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb,1,'APPLIED',$10::jsonb)`,
      [groupId, key, clienteId, value.fingerprint, value.payloadHash, JSON.stringify(value.payload),
        JSON.stringify(value.raw), value.targetId, JSON.stringify(value.snapshot), JSON.stringify(value.transformation)]);
    },
    update: (key, value) => one(`UPDATE pilot_worker_map SET source_fingerprint=$4,
      payload_hash=$5,payload_json=$6::jsonb,snapshot=$7::jsonb,transformation_json=$8::jsonb,
      revision=revision+1 WHERE group_id=$1 AND source_key=$2 AND cliente_id=$3 AND state='APPLIED'`,
    [groupId, key, clienteId, value.fingerprint, value.payloadHash, JSON.stringify(value.payload),
      JSON.stringify(value.snapshot), JSON.stringify(value.transformation)]),
    markReverted: key => one(`UPDATE pilot_worker_map SET state='REVERTED'
      WHERE group_id=$1 AND source_key=$2 AND cliente_id=$3 AND state='APPLIED'`, [groupId, key, clienteId]),
  };
}

/** The supplied transaction owns canonical service writes, audit and map together. */
export async function persistirEnderecoClienteGrupoLegado(source, options = {}) {
  const { transaction, action = 'apply' } = options;
  if (typeof transaction !== 'function') failure('LEGACY_ADDRESS_TRANSACTION_REQUIRED');
  if (!source?.groupId || !source.key || !source.clienteId
      || !/^[a-f0-9]{64}$/i.test(source.fingerprint || '')
      || !source.payload?.legacy_id || !source.raw
      || !source.transformation?.version || !['apply', 'revert'].includes(action)) {
    failure('LEGACY_ADDRESS_SOURCE_INVALID');
  }
  return transaction(source, async ({ ctx, service, rbacGuard, registry }) => {
    if (!ctx?.actorId || ctx.groupId !== source.groupId || ctx.empresaId
        || !service || !rbacGuard || !registry) failure('LEGACY_ADDRESS_SCOPE_INVALID');
    await rbacGuard.assertAllowed(ctx, 'Cadastros', 'cliente', 'importar', { allowGlobalWildcard: false });
    const known = await registry.load(source.key);
    if (known && known.clienteId !== source.clienteId) failure('WORKER_PARENT_CHANGED');
    if (action === 'revert') {
      if (!known) failure('WORKER_REVERSAL_SCOPE_DENIED');
      if (known.state === 'REVERTED') return { reverted: false };
    } else if (known?.state === 'REVERTED') failure('WORKER_RECORD_REVERTED');
    const payloadHash = fingerprintEnderecoLegado(source.payload);
    if (known) {
      await registry.lockTarget(known.targetId);
      const current = await service.get(ctx, source.clienteId, known.targetId);
      if (fingerprintEnderecoLegado(current) !== fingerprintEnderecoLegado(known.snapshot)) {
        failure('DESTINATION_CHANGED_OUTSIDE_BATCH');
      }
      if (action === 'revert') {
        await service.softDelete(ctx, source.clienteId, known.targetId);
        await registry.markReverted(source.key);
        return { reverted: true };
      }
      if (known.fingerprint === source.fingerprint && known.payloadHash === payloadHash) {
        return { id: known.targetId, created: false, updated: false };
      }
      if (!options.allowUpdate || options.expectedFingerprint !== known.fingerprint
          || options.expectedSnapshot !== fingerprintEnderecoLegado(known.snapshot)
          || fingerprintEnderecoLegado(source.raw) !== fingerprintEnderecoLegado(known.raw)) {
        failure('UPDATE_REQUIRES_MATCHED_PREVIOUS_REVISION');
      }
      if (source.payload.legacy_id !== known.snapshot.legacy_id) failure('LEGACY_ADDRESS_IDENTITY_CHANGED');
      const patch = validarPatchEndereco(options.patch, source.payload);
      const updated = await service.update(ctx, source.clienteId, known.targetId, patch);
      reconcile(updated, source.payload);
      await registry.update(source.key, { fingerprint: source.fingerprint, payloadHash,
        payload: source.payload, snapshot: updated, transformation: source.transformation });
      return { id: known.targetId, created: false, updated: true };
    }
    const candidates = await registry.findByLegacyId(source.payload.legacy_id);
    if (candidates.length > 1) failure('LEGACY_ID_AMBIGUOUS');
    if (candidates.length === 1) failure('UNMAPPED_EXTERNAL_LOCAL');
    const created = await service.create(ctx, source.clienteId, source.payload);
    reconcile(created, source.payload);
    await registry.insert(source.key, { clienteId: source.clienteId,
      fingerprint: source.fingerprint, payloadHash, payload: source.payload,
      raw: source.raw, transformation: source.transformation,
      targetId: created.id, snapshot: created, state: 'APPLIED' });
    return { id: created.id, created: true, updated: false };
  });
}

function validarPatchEndereco(patch, payload) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(patch))) failure('LEGACY_ADDRESS_UPDATE_PATCH_INVALID');
  const immutable = new Set(['id', 'group_id', 'grupo_id', 'empresa_id', 'cliente_id', 'legacy_id']);
  for (const field of Reflect.ownKeys(patch)) {
    if (typeof field !== 'string' || immutable.has(field) || !Object.hasOwn(payload, field)
        || patch[field] === undefined
        || fingerprintEnderecoLegado(patch[field]) !== fingerprintEnderecoLegado(payload[field])) {
      failure('LEGACY_ADDRESS_UPDATE_PATCH_INVALID');
    }
  }
  return structuredClone(patch);
}

function reconcile(actual, payload) {
  for (const [field, value] of Object.entries(payload)) {
    const found = field === 'finalidades'
      ? actual.finalidades.map(item => ({ finalidade: item.finalidade, principal: item.principal }))
      : actual[field] ?? null;
    if (fingerprintEnderecoLegado(found) !== fingerprintEnderecoLegado(value ?? null)) {
      failure('LEGACY_ADDRESS_FIELD_RECONCILIATION_FAILED');
    }
  }
}

/** Binds canonical service, audit and map to one transaction; serializes the first map insertion on its parent. */
export function criarTransacaoEnderecoPilotoPostgres({ db, ctx, criarServico, rbacGuard } = {}) {
  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  if (!db?.withTenantContext || !db.withTransaction || typeof criarServico !== 'function'
      || !rbacGuard?.assertAllowed || !uuid(ctx?.groupId) || !uuid(ctx?.actorId)
      || ctx.empresaId != null || ctx.scopeType === 'empresa') failure('LEGACY_ADDRESS_TRANSACTION_CONTRACT_REQUIRED');
  const context = Object.freeze({ ...ctx, empresaId: null });
  return async (source, work) => {
    if (source?.groupId !== context.groupId || !uuid(source.clienteId)
        || typeof source.key !== 'string' || !source.key || source.key.length > 512) failure('LEGACY_ADDRESS_SCOPE_INVALID');
    const requiredFields = ['nome', 'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'pais'];
    if (requiredFields.some(k => typeof source.payload?.[k] !== 'string' || !source.payload[k].trim())
        || !Array.isArray(source.payload.finalidades) || source.payload.finalidades.length === 0
        || !/^(?:[0-9]{8}|[0-9]{5}-[0-9]{3})$/.test(source.payload.cep)
        || !/^[A-Za-z]{2}$/.test(source.payload.uf)
        || (Array.isArray(source.conflicts) && source.conflicts.length > 0)) failure('LEGACY_ADDRESS_FIELDS_UNPROVEN');
    return db.withTenantContext(context, () => db.withTransaction(async executor => {
      let active = true, failed = false;
      const alive = () => {
        if (!active) failure('LEGACY_ADDRESS_EXECUTOR_EXPIRED');
        if (failed) failure('LEGACY_ADDRESS_ROLLBACK_REQUIRED');
      };
      const query = async (sql, values) => {
        alive();
        try { return await executor.query(sql, values); }
        catch (error) { failed = true; throw error; }
      };
      const q = Object.freeze({ query });
      const bound = Object.freeze({ pool: null, query,
        withTransaction: async fn => { alive(); try { return await fn(q); } catch (error) { failed = true; throw error; } },
        checkConnection: async () => (await query('SELECT 1 AS ok')).rows[0]?.ok === 1,
        end: async () => failure('LEGACY_ADDRESS_TRANSACTION_OWNS_CONNECTION') });
      const required = new Map();
      const rbac = Object.freeze({ assertAllowed: async (scope, module, entity, action, options = {}) => {
        alive();
        if (scope.groupId !== context.groupId || scope.actorId !== context.actorId || scope.empresaId != null) failure('LEGACY_ADDRESS_SCOPE_INVALID');
        try {
          await rbacGuard.assertAllowed(scope, module, entity, action, { ...options, allowGlobalWildcard: false, executor: q });
          required.set(JSON.stringify([module, entity, action]), { module, entity, action });
        } catch (error) { failed = true; throw error; }
      } });
      try {
        await rbac.assertAllowed(context, 'Cadastros', 'cliente', 'importar');
        const parent = await query('SELECT id FROM clientes WHERE group_id=$1 AND empresa_id IS NULL AND id=$2 AND ativo=true FOR UPDATE',
          [context.groupId, source.clienteId]);
        if (parent.rowCount !== 1) failure('LEGACY_ADDRESS_MAP_SCOPE_DENIED');
        const result = await work({ ctx: context, rbacGuard: rbac,
          service: criarServico(bound, rbac), registry: criarRegistroEnderecoPilotoPostgres(q,
            { groupId: context.groupId, clienteId: source.clienteId }) });
        alive();
        for (const rule of required.values()) await rbac.assertAllowed(context, rule.module, rule.entity, rule.action);
        return result;
      } finally { active = false; }
    }));
  };
}
