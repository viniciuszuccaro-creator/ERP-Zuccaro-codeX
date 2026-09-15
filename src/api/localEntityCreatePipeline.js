/** @typedef {Record<string, unknown>} LocalRecord */
/** @typedef {{ reuse?: LocalRecord | null, record?: LocalRecord | null, produtoPatch?: LocalRecord | null }} CreateStepResult */
/** @typedef {(db: LocalRecord, entityName: string, record: LocalRecord) => CreateStepResult} ReusableCreateStep */

/**
 * @typedef {{
 *   ordem: ReusableCreateStep,
 *   compras: ReusableCreateStep,
 *   expedicao: ReusableCreateStep,
 *   atendimento: ReusableCreateStep,
 *   crm: ReusableCreateStep,
 *   roteirizacao: ReusableCreateStep,
 *   siteOrigem: (entityName: string, record: LocalRecord) => LocalRecord,
 *   marketplace: ReusableCreateStep,
 *   migracao: ReusableCreateStep,
 *   piloto: (db: LocalRecord, entityName: string, record: LocalRecord) => LocalRecord,
 *   backup: (db: LocalRecord, entityName: string, record: LocalRecord) => LocalRecord,
 *   master: (db: LocalRecord, entityName: string, record: LocalRecord) => LocalRecord,
 *   syncEntregaNumero: (entityName: string, record: LocalRecord) => LocalRecord,
 *   estoque: ReusableCreateStep,
 *   financeiro: ReusableCreateStep,
 *   notaFiscal: (db: LocalRecord, entityName: string, record: LocalRecord) => LocalRecord,
 * }} LocalEntityCreateSteps
 */

/**
 * Encadeia as policies existentes antes da persistencia local. A ordem e os
 * atalhos idempotentes fazem parte do contrato e nao devem ser reordenados.
 * @param {{ db: LocalRecord, entityName: string, scoped: LocalRecord, steps: LocalEntityCreateSteps }} options
 * @returns {{ reuse?: LocalRecord, record?: LocalRecord, produtoPatch?: LocalRecord | null }}
 */
export const runLocalEntityCreatePipeline = ({ db, entityName, scoped, steps }) => {
  const ordem = steps.ordem(db, entityName, scoped);
  if (ordem.reuse) return { reuse: ordem.reuse };

  const compras = steps.compras(db, entityName, ordem.record || scoped);
  if (compras.reuse) return { reuse: compras.reuse };

  const expedicao = steps.expedicao(db, entityName, compras.record || ordem.record || scoped);
  if (expedicao.reuse) return { reuse: expedicao.reuse };

  const atendimento = steps.atendimento(
    db,
    entityName,
    expedicao.record || compras.record || ordem.record || scoped,
  );
  if (atendimento.reuse) return { reuse: atendimento.reuse };

  const crm = steps.crm(
    db,
    entityName,
    atendimento.record || expedicao.record || compras.record || ordem.record || scoped,
  );
  if (crm.reuse) return { reuse: crm.reuse };

  const roteirizacao = steps.roteirizacao(
    db,
    entityName,
    crm.record || atendimento.record || expedicao.record || compras.record || ordem.record || scoped,
  );
  if (roteirizacao.reuse) return { reuse: roteirizacao.reuse };

  const withSiteOrigem = steps.siteOrigem(
    entityName,
    roteirizacao.record || crm.record || atendimento.record || expedicao.record || ordem.record || scoped,
  );
  const marketplace = steps.marketplace(db, entityName, withSiteOrigem);
  if (marketplace.reuse) return { reuse: marketplace.reuse };

  const migracao = steps.migracao(db, entityName, marketplace.record || withSiteOrigem);
  if (migracao.reuse) return { reuse: migracao.reuse };

  const withPiloto = steps.piloto(
    db,
    entityName,
    migracao.record || marketplace.record || withSiteOrigem,
  );
  const withBackup = steps.backup(db, entityName, withPiloto);
  const stamped = steps.syncEntregaNumero(
    entityName,
    steps.master(db, entityName, withBackup),
  );
  const estoque = steps.estoque(db, entityName, stamped);
  if (estoque.reuse) return { reuse: estoque.reuse };

  const financeiro = steps.financeiro(db, entityName, estoque.record || stamped);
  if (financeiro.reuse) return { reuse: financeiro.reuse };

  return {
    record: steps.notaFiscal(db, entityName, financeiro.record || estoque.record || stamped),
    produtoPatch: estoque.produtoPatch || null,
  };
};
