const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

const strip = (value) => firstText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const JANELA_MIGRACAO_CHAVE = 'janela_migracao_congelada';

export const BACKUP_COUNT_ENTITIES = [
  'Cliente',
  'Fornecedor',
  'Produto',
  'Pedido',
  'ContaPagar',
  'ContaReceber',
  'NotaFiscal',
  'Entrega',
  'MovimentacaoEstoque',
];

export const VIRADA_CHECKLIST = [
  'backup_legado_confirmado',
  'janela_migracao_congelada',
  'deltas_migrados',
  'saldos_reconciliados',
  'financeiro_reconciliado',
  'estoque_reconciliado',
  'fiscal_validado',
  'usuarios_validados',
  'permissoes_validadas',
  'integracoes_validadas',
  'contingencia_definida',
];

export const backupSequenceKey = (groupId) => `seq_backup_${firstText(groupId) || 'grupo'}`;

export const buildBackupResumo = (stores = {}) => {
  const por_entidade = {};
  let quantidade_total_registros = 0;
  BACKUP_COUNT_ENTITIES.forEach((name) => {
    const count = Array.isArray(stores[name]) ? stores[name].length : 0;
    por_entidade[name] = count;
    quantidade_total_registros += count;
  });
  return { quantidade_total_registros, por_entidade };
};

export const hashBackupResumo = (resumo = {}) => {
  const text = JSON.stringify(resumo);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
};

export const isStatusBackupConcluido = (value) => {
  const raw = strip(value);
  return raw === 'concluido' || raw === 'concluido com sucesso';
};

export const isBackupErpValido = (backup = {}) => {
  if (!firstText(backup.group_id, backup.grupo_id)) return false;
  if (!isStatusBackupConcluido(backup.status)) return false;
  const numero = firstText(backup.numero_backup);
  if (!numero.startsWith('BKP-') || /BKP-\d{13,}/.test(numero)) return false;
  if (!firstText(backup.hash_integridade) || firstText(backup.hash_integridade).includes('random')) return false;
  const total = Number(backup.quantidade_total_registros);
  return Number.isFinite(total) && total >= 0;
};

export const isJanelaMigracaoCongelada = ({ configs = [], configBackup = {} } = {}) => {
  if (configBackup.janela_migracao_congelada === true) return true;
  const row = (Array.isArray(configs) ? configs : []).find((item) => firstText(item.chave) === JANELA_MIGRACAO_CHAVE);
  if (!row) return false;
  return row.ativa === true || row.valor === true || ['true', '1', 'congelada', 'sim'].includes(strip(row.valor || row.valor_texto));
};

export const evaluateChecklistVirada = (configBackup = {}) => {
  const faltando = VIRADA_CHECKLIST.filter((campo) => configBackup[campo] !== true);
  return { ok: faltando.length === 0, faltando };
};

export const assertJanelaMigracao = ({ configs = [], configBackup = {}, migracaoConfirmada = false } = {}) => {
  if (migracaoConfirmada && isJanelaMigracaoCongelada({ configs, configBackup })) {
    throw new Error('Janela de migracao congelada. Deltas somente com virada autorizada.');
  }
  return true;
};

export const applyBackupOnCreate = ({ record = {}, records = [], resumo = null, sequenceValue = 0 } = {}) => {
  const groupId = firstText(record.group_id, record.grupo_id);
  if (!groupId) {
    throw new Error('Grupo obrigatorio para backup do ERP.');
  }
  const snapshot = resumo || buildBackupResumo({});
  const hash = hashBackupResumo(snapshot);
  const usedMax = (Array.isArray(records) ? records : []).reduce((max, item) => {
    const parsed = Number.parseInt(String(item?.numero_backup || '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed > 1e11) return max;
    return parsed > max ? parsed : max;
  }, 0);
  const next = Math.max(sequenceValue, usedMax) + 1;
  const incoming = firstText(record.numero_backup);
  const numero = incoming && incoming.startsWith('BKP-') && !/BKP-\d{13,}/.test(incoming)
    ? incoming
    : `BKP-${String(next).padStart(6, '0')}`;
  const status = firstText(record.status) || 'Concluido';
  const stamped = {
    ...record,
    group_id: groupId,
    grupo_id: groupId,
    numero_backup: numero,
    origem_backup: firstText(record.origem_backup, 'erp_novo'),
    quantidade_total_registros: snapshot.quantidade_total_registros,
    resumo_entidades: snapshot.por_entidade,
    hash_integridade: hash,
    status,
    validacao_integridade: {
      validado: true,
      hash_valido: true,
      arquivo_integro: true,
      pode_restaurar: true,
    },
  };
  if (isStatusBackupConcluido(status) && !isBackupErpValido(stamped)) {
    throw new Error('Backup do ERP novo exige resumo, hash e numero estavel.');
  }
  return stamped;
};

export const assertChecklistVirada = ({
  backups = [],
  configBackup = {},
  configs = [],
} = {}) => {
  const backupOk = (Array.isArray(backups) ? backups : []).some((item) => isBackupErpValido(item));
  if (!backupOk) {
    throw new Error('Virada para producao exige backup valido do ERP novo.');
  }
  if (configBackup.backup_legado_confirmado !== true) {
    throw new Error('Virada para producao exige backup final do legado confirmado.');
  }
  if (!isJanelaMigracaoCongelada({ configs, configBackup })) {
    throw new Error('Virada para producao exige janela de migracao congelada.');
  }
  const checklist = evaluateChecklistVirada(configBackup);
  if (!checklist.ok) {
    throw new Error(`Virada para producao exige checklist completo: ${checklist.faltando.join(', ')}.`);
  }
  return { permitido: true };
};
