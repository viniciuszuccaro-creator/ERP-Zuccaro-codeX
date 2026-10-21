import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock, User, MessageCircle, Send } from 'lucide-react';
import { toast } from "sonner";
import { format } from "date-fns";

export default function ChatCliente({ clienteId, clienteNome }) {
  const [mensagem, setMensagem] = useState("");
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: chamados = [] } = useQuery({
    queryKey: ['chamados', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const todosChamados = await base44.entities.Chamado.list('-created_date');
      return todosChamados.filter(c => c.cliente_id === clienteId);
    },
    enabled: !!clienteId
  });

  useEffect(() => {
    if (chamados.length > 0) {
      const chamadoAberto = chamados.find(c => c.status === 'Aberto' || c.status === 'Em Andamento');
      setConversaAtiva(chamadoAberto || chamados[0]);
    }
  }, [chamados]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversaAtiva?.mensagens]);

  const enviarMensagemMutation = useMutation({
    mutationFn: async (/** @type {string} */ novaMensagem) => {
      const mensagens = conversaAtiva?.mensagens || [];
      const novaMsg = {
        autor: clienteNome,
        mensagem: novaMensagem,
        data: new Date().toISOString(),
        tipo: "Cliente"
      };

      if (conversaAtiva) {
        return base44.entities.Chamado.update(conversaAtiva.id, {
          mensagens: [...mensagens, novaMsg],
          status: conversaAtiva.status === 'Aguardando Cliente' ? 'Em Andamento' : conversaAtiva.status
        });
      } else {
        return base44.entities.Chamado.create({
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          titulo: "Chat - " + new Date().toLocaleDateString('pt-BR'),
          descricao: novaMensagem,
          categoria: "Suporte Técnico",
          prioridade: "Média",
          status: "Aberto",
          data_abertura: new Date().toISOString().split('T')[0],
          mensagens: [novaMsg]
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chamados', clienteId] });
      setConversaAtiva(data);
      setMensagem("");
    },
  });

  const handleEnviar = (e) => {
    e.preventDefault();
    if (mensagem.trim()) {
      enviarMensagemMutation.mutate(mensagem);
    }
  };

  return (
    <Card className="border-0 shadow-md h-[600px] flex flex-col">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          Chat com Suporte
          {conversaAtiva && (
            <Badge className={
              conversaAtiva.status === 'Aberto' ? 'bg-green-100 text-green-700' :
              conversaAtiva.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' :
              conversaAtiva.status === 'Aguardando Cliente' ? 'bg-yellow-100 text-yellow-700' :
              'bg-slate-100 text-slate-700'
            }>
              {conversaAtiva.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {!conversaAtiva || (conversaAtiva.mensagens || []).length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">Nenhuma conversa iniciada</p>
            <p className="text-sm mt-2">Envie uma mensagem para iniciar o atendimento</p>
          </div>
        ) : (
          <>
            {(conversaAtiva.mensagens || []).map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.tipo === 'Cliente' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.tipo === 'Atendente' && (
                  <Avatar className="w-8 h-8 bg-slate-100 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  </Avatar>
                )}
                <div className={`max-w-[85%] ${msg.tipo === 'Cliente' && 'flex flex-col items-end'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 ${
                    msg.tipo === 'Cliente'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white border border-slate-200'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.mensagem}</p>
                    <div className={`flex items-center gap-1 mt-1 text-xs ${
                      msg.tipo === 'Cliente' ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {format(new Date(msg.data), 'HH:mm')}
                    </div>
                  </div>
                </div>
                {msg.tipo === 'Cliente' && (
                  <Avatar className="w-8 h-8 bg-blue-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

      <div className="p-4 border-t bg-slate-50">
        <form onSubmit={handleEnviar} className="flex gap-3">
          <Input
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={enviarMensagemMutation.isPending}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!mensagem.trim() || enviarMensagemMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {enviarMensagemMutation.isPending ? (
              'Enviando...'
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </form>
        <p className="text-xs text-slate-500 mt-2 text-center">
          Tempo médio de resposta: 15 minutos
        </p>
      </div>
    </Card>
  );
}
