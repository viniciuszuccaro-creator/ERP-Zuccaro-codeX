import { isClienteLocalCanonicalId } from './clienteHttpPayload.js';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const partial = page => page?.partial === true || page?.incomplete === true
  || page?.meta?.partial === true || page?.meta?.incomplete === true || page?.meta?.hasMore === true;

/** Transport methods extracted from the existing large HTTP factory; same routes/Auth. */
export function createClienteLocalBatchHttpApi({ request, getScope, createHttpError }) {
  const assertCurrent = scope => {
    const current = getScope();
    if (['groupId', 'empresaId', 'actorId', 'token'].some(k => scope[k] !== current?.[k])) {
      throw createHttpError(409, { error: { code: 'CONTEXT_CHANGED' } }, undefined);
    }
  };
  const validRow = (row, scope, id) => row && isClienteLocalCanonicalId(row.id)
    && row.group_id === scope.groupId && row.cliente_id === id
    && typeof row.ativo === 'boolean' && typeof row.endereco_incompleto === 'boolean';
  return {
    /** @param {string} clienteId @param {{includeReview?: boolean, signal?: AbortSignal}} [options] */
    async snapshotLocais(clienteId, { includeReview = false, signal } = {}) {
      const id = String(clienteId ?? '').trim(), scope = Object.freeze({ ...getScope() });
      if (!id || typeof includeReview !== 'boolean') throw new Error('CLIENTE_LOCAIS_INPUT_INVALID');
      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais/snapshot`, {
        query: includeReview ? { include_review: 'true' } : {}, signal, unwrap: false,
      }, scope);
      assertCurrent(scope);
      if (partial(page) || !hash(page?.version) || !Array.isArray(page?.data) || page.data.length > 200
        || page.data.some(row => !validRow(row, scope, id) || row.ativo !== true)
        || new Set(page.data.map(row => row.id)).size !== page.data.length
        || (includeReview && !hash(page?.reviewVersion))) throw new Error('CLIENTE_LOCAIS_SNAPSHOT_INVALID');
      return page;
    },
    /** @param {string} clienteId @param {Record<string, unknown>} body @param {{signal?: AbortSignal}} [options] */
    async syncLocais(clienteId, body, { signal } = {}) {
      const id = String(clienteId ?? '').trim(), scope = Object.freeze({ ...getScope() });
      if (!id || !hash(body?.version) || !Array.isArray(body?.operations)
        || body.operations.length < 1 || body.operations.length > 50) throw new Error('CLIENTE_LOCAIS_INPUT_INVALID');
      const operations = body.operations.map(op => ({ ...op }));
      const review = operations.some(op => op?.op === 'review');
      if (review && !hash(body.review_version)) throw new Error('CLIENTE_LOCAIS_REVIEW_VERSION_REQUIRED');
      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais/sync`, {
        method: 'POST', body, signal, unwrap: false,
      }, scope);
      assertCurrent(scope);
      if (partial(page) || page?.batchAtomic !== true || !hash(page?.version) || !Array.isArray(page?.data)
        || page.data.length !== operations.length
        || page.data.some((row, i) => !validRow(row, scope, id) || (operations[i].id && row.id !== operations[i].id))
        || (review && !hash(page?.reviewVersion))) throw new Error('CLIENTE_LOCAIS_SYNC_INVALID');
      return page;
    },
  };
}
