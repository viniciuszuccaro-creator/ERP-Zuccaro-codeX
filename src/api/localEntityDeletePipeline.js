/** @typedef {Record<string, unknown>} LocalRecord */

/**
 * @typedef {{
 *   historicoEstoqueEntities: string[],
 *   isTituloFinanceiro: (entityName: string) => boolean,
 *   notaFiscalEntities: string[],
 *   loadDb: () => LocalRecord,
 *   getStore: (db: LocalRecord, entityName: string) => LocalRecord[],
 *   assertTituloOnDelete: (record: LocalRecord) => unknown,
 *   assertOpOnDelete: (record: LocalRecord) => unknown,
 *   assertEntregaOnDelete: (record: LocalRecord) => unknown,
 *   assertNotaFiscalOnDelete: (record: LocalRecord) => unknown,
 *   assertMutationAllowed: (entityName: string, action: string, id: unknown) => void,
 *   markRecordDeleted: (entityName: string, id: unknown) => void,
 *   saveDb: (db: LocalRecord) => void,
 *   notify: (entityName: string, action: string, record: LocalRecord) => void,
 *   auditMutation: (entityName: string, action: string, options: { before: LocalRecord, recordId: unknown }) => void,
 * }} LocalEntityDeleteDependencies
 */

/**
 * Executa o fluxo local de exclusao preservando guards, marcador idempotente,
 * persistencia, notificacao e auditoria na ordem historica do cliente.
 * @param {{
 *   entityName: string,
 *   id: unknown,
 *   dependencies: LocalEntityDeleteDependencies,
 * }} options
 * @returns {{ success: true }}
 */
export const runLocalEntityDeletePipeline = ({ entityName, id, dependencies }) => {
  if (dependencies.historicoEstoqueEntities.includes(entityName)) {
    throw new Error('Exclusao de historico bloqueada.');
  }

  const requiresCurrentRecord = dependencies.isTituloFinanceiro(entityName)
    || entityName === 'OrdemProducao'
    || entityName === 'Entrega'
    || dependencies.notaFiscalEntities.includes(entityName);
  if (requiresCurrentRecord) {
    const previewDb = dependencies.loadDb();
    const current = dependencies.getStore(previewDb, entityName)
      .find((item) => String(item.id) === String(id)) || {};
    if (dependencies.isTituloFinanceiro(entityName)) dependencies.assertTituloOnDelete(current);
    if (entityName === 'OrdemProducao') dependencies.assertOpOnDelete(current);
    if (entityName === 'Entrega') dependencies.assertEntregaOnDelete(current);
    if (dependencies.notaFiscalEntities.includes(entityName)) dependencies.assertNotaFiscalOnDelete(current);
  }

  dependencies.assertMutationAllowed(entityName, 'excluir', id);
  const db = dependencies.loadDb();
  const records = dependencies.getStore(db, entityName);
  const index = records.findIndex((item) => String(item.id) === String(id));
  dependencies.markRecordDeleted(entityName, id);
  if (index < 0) return { success: true };

  const [removed] = records.splice(index, 1);
  dependencies.saveDb(db);
  dependencies.notify(entityName, 'delete', removed);
  dependencies.auditMutation(entityName, 'Exclusao', {
    before: removed,
    recordId: removed.id || id,
  });
  return { success: true };
};
