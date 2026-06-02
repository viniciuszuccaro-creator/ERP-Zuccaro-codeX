import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Target,
  ShoppingCart,
  DollarSign,
  Truck,
  MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - IA CONVERSACIONAL AVANÇADA
 * 
 * Motor de IA para:
 * ✅ Análise de sentimento em tempo real
 * ✅ Detecção de intenção com alta precisão
 * ✅ Recomendações de produtos contextuais
 * ✅ Previsão de necessidades do cliente
 * ✅ Geração de respostas inteligentes
 * ✅ Análise de risco de churn
 */
export default function IAConversacional({ conversa, mensagens = [], clienteId }) {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = conversa?.empresa_id || empresaAtual?.id;
  const groupId = conversa?.group_id || conversa?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canUseIA = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');

  // Buscar análise da IA
  const { data: analise, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ia-analise-conversa', conversa?.id, contextKey],
    queryFn: async () => {
      if (!conversa || mensagens.length < 2 || !contextoValido || !canUseIA) return null;

      const ultimasMensagens = mensagens.slice(-10).map(m => ({
        remetente: m.tipo_remetente,
        mensagem: m.mensagem,
        sentimento: m.sentimento
      }));

      try {
        const resultado = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é um analista de atendimento ao cliente de um ERP industrial.
          
Analise esta conversa e forneça insights acionáveis:

CONVERSA:
${ultimasMensagens.map(m => `[${m.remetente}]: ${m.mensagem}`).join('\n')}

CONTEXTO:
- Canal: ${conversa.canal}
- Status: ${conversa.status}
- Sentimento atual: ${conversa.sentimento_geral}
- Intent principal: ${conversa.intent_principal || 'não identificado'}

Forneça:
1. Resumo executivo (1 linha)
2. Sentimento predominante e intensidade
3. Principal necessidade do cliente
4. Próximas ações recomendadas para o atendente
5. Produtos/serviços que poderiam ser oferecidos
6. Risco de insatisfação (baixo/médio/alto)
7. Oportunidade de venda (sim/não e valor estimado)`,
          response_json_schema: {
            type: "object",
            properties: {
              resumo: { type: "string" },
              sentimento: { 
                type: "object",
                properties: {
                  tipo: { type: "string" },
                  intensidade: { type: "number" },
                  motivo: { type: "string" }
                }
              },
              necessidade_principal: { type: "string" },
              acoes_recomendadas: { 
                type: "array", 
                items: { type: "string" } 
              },
              produtos_sugeridos: { 
                type: "array", 
                items: { 
                  type: "object",
                  properties: {
                    produto: { type: "string" },
                    motivo: { type: "string" }
                  }
                } 
              },
              risco_insatisfacao: { type: "string" },
              oportunidade_venda: {
                type: "object",
                properties: {
                  existe: { type: "boolean" },
                  valor_estimado: { type: "number" },
                  tipo: { type: "string" }
                }
              },
              palavras_chave: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });

        return resultado;
      } catch (err) {
        console.warn('Erro na análise IA:', err);
        // Retornar análise fallback baseada em regras simples
        return {
          resumo: 'Análise automática baseada em regras (IA indisponível)',
          sentimento: {
            tipo: conversa.sentimento_geral || 'Neutro',
            intensidade: 0.5,
            motivo: 'Análise baseada em palavras-chave'
          },
          necessidade_principal: conversa.intent_principal || 'Atendimento geral',
          acoes_recomendadas: [
            'Verificar histórico do cliente',
            'Oferecer ajuda personalizada',
            'Encaminhar para especialista se necessário'
          ],
          produtos_sugeridos: [],
          risco_insatisfacao: 'médio',
          oportunidade_venda: { existe: false, valor_estimado: 0, tipo: '' },
          palavras_chave: conversa.tags || []
        };
      }
    },
    enabled: !!conversa && mensagens.length >= 2 && contextoValido && canUseIA,
    staleTime: 60000, // 1 minuto
    retry: 1 // Tentar apenas 1 vez em caso de erro
  });

  if (!conversa) return null;

  if (isLoading) {
    return (
      <Card className="w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
            <span className="text-sm text-slate-600">Analisando conversa com IA...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analise) {
    return (
      <Card className="w-full h-full" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
        <CardContent className="p-4 text-center text-slate-500">
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aguardando mais mensagens para análise</p>
        </CardContent>
      </Card>
    );
  }

  const corRisco = {
    'baixo': 'bg-green-100 text-green-700 border-green-300',
    'médio': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'alto': 'bg-red-100 text-red-700 border-red-300'
  };

  return (
    <Card className="w-full h-full border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50" data-permission="CRM.Atendimento.visualizar" data-context-required="group-or-company">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-900">
          <Brain className="w-5 h-5 text-purple-600" />
          Análise IA em Tempo Real
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-sm font-medium text-slate-900">{analise.resumo}</p>
        </div>

        {/* Sentimento */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-600" />
            <span className="text-sm text-slate-600">Sentimento:</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${
              analise.sentimento?.tipo === 'Positivo' ? 'bg-green-600' :
              analise.sentimento?.tipo === 'Negativo' ? 'bg-red-600' :
              'bg-slate-600'
            }`}>
              {analise.sentimento?.tipo || 'Neutro'}
            </Badge>
            <span className="text-xs text-slate-500">
              {Math.round((analise.sentimento?.intensidade || 0) * 100)}% intensidade
            </span>
          </div>
        </div>

        {/* Necessidade Principal */}
        <div className="p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">Necessidade Principal</span>
          </div>
          <p className="text-sm text-slate-700">{analise.necessidade_principal}</p>
        </div>

        {/* Risco e Oportunidade */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg border-2 ${corRisco[analise.risco_insatisfacao?.toLowerCase()] || corRisco.baixo}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-semibold">Risco</span>
            </div>
            <p className="text-sm font-bold capitalize">{analise.risco_insatisfacao}</p>
          </div>

          {analise.oportunidade_venda?.existe && (
            <div className="p-3 rounded-lg border-2 bg-green-100 text-green-700 border-green-300">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-semibold">Oportunidade</span>
              </div>
              <p className="text-sm font-bold">
                R$ {(analise.oportunidade_venda.valor_estimado || 0).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
        </div>

        {/* Ações Recomendadas */}
        {analise.acoes_recomendadas?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-slate-900">Ações Recomendadas</span>
            </div>
            <div className="space-y-2">
              {analise.acoes_recomendadas.map((acao, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-2 p-2 bg-white rounded border text-sm"
                >
                  <span className="text-blue-600 font-bold">{idx + 1}.</span>
                  <span className="text-slate-700">{acao}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Produtos Sugeridos */}
        {analise.produtos_sugeridos?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-slate-900">Produtos Sugeridos</span>
            </div>
            <div className="space-y-2">
              {analise.produtos_sugeridos.map((item, idx) => (
                <div key={idx} className="p-2 bg-white rounded border text-sm">
                  <p className="font-medium text-slate-900">{item.produto}</p>
                  <p className="text-xs text-slate-500">{item.motivo}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Palavras-chave */}
        {analise.palavras_chave?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {analise.palavras_chave.map((palavra, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {palavra}
              </Badge>
            ))}
          </div>
        )}

        {/* Botão Atualizar */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          className="w-full"
        >
          <Brain className="w-4 h-4 mr-2" />
          Reanalisar Conversa
        </Button>
      </CardContent>
    </Card>
  );
}
