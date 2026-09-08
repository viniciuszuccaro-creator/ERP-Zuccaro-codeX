import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Users, Target, DollarSign } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useWindow } from "@/components/lib/useWindow";
import useContextoVisual from "@/components/lib/useContextoVisual";

const etapasFunil = [
  { id: "Prospecção", nome: "Prospecção", cor: "bg-slate-100" },
  { id: "Contato Inicial", nome: "Contato", cor: "bg-blue-100" },
  { id: "Qualificação", nome: "Qualificação", cor: "bg-purple-100" },
  { id: "Proposta", nome: "Proposta", cor: "bg-indigo-100" },
  { id: "Negociação", nome: "Negociação", cor: "bg-yellow-100" },
  { id: "Fechamento", nome: "Fechamento", cor: "bg-green-100" },
];

export default function FunilComercialInteligente({ windowMode = false }) {
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { filtrarPorContexto, empresaAtual, estaNoGrupo, updateInContext } = useContextoVisual();
  const contextoPronto = estaNoGrupo || Boolean(empresaAtual);

  const { data: oportunidades = [], isLoading } = useQuery({
    queryKey: ["oportunidades", empresaAtual?.id],
    queryFn: () => filtrarPorContexto('Oportunidade', {}, '-created_date', 200),
    enabled: contextoPronto,
  });

  const updateEtapaMutation = useMutation({
    mutationFn: ({ id, etapa }) => updateInContext('Oportunidade', id, {
      etapa,
      etapa_funil: etapa,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oportunidades"] });
      toast.success("Etapa atualizada");
    },
    onError: (error) => toast.error(error?.message || "Falha ao mover oportunidade"),
  });

  const priorizarIAMutation = useMutation({
    mutationFn: async () => {
      toast.info("🤖 IA priorizando leads...");

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise estas oportunidades e priorize baseado em:
- Probabilidade de fechamento
- Valor estimado
- Tempo no funil
- Histórico de interações

Oportunidades: ${JSON.stringify(oportunidades.map(o => ({
  titulo: o.titulo,
  valor: o.valor_estimado,
  probabilidade: o.probabilidade,
  etapa: o.etapa,
  dias_aberto: Math.floor((new Date() - new Date(o.data_abertura)) / (1000 * 60 * 60 * 24))
})))}

Retorne uma lista priorizada com score e motivo.`,
        response_json_schema: {
          type: "object",
          properties: {
            oportunidades_priorizadas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  score_ia: { type: "number" },
                  motivo_priorizacao: { type: "string" }
                }
              }
            }
          }
        }
      });

      toast.success(`✅ IA priorizou ${result.oportunidades_priorizadas?.length || 0} oportunidades!`);
      return result;
    },
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const novaEtapa = destination.droppableId;
    
    updateEtapaMutation.mutate({ id: draggableId, etapa: novaEtapa });
  };

  const valorTotalFunil = oportunidades
    .filter(o => o.status === "Aberto" || o.status === "Em Andamento")
    .reduce((acc, o) => acc + (o.valor_estimado || 0), 0);

  const taxaConversao = oportunidades.length > 0
    ? (oportunidades.filter(o => o.status === "Ganho").length / oportunidades.length) * 100
    : 0;

  if (isLoading) return <div className="p-6">Carregando funil...</div>;

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-hidden" : "h-full flex flex-col bg-gradient-to-br from-slate-50 to-purple-50";

  return (
    <div className={containerClass}>
      <div className="p-6 border-b bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Funil Comercial Inteligente</h1>
            <p className="text-sm text-slate-600 mt-1">CRM com IA e priorização automática</p>
          </div>

          <Button 
            onClick={() => priorizarIAMutation.mutate()}
            disabled={priorizarIAMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Priorizar com IA
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Oportunidades</p>
                  <p className="text-2xl font-bold">{oportunidades.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Valor Total</p>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {(valorTotalFunil / 1000).toFixed(0)}k
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Taxa Conversão</p>
                  <p className="text-2xl font-bold text-purple-600">{taxaConversao.toFixed(1)}%</p>
                </div>
                <Target className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Ganhos</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {oportunidades.filter(o => o.status === "Ganho").length}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-w-max">
            {etapasFunil.map(etapa => {
              const oppsEtapa = oportunidades.filter(o => o.etapa === etapa.id && o.status !== "Ganho" && o.status !== "Perdido");
              
              return (
                <Droppable key={etapa.id} droppableId={etapa.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-shrink-0 w-80 rounded-lg ${etapa.cor} ${
                        snapshot.isDraggingOver ? 'ring-2 ring-purple-400' : ''
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-slate-800">{etapa.nome}</h3>
                          <Badge variant="outline">{oppsEtapa.length}</Badge>
                        </div>

                        <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
                          {oppsEtapa.map((opp, index) => (
                            <Draggable key={opp.id} draggableId={opp.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`cursor-pointer hover:shadow-lg transition-shadow ${
                                    snapshot.isDragging ? 'shadow-2xl rotate-2' : ''
                                  }`}
                                >
                                  <CardHeader className="p-3">
                                    <CardTitle className="text-sm font-semibold">{opp.titulo}</CardTitle>
                                    <p className="text-xs text-slate-600 mt-1">{opp.cliente_nome}</p>
                                  </CardHeader>

                                  <CardContent className="p-3 pt-0 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-600">Valor</span>
                                      <span className="font-semibold text-green-600">
                                        R$ {(opp.valor_estimado || 0).toLocaleString('pt-BR')}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-600">Probabilidade</span>
                                      <span className="font-semibold">{opp.probabilidade || 0}%</span>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t">
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          opp.temperatura === "Quente" ? "border-red-300 text-red-700" :
                                          opp.temperatura === "Morno" ? "border-yellow-300 text-yellow-700" :
                                          "border-blue-300 text-blue-700"
                                        }`}
                                      >
                                        {opp.temperatura === "Quente" ? "🔥" : opp.temperatura === "Morno" ? "☀️" : "❄️"} {opp.temperatura}
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}