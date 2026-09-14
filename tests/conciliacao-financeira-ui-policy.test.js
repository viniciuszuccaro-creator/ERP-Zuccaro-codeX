import assert from "node:assert/strict";
import test from "node:test";

import { applyManualWorkflowTransition } from "../base44/functions/_lib/financeiro/manualReconciliationApprovalPolicy/entry.ts";
import {
  buildManualReconciliationApprovalRequest,
  buildPendingManualReconciliation,
  MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
} from "../src/components/lib/migracaoErpPolicy.js";
import {
  assertConciliacaoEvidenceFile,
  assertFiscalStagingManifest,
  assertFiscalStagingManifestFile,
  buildConciliacaoFinanceiraQueryKey,
  calculateConciliacaoEvidenceSha256,
  FISCAL_MANUAL_RECONCILIATION_TYPE,
  filterConciliacoesByScope,
  readFiscalStagingManifest,
  resolveConciliacaoCentralTabs,
  resolveConciliacaoFinanceiraAccess,
  resolveConciliacaoRowActions,
} from "../src/components/comercial/conciliacaoFinanceiraUiPolicy.js";

const GROUP_ID = "grupo-cpa";
const privateEvidence = (id = "ev-1", overrides = {}) => ({
  id,
  tipo: "application/pdf",
  file_uri: `private/test/${id}.pdf`,
  arquivo_nome: `${id}.pdf`,
  arquivo_tamanho: 128,
  hash_sha256: "a".repeat(64),
  hash_algoritmo: "SHA-256",
  armazenamento: "privado",
  ...overrides,
});
const makeRequest = (empresaId, legacyCode = "titulo-1", entidade = "ContaPagar") => {
  const staging = buildPendingManualReconciliation({
    group_id: GROUP_ID,
    empresa_id: empresaId,
    codigo_legado: legacyCode,
  }, { entidade, registradoPor: "registrante", registradoEm: "2026-09-13T12:00:00.000Z" });
  return {
    id: `${empresaId}-${legacyCode}`,
    ...buildManualReconciliationApprovalRequest(staging, {
      solicitanteId: "registrante",
      timestamp: "2026-09-13T12:05:00.000Z",
    }),
  };
};
const makeFiscalManifest = () => ({
  schema_version: "1.0",
  batch_id: "FISCAL-DRYRUN-001",
  classification: "READY_FOR_EXPLICIT_STAGING_AUTHORIZATION",
  candidate_count: 3,
  source_stage: "quarantine",
  requested_target_stage: "staging",
  group_context_ref_hmac: "1".repeat(64),
  empresa_context_ref_hmac: "2".repeat(64),
  membership_ref_hmac: "3".repeat(64),
  context_resolution: "CANONICAL_IDS_RESOLVED_ONLY_IN_MEMORY",
  staging_entity: "SolicitacaoAprovacao",
  operational_entity: "NotaFiscal",
  source_sha256: {
    envelopes: "A".repeat(64),
    human_review: "B".repeat(64),
    canonical_context_map: "C".repeat(64),
    canonical_context_validation: "D".repeat(64),
  },
  candidates: ["4", "5", "6"].map((digit) => ({
    candidate_ref_hmac: digit.repeat(64),
    entity: "NotaFiscal",
    reconciliation_type: FISCAL_MANUAL_RECONCILIATION_TYPE,
    decision: "PRESERVAR_SEM_VINCULO_PEDIDO",
    pedido_link_policy: "PRESERVE_NULL",
    source_stage: "quarantine",
    requested_target_stage: "staging",
    staging_entity: "SolicitacaoAprovacao",
    staging_operation: "manual_fiscal_reconciliation_staging",
    homologation_status: "LOCAL_HOMOLOGATION_COMPLETE_IMPORT_BLOCKED",
    production_reapproval_required: true,
    import_authorized: false,
    operational_promotion_allowed: false,
    transition_authorized: false,
  })),
  controls: {
    explicit_staging_authorization_required: true,
    files_moved_to_staging: false,
    backend_or_base44_called: false,
    erp_persistence_performed: false,
    import_authorized: false,
    operational_promotion_allowed: false,
    production_reapproval_required: true,
    raw_canonical_ids_persisted: false,
  },
});

test("evidencia valida MIME, tamanho, extensao e calcula SHA-256", async () => {
  const bytes = new TextEncoder().encode("abc");
  const file = {
    name: "comprovante.pdf",
    size: bytes.byteLength,
    type: "application/pdf",
    arrayBuffer: async () => bytes.buffer,
  };
  assert.deepEqual(assertConciliacaoEvidenceFile(file), {
    name: "comprovante.pdf", size: 3, type: "application/pdf",
  });
  assert.equal(
    await calculateConciliacaoEvidenceSha256(file),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.throws(() => assertConciliacaoEvidenceFile({ ...file, size: 0 }), /entre 1 byte e 10 MB/);
  assert.throws(() => assertConciliacaoEvidenceFile({ ...file, name: "comprovante.png" }), /extensão/);
});

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

test("manifesto fiscal valida somente contrato bloqueado e sem IDs brutos", async () => {
  const manifest = makeFiscalManifest();
  assert.deepEqual(assertFiscalStagingManifest(manifest), {
    batchId: "FISCAL-DRYRUN-001",
    candidateCount: 3,
    classification: "READY_FOR_EXPLICIT_STAGING_AUTHORIZATION",
    operationalPromotionAllowed: false,
    requiresCanonicalContextVerification: true,
  });
  const contents = JSON.stringify(manifest);
  const file = {
    name: "staging-transition-manifest.json",
    size: new TextEncoder().encode(contents).byteLength,
    type: "application/json",
    text: async () => contents,
  };
  assert.deepEqual(assertFiscalStagingManifestFile(file), {
    name: file.name, size: file.size, type: file.type,
  });
  assert.deepEqual(await readFiscalStagingManifest(file), assertFiscalStagingManifest(manifest));

  assert.throws(
    () => assertFiscalStagingManifest({ ...manifest, empresa_id: "empresa-cpa" }),
    /campo não permitido: empresa_id/,
  );
  const { envelopes: omittedHash, ...incompleteSourceHashes } = manifest.source_sha256;
  assert.equal(omittedHash, "A".repeat(64));
  assert.throws(
    () => assertFiscalStagingManifest({ ...manifest, source_sha256: incompleteSourceHashes }),
    /campo obrigatório: envelopes/,
  );
  assert.throws(
    () => assertFiscalStagingManifest({
      ...manifest,
      candidates: manifest.candidates.map((candidate, index) => (
        index === 0 ? { ...candidate, transition_authorized: true } : candidate
      )),
    }),
    /autorização ou destino incompatível/,
  );
  assert.throws(
    () => assertFiscalStagingManifest({
      ...manifest,
      candidates: manifest.candidates.map((candidate) => ({
        ...candidate,
        candidate_ref_hmac: manifest.candidates[0].candidate_ref_hmac,
      })),
    }),
    /inválida ou duplicada/,
  );
  assert.throws(
    () => assertFiscalStagingManifestFile({ ...file, size: (256 * 1024) + 1 }),
    /256 KB/,
  );
});

test("perfil somente financeiro nao visualiza nem seleciona a ramificacao fiscal", () => {
  assert.deepEqual(resolveConciliacaoCentralTabs({
    activeTab: "conciliacao-fiscal",
    canReviewFinance: true,
    canApproveFinance: true,
  }), {
    tabsPermitidas: ["conciliacao"],
    tabVisivel: "conciliacao",
    totalTabs: 1,
  });
  assert.deepEqual(resolveConciliacaoCentralTabs({
    activeTab: "conciliacao",
    canReviewFiscal: true,
  }), {
    tabsPermitidas: ["conciliacao-fiscal"],
    tabVisivel: "conciliacao-fiscal",
    totalTabs: 1,
  });
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
  const fiscalKey = buildConciliacaoFinanceiraQueryKey({
    userId: "revisor", groupId: GROUP_ID, empresaId: "empresa-cpa", contexto: "empresa",
    tipoSolicitacao: FISCAL_MANUAL_RECONCILIATION_TYPE,
  });
  assert.notDeepEqual(cpaKey, fiscalKey);
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
  const fiscal = makeRequest("empresa-cpa", "nf-1", "NotaFiscal");
  assert.deepEqual(filterConciliacoesByScope([cpa, fiscal], {
    groupId: GROUP_ID,
    empresaId: "empresa-cpa",
    tipoSolicitacao: FISCAL_MANUAL_RECONCILIATION_TYPE,
  }).map((record) => record.id), [fiscal.id]);
});

test("ramificacao fiscal usa decisoes e segregacao proprias sem promover NotaFiscal", () => {
  const initial = makeRequest("empresa-cpa", "nf-2", "NotaFiscal");
  const withEvidence = applyManualWorkflowTransition(initial, "attachManualReconciliationEvidence", {
    evidencia: privateEvidence("ev-fiscal"),
  }, { id: "registrante" }, "2026-09-14T13:00:00.000Z").record;
  assert.equal(resolveConciliacaoRowActions({
    record: withEvidence, userId: "revisor-fiscal", canReview: true,
  }).canPerformReview, true);
  const reviewed = applyManualWorkflowTransition(withEvidence, "reviewManualReconciliation", {
    decisao: "PRESERVAR_SEM_VINCULO_PEDIDO",
    justificativa: "Documento fiscal sintetico sem referencia de pedido.",
  }, { id: "revisor-fiscal" }, "2026-09-14T14:00:00.000Z").record;
  assert.equal(resolveConciliacaoRowActions({
    record: reviewed, userId: "aprovador-fiscal", canApprove: true,
  }).canPerformApproval, true);
  const approved = applyManualWorkflowTransition(reviewed, "approveManualReconciliation", {
    decisao: "PRESERVAR_SEM_VINCULO_PEDIDO",
    justificativa: "Revisao fiscal independente confirmada.",
    confirmacao_humana: true,
  }, { id: "aprovador-fiscal" }, "2026-09-14T15:00:00.000Z").record;
  assert.equal(approved.dados_propostos.envelope_staging.destino_migracao, "staging");
  assert.equal(approved.dados_propostos.envelope_staging.confirmado, false);
});

test("acoes visuais respeitam tres usuarios e acompanham o workflow do backend", () => {
  const initial = makeRequest("empresa-cpa");
  assert.deepEqual(resolveConciliacaoRowActions({
    record: initial, userId: "registrante", canReview: true,
  }), { canAttach: true, canPerformReview: false, canPerformApproval: false });

  const withEvidence = applyManualWorkflowTransition(initial, "attachManualReconciliationEvidence", {
    evidencia: privateEvidence(),
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
