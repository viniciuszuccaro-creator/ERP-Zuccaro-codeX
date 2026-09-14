import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createServer } from "vite";

import {
  buildManualReconciliationApprovalRequest,
  buildPendingManualReconciliation,
  MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
} from "../src/components/lib/migracaoErpPolicy.js";

const STORAGE_KEY = "erp_integra_local_db_v1";
const USER_KEY = "erp_integra_local_user_v1";
const GROUP_ID = "local_grupo_cpa";
const EMPRESA_CPA_ID = "local_empresa_cpa";
const EMPRESA_3Z_ID = "local_empresa_3z";
const privateEvidence = (id) => ({
  id,
  tipo: "application/pdf",
  file_uri: `private/local-test/${id}.pdf`,
  arquivo_nome: `${id}.pdf`,
  arquivo_tamanho: 128,
  hash_sha256: "a".repeat(64),
  hash_algoritmo: "SHA-256",
  armazenamento: "privado",
});

const createMemoryStorage = (initialEntries = []) => {
  const values = new Map(initialEntries);
  const blockedWrites = new Set();
  const ignoredWrites = new Set();
  return {
    getItem: (key) => values.has(String(key)) ? values.get(String(key)) : null,
    setItem: (key, value) => {
      if (blockedWrites.has(String(key))) throw new Error(`Escrita bloqueada para ${key}`);
      if (ignoredWrites.has(String(key))) return;
      values.set(String(key), String(value));
    },
    removeItem: (key) => values.delete(String(key)),
    clear: () => values.clear(),
    blockWrites: (key) => blockedWrites.add(String(key)),
    allowWrites: (key) => blockedWrites.delete(String(key)),
    ignoreWrites: (key) => ignoredWrites.add(String(key)),
    confirmWrites: (key) => ignoredWrites.delete(String(key)),
    snapshot: () => [...values.entries()].sort(([left], [right]) => left.localeCompare(right)),
    restore: (entries) => {
      blockedWrites.clear();
      ignoredWrites.clear();
      values.clear();
      entries.forEach(([key, value]) => values.set(key, value));
    },
  };
};

const makeUser = (id, empresaId, contexto = "empresa", perfilAcessoId = "local_perfil_admin") => ({
  id,
  email: `${id}@homologacao.local`,
  full_name: id,
  role: "user",
  perfil_acesso_id: perfilAcessoId,
  mestre_local: false,
  disabled: false,
  ativo: true,
  status: "Ativo",
  is_verified: true,
  contexto_atual: contexto,
  grupo_atual_id: GROUP_ID,
  grupo_padrao_id: GROUP_ID,
  empresa_atual_id: empresaId,
  empresa_padrao_id: empresaId,
  grupos_vinculados: [{ grupo_id: GROUP_ID, ativo: true }],
  empresas_vinculadas: [
    { empresa_id: EMPRESA_CPA_ID, ativo: true },
    { empresa_id: EMPRESA_3Z_ID, ativo: true },
  ],
});

const makeRequest = (empresaId, code, entidade = "ContaPagar") => {
  const staging = buildPendingManualReconciliation({
    group_id: GROUP_ID,
    empresa_id: empresaId,
    codigo_legado: code,
  }, { entidade, registradoPor: "registrante", registradoEm: "2026-09-13T12:00:00.000Z" });
  return {
    id: `homologacao-${empresaId}-${code}`,
    ...buildManualReconciliationApprovalRequest(staging, {
      solicitanteId: "registrante",
      timestamp: "2026-09-13T12:05:00.000Z",
    }),
  };
};

test("cliente local persiste e reabre conciliacao entre tres sessoes sem misturar empresas", async () => {
  const storage = createMemoryStorage([["registro-anterior", "preservar"]]);
  const originalSnapshot = storage.snapshot();
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });

  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    root,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  const reopenClient = async (sessionName) => {
    const module = await server.ssrLoadModule(
      `/src/api/localBase44Client.js?homologacao=${sessionName}-${Date.now()}`,
    );
    return module.localBase44;
  };
  const openSession = async (id, empresaId, contexto = "empresa", perfilAcessoId = "local_perfil_admin") => {
    storage.setItem(USER_KEY, JSON.stringify(makeUser(id, empresaId, contexto, perfilAcessoId)));
    storage.setItem("contexto_atual", contexto);
    storage.setItem("group_atual_id", GROUP_ID);
    if (empresaId) storage.setItem("empresa_atual_id", empresaId);
    else storage.removeItem("empresa_atual_id");
    return reopenClient(id);
  };

  try {
    const setupClient = await reopenClient("preparacao");
    setupClient.__local.reset();
    await setupClient.entities.PerfilAcesso.create({
      id: "perfil-somente-financeiro",
      nome: "Homologacao somente financeira",
      ativo: true,
      group_id: GROUP_ID,
      permissoes: {
        Financeiro: { Migracao: ["visualizar", "conciliar", "aprovar"] },
      },
    });
    await setupClient.entities.SolicitacaoAprovacao.create(makeRequest(EMPRESA_CPA_ID, "cpa-1"));
    await setupClient.entities.SolicitacaoAprovacao.create(makeRequest(EMPRESA_3Z_ID, "3z-1"));
    const beforeWorkflow = JSON.parse(storage.getItem(STORAGE_KEY));
    const financialCounts = {
      pagar: beforeWorkflow.ContaPagar?.length || 0,
      receber: beforeWorkflow.ContaReceber?.length || 0,
      fiscal: beforeWorkflow.NotaFiscal?.length || 0,
    };

    const groupClient = await openSession("registrante", null, "grupo");
    await assert.rejects(
      () => groupClient.functions.invoke("solicitacoesAprovacao", {
        action: "listManualReconciliations",
        group_id: GROUP_ID,
        empresa_id: EMPRESA_CPA_ID,
        scope_type: "empresa",
      }),
      /Contexto local nao autorizado/,
    );

    const registrantClient = await openSession("registrante", EMPRESA_CPA_ID);
    const fiscalRequest = makeRequest(EMPRESA_CPA_ID, "nf-fiscal-1", "NotaFiscal");
    const createdFiscal = await registrantClient.functions.invoke("solicitacoesAprovacao", {
      action: "createManualReconciliation",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      approval_request: fiscalRequest,
    });
    assert.equal(createdFiscal.data.reused, false);
    assert.equal(createdFiscal.data.record.tipo_solicitacao, "conciliacao_migracao_fiscal");
    const reusedFiscal = await registrantClient.functions.invoke("solicitacoesAprovacao", {
      action: "createManualReconciliation",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      approval_request: fiscalRequest,
    });
    assert.equal(reusedFiscal.data.reused, true);
    assert.equal(reusedFiscal.data.record.id, createdFiscal.data.record.id);
    const cpaList = await registrantClient.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
    });
    assert.deepEqual(cpaList.data.map((record) => record.referencia_staging), ["cpa-1"]);
    const requestId = cpaList.data[0].id;
    await registrantClient.functions.invoke("solicitacoesAprovacao", {
      action: "attachManualReconciliationEvidence",
      solicitacao_id: requestId,
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      evidencia: privateEvidence("evidencia-descartavel-1"),
    });

    const reviewerClient = await openSession("revisor", EMPRESA_CPA_ID);
    const reopenedForReview = await reviewerClient.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
    });
    assert.equal(
      reopenedForReview.data[0].dados_propostos.envelope_staging.etapa_conciliacao,
      "evidencia_anexada",
    );
    const privateAccess = await reviewerClient.functions.invoke("solicitacoesAprovacao", {
      action: "createManualReconciliationEvidenceAccessUrl",
      solicitacao_id: requestId,
      evidencia_id: "evidencia-descartavel-1",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
    });
    assert.match(privateAccess.data.signed_url, /^local:\/\/signed\//);
    assert.equal(privateAccess.data.expires_in, 300);
    await reviewerClient.functions.invoke("solicitacoesAprovacao", {
      action: "reviewManualReconciliation",
      solicitacao_id: requestId,
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      decisao: "ABERTO",
      justificativa: "Documento sintetico conferido em sessao descartavel.",
    });

    const approverClient = await openSession("aprovador", EMPRESA_CPA_ID);
    const reopenedForApproval = await approverClient.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
    });
    assert.equal(
      reopenedForApproval.data[0].dados_propostos.envelope_staging.etapa_conciliacao,
      "aguardando_aprovacao_final",
    );
    await approverClient.functions.invoke("solicitacoesAprovacao", {
      action: "approveManualReconciliation",
      solicitacao_id: requestId,
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      decisao: "ABERTO",
      justificativa: "Terceira sessao confirma a classificacao sintetica.",
      confirmacao_humana: true,
    });

    const z3Client = await openSession("aprovador", EMPRESA_3Z_ID);
    const z3List = await z3Client.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_3Z_ID,
      scope_type: "empresa",
    });
    assert.deepEqual(z3List.data.map((record) => record.referencia_staging), ["3z-1"]);
    assert.equal(
      z3List.data[0].dados_propostos.envelope_staging.etapa_conciliacao,
      "aguardando_evidencia",
    );

    const beforeRejectedWrite = storage.getItem(STORAGE_KEY);
    storage.blockWrites(STORAGE_KEY);
    await assert.rejects(
      () => z3Client.functions.invoke("solicitacoesAprovacao", {
        action: "attachManualReconciliationEvidence",
        solicitacao_id: z3List.data[0].id,
        group_id: GROUP_ID,
        empresa_id: EMPRESA_3Z_ID,
        scope_type: "empresa",
        evidencia: privateEvidence("evidencia-nao-persistida"),
      }),
      /Nao foi possivel confirmar a persistencia local/,
    );
    storage.allowWrites(STORAGE_KEY);
    assert.equal(storage.getItem(STORAGE_KEY), beforeRejectedWrite);
    const reopenedAfterFailure = await (await openSession("aprovador", EMPRESA_3Z_ID)).functions.invoke(
      "solicitacoesAprovacao",
      {
        action: "listManualReconciliations",
        group_id: GROUP_ID,
        empresa_id: EMPRESA_3Z_ID,
        scope_type: "empresa",
      },
    );
    assert.equal(
      reopenedAfterFailure.data[0].dados_propostos.envelope_staging.etapa_conciliacao,
      "aguardando_evidencia",
    );

    const beforeUnconfirmedWrite = storage.getItem(STORAGE_KEY);
    storage.ignoreWrites(STORAGE_KEY);
    await assert.rejects(
      () => z3Client.functions.invoke("solicitacoesAprovacao", {
        action: "attachManualReconciliationEvidence",
        solicitacao_id: z3List.data[0].id,
        group_id: GROUP_ID,
        empresa_id: EMPRESA_3Z_ID,
        scope_type: "empresa",
        evidencia: privateEvidence("evidencia-sem-confirmacao"),
      }),
      /Nao foi possivel confirmar a persistencia local/,
    );
    storage.confirmWrites(STORAGE_KEY);
    assert.equal(storage.getItem(STORAGE_KEY), beforeUnconfirmedWrite);
    const reopenedAfterUnconfirmedWrite = await (await openSession("aprovador", EMPRESA_3Z_ID)).functions.invoke(
      "solicitacoesAprovacao",
      {
        action: "listManualReconciliations",
        group_id: GROUP_ID,
        empresa_id: EMPRESA_3Z_ID,
        scope_type: "empresa",
      },
    );
    assert.equal(
      reopenedAfterUnconfirmedWrite.data[0].dados_propostos.envelope_staging.etapa_conciliacao,
      "aguardando_evidencia",
    );

    const financeOnlyClient = await openSession(
      "somente-financeiro",
      EMPRESA_CPA_ID,
      "empresa",
      "perfil-somente-financeiro",
    );
    const financeOnlyList = await financeOnlyClient.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
    });
    assert.deepEqual(financeOnlyList.data.map((record) => record.referencia_staging), ["cpa-1"]);
    await assert.rejects(
      () => financeOnlyClient.functions.invoke("solicitacoesAprovacao", {
        action: "listManualReconciliations",
        group_id: GROUP_ID,
        empresa_id: EMPRESA_CPA_ID,
        scope_type: "empresa",
        tipo_solicitacao: "conciliacao_migracao_fiscal",
      }),
      /Permissao negada/,
    );

    const fiscalRegistrant = await openSession("registrante-fiscal", EMPRESA_CPA_ID);
    const fiscalRegistrantList = await fiscalRegistrant.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      tipo_solicitacao: "conciliacao_migracao_fiscal",
    });
    assert.deepEqual(fiscalRegistrantList.data.map((record) => record.referencia_staging), ["nf-fiscal-1"]);
    const fiscalRequestId = fiscalRegistrantList.data[0].id;
    await fiscalRegistrant.functions.invoke("solicitacoesAprovacao", {
      action: "attachManualReconciliationEvidence",
      solicitacao_id: fiscalRequestId,
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      evidencia: privateEvidence("evidencia-fiscal-descartavel"),
    });

    const fiscalReviewer = await openSession("revisor-fiscal", EMPRESA_CPA_ID);
    const reopenedFiscalForReview = await fiscalReviewer.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      tipo_solicitacao: "conciliacao_migracao_fiscal",
    });
    assert.equal(reopenedFiscalForReview.data[0].dados_propostos.envelope_staging.etapa_conciliacao, "evidencia_anexada");
    await fiscalReviewer.functions.invoke("solicitacoesAprovacao", {
      action: "reviewManualReconciliation",
      solicitacao_id: fiscalRequestId,
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      decisao: "PRESERVAR_SEM_VINCULO_PEDIDO",
      justificativa: "Documento fiscal sintetico revisado em nova sessao.",
    });

    const fiscalApprover = await openSession("aprovador-fiscal", EMPRESA_CPA_ID);
    const reopenedFiscalForApproval = await fiscalApprover.functions.invoke("solicitacoesAprovacao", {
      action: "listManualReconciliations",
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      tipo_solicitacao: "conciliacao_migracao_fiscal",
    });
    assert.equal(reopenedFiscalForApproval.data[0].dados_propostos.envelope_staging.etapa_conciliacao, "aguardando_aprovacao_final");
    await fiscalApprover.functions.invoke("solicitacoesAprovacao", {
      action: "approveManualReconciliation",
      solicitacao_id: fiscalRequestId,
      group_id: GROUP_ID,
      empresa_id: EMPRESA_CPA_ID,
      scope_type: "empresa",
      decisao: "PRESERVAR_SEM_VINCULO_PEDIDO",
      justificativa: "Terceira sessao confirma a decisao fiscal sintetica.",
      confirmacao_humana: true,
    });

    const reopenedFiscal = await (await openSession("auditor-fiscal", EMPRESA_CPA_ID)).functions.invoke(
      "solicitacoesAprovacao",
      {
        action: "listManualReconciliations",
        group_id: GROUP_ID,
        empresa_id: EMPRESA_CPA_ID,
        scope_type: "empresa",
        tipo_solicitacao: "conciliacao_migracao_fiscal",
      },
    );
    const fiscalEnvelope = reopenedFiscal.data[0].dados_propostos.envelope_staging;
    assert.equal(fiscalEnvelope.etapa_conciliacao, "aprovada_aguardando_promocao_manual");
    assert.equal(fiscalEnvelope.decisao_fiscal.classificacao, "PRESERVAR_SEM_VINCULO_PEDIDO");
    assert.equal(fiscalEnvelope.destino_migracao, "staging");
    assert.equal(fiscalEnvelope.confirmado, false);

    const persisted = z3Client.__local.export();
    const approved = persisted.SolicitacaoAprovacao.find((record) => record.id === requestId);
    const envelope = approved.dados_propostos.envelope_staging;
    assert.equal(approved.status, "pendente");
    assert.equal(approved.bloqueio_operacional, true);
    assert.equal(envelope.etapa_conciliacao, "aprovada_aguardando_promocao_manual");
    assert.equal(envelope.status_migracao, MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION);
    assert.equal(envelope.confirmado, false);
    assert.equal(persisted.ContaPagar?.length || 0, financialCounts.pagar);
    assert.equal(persisted.ContaReceber?.length || 0, financialCounts.receber);
    assert.equal(persisted.NotaFiscal?.length || 0, financialCounts.fiscal);
    const workflowAudits = persisted.AuditLog.filter((entry) => (
      entry.registro_id === requestId && ["Evidencia", "Revisao", "Aprovacao"].includes(entry.acao)
    ));
    assert.deepEqual(
      workflowAudits.map((entry) => entry.usuario_id).sort(),
      ["aprovador", "registrante", "revisor"],
    );
    const fiscalWorkflowAudits = persisted.AuditLog.filter((entry) => (
      entry.registro_id === fiscalRequestId && ["Evidencia", "Revisao", "Aprovacao"].includes(entry.acao)
    ));
    assert.deepEqual(
      fiscalWorkflowAudits.map((entry) => entry.usuario_id).sort(),
      ["aprovador-fiscal", "registrante-fiscal", "revisor-fiscal"],
    );
    assert.ok(fiscalWorkflowAudits.every((entry) => entry.modulo === "Fiscal"));
  } finally {
    await server.close();
    storage.restore(originalSnapshot);
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    assert.deepEqual(storage.snapshot(), originalSnapshot);
  }
});
