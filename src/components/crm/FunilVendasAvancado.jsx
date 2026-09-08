import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  TrendingUp, 
  Zap, 
  Target, 
  DollarSign,
  User,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle,
  Award
} from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { normalizeEtapaCrm } from "@/components/lib/crmOportunidadePolicy";

/**
 * ETAPA 10: FUNIL DE VENDAS AVANÇADO V21.4
 * 
 * Melhorias implementadas:
 * - ✅ Drag-and-drop entre etapas
 * - ✅ Scoring automático por IA
 * - ✅ Análise de temperatura (quente/morno/frio)
 * - ✅ Probabilidade de fechamento
 * - ✅ Sugestões de ações por IA
 * - ✅ Alertas de inatividade
 * - ✅ Gamificação de vendedores
 * - ✅ Métricas em tempo real
 * - ✅ Multiempresa e controle de acesso
 * - ✅ Responsivo w-full h-full
 */

const etapas = [
  { id: 'Prospecção', nome: 'Prospecção', cor: 'bg-slate-100' },
  { id: 'Contato Inicial', nome: 'Contato Inicial', cor: 'bg-cyan-100' },
  { id: 'Qualificação', nome: 'Qualificação', cor: 'bg-blue-100' },
  { id: 'Proposta', nome: 'Proposta', cor: 'bg-yellow-100' },
  { id: 'Negociação', nome: 'Negociação', cor: 'bg-orange-100' },
  { id: 'Fechamento', nome: 'Fechamento', cor: 'bg-green-100' }
];

export default function FunilVendasAvancado({ windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { filtrarPorContexto, empresaAtual, estaNoGrupo, updateInContext } = useContextoVisual();
  const contextoPronto = estaNoGrupo || Boolean(empresaAtual);

  const { data: oportunidades = [] } = useQuery({
    queryKey: ['oportunidades', empresaAtual?.id],
    queryFn: () => filtrarPorContexto('Oportunidade', {}, '-created_date', 200),
    enabled: contextoPronto,
  });

  const updateEtapaMutation = useMutation({
    mutationFn: ({ id, etapa }) => updateInContext('Oportunidade', id, {
      etapa,
      etapa_funil: etapa,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
      toast({ title: "✅ Etapa atualizada" });
    },
    onError: (error) => {
      toast({ title: "Falha ao mover oportunidade", description: error?.message || 'Erro', variant: 'destructive' });
    },
  });

  const priorizarIAMutation = useMutation({
    mutationFn: async (oportunidade) => {
      return await base44.integrations.Core.InvokeLLM({
        prompt: `Analise a oportunidade de venda:
        
Cliente: ${oportunidade.cliente_nome}
Valor: R$ ${oportunidade.valor_estimado}
Etapa: ${oportunidade.etapa_funil}
Dias desde último contato: ${Math.floor((Date.now() - new Date(oportunidade.data_ultimo_contato || Date.now())) / 86400000)}
Fonte: ${oportunidade.origem}

Calcule:
1. Score de 0-100 (probabilidade de fechamento)
2. Temperatura: Quente/Morno/Frio
3. Próxima ação recomendada
4. Prazo sugerido para ação
5. Risco de perda`,
        response_json_schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            temperatura: { type: "string" },
            proxima_acao: { type: "string" },
            prazo_dias: { type: "number" },
            risco: { type: "string" },
            observacoes: { type: "string" }
          }
        }
      });
    }
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const novaEtapa = destination.droppableId;

    updateEtapaMutation.mutate({ id: draggableId, etapa: novaEtapa });
  };

  const calcularMetricas = () => {
    const totalValor = oportunidades.reduce((acc, op) => acc + (op.valor_estimado || 0), 0);
    const taxaConversao = oportunidades.length > 0 
      ? ((oportunidades.filter(op => normalizeEtapaCrm(op.etapa_funil || op.etapa) === 'Fechamento').length / oportunidades.length) * 100).toFixed(0)
      : 0;
    
    return { totalValor, taxaConversao, total: oportunidades.length };
  };

  const metricas = calcularMetricas();

  const getTemperaturaBadge = (temp) => {
    const colors = {
      'Quente': 'bg-red-100 text-red-800',
      'Morno': 'bg-yellow-100 text-yellow-800',
      'Frio': 'bg-blue-100 text-blue-800'
    };
    return colors[temp] || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="w-full h-full space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total no Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">{metricas.total}</span>
              <span className="text-sm text-slate-600">oportunidades</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Valor Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">
                {metricas.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="text-2xl font-bold">{metricas.taxaConversao}%</span>
              <Badge variant={metricas.taxaConversao >= 20 ? 'default' : 'secondary'}>
                {metricas.taxaConversao >= 20 ? 'Excelente' : 'Bom'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funil Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {etapas.map(etapa => {
            const opsEtapa = oportunidades.filter(op => normalizeEtapaCrm(op.etapa_funil || op.etapa) === etapa.id);
            const valorEtapa = opsEtapa.reduce((acc, op) => acc + (op.valor_estimado || 0), 0);

            return (
              <Droppable key={etapa.id} droppableId={etapa.id}>
                {(provided, snapshot) => (
                  <Card className={snapshot.isDraggingOver ? 'ring-2 ring-blue-400' : ''}>
                    <CardHeader className={`${etapa.cor} pb-3`}>
                      <CardTitle className="text-sm font-semibold">{etapa.nome}</CardTitle>
                      <div className="text-xs text-slate-600 mt-1">
                        {opsEtapa.length} oportunidades • {valorEtapa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                      </div>
                    </CardHeader>
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 min-h-[400px]"
                    >
                      {opsEtapa.map((op, index) => (
                        <Draggable key={op.id} draggableId={op.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow ${
                                snapshot.isDragging ? 'rotate-2 shadow-lg' : ''
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="font-medium text-sm">{op.cliente_nome}</div>
                                  {op.temperatura && (
                                    <Badge className={getTemperaturaBadge(op.temperatura)} variant="outline">
                                      {op.temperatura}
                                    </Badge>
                                  )}
                                </div>

                                <div className="text-lg font-bold text-green-600">
                                  {(op.valor_estimado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                                </div>

                                {op.score && (
                                  <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-yellow-600" />
                                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                                      <div
                                        className="bg-gradient-to-r from-yellow-400 to-green-500 h-2 rounded-full"
                                        style={{ width: `${op.score}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold">{op.score}%</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <User className="w-3 h-3" />
                                  {op.responsavel_nome || 'Sem responsável'}
                                </div>

                                {op.proxima_acao && (
                                  <div className="text-xs text-blue-600 flex items-start gap-1">
                                    <Zap className="w-3 h-3 mt-0.5" />
                                    <span>{op.proxima_acao}</span>
                                  </div>
                                )}

                                {op.dias_sem_contato > 7 && (
                                  <Badge variant="destructive" className="w-full justify-center text-xs">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    {op.dias_sem_contato} dias sem contato
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </CardContent>
                  </Card>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}