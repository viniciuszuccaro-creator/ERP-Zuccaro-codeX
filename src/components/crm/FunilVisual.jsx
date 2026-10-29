import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, TrendingUp, Calendar, DollarSign, Flame, Snowflake, Sun } from "lucide-react";

const etapas = [
  { id: "Prospecção", nome: "Prospecção", cor: "bg-gray-500" },
  { id: "Contato Inicial", nome: "Contato Inicial", cor: "bg-blue-500" },
  { id: "Qualificação", nome: "Qualificação", cor: "bg-cyan-500" },
  { id: "Proposta", nome: "Proposta", cor: "bg-purple-500" },
  { id: "Negociação", nome: "Negociação", cor: "bg-orange-500" },
  { id: "Fechamento", nome: "Fechamento", cor: "bg-green-500" }
];

export default function FunilVisual({ oportunidades, onMoverEtapa, onVisualizarOportunidade }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const oportunidadeId = draggableId;
    const novaEtapa = destination.droppableId;

    onMoverEtapa(oportunidadeId, novaEtapa);
  };

  const getOportunidadesPorEtapa = (etapa) => {
    return oportunidades.filter(opp => opp.etapa === etapa && (opp.status === "Aberto" || opp.status === "Em Andamento"));
  };

  const getTemperaturaIcon = (temp) => {
    switch(temp) {
      case "Quente": return <Flame className="w-4 h-4 text-red-500" />;
      case "Morno": return <Sun className="w-4 h-4 text-yellow-500" />;
      case "Frio": return <Snowflake className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const calcularTotaisPorEtapa = (etapa) => {
    const opps = getOportunidadesPorEtapa(etapa);
    const quantidade = opps.length;
    const valorTotal = opps.reduce((sum, opp) => sum + (opp.valor_estimado || 0), 0);
    const valorPonderado = opps.reduce((sum, opp) => sum + ((opp.valor_estimado || 0) * (opp.probabilidade || 0) / 100), 0);
    return { quantidade, valorTotal, valorPonderado };
  };

  return (
    <div className="space-y-4">
      {/* Resumo do Funil */}
      <div className="grid grid-cols-6 gap-4">
        {etapas.map((etapa) => {
          const totais = calcularTotaisPorEtapa(etapa.id);
          return (
            <Card key={etapa.id} className="border-t-4" style={{ borderTopColor: etapa.cor.replace('bg-', '#') }}>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-2">{etapa.nome}</h4>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{totais.quantidade}</p>
                  <p className="text-xs text-slate-600">
                    R$ {totais.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-green-600 font-semibold">
                    Ponderado: R$ {totais.valorPonderado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Funil Drag & Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-6 gap-4">
          {etapas.map((etapa) => {
            const opps = getOportunidadesPorEtapa(etapa.id);
            
            return (
              <Droppable key={etapa.id} droppableId={etapa.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-3 min-h-[500px] p-3 rounded-lg border-2 border-dashed transition-colors ${
                      snapshot.isDraggingOver 
                        ? 'bg-blue-50 border-blue-400' 
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className={`text-center py-2 rounded ${etapa.cor} text-white font-semibold text-sm`}>
                      {etapa.nome}
                    </div>

                    {opps.map((opp, index) => (
                      <Draggable key={opp.id} draggableId={opp.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`transition-shadow ${
                              snapshot.isDragging ? 'shadow-2xl rotate-3' : ''
                            }`}
                          >
                            <Card className={`cursor-move hover:shadow-lg transition-all ${
                              snapshot.isDragging ? 'ring-4 ring-blue-400' : ''
                            }`}>
                              <CardHeader className="p-3 pb-2">
                                <div className="flex items-start justify-between gap-2">
                                  <h5 className="text-sm font-semibold line-clamp-2 flex-1">
                                    {opp.titulo}
                                  </h5>
                                  {getTemperaturaIcon(opp.temperatura)}
                                </div>
                                <p className="text-xs text-slate-600">{opp.cliente_nome}</p>
                              </CardHeader>
                              <CardContent className="p-3 pt-0 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600">Valor:</span>
                                  <span className="font-bold text-green-600">
                                    R$ {(opp.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                  </span>
                                </div>
                                
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600">Prob.:</span>
                                  <Badge variant="outline" className="text-xs">
                                    {opp.probabilidade || 0}%
                                  </Badge>
                                </div>

                                {opp.data_previsao && (
                                  <div className="flex items-center gap-1 text-xs text-slate-600">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(opp.data_previsao).toLocaleDateString('pt-BR')}
                                  </div>
                                )}

                                {opp.dias_sem_contato > 7 && (
                                  <div className="text-xs text-red-600 font-semibold">
                                    ⚠️ {opp.dias_sem_contato} dias sem contato
                                  </div>
                                )}

                                {opp.score && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600">Score:</span>
                                    <div className="flex items-center gap-1">
                                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full ${
                                            opp.score >= 70 ? 'bg-green-500' :
                                            opp.score >= 40 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                          }`}
                                          style={{ width: `${opp.score}%` }}
                                        />
                                      </div>
                                      <span className="font-semibold">{opp.score}</span>
                                    </div>
                                  </div>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="w-full text-xs"
                                  onClick={() => onVisualizarOportunidade(opp)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Ver Detalhes
                                </Button>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {opps.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        Nenhuma oportunidade
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}