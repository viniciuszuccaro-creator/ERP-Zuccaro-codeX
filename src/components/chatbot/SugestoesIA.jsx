import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Lightbulb, 
  Sparkles, 
  Copy,
  MessageSquare,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - SUGESTÕES INTELIGENTES DE IA
 * 
 * Gera sugestões contextuais para o atendente:
 * ✅ Respostas sugeridas baseadas no contexto
 * ✅ Próximas ações recomendadas
 * ✅ Alertas de risco
 * ✅ Oportunidades de venda
 */
export default function SugestoesIA({ conversa, mensagens = [] }) {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = conversa?.empresa_id || empresaAtual?.id;
  const groupId = conversa?.group_id || conversa?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canUseIA = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');

  const { data: sugestoes, isLoading, refetch } = useQuery({
    queryKey: ['sugestoes-ia', conversa?.id, mensagens.length, contextKey],
    queryFn: async () => {
      if (!conversa || mensagens.length < 1 || !contextoValido || !canUseIA) return null;

      // Pegar últimas mensagens para contexto
      const ultimasMensagens = mensagens.slice(-5);
      const ultimaMensagemCliente = ultimasMensagens
        .filter(m => m.tipo_remetente === 'Cliente')
        .pop();

      if (!ultimaMensagemCliente) return null;

      try {
        // Gerar sugestões usando IA
        const resultado = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é um assistente de atendimento ao cliente de um ERP industrial.

ÚLTIMA MENSAGEM DO CLIENTE:
"${ultimaMensagemCliente.mensagem}"

CONTEXTO DA CONVERSA:
- Canal: ${conversa.canal}
- Sentimento detectado: ${conversa.sentimento_geral || 'Neutro'}
- Intent principal: ${conversa.intent_principal || 'não identificado'}
- Status: ${conversa.status}

Gere 3 respostas curtas e profissionais que o atendente pode usar.
Também sugira 2 ações que o atendente deve considerar.`,
          response_json_schema: {
            type: "object",
            properties: {
              respostas_sugeridas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    texto: { type: "string" },
                    tom: { type: "string", enum: ["formal", "amigavel", "tecnico"] }
                  }
                }
              },
              acoes_recomendadas: {
                type: "array",
                items: { type: "string" }
              },
              alerta: {
                type: "object",
                properties: {
                  tem_alerta: { type: "boolean" },
                  mensagem: { type: "string" },
                  tipo: { type: "string", enum: ["info", "aviso", "urgente"] }
                }
              }
            }
          }
        });

        return resultado;
      } catch (err) {
        console.warn('Erro ao gerar sugestões IA:', err);
        // Retornar sugestões fallback
        return {
          respostas_sugeridas: [
            { texto: 'Olá! Como posso ajudar você hoje?', tom: 'amigavel' },
            { texto: 'Entendo sua solicitação. Vou verificar isso para você.', tom: 'formal' },
            { texto: 'Um momento, estou consultando as informações.', tom: 'formal' }
          ],
          acoes_recomendadas: [
            'Verificar histórico do cliente',
            'Consultar pedidos recentes'
          ],
          alerta: {
            tem_alerta: false,
            mensagem: '',
            tipo: 'info'
          }
        };
      }
    },
    enabled: !!conversa && mensagens.length >= 1 && contextoValido && canUseIA,
    staleTime: 30000,
    retry: 1
  });

  const copiarResposta = async (texto) => {
    await navigator.clipboard.writeText(texto);
    toast.success('Resposta copiada!');
  };

  if (!conversa) return null;

  if (isLoading) {
    return (
      <Card className="w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Gerando sugestões...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sugestoes) {
    return (
      <Card className="w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
        <CardContent className="p-4 text-center text-slate-400">
          <Lightbulb className="w-6 h-6 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Aguardando mensagem do cliente</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-yellow-900">
          <Lightbulb className="w-4 h-4 text-yellow-600" />
          Sugestões IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Alerta se houver */}
        {sugestoes.alerta?.tem_alerta && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-2 rounded-lg text-sm flex items-start gap-2 ${
              sugestoes.alerta.tipo === 'urgente' 
                ? 'bg-red-100 text-red-800 border border-red-300'
                : sugestoes.alerta.tipo === 'aviso'
                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{sugestoes.alerta.mensagem}</span>
          </motion.div>
        )}

        {/* Respostas Sugeridas */}
        {sugestoes.respostas_sugeridas?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Respostas Sugeridas
            </p>
            <div className="space-y-2">
              {sugestoes.respostas_sugeridas.map((resp, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group p-2 bg-white rounded-lg border hover:border-yellow-400 transition-colors cursor-pointer"
                  data-action="SugestoesIA.copiarResposta"
                  data-permission="CRM.Atendimento.visualizar"
                  data-context-required="group-or-company"
                  onClick={() => copiarResposta(resp.texto)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-700 flex-1">{resp.texto}</p>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                  <Badge variant="outline" className="text-xs mt-1 capitalize">
                    {resp.tom}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Ações Recomendadas */}
        {sugestoes.acoes_recomendadas?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Ações Recomendadas
            </p>
            <div className="space-y-1">
              {sugestoes.acoes_recomendadas.map((acao, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="text-yellow-600 font-bold">→</span>
                  <span>{acao}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botão Atualizar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="w-full text-xs"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Atualizar Sugestões
        </Button>
      </CardContent>
    </Card>
  );
}
