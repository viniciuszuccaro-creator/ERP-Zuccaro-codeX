/** @typedef {Record<string, unknown>} LocalRecord */

/**
 * @typedef {{
 *   legacyReferenceSpecs: Record<string, { field: string }>,
 *   supplierProtectedFieldScopes: Array<{ fields: string[] }>,
 *   assertMutationAllowed: (entityName: string, action: string) => void,
 *   createItem: (item: LocalRecord) => Promise<LocalRecord>,
 * }} LocalEntityBulkCreateDependencies
 */

/**
 * Coordena a criacao sequencial em lote pela mesma operacao create da entidade.
 * Assim, contexto, validacoes, idempotencia e auditoria continuam por item.
 * @param {{
 *   entityName: string,
 *   items?: LocalRecord[],
 *   dependencies: LocalEntityBulkCreateDependencies,
 * }} options
 * @returns {Promise<LocalRecord[]>}
 */
export const runLocalEntityBulkCreatePipeline = async ({
  entityName,
  items = [],
  dependencies,
}) => {
  const legacySpec = dependencies.legacyReferenceSpecs[entityName];
  const hasLegacyReference = Boolean(legacySpec && items.some((item) => (
    String(item?.[legacySpec.field] || '').trim()
  )));
  const hasProtectedSupplierField = entityName === 'Fornecedor' && items.some((item) => (
    dependencies.supplierProtectedFieldScopes.some((rule) => (
      rule.fields.some((field) => Object.prototype.hasOwnProperty.call(item || {}, field))
    ))
  ));
  if (hasLegacyReference || hasProtectedSupplierField) {
    dependencies.assertMutationAllowed(entityName, 'importar');
  }

  const created = [];
  for (const item of items) {
    created.push(await dependencies.createItem(item));
  }
  return created;
};
