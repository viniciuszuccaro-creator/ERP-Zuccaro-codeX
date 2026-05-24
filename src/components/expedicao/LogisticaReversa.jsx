import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

/**
 * Logistica Reversa Automatizada
 * Processa devolucoes e recusas com automacao completa.
 */
export default function LogisticaReversa({ entrega, onConcluido }) {
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [motivo, setMotivo] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [acao, setAcao] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const effectiveEmpresaId = entrega?.empresa_id || empresaAtual?.id || null;
  const effectiveGroupId = entrega?.group_id || entrega?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(entrega?.id && (effectiveEmpresaId || effectiveGroupId));
  const canProcess = hasPermission("Expedicao", "Logistica Reversa", "editar")
    || hasPermission("Expedicao", "Entregas", "editar")
    || hasPermission("Expedicao", "Painel Logistico", "editar");

  const auditReversa = async ({ acao: acaoAudit, sucesso = true, motivo: motivoAudit = null, detalhes: detalhesAudit = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao: acaoAudit,
        modulo: "Expedicao",
        entidade: "Entrega",
        registro_id: entrega?.id || null,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo: motivoAudit,
        detalhes: detalhesAudit,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar logistica reversa", error);
    }
  };

  const processarDevolucaoMutation = useMutation({
    mutationFn: async () => {
      const motivoLimpo = sanitizeText(motivo);
      const detalhesLimpos = sanitizeText(detalhes);

      if (!contextoValido || !canProcess) {
        await auditReversa({ acao: "Entrega.logisticaReversa.processar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto e permissao sao obrigatorios para processar logistica reversa.");
      }
      if (!motivoLimpo || !acao) throw new Error("Motivo e acao sao obrigatorios.");

      const confirmado = window.confirm("Confirma processar a logística reversa desta entrega? Esta ação altera entrega, financeiro e estoque quando aplicável.");
      if (!confirmado) {
        await auditReversa({ acao: "Entrega.logisticaReversa.processar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
        throw new Error("Processamento cancelado pelo usuario.");
      }

      await updateInContext("Entrega", entrega.id, {
        status: "Devolvido",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        entrega_frustrada: {
          motivo: motivoLimpo,
          detalhes: detalhesLimpos,
          tentativa_numero: 1,
          reagendamento: null
        },
        historico_status: [
          ...(entrega.historico_status || []),
          {
            status: "Devolvido",
            data_hora: new Date().toISOString(),
            usuario: user?.full_name || user?.email || "Sistema",
            observacao: `Logistica reversa processada. Motivo: ${motivoLimpo}. Acao: ${acao}`
          }
        ]
      });

      let ped = null;
      if (entrega.pedido_id) {
        const pedido = await filterInContext("Pedido", { id: entrega.pedido_id }, undefined, 1);
        ped = pedido[0] || null;
        if (ped?.contas_receber_ids?.length > 0) {
          for (const contaId of ped.contas_receber_ids) {
            await updateInContext("ContaReceber", contaId, {
              status: "Cancelado",
              group_id: effectiveGroupId,
              grupo_id: effectiveGroupId,
              empresa_id: effectiveEmpresaId,
              observacoes: `Cancelado automaticamente - Devolução total. Motivo: ${motivoLimpo}`
            });
          }
        }
      }

      if (acao === "devolver_estoque" && entrega.pedido_id) {
        const pedidoRef = ped || (await filterInContext("Pedido", { id: entrega.pedido_id }, undefined, 1))[0];
        if (pedidoRef) {
          for (const item of (pedidoRef.itens_revenda || [])) {
            await createInContext("MovimentacaoEstoque", {
              empresa_id: effectiveEmpresaId,
              group_id: effectiveGroupId,
              grupo_id: effectiveGroupId,
              origem_movimento: "devolucao",
              origem_documento_id: entrega.id,
              tipo_movimento: "entrada",
              produto_id: item.produto_id,
              produto_descricao: item.descricao,
              quantidade: item.quantidade,
              unidade_medida: item.unidade,
              data_movimentacao: new Date().toISOString(),
              documento: entrega.numero_pedido,
              motivo: `Devolução - ${motivoLimpo}`,
              responsavel: user?.full_name || user?.email || "Sistema Automático"
            });
          }
        }
      }

      const destinatario = ped?.vendedor_id || null;
      await createInContext("Notificacao", {
        destinatario_id: destinatario,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        tipo: "urgente",
        categoria: "Comercial",
        titulo: `Devolução Total - Pedido ${entrega.numero_pedido}`,
        mensagem: `Cliente ${entrega.cliente_nome} recusou a entrega. Motivo: ${motivoLimpo}. Ação tomada: ${acao}.`,
        link_acao: `/expedicao?ver=entrega&id=${entrega.id}`
      });

      await auditReversa({ acao: "Entrega.logisticaReversa.processar", detalhes: { motivo: motivoLimpo, acao, pedido_id: entrega.pedido_id || null } });
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      queryClient.invalidateQueries({ queryKey: ["painel-logistico-entregas"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacao-estoque"] });
      toast({ title: "Devolução processada com sucesso!" });
      onConcluido?.();
    },
    onError: (error) => {
      auditReversa({ acao: "Entrega.logisticaReversa.processar.erro", sucesso: false, motivo: error?.message || "erro_processar" });
      toast({ title: "Erro ao processar devolução", description: error?.message || "Tente novamente", variant: "destructive" });
    }
  });

  return (
    <Card className="border-orange-300 bg-orange-50" data-permission="Expedicao.LogisticaReversa.visualizar" data-context-required="true">
      <CardHeader className="border-b bg-white">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-orange-600" />
          Processar Logística Reversa
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label>Motivo da Recusa</Label>
          <Select value={motivo} onValueChange={setMotivo} disabled={!contextoValido || !canProcess || processarDevolucaoMutation.isPending}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Recusa de Recebimento">Recusa de Recebimento</SelectItem>
              <SelectItem value="Produto Danificado">Produto Danificado</SelectItem>
              <SelectItem value="Pedido Incorreto">Pedido Incorreto</SelectItem>
              <SelectItem value="Cliente Cancelou">Cliente Cancelou</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Detalhes</Label>
          <Textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)} placeholder="Descreva o que aconteceu..." rows={3} className="mt-1" disabled={!contextoValido || !canProcess || processarDevolucaoMutation.isPending} />
        </div>

        <div>
          <Label>Ação a Tomar</Label>
          <Select value={acao} onValueChange={setAcao} disabled={!contextoValido || !canProcess || processarDevolucaoMutation.isPending}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a ação..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="devolver_estoque">Devolver ao Estoque</SelectItem>
              <SelectItem value="descartar">Descartar (Refugo)</SelectItem>
              <SelectItem value="reagendar">Reagendar Entrega</SelectItem>
              <SelectItem value="manual">Processar Manualmente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="p-4 bg-white rounded-lg border border-orange-200">
          <h4 className="font-semibold text-sm text-orange-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Ações Automáticas
          </h4>
          <ul className="text-xs text-orange-800 space-y-1">
            <li>Entrega marcada como "Devolvido"</li>
            <li>Títulos financeiros serão bloqueados</li>
            {acao === "devolver_estoque" && <li>Produtos retornarão ao estoque</li>}
            <li>Vendedor será notificado automaticamente</li>
            <li>Histórico será registrado na entrega</li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onConcluido} disabled={processarDevolucaoMutation.isPending}>Cancelar</Button>
          <Button onClick={() => processarDevolucaoMutation.mutate()} disabled={!motivo || !acao || processarDevolucaoMutation.isPending || !contextoValido || !canProcess} className="bg-orange-600 hover:bg-orange-700" data-action="Entrega.logisticaReversa.processar" data-permission="Expedicao.LogisticaReversa.editar" data-context-required="true" data-sensitive="true">
            {processarDevolucaoMutation.isPending ? "Processando..." : "Processar Devolução"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
