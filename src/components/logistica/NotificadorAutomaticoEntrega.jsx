import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Send, MessageCircle, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").replace(/javascript:/gi, "").trim();

/**
 * Notificador automatico de entregas.
 * Envia notificacoes ao cliente sobre status de entrega.
 */
export default function NotificadorAutomaticoEntrega({ pedido, entrega, onClose, windowMode = false }) {
  const [canal, setCanal] = useState("WhatsApp");
  const [mensagemCustom, setMensagemCustom] = useState("");
  const queryClient = useQueryClient();
  const { updateInContext, createInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();

  const effectiveEmpresaId = entrega?.empresa_id || pedido?.empresa_id || empresaAtual?.id || null;
  const effectiveGroupId = entrega?.group_id || entrega?.grupo_id || pedido?.group_id || pedido?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(pedido?.id && (effectiveGroupId || effectiveEmpresaId));
  const canNotify = hasPermission("Expedicao", "Comunicacao", "criar") || hasPermission("Expedicao", "Entregas", "editar") || hasPermission("Comercial", "Pedido", "editar");

  const mensagensPadrao = {
    "Pronto para Retirada": `Ola ${sanitizeText(pedido?.cliente_nome)}!\n\nSeu pedido #${sanitizeText(pedido?.numero_pedido)} esta pronto para retirada.\n\nEndereco: [Sua loja]\nHorario: Segunda a sexta, 8h as 18h.\n\nAguardamos voce.`,
    "Em Expedicao": `Ola ${sanitizeText(pedido?.cliente_nome)}!\n\nSeu pedido #${sanitizeText(pedido?.numero_pedido)} esta sendo separado para entrega.\n\nPrevisao de entrega: ${pedido?.data_prevista_entrega ? new Date(pedido.data_prevista_entrega).toLocaleDateString("pt-BR") : "em breve"}.`,
    "Em Expedição": `Ola ${sanitizeText(pedido?.cliente_nome)}!\n\nSeu pedido #${sanitizeText(pedido?.numero_pedido)} esta sendo separado para entrega.\n\nPrevisao de entrega: ${pedido?.data_prevista_entrega ? new Date(pedido.data_prevista_entrega).toLocaleDateString("pt-BR") : "em breve"}.`,
    "Saiu para Entrega": `Ola ${sanitizeText(pedido?.cliente_nome)}!\n\nSeu pedido #${sanitizeText(pedido?.numero_pedido)} saiu para entrega.\n\nEndereco: ${sanitizeText(pedido?.endereco_entrega_principal?.logradouro)}, ${sanitizeText(pedido?.endereco_entrega_principal?.numero)}\nPrevisao: hoje.`,
    "Em Transito": `Ola ${sanitizeText(pedido?.cliente_nome)}!\n\nSeu pedido #${sanitizeText(pedido?.numero_pedido)} esta em transito para entrega.`,
    "Em Trânsito": `Ola ${sanitizeText(pedido?.cliente_nome)}!\n\nSeu pedido #${sanitizeText(pedido?.numero_pedido)} esta em transito para entrega.`,
    "Entregue": `Ola ${sanitizeText(pedido?.cliente_nome)}!\n\nSeu pedido #${sanitizeText(pedido?.numero_pedido)} foi entregue com sucesso.\n\nObrigado pela preferencia.`
  };

  const mensagemFinal = sanitizeText(mensagemCustom) || mensagensPadrao[pedido?.status] || `Atualizacao do pedido #${sanitizeText(pedido?.numero_pedido)}: status alterado para ${sanitizeText(pedido?.status)}`;

  const auditarNotificacao = async ({ acao, sucesso = true, motivo = null, detalhes = {}, dadosNovos = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Expedicao",
        entidade: "NotificacaoEntrega",
        registro_id: entrega?.id || pedido?.id,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        empresa_id: effectiveEmpresaId,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        sucesso,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar notificacao de entrega", error);
    }
  };

  const enviarNotificacaoMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canNotify) {
        await auditarNotificacao({ acao: "NotificadorEntrega.enviar_bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { canal } });
        throw new Error("Contexto e permissao sao obrigatorios para enviar notificacao.");
      }
      if (!window.confirm(`Confirma registrar e enviar notificacao via ${canal}?`)) {
        await auditarNotificacao({ acao: "NotificadorEntrega.enviar_cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { canal } });
        throw new Error("Envio cancelado pelo usuario.");
      }

      const registroNotificacao = {
        tipo: sanitizeText(pedido?.status),
        canal,
        destinatario: sanitizeText(pedido?.cliente_nome),
        data_envio: new Date().toISOString(),
        status_envio: "Enviado",
        mensagem: mensagemFinal,
        usuario_id: user?.id,
        usuario_nome: user?.full_name || user?.email || "Sistema"
      };

      if (entrega?.id) {
        await updateInContext("Entrega", entrega.id, {
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: effectiveEmpresaId,
          notificacoes_enviadas: [...(entrega.notificacoes_enviadas || []), registroNotificacao]
        });
      } else {
        await createInContext("HistoricoCliente", {
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: effectiveEmpresaId,
          cliente_id: pedido?.cliente_id,
          cliente_nome: pedido?.cliente_nome,
          modulo_origem: "Expedicao",
          referencia_id: pedido?.id,
          referencia_tipo: "Pedido",
          tipo_evento: "Notificacao",
          titulo_evento: `Notificacao de entrega via ${canal}`,
          descricao_detalhada: mensagemFinal,
          usuario_responsavel: user?.full_name || user?.email || "Sistema",
          data_evento: new Date().toISOString(),
          status_relacionado: pedido?.status
        });
      }

      if (canal === "E-mail" && pedido?.cliente_email) {
        await base44.integrations.Core.SendEmail({
          to: sanitizeText(pedido.cliente_email),
          subject: `Atualizacao do Pedido #${pedido.numero_pedido}`,
          body: mensagemFinal
        });
      }

      await auditarNotificacao({ acao: "NotificadorEntrega.enviar", detalhes: { canal, pedido_id: pedido?.id, entrega_id: entrega?.id }, dadosNovos: registroNotificacao });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-comercial"] });
      toast.success(`Notificacao enviada via ${canal}.`);
      onClose?.();
    },
    onError: (error) => {
      if (error?.message !== "Envio cancelado pelo usuario.") toast.error(error?.message || "Erro ao enviar notificacao.");
    }
  });

  const contatosCliente = pedido?.contatos_cliente || [];
  const whatsappPrincipal = contatosCliente.find(c => c.tipo === "WhatsApp" && c.principal)?.valor;
  const emailPrincipal = pedido?.cliente_email;
  const containerClass = windowMode ? "w-full h-full flex flex-col" : "";

  if (!contextoValido || !canNotify) {
    return (
      <Card className={`border-yellow-200 bg-yellow-50 ${containerClass}`} data-permission="Expedicao.Comunicacao.criar" data-context-required="true">
        <CardContent className="p-4 text-sm text-yellow-800">
          Selecione contexto grupo/empresa e confirme permissao para notificar cliente.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-0 shadow-xl ${containerClass}`} data-permission="Expedicao.Comunicacao.criar" data-context-required="true">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />Notificar Cliente</CardTitle>
        <p className="text-sm opacity-90">Pedido #{pedido?.numero_pedido} - {pedido?.cliente_nome}</p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label>Canal de Comunicacao</Label>
          <Select value={canal} onValueChange={setCanal}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WhatsApp"><div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-600" />WhatsApp{whatsappPrincipal && <Badge variant="outline" className="ml-2 text-xs">{whatsappPrincipal}</Badge>}</div></SelectItem>
              <SelectItem value="E-mail"><div className="flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" />E-mail{emailPrincipal && <Badge variant="outline" className="ml-2 text-xs">{emailPrincipal}</Badge>}</div></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Mensagem (personalize ou use a padrao)</Label>
          <Textarea value={mensagemCustom} onChange={(e) => setMensagemCustom(sanitizeText(e.target.value))} placeholder={mensagemFinal} rows={8} className="font-mono text-sm" />
          <p className="text-xs text-slate-500 mt-1">Deixe em branco para usar a mensagem padrao automatica.</p>
        </div>

        <Card className="bg-slate-50 border-slate-200"><CardContent className="p-4"><p className="text-xs text-slate-600 mb-2 font-semibold">Preview:</p><p className="text-sm whitespace-pre-wrap">{mensagemFinal}</p></CardContent></Card>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => enviarNotificacaoMutation.mutate()} disabled={enviarNotificacaoMutation.isPending} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" data-action="NotificadorEntrega.enviar" data-permission="Expedicao.Comunicacao.criar" data-context-required="true" data-sensitive="true">
            <Send className="w-4 h-4 mr-2" />{enviarNotificacaoMutation.isPending ? "Enviando..." : `Enviar via ${canal}`}
          </Button>
        </div>

        {entrega?.notificacoes_enviadas?.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-semibold mb-2">Historico de Notificacoes</p>
            <div className="space-y-2">
              {entrega.notificacoes_enviadas.slice(-3).reverse().map((notif, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded"><Check className="w-4 h-4 text-green-600" /><span className="font-medium">{notif.tipo}</span><Badge variant="outline">{notif.canal}</Badge><span className="text-xs text-slate-500">{new Date(notif.data_envio).toLocaleString("pt-BR")}</span></div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
