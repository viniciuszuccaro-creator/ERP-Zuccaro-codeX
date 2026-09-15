/** @typedef {Record<string, unknown>} LocalRecord */

/**
 * @typedef {{
 *   isTituloFinanceiro: (entityName: string) => boolean,
 *   notaFiscalEntities: string[],
 *   assertMutationAllowed: (entityName: string, action: string, id: unknown) => void,
 *   assertLegacyFieldAllowed: (entityName: string, data: LocalRecord) => void,
 *   assertSupplierFieldsAllowed: (entityName: string, data: LocalRecord) => void,
 *   stampRecordContext: (entityName: string, data: LocalRecord) => LocalRecord,
 *   getCurrentContext: () => { groupId?: unknown },
 *   getStore: (db: LocalRecord, entityName: string) => LocalRecord[],
 *   normalizeFornecedorCadastro: (record: LocalRecord) => LocalRecord,
 *   assertFornecedorScope: (options: { record: LocalRecord, before: LocalRecord, currentGroupId?: unknown, companies: LocalRecord[] }) => unknown,
 *   findDuplicateMaster: (options: { entityName: string, record: LocalRecord, records: LocalRecord[], currentId: unknown }) => LocalRecord | null | undefined,
 *   assertBackupExpire: (before: LocalRecord) => unknown,
 *   assertPermissionAny: (entityName: string, actions: string[], id: unknown) => void,
 *   applyPilotoWrite: (db: LocalRecord, entityName: string, record: LocalRecord, before: LocalRecord) => LocalRecord,
 *   applyBackupWrite: (db: LocalRecord, entityName: string, record: LocalRecord, before: LocalRecord) => LocalRecord,
 *   applyLegacyReferenceUpdate: (db: LocalRecord, entityName: string, before: LocalRecord, patch: LocalRecord) => LocalRecord,
 * }} LocalEntityUpdatePreparationDependencies
 */

const SENSITIVE_CONTEXT_ENTITIES = ['OrdemProducao', 'Entrega', 'OrdemCompra', 'Oportunidade'];
const IMMUTABLE_COMPANY_ENTITIES = ['Entrega', 'OrdemCompra', 'OrdemProducao'];
const FORNECEDOR_DOCUMENT_FIELDS = ['tipo_pessoa', 'cpf_cnpj', 'cpf', 'cnpj'];

/**
 * Prepara validacoes e enriquecimentos anteriores as transicoes operacionais.
 * A persistencia permanece sob responsabilidade do cliente chamador.
 * @param {{
 *   db: LocalRecord,
 *   entityName: string,
 *   id: unknown,
 *   data: LocalRecord,
 *   records: LocalRecord[],
 *   before: LocalRecord,
 *   dependencies: LocalEntityUpdatePreparationDependencies,
 * }} options
 * @returns {{ payload: LocalRecord, initialRecord: LocalRecord }}
 */
export const prepareLocalEntityUpdate = ({
  db,
  entityName,
  id,
  data,
  records,
  before,
  dependencies,
}) => {
  const isTitulo = dependencies.isTituloFinanceiro(entityName);
  const isNotaFiscal = dependencies.notaFiscalEntities.includes(entityName);
  const hasSpecialAuthorization = isTitulo
    || isNotaFiscal
    || SENSITIVE_CONTEXT_ENTITIES.includes(entityName)
    || entityName === 'BackupAutomatico';

  if (!hasSpecialAuthorization) {
    dependencies.assertMutationAllowed(entityName, 'editar', id);
  }
  dependencies.assertLegacyFieldAllowed(entityName, data);
  dependencies.assertSupplierFieldsAllowed(entityName, data);

  let payload = dependencies.stampRecordContext(entityName, data);
  if (entityName === 'Fornecedor') {
    const { groupId: currentGroupId } = dependencies.getCurrentContext();
    const hasDocumentPatch = FORNECEDOR_DOCUMENT_FIELDS.some((field) => (
      Object.prototype.hasOwnProperty.call(payload, field)
    ));
    const normalized = hasDocumentPatch
      ? dependencies.normalizeFornecedorCadastro({ ...before, ...payload })
      : dependencies.normalizeFornecedorCadastro(payload);
    const merged = { ...before, ...normalized };
    dependencies.assertFornecedorScope({
      record: merged,
      before,
      currentGroupId,
      companies: dependencies.getStore(db, 'Empresa'),
    });
    if (hasDocumentPatch) {
      const duplicate = dependencies.findDuplicateMaster({
        entityName,
        record: merged,
        records,
        currentId: before.id,
      });
      if (duplicate) throw new Error('Cadastro duplicado no grupo para este documento.');
    }
    const normalizedFields = new Set(hasDocumentPatch ? FORNECEDOR_DOCUMENT_FIELDS : []);
    payload = Object.fromEntries(Object.entries(normalized).filter(([field]) => (
      Object.prototype.hasOwnProperty.call(payload, field) || normalizedFields.has(field)
    )));
  }

  if (
    (isTitulo || isNotaFiscal || SENSITIVE_CONTEXT_ENTITIES.includes(entityName))
    && before.empresa_id
    && !Object.prototype.hasOwnProperty.call(data, 'empresa_id')
  ) {
    payload.empresa_id = before.empresa_id;
    if (before.group_id) payload.group_id = before.group_id;
    if (before.grupo_id) payload.grupo_id = before.grupo_id;
  }
  if ((IMMUTABLE_COMPANY_ENTITIES.includes(entityName) || isNotaFiscal) && before.empresa_id) {
    payload.empresa_id = before.empresa_id;
  }

  if (entityName === 'BackupAutomatico') {
    const statusPatch = Object.prototype.hasOwnProperty.call(payload, 'status')
      ? String(payload.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : '';
    if (statusPatch === 'expirado') {
      dependencies.assertBackupExpire(before);
      dependencies.assertPermissionAny(entityName, ['excluir', 'editar'], id);
    } else {
      dependencies.assertPermissionAny(entityName, ['editar', 'restaurar', 'executar'], id);
    }
  }

  const piloto = dependencies.applyPilotoWrite(db, entityName, payload, before);
  const backup = dependencies.applyBackupWrite(db, entityName, piloto, before);
  const initialRecord = dependencies.applyLegacyReferenceUpdate(db, entityName, before, backup);
  return { payload, initialRecord };
};
