import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Link2, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { persistOperationalAudit } from "@/components/lib/uiAudit";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const isSafeUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export default function GerarLinkPagamentoModal({ isOpen, onClose, contaReceber }) {
  const queryClient = useQueryClient();
  const [linkGerado, setLinkGerado] = useState(null);
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = contaReceber?.group_id || contaReceber?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contaReceber?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeGerarLink = hasPermission("Financeiro", "Contas a Receber", "editar")
    || hasPermission("Financeiro", "ContaReceber", "editar")
    || hasPermission("Financeiro", "Cobranca", "criar")
    || hasPermission("Financeiro", null, "editar");

  const auditLinkPagamento = async (acao, sucesso, detalhes = {}) => {
    await persistOperationalAudit({
      acao,
      sucesso,
      detalhes,
      modulo: "Financeiro",
      entidade: "ContaReceber",
      registro_id: contaReceber?.id || null,
      descricao: `Link de pagamento: ${acao}`,
      empresa_id: empresaId,
      group_id: groupId,
    });
  };

  const withContext = (payload = {}) => ({
    ...payload,
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {})
  });

  const gerarLinkMutation = useMutation({
    mutationFn: async () => {
      if (!contaReceber?.id) {
        throw new Error("Titulo financeiro nao informado.");
      }
      if (!contextoValido || !empresaId) {
        await auditLinkPagamento("bloqueado_sem_contexto", false, { motivo: "Grupo/empresa obrigatorios" });
        throw new Error("Selecione um grupo e uma empresa antes de gerar o link.");
      }
      if (!podeGerarLink) {
        await auditLinkPagamento("bloqueado_sem_permissao", false, { permissao: "Financeiro.ContaReceber.editar" });
        throw new Error("Sem permissao para gerar link de pagamento.");
      }
      const confirmado = window.confirm("Gerar link de pagamento para este titulo? Esta acao sera auditada.");
      if (!confirmado) {
        await auditLinkPagamento("cancelado_pelo_usuario", false, { valor: contaReceber?.valor || 0 });
        throw new Error("Geracao cancelada pelo usuario.");
      }

      const linkSimulado = `https://pag.erp-integra.com.br/pay/${encodeURIComponent(contaReceber.id)}`;
      if (!isSafeUrl(linkSimulado)) {
        throw new Error("Link de pagamento invalido.");
      }

      const pagamento = await createInContext("PagamentoOmnichannel", withContext({
        origem_pagamento: "Link Pagamento",
        cliente_nome: sanitizeText(contaReceber.cliente || contaReceber.cliente_nome),
        cliente_cpf_cnpj: sanitizeText(contaReceber.cliente_cpf_cnpj),
        valor_bruto: Number(contaReceber.valor || contaReceber.valor_total || 0),
        valor_liquido: Number((contaReceber.valor || contaReceber.valor_total || 0) * 0.97),
        forma_pagamento: "PIX",
        status_transacao: "Pendente",
        status_conferencia: "Pendente",
        conta_receber_id: contaReceber.id,
        link_pagamento: linkSimulado,
        gateway_utilizado: "Asaas",
        data_transacao: new Date().toISOString()
      }));

      await updateInContext("ContaReceber", contaReceber.id, withContext({
        url_fatura: linkSimulado,
        link_pagamento_gerado: linkSimulado,
        data_link_pagamento: new Date().toISOString(),
        status_cobranca: "gerada_simulada",
        forma_cobranca: "Link Pagamento",
        pagamento_omnichannel_id: pagamento?.id || null
      }));

      await auditLinkPagamento("link_pagamento_gerado", true, {
        valor: Number(contaReceber.valor || contaReceber.valor_total || 0),
        pagamento_omnichannel_id: pagamento?.id || null,
        gateway: "Asaas"
      });

      return linkSimulado;
    },
    onSuccess: (link) => {
      setLinkGerado(link);
      queryClient.invalidateQueries({ queryKey: ["contasReceber"] });
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-omnichannel"] });
      toast.success("Link de pagamento gerado!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar link de pagamento");
    }
  });

  const copiarLink = () => {
    if (!linkGerado || !isSafeUrl(linkGerado)) return;
    navigator.clipboard.writeText(linkGerado);
    toast.success("Link copiado!");
  };

  const cliente = sanitizeText(contaReceber?.cliente || contaReceber?.cliente_nome);
  const valor = Number(contaReceber?.valor || contaReceber?.valor_total || 0);
  const vencimento = contaReceber?.data_vencimento ? new Date(contaReceber.data_vencimento).toLocaleDateString("pt-BR") : "-";
  const bloqueado = !contextoValido || !empresaId || !podeGerarLink;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Link de Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertDescription>
              <p className="font-semibold mb-2">Cliente: {cliente || "-"}</p>
              <p>Valor: R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-500 mt-1">Vencimento: {vencimento}</p>
            </AlertDescription>
          </Alert>

          {bloqueado && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                {!contextoValido || !empresaId
                  ? "Selecione uma empresa do grupo antes de gerar cobranca."
                  : "Seu perfil nao tem permissao para gerar link de pagamento."}
              </AlertDescription>
            </Alert>
          )}

          {!linkGerado ? (
            <Button
              onClick={() => gerarLinkMutation.mutate()}
              disabled={gerarLinkMutation.isPending || bloqueado}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
              data-action="gerar-link-pagamento"
              data-permission="Financeiro.ContaReceber.editar"
              data-context-required="group_id,empresa_id"
              data-sensitive="true"
            >
              {gerarLinkMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando Link...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Gerar Link de Pagamento
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  Link gerado com sucesso. Copie e envie ao cliente.
                </AlertDescription>
              </Alert>

              <div>
                <Label>Link de Pagamento</Label>
                <div className="flex gap-2 mt-2">
                  <Input value={linkGerado} readOnly className="font-mono text-sm" />
                  <Button onClick={copiarLink} variant="outline" title="Copiar link">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Proximos passos:</p>
                  <ul className="text-xs space-y-1 ml-4 list-disc">
                    <li>Envie o link ao cliente via WhatsApp ou e-mail</li>
                    <li>Cliente paga via PIX ou cartao</li>
                    <li>Webhook baixa automaticamente quando integrado</li>
                    <li>Pagamento segue para Omnichannel para conciliacao</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Button onClick={onClose} className="w-full">Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}