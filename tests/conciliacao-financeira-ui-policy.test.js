import assert from "node:assert/strict";
import test from "node:test";

import { applyManualWorkflowTransition } from "../base44/functions/_lib/financeiro/manualReconciliationApprovalPolicy/entry.ts";
import {
  buildManualReconciliationApprovalRequest,
  buildPendingManualReconciliation,
  MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
} from "../src/components/lib/migracaoErpPolicy.js";
import {
  buildConciliacaoFinanceiraQueryKey,
  filterConciliacoesByScope,
  resolveConciliacaoFinanceiraAccess,
  resolveConciliacaoRowActions,
} from "../src/components/comercial/conciliacaoFinanceiraUiPolicy.js";

const GROUP_ID = "grupo-cpa";
const makeRequest = (empresaId, legacyCode = "titulo-1") => {
  const staging = buildPendingManualReconciliation({
    group_id: GROUP_ID,
    empresa_id: empresaId,
    codigo_legado: legacyCode,
  }, { registradoPor: "registrante", registradoEm: "2026-09-13T12:00:00.000Z" });
  return {
    id: `${empresaId}-${legacyCode}`,
    ...buildManualReconciliationApprovalRequest(staging, {
      solicitanteId: "registrante",
      timestamp: "2026-09-13T12:05:00.000Z",
    }),
  };
};

test("Grupo CPA nao consulta conciliacao e empresas exigem contexto completo", () => {
  assert.deepEqual(resolveConciliacaoFinanceiraAccess({
    contexto: "grupo", groupId: GROUP_ID, canReview: true,
  }), { validContext: false, canView: true });
  assert.deepEqual(resolveConciliacaoFinanceiraAccess({
    contexto: "empresa", groupId: GROUP_ID, empresaId: "empresa-cpa", canReview: true,
  }), { validContext: true, canView: true });
  assert.deepEqual(resolveConciliacaoFinanceiraAccess({
    contexto: "empresa", groupId: GROUP_ID, empresaId: "empresa-3z", canApprove: true,
  }), { validContext: true, canView: true });
  assert.equal(resolveConciliacaoFinanceiraAccess({
    contexto: "empresa", groupId: GROUP_ID, empresaId: "empresa-cpa",
  }).canView, false);
});

test("chaves de cache isolam Grupo CPA, CPA Ferro e Aco e 3Z LTDA", () => {
  const groupKey = buildConciliacaoFinanceiraQueryKey({
    userId: "revisor", groupId: GROUP_ID, contexto: "grupo",
  });
  const cpaKey = buildConciliacaoFinanceiraQueryKey({
    userId: "revisor", groupId: GROUP_ID, empresaId: "empresa-cpa", contexto: "empresa",
  });
  const z3Key = buildConciliacaoFinanceiraQueryKey({
    userId: "revisor", groupId: GROUP_ID, empresaId: "empresa-3z", contexto: "empresa",
  });
  assert.notDeepEqual(groupKey, cpaKey);
  assert.notDeepEqual(cpaKey, z3Key);
  assert.deepEqual(cpaKey.slice(-3), [GROUP_ID, "empresa-cpa", "empresa"]);
});

test("filtro defensivo impede mistura entre CPA Ferro e Aco e 3Z LTDA", () => {
  const cpa = makeRequest("empresa-cpa", "cpa-1");
  const z3 = makeRequest("empresa-3z", "3z-1");
  const wrongGroup = { ...makeRequest("empresa-cpa", "outro-1"), group_id: "outro-grupo" };
  const genericRequest = { ...cpa, id: "generica", tipo_solicitacao: "aprovacao_desconto" };
  assert.deepEqual(
    filterConciliacoesByScope([cpa, z3, wrongGroup, genericRequest], {
      groupId: GROUP_ID, empresaId: "empresa-cpa",
    }).map((record) => record.id),
    [cpa.id],
  );
  assert.deepEqual(
    filterConciliacoesByScope([cpa, z3], { groupId: GROUP_ID, empresaId: "empresa-3z" })
      .map((record) => record.id),
    [z3.id],
  );
  assert.deepEqual(filterConciliacoesByScope([cpa, z3], { groupId: GROUP_ID }), []);
});

test("acoes visuais respeitam tres usuarios e acompanham o workflow do backend", () => {
  const initial = makeRequest("empresa-cpa");
  assert.deepEqual(resolveConciliacaoRowActions({
    record: initial, userId: "registrante", canReview: true,
  }), { canAttach: true, canPerformReview: false, canPerformApproval: false });

  const withEvidence = applyManualWorkflowTransition(initial, "attachManualReconciliationEvidence", {
    evidencia: { id: "ev-1", tipo: "application/pdf", referencia: "arquivo-controlado" },
  }, { id: "registrante" }, "2026-09-13T13:00:00.000Z").record;
  assert.equal(resolveConciliacaoRowActions({
    record: withEvidence, userId: "registrante", canReview: true,
  }).canPerformReview, false);
  assert.equal(resolveConciliacaoRowActions({
    record: withEvidence, userId: "revisor", canReview: true,
  }).canPerformReview, true);

  const reviewed = applyManualWorkflowTransition(withEvidence, "reviewManualReconciliation", {
    decisao: "ABERTO", justificativa: "Documento conferido pelo financeiro.",
  }, { id: "revisor" }, "2026-09-13T14:00:00.000Z").record;
  assert.equal(resolveConciliacaoRowActions({
    record: reviewed, userId: "revisor", canApprove: true,
  }).canPerformApproval, false);
  assert.equal(resolveConciliacaoRowActions({
    record: reviewed, userId: "aprovador", canApprove: true,
  }).canPerformApproval, true);

  const approved = applyManualWorkflowTransition(reviewed, "approveManualReconciliation", {
    decisao: "ABERTO",
    justificativa: "Terceira conferencia confirma a classificacao.",
    confirmacao_humana: true,
  }, { id: "aprovador" }, "2026-09-13T15:00:00.000Z").record;
  const envelope = approved.dados_propostos.envelope_staging;
  assert.deepEqual(resolveConciliacaoRowActions({
    record: approved, userId: "aprovador", canReview: true, canApprove: true,
  }), { canAttach: false, canPerformReview: false, canPerformApproval: false });
  assert.equal(approved.status, "pendente");
  assert.equal(approved.bloqueio_operacional, true);
  assert.equal(envelope.status_migracao, MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION);
  assert.equal(envelope.destino_migracao, "staging");
  assert.equal(envelope.confirmado, false);
});
