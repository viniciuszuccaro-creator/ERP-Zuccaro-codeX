/** @typedef {Record<string, unknown>} LocalRecord */

/**
 * @typedef {{
 *   assertPermissionAny: (entityName: string, actions: string[], id: unknown) => void,
 *   loadDb: () => LocalRecord,
 *   getStore: (db: LocalRecord, entityName: string) => LocalRecord[],
 *   getCurrentContext: () => { groupId?: unknown, empresaId?: unknown, user?: LocalRecord | null },
 *   assertBackupRestore: (options: { backup: LocalRecord, groupId?: unknown, empresaId?: unknown }) => Record<string, LocalRecord[]>,
 *   backupCountEntities: string[],
 *   mergeSnapshotRecords: (db: LocalRecord, entityName: string, incoming: LocalRecord[]) => LocalRecord,
 *   now: () => string,
 *   saveDb: (db: LocalRecord) => void,
 *   notify: (entityName: string, action: string, record: LocalRecord) => void,
 *   auditMutation: (entityName: string, action: string, options: { before: LocalRecord, after: LocalRecord, recordId: unknown, detalhes: LocalRecord }) => void,
 * }} LocalBackupRestoreDependencies
 */

/**
 * Restaura somente snapshots de BackupAutomatico pela allowlist existente.
 * O merge e a persistencia continuam fornecidos pelo cliente local chamador.
 * @param {{
 *   entityName: string,
 *   id: unknown,
 *   options?: LocalRecord,
 *   dependencies: LocalBackupRestoreDependencies,
 * }} input
 * @returns {{ backup: LocalRecord, summary: LocalRecord }}
 */
export const runLocalBackupRestorePipeline = ({
  entityName,
  id,
  options = {},
  dependencies,
}) => {
  if (entityName !== 'BackupAutomatico') {
    throw new Error(`restore nao suportado para ${entityName}`);
  }

  dependencies.assertPermissionAny(entityName, ['restaurar', 'executar'], id);
  const db = dependencies.loadDb();
  const records = dependencies.getStore(db, entityName);
  const index = records.findIndex((item) => String(item.id) === String(id));
  if (index < 0) throw new Error(`${entityName} local nao encontrado: ${id}`);

  const backup = records[index];
  const { groupId, empresaId, user } = dependencies.getCurrentContext();
  const entitiesSnapshot = dependencies.assertBackupRestore({
    backup,
    groupId: options.group_id || groupId,
    empresaId: options.empresa_id || empresaId,
  });
  const summary = /** @type {LocalRecord} */ ({});
  dependencies.backupCountEntities.forEach((name) => {
    summary[name] = dependencies.mergeSnapshotRecords(db, name, entitiesSnapshot[name] || []);
  });

  const restoration = {
    data_hora: dependencies.now(),
    usuario: user?.full_name || user?.email || 'Sistema',
    usuario_id: user?.id || null,
    tipo_restauracao: 'Completa',
    sucesso: true,
    observacoes: `Restauracao aplicada do backup ${backup.numero_backup || backup.id}`,
    resumo: summary,
  };
  const history = /** @type {LocalRecord[]} */ (
    Array.isArray(backup.restauracoes) ? backup.restauracoes : []
  );
  const restoredBackup = /** @type {LocalRecord} */ ({
    ...backup,
    restauracoes: [...history, restoration],
    updated_date: dependencies.now(),
  });
  records[index] = restoredBackup;
  dependencies.saveDb(db);
  dependencies.notify(entityName, 'update', restoredBackup);
  dependencies.auditMutation(entityName, 'Restauracao', {
    before: backup,
    after: restoredBackup,
    recordId: restoredBackup.id,
    detalhes: summary,
  });
  return { backup: restoredBackup, summary };
};
