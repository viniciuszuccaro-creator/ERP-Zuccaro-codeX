/** @typedef {Record<string, unknown>} LocalRecord */

/**
 * @typedef {{
 *   validateContext: (scope: LocalRecord) => { valid: boolean, error?: unknown },
 *   toEntityScope: (context: LocalRecord) => LocalRecord,
 *   filterConfigs: (filter: LocalRecord, sort: string, limit: number) => Promise<LocalRecord[]>,
 *   updateConfig: (id: unknown, payload: LocalRecord) => Promise<LocalRecord>,
 *   createConfig: (payload: LocalRecord) => Promise<LocalRecord>,
 *   now: () => string,
 * }} LocalConfigDependencies
 */

/**
 * @param {LocalRecord} scope
 * @param {Pick<LocalConfigDependencies, 'validateContext' | 'toEntityScope'>} dependencies
 */
export const normalizeLocalConfigScope = (scope = {}, dependencies) => {
  const context = dependencies.validateContext(scope);
  if (!context.valid) return { valid: false, error: context.error, scope: {} };
  return {
    valid: true,
    error: null,
    scope: dependencies.toEntityScope(/** @type {LocalRecord} */ (context)),
  };
};

/**
 * Executa o upsert pela entidade ConfiguracaoSistema existente. A chave externa
 * e o contexto validado sao autoritativos sobre campos repetidos em data.
 * @param {{ chave?: unknown, data?: LocalRecord, scope?: LocalRecord }} options
 * @param {LocalConfigDependencies} dependencies
 * @returns {Promise<{ data: { record: LocalRecord } }>}
 */
export const upsertLocalConfig = async (
  { chave, data = {}, scope = {} },
  dependencies,
) => {
  const normalizedScope = normalizeLocalConfigScope(scope, dependencies);
  const configKey = String(chave || '').trim();
  if (!configKey) throw new Error('Chave obrigatoria para ConfiguracaoSistema local');
  if (!normalizedScope.valid) {
    throw new Error(`Contexto multiempresa obrigatorio para ConfiguracaoSistema local: ${normalizedScope.error}`);
  }

  const filter = { chave: configKey, ...normalizedScope.scope };
  const existing = await dependencies.filterConfigs(filter, '-updated_date', 1);
  const payload = {
    categoria: data.categoria || 'Sistema',
    ...data,
    chave: configKey,
    ...normalizedScope.scope,
    updated_date: dependencies.now(),
  };
  const record = existing[0]
    ? await dependencies.updateConfig(existing[0].id, payload)
    : await dependencies.createConfig(payload);
  return { data: { record } };
};
