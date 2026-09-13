import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Loader2 } from 'lucide-react';

export default function ChatbotPortal({ cliente }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Posso abrir chamados e consultar o status dos seus pedidos. Como posso ajudar?' }
  ]);

  const chatMut = useMutation({
    mutationFn: async (text) => {
      // Chama LLM para extrair intenção e parâmetros mínimos
      const schema = {
        type: 'object',
        properties: {
          intent: { type: 'string', enum: ['open_ticket', 'query_order_status', 'smalltalk'] },
          data: {
            type: 'object',
            additionalProperties: true,
            properties: {
              titulo: { type: 'string' },
              descricao: { type: 'string' },
              numero_pedido: { type: 'string' }
            }
          },
          reply: { type: 'string' }
        },
        required: ['intent']
      };

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um atendente do Portal do Cliente. Extraia a intenção do usuário entre: open_ticket (abrir chamado), query_order_status (consultar status de pedido) ou smalltalk. Sempre produza JSON válido conforme o schema. Texto do usuário: "${text}"` ,
        response_json_schema: schema
      });

      return llm;
    },
    onSuccess: async (llm) => {
      const res = llm; // já é objeto por response_json_schema
      const intent = res.intent;
      const data = res.data || {};

      if (intent === 'open_ticket') {
        const titulo = (data.titulo || input || 'Chamado via Chatbot').slice(0, 80);
        const descricao = data.descricao || input;
        const ch = await base44.entities.Chamado.create({
          titulo,
          descricao,
          cliente_id: cliente.id,
          cliente_nome: cliente.nome || cliente.nome_fantasia,
          origem: 'Portal/Chatbot',
          status: 'Aberto'
        });
        try {
          await base44.entities.AuditLog.create({ acao: 'Criação', modulo: 'CRM', tipo_auditoria: 'entidade', entidade: 'Chamado', registro_id: ch.id, descricao: 'Chamado criado via Chatbot no Portal', data_hora: new Date().toISOString() });
        } catch (auditError) {
          console.error('[ChatbotPortal] Falha ao auditar criacao do chamado', auditError);
        }
        setMessages((m) => [...m, { role: 'assistant', content: `Chamado aberto com sucesso (#${ch.id}). Em breve nossa equipe entrará em contato.` }]);
      } else if (intent === 'query_order_status') {
        const numero = String(data.numero_pedido || '').trim();
        if (!numero) {
          setMessages((m) => [...m, { role: 'assistant', content: 'Qual o número do pedido que deseja consultar?' }]);
          return;
        }
        const pedidos = await base44.entities.Pedido.filter({ numero_pedido: numero, cliente_id: cliente.id }, '-updated_date', 1);
        const p = pedidos?.[0];
        if (!p) {
          setMessages((m) => [...m, { role: 'assistant', content: `Não encontrei o Pedido #${numero} vinculado a este cliente.` }]);
          return;
        }
        const entregas = await base44.entities.Entrega.filter({ pedido_id: p.id }, '-updated_date', 1);
        const e = entregas?.[0];
        let msg = `Pedido #${p.numero_pedido || p.id} está em "${p.status}" e valor total R$ ${Number(p.valor_total||0).toFixed(2)}.`;
        if (e) {
          msg += ` Entrega: ${e.status}${e.data_previsao ? ` (previsão ${e.data_previsao})` : ''}.`;
          if (e.link_publico_rastreamento) msg += ' Link de rastreio disponível na aba Entregas.';
        }
        setMessages((m) => [...m, { role: 'assistant', content: msg }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: res.reply || 'Certo! Me diga se quer abrir um chamado ou consultar um pedido.' }]);
      }
    }
  });

  const onSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    chatMut.mutate(text);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="w-4 h-4" /> Assistente do Portal — abra chamados e consulte pedidos.
        </div>
        <div className="h-48 overflow-auto rounded-md border p-2 bg-background text-sm">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <span className={m.role === 'user' ? 'inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md my-1' : 'inline-block bg-secondary text-secondary-foreground px-2 py-1 rounded-md my-1'}>
                {m.content}
              </span>
            </div>
          ))}
          {chatMut.isPending && (
            <div className="text-left text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Pensando...</div>
          )}
        </div>
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua pergunta..." onKeyDown={(e) => e.key==='Enter' ? onSend() : null} />
          <Button onClick={onSend} className="gap-2"><Send className="w-4 h-4" /> Enviar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
