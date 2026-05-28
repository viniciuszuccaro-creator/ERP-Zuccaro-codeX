import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { MessageCircle, Send, CheckCircle, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { mockEnviarWhatsApp, avisoModoSimulacao } from "@/components/integracoes/MockIntegracoes";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

/**
 * Componente para envio de WhatsApp automatico nas entregas.
 * Mantem modo simulacao ate a integracao oficial estar ativa.
 */
export default function EnvioMensagemAutomatica({ entrega, tipo = "saida_entrega" }) {
  const [enviando, setEnviando] = React.useState(false);
  const [mensagemCustom, setMensagemCustom] = React.useState("");
  const [enviado, setEnviado] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateInContext, createInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { user } = useUser();
  const { hasPermission } = usePermissions();

  const effectiveEmpresaId = entrega?.empresa_id || empresaAtual?.id || null;
  const effectiveGroupId = entrega?.group_id || entrega?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(entrega?.id && (effectiveEmpresaId || effectiveGroupId));
  const canSend = hasPermission("Expedicao", "Comunicacao", "criar")
    || hasPermission("Expedicao", "Entregas", "editar")
    || hasPermission("Expedicao", "Painel Logistico", "editar");

  const templates = React.useMemo(() => ({
    saida_entrega: `Olá! Seu pedido saiu para entrega.\n\nPedido: ${entrega?.numero_pedido || "-"}\nPrevisão: Hoje\nRastreio: ${entrega?.qr_code || entrega?.codigo_rastreamento || "-"}\n\nQualquer dúvida, estamos à disposição!`,
    confirmacao_pedido: `Pedido confirmado!\n\nNúmero: ${entrega?.numero_pedido || "-"}\nPrevisão de entrega: ${entrega?.data_previsao ? new Date(entrega.data_previsao).toLocaleDateString("pt-BR") : "A definir"}\n\nObrigado pela preferência!`,
    entrega_realizada: `Entrega concluída!\n\nPedido: ${entrega?.numero_pedido || "-"}\nEntregue em: ${new Date().toLocaleString("pt-BR")}\n\nObrigado pela confiança!`
  }), [entrega]);

  const auditEnvio = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
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
        motivo,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar envio de WhatsApp", error);
    }
  };

  const enviarMensagemMutation = useMutation({
    mutationFn: async (mensagemOriginal) => {
      const mensagem = sanitizeText(mensagemOriginal);
      const telefone = entrega?.contato_entrega?.whatsapp || entrega?.contato_entrega?.telefone;

      if (!contextoValido || !canSend) {
        await auditEnvio({ acao: "Entrega.whatsapp.enviar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto e permissao sao obrigatorios para enviar WhatsApp.");
      }
      if (!telefone) throw new Error("Cliente não possui WhatsApp cadastrado.");
      if (!mensagem) throw new Error("Mensagem obrigatória.");

      const confirmado = window.confirm("Confirma registrar o envio desta mensagem de WhatsApp para a entrega?");
      if (!confirmado) {
        await auditEnvio({ acao: "Entrega.whatsapp.enviar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
        throw new Error("Envio cancelado pelo usuario.");
      }

      const resultado = await mockEnviarWhatsApp({ telefone, mensagem, anexos: [] });
      const notificacoesAtuais = Array.isArray(entrega?.notificacoes_enviadas) ? entrega.notificacoes_enviadas : [];
      const tipoNotificacao = tipo === "saida_entrega" ? "Saída" : tipo === "entrega_realizada" ? "Entregue" : "Confirmação";

      await updateInContext("Entrega", entrega.id, {
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        notificacoes_enviadas: [
          ...notificacoesAtuais,
          {
            tipo: tipoNotificacao,
            canal: "WhatsApp",
            destinatario: telefone,
            data_envio: new Date().toISOString(),
            status_envio: "Enviado",
            mensagem,
            message_id: resultado.message_id,
            __simulado__: true
          }
        ]
      });

      await createInContext("HistoricoCliente", {
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        cliente_id: entrega.cliente_id,
        cliente_nome: entrega.cliente_nome,
        modulo_origem: "Expedicao",
        referencia_id: entrega.id,
        referencia_tipo: "Entrega",
        referencia_numero: entrega.numero_pedido,
        tipo_evento: "Comunicacao",
        titulo_evento: "WhatsApp Enviado (Simulação)",
        descricao_detalhada: mensagem,
        usuario_responsavel: user?.full_name || user?.email || "Sistema",
        data_evento: new Date().toISOString(),
        whatsapp_envio: true,
        whatsapp_mensagem: mensagem,
        whatsapp_status: "Enviado"
      });

      await auditEnvio({ acao: "Entrega.whatsapp.enviar", detalhes: { tipo, telefone, simulado: true } });
      return resultado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      queryClient.invalidateQueries({ queryKey: ["historico-cliente"] });
      setEnviado(true);
      toast({ title: "WhatsApp enviado (simulação)", description: "Mensagem registrada no histórico." });
    },
    onError: (error) => {
      auditEnvio({ acao: "Entrega.whatsapp.enviar.erro", sucesso: false, motivo: error?.message || "erro_envio" });
      toast({ title: "Erro ao enviar WhatsApp", description: error?.message || "Tente novamente", variant: "destructive" });
    }
  });

  const handleEnviar = async (template) => {
    const mensagem = sanitizeText(template || mensagemCustom);
    if (!mensagem) {
      toast({ title: "Digite uma mensagem", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      await enviarMensagemMutation.mutateAsync(mensagem);
    } finally {
      setEnviando(false);
    }
  };

  const aviso = avisoModoSimulacao();
  const disabled = enviando || enviarMensagemMutation.isPending || !contextoValido || !canSend;

  return (
    <Card data-permission="Expedicao.Comunicacao.criar" data-context-required="true">
      <CardHeader className="bg-green-50 border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="w-5 h-5 text-green-600" />
          Notificação WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {(!contextoValido || !canSend) && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {!contextoValido ? "Selecione grupo/empresa e entrega para enviar WhatsApp." : "Seu perfil nao tem permissao para enviar WhatsApp."}
          </div>
        )}
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs"><strong>{aviso.titulo}</strong> - {aviso.mensagem}</AlertDescription>
        </Alert>

        {enviado ? (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <div className="flex items-center gap-2 text-green-900 font-semibold mb-2"><CheckCircle className="w-5 h-5" />Mensagem enviada (simulação)</div>
            <p className="text-sm text-green-700">Para: {entrega?.contato_entrega?.whatsapp || entrega?.contato_entrega?.telefone}</p>
            <p className="text-xs text-green-600 mt-1">Registrado no histórico do cliente</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-slate-700 mb-2"><strong>Destinatário:</strong> {entrega?.contato_entrega?.nome || entrega?.cliente_nome}</p>
              <p className="text-sm text-slate-700"><strong>WhatsApp:</strong> {entrega?.contato_entrega?.whatsapp || entrega?.contato_entrega?.telefone || "Não cadastrado"}</p>
            </div>

            <div>
              <Label>Templates prontos</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => handleEnviar(templates.confirmacao_pedido)} disabled={disabled} data-action="Entrega.whatsapp.confirmacao" data-permission="Expedicao.Comunicacao.criar" data-context-required="true" data-sensitive="true">Confirmação</Button>
                <Button size="sm" variant="outline" onClick={() => handleEnviar(templates.saida_entrega)} disabled={disabled} data-action="Entrega.whatsapp.saida" data-permission="Expedicao.Comunicacao.criar" data-context-required="true" data-sensitive="true">Saída</Button>
                <Button size="sm" variant="outline" onClick={() => handleEnviar(templates.entrega_realizada)} disabled={disabled} data-action="Entrega.whatsapp.entregue" data-permission="Expedicao.Comunicacao.criar" data-context-required="true" data-sensitive="true">Entregue</Button>
              </div>
            </div>

            <div>
              <Label>Ou escreva uma mensagem personalizada:</Label>
              <Textarea value={mensagemCustom} onChange={(e) => setMensagemCustom(e.target.value)} placeholder="Digite sua mensagem..." rows={4} className="mt-2" disabled={disabled} />
            </div>

            <Button onClick={() => handleEnviar(null)} disabled={disabled || !sanitizeText(mensagemCustom)} className="w-full bg-green-600 hover:bg-green-700" data-action="Entrega.whatsapp.enviar" data-permission="Expedicao.Comunicacao.criar" data-context-required="true" data-sensitive="true">
              {enviando ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Enviando...</>) : (<><Send className="w-4 h-4 mr-2" />Enviar mensagem (simulação)</>)}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
