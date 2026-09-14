import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ExternalLink, FileCheck2, Loader2, Paperclip, ShieldCheck } from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import ConciliacaoFiscalManifestPanel from "./ConciliacaoFiscalManifestPanel";
import ConciliacaoManualWorkflowDialog from "./ConciliacaoManualWorkflowDialog";
import {
  assertConciliacaoEvidenceFile,
  buildConciliacaoFinanceiraQueryKey,
  calculateConciliacaoEvidenceSha256,
  FISCAL_MANUAL_RECONCILIATION_TYPE,
  filterConciliacoesByScope,
  getConciliacaoDecision,
  getConciliacaoEntityLabel,
  getConciliacaoEvidenceCount,
  getConciliacaoEvidences,
  getConciliacaoRecordId,
  getConciliacaoReference,
  getConciliacaoStage,
  resolveConciliacaoFinanceiraAccess,
  resolveConciliacaoRowActions,
} from "./conciliacaoFinanceiraUiPolicy";

const STAGE_LABELS = {
  aguardando_evidencia: "Aguardando evidência",
  evidencia_anexada: "Aguardando revisão",
  aguardando_aprovacao_final: "Aguardando aprovação final",
  aprovada_aguardando_promocao_manual: "Aprovada no staging",
};

const DOMAIN_CONFIG = {
  financeiro: {
    tipoSolicitacao: "conciliacao_migracao_financeira",
    domainLabel: "financeira",
    pluralLabel: "financeiras",
    permissionModule: "Financeiro",
    title: "Pendências financeiras da empresa",
    emptyLabel: "Nenhuma conciliação financeira neste contexto.",
    decisions: [
      { value: "PAGO", label: "Pago" },
      { value: "ABERTO", label: "Em aberto" },
    ],
  },
  fiscal: {
    tipoSolicitacao: FISCAL_MANUAL_RECONCILIATION_TYPE,
    domainLabel: "fiscal",
    pluralLabel: "fiscais",
    permissionModule: "Fiscal",
    title: "Pendências fiscais da empresa",
    emptyLabel: "Nenhuma conciliação fiscal neste contexto.",
    decisions: [
      { value: "PRESERVAR_SEM_VINCULO_PEDIDO", label: "Preservar sem vínculo de pedido" },
      { value: "AGUARDAR_VINCULO_PEDIDO", label: "Aguardar vínculo de pedido" },
    ],
  },
};

export default function ConciliacaoFinanceiraAprovacoesTab({
  groupId,
  empresaId,
  contexto,
  user,
  canReview,
  canApprove,
  domain = "financeiro",
}) {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.financeiro;
  const reconcilePermission = `${config.permissionModule}.Migracao.conciliar`;
  const approvePermission = `${config.permissionModule}.Migracao.aprovar`;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState(null);
  const [decision, setDecision] = useState("");
  const [justification, setJustification] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const { validContext, canView } = resolveConciliacaoFinanceiraAccess({
    contexto,
    groupId,
    empresaId,
    canReview,
    canApprove,
  });

  const queryKey = buildConciliacaoFinanceiraQueryKey({
    userId: user?.id,
    groupId,
    empresaId,
    contexto,
    tipoSolicitacao: config.tipoSolicitacao,
  });
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await base44.functions.invoke("solicitacoesAprovacao", {
        action: "listManualReconciliations",
        group_id: groupId,
        empresa_id: empresaId,
        scope_type: "empresa",
        tipo_solicitacao: config.tipoSolicitacao,
      });
      return filterConciliacoesByScope(response?.data, { groupId, empresaId, tipoSolicitacao: config.tipoSolicitacao });
    },
    enabled: validContext && canView,
    retry: 1,
  });

  const pendingCount = useMemo(
    () => requests.filter((record) => getConciliacaoStage(record) !== "aprovada_aguardando_promocao_manual").length,
    [requests],
  );

  const closeDialog = () => {
    setDialogState(null);
    setDecision("");
    setJustification("");
    setEvidenceFile(null);
    setHumanConfirmed(false);
  };

  const workflowMutation = useMutation({
    mutationFn: async () => {
      const record = dialogState?.record;
      const action = dialogState?.action;
      if (!record?.id || !action) throw new Error("Solicitação de conciliação inválida.");

      const payload = {
        action,
        solicitacao_id: record.id,
        group_id: groupId,
        empresa_id: empresaId,
        scope_type: "empresa",
      };
      if (action === "attachManualReconciliationEvidence") {
        const metadata = assertConciliacaoEvidenceFile(evidenceFile);
        const hashSha256 = await calculateConciliacaoEvidenceSha256(evidenceFile);
        const upload = await base44.integrations.Core.UploadPrivateFile({ file: evidenceFile });
        const fileUri = upload?.file_uri;
        if (!fileUri) throw new Error("O upload privado não retornou uma referência válida.");
        payload.evidencia = {
          id: globalThis.crypto?.randomUUID?.() || `evidencia-${record.id}-${evidenceFile.size}`,
          tipo: metadata.type,
          file_uri: fileUri,
          arquivo_nome: metadata.name,
          arquivo_tamanho: metadata.size,
          hash_sha256: hashSha256,
          hash_algoritmo: "SHA-256",
          armazenamento: "privado",
          descricao: justification,
        };
      } else {
        if (!decision) throw new Error(`Selecione a decisão ${config.domainLabel}.`);
        if (!justification.trim()) throw new Error("Informe a justificativa.");
        payload.decisao = decision;
        payload.justificativa = justification.trim();
        if (action === "approveManualReconciliation") payload.confirmacao_humana = humanConfirmed;
      }
      const response = await base44.functions.invoke("solicitacoesAprovacao", payload);
      if (!response?.data?.record) throw new Error(response?.data?.error || "O backend não confirmou a atualização.");
      return response.data.record;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast({ title: "Conciliação atualizada no staging" });
      closeDialog();
    },
    onError: (mutationError) => {
      toast({ title: "Não foi possível atualizar", description: mutationError.message, variant: "destructive" });
    },
  });

  const evidenceAccessMutation = useMutation({
    mutationFn: async (/** @type {{ record: Record<string, unknown>, evidenceId: string }} */ { record, evidenceId }) => {
      const response = await base44.functions.invoke("solicitacoesAprovacao", {
        action: "createManualReconciliationEvidenceAccessUrl",
        solicitacao_id: record.id,
        evidencia_id: evidenceId,
        group_id: groupId,
        empresa_id: empresaId,
        scope_type: "empresa",
      });
      const signedUrl = response?.data?.signed_url;
      if (!signedUrl) throw new Error(response?.data?.error || "O backend não autorizou o acesso à evidência.");
      return signedUrl;
    },
    onSuccess: (signedUrl) => {
      const anchor = document.createElement("a");
      anchor.href = signedUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    },
    onError: (accessError) => {
      toast({ title: "Não foi possível abrir a evidência", description: accessError.message, variant: "destructive" });
    },
  });

  if (!validContext) {
    return (
      <Alert className="mt-4 border-amber-300 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-amber-900">
          Selecione uma Empresa para revisar conciliações {config.pluralLabel}. A visão de Grupo não permite decidir por uma empresa.
        </AlertDescription>
      </Alert>
    );
  }

  if (!canView) {
    return (
      <Alert variant="destructive" className="mt-4">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>Seu perfil não possui permissão para visualizar a conciliação {config.domainLabel}.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-4 w-full space-y-4" data-context-required="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Pendentes de ação</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-amber-700">{pendingCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Aprovadas no staging</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-emerald-700">{requests.length - pendingCount}</CardContent>
        </Card>
      </div>

      <Alert className="border-slate-300 bg-slate-50">
        <ShieldCheck className="h-4 w-4 text-slate-700" />
        <AlertDescription>
          A aprovação classifica a pendência, mas mantém o registro bloqueado no staging. Nenhum registro operacional é criado ou promovido nesta etapa.
        </AlertDescription>
      </Alert>

      {domain === "fiscal" && (
        <ConciliacaoFiscalManifestPanel
          canValidate={canReview}
          validContext={validContext}
          permission={reconcilePermission}
        />
      )}

      <Card>
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 className="h-5 w-5" />
            {config.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Evidências</TableHead>
                  <TableHead>Decisão</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((record) => {
                  const stage = getConciliacaoStage(record);
                  const evidences = getConciliacaoEvidences(record);
                  const latestPrivateEvidence = [...evidences].reverse().find((item) => item?.file_uri);
                  const { canAttach, canPerformReview, canPerformApproval } = resolveConciliacaoRowActions({
                    record,
                    userId: user?.id,
                    canReview,
                    canApprove,
                  });
                  return (
                    <TableRow key={getConciliacaoRecordId(record)}>
                      <TableCell className="font-medium">{getConciliacaoReference(record) || "-"}</TableCell>
                      <TableCell>{getConciliacaoEntityLabel(record)}</TableCell>
                      <TableCell><Badge variant="outline">{STAGE_LABELS[stage] || stage || "Pendente"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{getConciliacaoEvidenceCount(record)}</span>
                          {latestPrivateEvidence && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Abrir evidência mais recente"
                              aria-label="Abrir evidência mais recente"
                              onClick={() => evidenceAccessMutation.mutate({ record, evidenceId: latestPrivateEvidence.id })}
                              disabled={evidenceAccessMutation.isPending}
                              data-permission={canReview ? reconcilePermission : approvePermission}
                              data-action="conciliacao-abrir-evidencia"
                              data-sensitive="true"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getConciliacaoDecision(record) || "-"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {canAttach && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDialogState({ record, action: "attachManualReconciliationEvidence" })}
                              data-permission={reconcilePermission}
                              data-action="conciliacao-anexar-evidencia"
                              data-sensitive="true"
                            >
                              <Paperclip className="mr-1 h-4 w-4" />
                              Evidência
                            </Button>
                          )}
                          {canPerformReview && (
                            <Button
                              size="sm"
                              onClick={() => setDialogState({ record, action: "reviewManualReconciliation" })}
                              data-permission={reconcilePermission}
                              data-action="conciliacao-revisar"
                              data-sensitive="true"
                            >
                              Revisar
                            </Button>
                          )}
                          {canPerformApproval && (
                            <Button
                              size="sm"
                              onClick={() => setDialogState({ record, action: "approveManualReconciliation" })}
                              data-permission={approvePermission}
                              data-action="conciliacao-aprovar"
                              data-sensitive="true"
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Aprovar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando pendências
            </div>
          )}
          {!isLoading && error && <div className="p-6 text-center text-red-700">Não foi possível consultar o staging.</div>}
          {!isLoading && !error && requests.length === 0 && (
            <div className="p-10 text-center text-slate-500">{config.emptyLabel}</div>
          )}
        </CardContent>
      </Card>

      <ConciliacaoManualWorkflowDialog
        dialogState={dialogState}
        domain={domain}
        config={config}
        decision={decision}
        onDecisionChange={setDecision}
        justification={justification}
        onJustificationChange={setJustification}
        onEvidenceChange={setEvidenceFile}
        humanConfirmed={humanConfirmed}
        onHumanConfirmedChange={setHumanConfirmed}
        reconcilePermission={reconcilePermission}
        approvePermission={approvePermission}
        isPending={workflowMutation.isPending}
        onClose={closeDialog}
        onConfirm={() => workflowMutation.mutate()}
      />
    </div>
  );
}
