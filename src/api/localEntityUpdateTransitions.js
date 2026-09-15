/** @typedef {Record<string, unknown>} LocalRecord */
/**
 * @typedef {{
 *   reuse?: LocalRecord | null,
 *   record: LocalRecord,
 *   action?: string,
 *   settlement?: boolean,
 *   estorno?: boolean,
 *   conciliation?: boolean,
 *   emit?: boolean,
 *   cancel?: boolean,
 * }} UpdateDecision
 */
/**
 * @typedef {{
 *   getStore: (db: LocalRecord, entityName: string) => LocalRecord[],
 *   readUser: () => LocalRecord,
 *   assertPermissionAny: (entityName: string, actions: string[], id: unknown) => void,
 *   assertMutationAllowed: (entityName: string, action: string, id: unknown) => void,
 *   assertTituloSettlementAllowed: (entityName: string, id: unknown) => void,
 *   isTituloFinanceiro: (entityName: string) => boolean,
 *   notaFiscalEntities: string[],
 *   resolvePortalClienteId: (clientes: LocalRecord[], user: LocalRecord) => string | number | null,
 *   assertPortalTituloWrite: (options: { before: LocalRecord, patch: LocalRecord, portalClienteId: string | number }) => void,
 *   assertEntregaOnUpdate: (options: { before: LocalRecord, patch: LocalRecord }) => UpdateDecision,
 *   entregaActions: (action: string) => string[],
 *   isMotoristaIdempotencyKey: (value: unknown) => boolean,
 *   assertEntregaMotoristaOnUpdate: (options: { before: LocalRecord, patch: LocalRecord, user: LocalRecord, motoristas: LocalRecord[] }) => LocalRecord,
 *   assertOrdemCompraOnUpdate: (options: { before: LocalRecord, patch: LocalRecord }) => UpdateDecision,
 *   ordemCompraActions: (action: string) => string[],
 *   assertOportunidadeOnUpdate: (options: { before: LocalRecord, patch: LocalRecord }) => UpdateDecision,
 *   oportunidadeActions: (action: string) => string[],
 *   assertTituloOnUpdate: (options: { before: LocalRecord, patch: LocalRecord }) => UpdateDecision,
 *   assertNotaFiscalOnUpdate: (options: { before: LocalRecord, patch: LocalRecord }) => UpdateDecision,
 *   nfeEmitActions: () => string[],
 *   nfeCancelActions: () => string[],
 *   assertOpOnUpdate: (options: { before: LocalRecord, patch: LocalRecord }) => UpdateDecision,
 *   opActions: (action: string) => string[],
 * }} LocalEntityUpdateDependencies
 */

/**
 * Aplica somente transicoes operacionais. Persistencia e auditoria permanecem
 * no cliente chamador e so ocorrem quando nao ha retorno idempotente.
 * @param {{
 *   db: LocalRecord,
 *   entityName: string,
 *   id: unknown,
 *   before: LocalRecord,
 *   payload: LocalRecord,
 *   initialRecord: LocalRecord,
 *   dependencies: LocalEntityUpdateDependencies,
 * }} options
 * @returns {{ reuse?: LocalRecord, record?: LocalRecord }}
 */
export const applyLocalEntityUpdateTransitions = ({
  db,
  entityName,
  id,
  before,
  payload,
  initialRecord,
  dependencies,
}) => {
  let nextRecord = initialRecord;

  if (entityName === 'Entrega') {
    const decision = dependencies.assertEntregaOnUpdate({ before, patch: payload });
    if (decision.reuse || decision.action === 'retry') {
      dependencies.assertPermissionAny(entityName, ['editar', 'entregar', 'conferir', 'expedir'], id);
      return { reuse: decision.reuse || before };
    }
    dependencies.assertPermissionAny(entityName, dependencies.entregaActions(decision.action || 'editar'), id);
    nextRecord = decision.record;
    if (before.empresa_id) nextRecord.empresa_id = before.empresa_id;
    if (
      dependencies.isMotoristaIdempotencyKey(payload.idempotency_key)
      || dependencies.isMotoristaIdempotencyKey(nextRecord.idempotency_key)
    ) {
      nextRecord = dependencies.assertEntregaMotoristaOnUpdate({
        before,
        patch: nextRecord,
        user: dependencies.readUser(),
        motoristas: dependencies.getStore(db, 'Motorista'),
      });
      if (before.empresa_id) nextRecord.empresa_id = before.empresa_id;
    }
  }

  if (entityName === 'OrdemCompra') {
    const decision = dependencies.assertOrdemCompraOnUpdate({ before, patch: payload });
    if (decision.reuse || decision.action === 'retry') {
      dependencies.assertPermissionAny(entityName, ['editar', 'receber', 'aprovar', 'enviar_fornecedor'], id);
      return { reuse: decision.reuse || before };
    }
    dependencies.assertPermissionAny(entityName, dependencies.ordemCompraActions(decision.action || 'editar'), id);
    nextRecord = decision.record;
    if (before.empresa_id) nextRecord.empresa_id = before.empresa_id;
  }

  if (entityName === 'Oportunidade') {
    const decision = dependencies.assertOportunidadeOnUpdate({ before, patch: payload });
    if (decision.reuse || decision.action === 'retry') {
      dependencies.assertPermissionAny(entityName, ['editar', 'mover_etapa', 'converter'], id);
      return { reuse: decision.reuse || before };
    }
    dependencies.assertPermissionAny(entityName, dependencies.oportunidadeActions(decision.action || 'editar'), id);
    nextRecord = decision.record;
    if (before.empresa_id) nextRecord.empresa_id = before.empresa_id;
  }

  if (dependencies.isTituloFinanceiro(entityName)) {
    const portalClienteId = dependencies.resolvePortalClienteId(
      dependencies.getStore(db, 'Cliente'),
      dependencies.readUser(),
    );
    if (portalClienteId && entityName === 'ContaReceber') {
      dependencies.assertPortalTituloWrite({ before, patch: payload, portalClienteId });
    }
    const decision = dependencies.assertTituloOnUpdate({ before, patch: payload });
    if (decision.reuse) {
      dependencies.assertTituloSettlementAllowed(entityName, id);
      return { reuse: decision.reuse };
    }
    if (decision.settlement) dependencies.assertTituloSettlementAllowed(entityName, id);
    else if (decision.estorno) dependencies.assertMutationAllowed(entityName, 'estornar', id);
    else if (decision.conciliation) dependencies.assertMutationAllowed(entityName, 'conciliar', id);
    else dependencies.assertMutationAllowed(entityName, 'editar', id);
    nextRecord = decision.record;
  }

  if (dependencies.notaFiscalEntities.includes(entityName)) {
    const decision = dependencies.assertNotaFiscalOnUpdate({ before, patch: payload });
    if (decision.reuse) {
      dependencies.assertPermissionAny(
        entityName,
        [...dependencies.nfeEmitActions(), ...dependencies.nfeCancelActions()],
        id,
      );
      return { reuse: decision.reuse };
    }
    if (decision.emit) dependencies.assertPermissionAny(entityName, dependencies.nfeEmitActions(), id);
    else if (decision.cancel) dependencies.assertPermissionAny(entityName, dependencies.nfeCancelActions(), id);
    else dependencies.assertMutationAllowed(entityName, 'editar', id);
    nextRecord = decision.record;
    if (before.empresa_id) nextRecord.empresa_id = before.empresa_id;
    if (before.empresa_faturamento_id) nextRecord.empresa_faturamento_id = before.empresa_faturamento_id;
  }

  if (entityName === 'OrdemProducao') {
    const decision = dependencies.assertOpOnUpdate({ before, patch: payload });
    if (decision.reuse || decision.action === 'retry') {
      dependencies.assertPermissionAny(entityName, ['editar', 'apontar', 'aprovar', 'criar'], id);
      return { reuse: decision.reuse || before };
    }
    dependencies.assertPermissionAny(entityName, dependencies.opActions(decision.action || 'editar'), id);
    nextRecord = decision.record;
    if (before.empresa_id) nextRecord.empresa_id = before.empresa_id;
  }

  return { record: nextRecord };
};
