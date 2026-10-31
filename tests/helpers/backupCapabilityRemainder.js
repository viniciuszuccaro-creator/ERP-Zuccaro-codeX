import assert from 'node:assert/strict';
export const backupCapabilityFile = 'src/components/sistema/HistoricoBackups.jsx';
export const backupCapabilityHunks = [
  ["    mutationFn: async (/** @type {import('@/components/lib/viradaProducaoPolicy').ViradaRecord} */ backup) => {", '    mutationFn: async (backup) => {'],
  [`
      if (!backup || typeof backup !== 'object' || Array.isArray(backup)
        || (typeof backup.id !== 'string' && typeof backup.id !== 'number')
        || (typeof backup.id === 'string' && !backup.id.trim())
        || (typeof backup.id === 'number' && !Number.isFinite(backup.id))) {
        throw new Error('Identidade do backup invalida.');
      }
      const backupApi = base44.entities.BackupAutomatico;
      if (!backupApi || !('restore' in backupApi) || typeof backupApi.restore !== 'function') {
        await auditBackup({
          acao: 'Backup.restaurar_bloqueado',
          sucesso: false,
          motivo: 'backend_sem_restauracao',
          registroId: backup.id,
        });
        throw new Error('Restauracao indisponivel neste backend.');
      }
`, ''],
  ['      /** @type {unknown} */\n      const result = await backupApi.restore(backup.id, {', '      const result = await base44.entities.BackupAutomatico.restore(backup.id, {'],
  [`
      if (!result || typeof result !== 'object' || Array.isArray(result)
        || !('backup' in result) || !result.backup || typeof result.backup !== 'object'
        || Array.isArray(result.backup) || !('id' in result.backup) || result.backup.id !== backup.id
        || !('summary' in result) || !result.summary || typeof result.summary !== 'object'
        || Array.isArray(result.summary)) {
        await auditBackup({
          acao: 'Backup.restaurar_recibo_invalido',
          sucesso: false,
          motivo: 'recibo_invalido',
          registroId: backup.id,
        });
        throw new Error('Recibo de restauracao invalido; verifique o resultado antes de repetir.');
      }
`, ''],
];
export function backupCapabilityRemainder(file, text) {
  if (file !== backupCapabilityFile) return text;
  let source = text.replace(/\r\n/g, '\n');
  for (const [after, before] of backupCapabilityHunks) {
    assert.equal(source.split(after).length, 2, 'one exact backup capability hunk');
    source = source.replace(after, before);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
