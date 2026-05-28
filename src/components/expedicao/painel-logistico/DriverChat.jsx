import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send } from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

export default function DriverChat({ entrega, onUpdated }) {
  const { user } = useUser();
  const { updateInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [msg, setMsg] = useState("");
  const endRef = useRef(null);

  const effectiveEmpresaId = entrega?.empresa_id || empresaAtual?.id || null;
  const effectiveGroupId = entrega?.group_id || entrega?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(entrega?.id && (effectiveEmpresaId || effectiveGroupId));
  const canSend = hasPermission("Expedicao", "Comunicacao", "criar")
    || hasPermission("Expedicao", "Painel Logistico", "editar")
    || hasPermission("Expedicao", "Entregas", "editar");

  const auditChat = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
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
      console.warn("Falha ao auditar comunicacao da entrega", error);
    }
  };

  const mensagens = useMemo(() => {
    const arr = Array.isArray(entrega?.ocorrencias) ? entrega.ocorrencias : [];
    // Usa ocorrencias como trilha de comunicacao operacional com o motorista.
    return arr
      .filter((o) => o && (o.tipo === "Outros" || o.tipo === "Comunicacao" || o.tipo === "Mensagem"))
      .sort((a, b) => new Date(a.data_hora || 0) - new Date(b.data_hora || 0));
  }, [entrega?.ocorrencias]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length]);

  const enviarMutation = useMutation({
    mutationFn: async (textoOriginal) => {
      const texto = sanitizeText(textoOriginal);
      if (!contextoValido || !canSend) {
        await auditChat({ acao: "Entrega.comunicacao.enviar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto e permissao sao obrigatorios para enviar mensagem.");
      }
      if (!texto) throw new Error("Mensagem obrigatoria.");
      const confirmado = window.confirm("Confirma incluir esta mensagem na entrega selecionada?");
      if (!confirmado) {
        await auditChat({ acao: "Entrega.comunicacao.enviar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
        throw new Error("Envio cancelado pelo usuario.");
      }
      const nova = {
        tipo: "Comunicacao",
        descricao: texto,
        data_hora: new Date().toISOString(),
        responsavel: user?.full_name || user?.email || "Operador",
      };
      const ocorrencias = Array.isArray(entrega?.ocorrencias) ? [...entrega.ocorrencias, nova] : [nova];
      const res = await updateInContext("Entrega", entrega.id, {
        ocorrencias,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId
      });
      await auditChat({ acao: "Entrega.comunicacao.enviar", detalhes: { tamanho: texto.length } });
      return res;
    },
    onSuccess: (res) => {
      setMsg("");
      onUpdated?.(res);
    },
    onError: (error) => auditChat({ acao: "Entrega.comunicacao.enviar.erro", sucesso: false, motivo: error?.message || "erro_envio" })
  });

  const handleSend = (e) => {
    e?.preventDefault?.();
    const texto = sanitizeText(msg);
    if (!texto) return;
    enviarMutation.mutate(texto);
  };

  return (
    <Card className="h-full flex flex-col" data-permission="Expedicao.Comunicacao.visualizar" data-context-required="true">
      <CardHeader className="py-2 border-b bg-slate-50">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-600"/> Comunicacao com Motorista
          {entrega?.motorista && (
            <Badge variant="outline" className="ml-auto text-xs">{entrega.motorista}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-2 p-3">
        {(!contextoValido || !canSend) && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            {!contextoValido ? "Selecione grupo/empresa para enviar mensagens." : "Seu perfil nao tem permissao para enviar mensagens."}
          </div>
        )}
        {mensagens.length === 0 && (
          <div className="text-xs text-slate-500">Sem mensagens ainda. Envie uma atualizacao para o motorista.</div>
        )}
        {mensagens.map((m, idx) => {
          const isOperador = (m?.responsavel || "").toLowerCase() !== (entrega?.motorista || "").toLowerCase();
          return (
            <div key={idx} className={`flex ${isOperador ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isOperador ? "bg-blue-600 text-white" : "bg-white border"}`}>
                <div>{m.descricao}</div>
                <div className={`mt-1 text-[10px] ${isOperador ? "text-blue-100" : "text-slate-500"}`}>
                  {m.responsavel || (isOperador ? "Operador" : "Motorista")} - {new Date(m.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </CardContent>
      <form onSubmit={handleSend} className="border-t p-2 flex gap-2" data-permission="Expedicao.Comunicacao.criar" data-context-required="true">
        <Input value={msg} onChange={(e)=>setMsg(e.target.value)} placeholder="Escreva uma mensagem..." className="flex-1" disabled={enviarMutation.isPending || !contextoValido || !canSend} />
        <Button type="submit" disabled={!sanitizeText(msg) || enviarMutation.isPending || !contextoValido || !canSend} className="bg-blue-600 hover:bg-blue-700" data-action="Entrega.comunicacao.enviar" data-permission="Expedicao.Comunicacao.criar" data-context-required="true" data-sensitive="true">
          <Send className="w-4 h-4"/>
        </Button>
      </form>
    </Card>
  );
}
