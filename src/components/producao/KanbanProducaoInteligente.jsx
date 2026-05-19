import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, TrendingUp, Package, Clock } from "lucide-react";
import { useWindow } from "@/components/lib/useWindow";
import { toast } from "sonner";
import FormularioOrdemProducao from "./FormularioOrdemProducao";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const colunas = [
  { id: "Planejada", nome: "Planejada", cor: "bg-slate-100" },
  { id: "Aguardando Matéria-Prima", nome: "Aguardando MP", cor: "bg-yellow-100" },
  { id: "Em Corte", nome: "Em Corte", cor: "bg-blue-100" },
  { id: "Em Dobra", nome: "Em Dobra", cor: "bg-purple-100" },
  { id: "Em Montagem", nome: "Em Montagem", cor: "bg-indigo-100" },
  { id: "Inspeção", nome: "Inspeção", cor: "bg-orange-100" },
  { id: "Pronto para Expedição", nome: "Pronto", cor: "bg-green-100" },
];

export default function KanbanProducaoInteligente({ windowMode = false }) {
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const { empresaAtual, grupoAtual, filterInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaId || "sem-empresa"}`;
  const canViewKanban = hasPermission("Produção", "Kanban", "visualizar") || hasPermission("Produção", "Kanban", "ver") || hasPermission("Produção", null, "visualizar") || hasPermission("Produção", null, "ver") || hasPermission("Producao", "Kanban", "visualizar") || hasPermission("Producao", null, "visualizar");
  const canEditOP = hasPermission("Produção", "Ordens Produção", "editar") || hasPermission("Produção", "OrdemProducao", "editar") || hasPermission("Producao", "Ordens Producao", "editar") || hasPermission("Producao", "OrdemProducao", "editar");
  const canCreateOP = hasPermission("Produção", "Ordens Produção", "criar") || hasPermission("Produção", "OrdemProducao", "criar") || hasPermission("Producao", "Ordens Producao", "criar") || hasPermission("Producao", "OrdemProducao", "criar");

  const auditarKanban = async ({ acao, descricao, sucesso = true, dadosNovos = null, dadosAnteriores = null, registroId = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId || dadosNovos?.empresa_id || dadosAnteriores?.empresa_id || null,
        group_id: groupId || dadosNovos?.group_id || dadosAnteriores?.group_id || null,
        grupo_id: groupId || dadosNovos?.group_id || dadosAnteriores?.group_id || null,
        acao,
        modulo: "Produção",
        entidade: "KanbanProducao",
        registro_id: registroId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        descricao,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar Kanban de produção:", error);
    }
  };

  const { data: ops = [], isLoading } = useQuery({
    queryKey: ["ordens-producao", contextKey],
    queryFn: () => filterInContext("OrdemProducao", {}, "-created_date", 500),
    enabled: canViewKanban && contextoValido,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-producao-kanban", contextKey],
    queryFn: () => filterInContext("Empresa", {}, "nome_fantasia", 500, "id"),
    enabled: canViewKanban && contextoValido,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const opAtual = ops.find(op => op.id === id);
      if (!contextoValido) {
        await auditarKanban({ acao: "Kanban.bloqueado", descricao: "Tentativa de mover OP sem contexto grupo/empresa.", sucesso: false, dadosNovos: { id, status }, dadosAnteriores: opAtual, registroId: id });
        throw new Error("Contexto multiempresa obrigatório.");
      }
      if (!canEditOP) {
        await auditarKanban({ acao: "Kanban.bloqueado", descricao: "Tentativa de mover OP sem permissão.", sucesso: false, dadosNovos: { id, status }, dadosAnteriores: opAtual, registroId: id });
        throw new Error("Seu perfil não pode alterar OP.");
      }
      const dadosStatus = {
        status,
        group_id: opAtual?.group_id || groupId || null,
        empresa_id: opAtual?.empresa_id || empresaId || null,
        historico_mudancas_status: [
          ...(opAtual?.historico_mudancas_status || []),
          {
            data_hora: new Date().toISOString(),
            status_anterior: opAtual?.status,
            status_novo: status,
            usuario: user?.full_name || user?.email || "Sistema",
            usuario_id: user?.id,
            motivo: "Movido no Kanban"
          }
        ]
      };
      const result = await updateInContext("OrdemProducao", id, dadosStatus);
      await auditarKanban({
        acao: "Edição",
        descricao: `Status da OP ${opAtual?.numero_op || id} alterado no Kanban para ${status}.`,
        dadosNovos: dadosStatus,
        dadosAnteriores: opAtual,
        registroId: id
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens-producao"] });
      toast.success("Status atualizado");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar status da OP");
    }
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (!contextoValido) {
      auditarKanban({ acao: "Kanban.bloqueado", descricao: "Tentativa de mover OP no Kanban sem contexto grupo/empresa.", sucesso: false, dadosNovos: { draggableId: result.draggableId } });
      toast.error("Selecione um grupo ou empresa antes de mover OP.");
      return;
    }
    if (!canEditOP) {
      auditarKanban({ acao: "Kanban.bloqueado", descricao: "Tentativa de mover OP no Kanban sem permissão.", sucesso: false, dadosNovos: { draggableId: result.draggableId } });
      toast.error("Seu perfil não pode mover OP no Kanban.");
      return;
    }
    
    const { draggableId, destination } = result;
    const novoStatus = destination.droppableId;
    
    updateStatusMutation.mutate({ id: draggableId, status: novoStatus });
  };

  const handleAbrirOP = (op) => {
    auditarKanban({
      acao: "Visualizacao",
      descricao: `OP ${op.numero_op || op.id} aberta pelo Kanban.`,
      dadosNovos: { op_id: op.id, numero_op: op.numero_op, status: op.status },
      registroId: op.id
    });
    openWindow(FormularioOrdemProducao, { op, windowMode: true }, {
      title: `OP ${op.numero_op} - ${op.cliente_nome}`,
      width: 1400,
      height: 900,
    });
  };

  const handleNovaOP = () => {
    if (!empresaId) {
      auditarKanban({ acao: "Kanban.bloqueado", descricao: "Tentativa de criar OP pelo Kanban sem empresa operacional.", sucesso: false, dadosNovos: { groupId, empresaId } });
      toast.error("Selecione uma empresa operacional antes de criar OP.");
      return;
    }
    if (!canCreateOP) {
      auditarKanban({ acao: "Kanban.bloqueado", descricao: "Tentativa de criar OP pelo Kanban sem permissão.", sucesso: false, dadosNovos: { groupId, empresaId } });
      toast.error("Seu perfil não pode criar OP.");
      return;
    }
    auditarKanban({ acao: "Criacao", descricao: "Abertura de nova OP pelo Kanban.", dadosNovos: { groupId, empresaId } });
    openWindow(FormularioOrdemProducao, { windowMode: true }, {
      title: "Nova Ordem de Produção",
      width: 1400,
      height: 900,
    });
  };

  const opsFiltradas = filtroEmpresa === "todas" 
    ? ops 
    : ops.filter(op => op.empresa_id === filtroEmpresa);

  const getCorRisco = (risco) => {
    switch(risco) {
      case "Crítico": return "bg-red-500 text-white";
      case "Alto": return "bg-orange-500 text-white";
      case "Médio": return "bg-yellow-500 text-white";
      default: return "bg-green-500 text-white";
    }
  };

  if (isLoading) return <div className="p-6">Carregando Kanban...</div>;

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-hidden" : "h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50";

  return (
    <div className={containerClass} data-permission="Producao.Kanban.visualizar" data-context-required="true">
      <div className="p-6 border-b bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Kanban Industrial Inteligente</h1>
            <p className="text-sm text-slate-600 mt-1">Gestão visual de produção com IA</p>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="px-3 py-2 border rounded-lg"
              data-permission="Produção.Kanban.visualizar"
              data-action="filtrar-kanban-por-empresa"
              data-context-required="true"
            >
              <option value="todas">Todas as Empresas</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</option>
              ))}
            </select>

            <Button onClick={handleNovaOP} disabled={!empresaId || !canCreateOP} className="bg-blue-600 hover:bg-blue-700" data-permission="Produção.Ordens Produção.criar" data-action="criar-ordem-producao-kanban" data-context-required="true" data-sensitive="true">
              <Plus className="w-4 h-4 mr-2" />
              Nova OP
            </Button>
          </div>
        </div>

        <PanelGroup direction="horizontal" className="mt-4 gap-2">
          <Panel defaultSize={25} minSize={15}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">OPs Ativas</p>
                    <p className="text-2xl font-bold">{opsFiltradas.filter(op => op.status !== "Concluída" && op.status !== "Cancelada").length}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </Panel>
          <PanelResizeHandle className="w-1 bg-slate-200 rounded" />

          <Panel defaultSize={25} minSize={15}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Em Atraso</p>
                    <p className="text-2xl font-bold text-red-600">
                      {opsFiltradas.filter(op => op.risco_atraso === "Crítico" || op.risco_atraso === "Alto").length}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </Panel>
          <PanelResizeHandle className="w-1 bg-slate-200 rounded" />

          <Panel defaultSize={25} minSize={15}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Peso Total (KG)</p>
                    <p className="text-2xl font-bold">
                      {opsFiltradas.reduce((acc, op) => acc + (op.peso_total_kg || 0), 0).toFixed(0)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </Panel>
          <PanelResizeHandle className="w-1 bg-slate-200 rounded" />

          <Panel defaultSize={25} minSize={15}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Progresso Médio</p>
                    <p className="text-2xl font-bold">
                      {opsFiltradas.length > 0 
                        ? (opsFiltradas.reduce((acc, op) => acc + (op.progresso_fisico_percentual || 0), 0) / opsFiltradas.length).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </Panel>
        </PanelGroup>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-w-max">
            {colunas.map(coluna => {
              const opsColuna = opsFiltradas.filter(op => op.status === coluna.id);
              
              return (
                <Droppable key={coluna.id} droppableId={coluna.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-shrink-0 w-80 rounded-lg ${coluna.cor} ${
                        snapshot.isDraggingOver ? 'ring-2 ring-blue-400' : ''
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-slate-800">
                            {coluna.nome}
                          </h3>
                          <Badge variant="outline">{opsColuna.length}</Badge>
                        </div>

                        <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
                          {opsColuna.map((op, index) => (
                            <Draggable key={op.id} draggableId={op.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`cursor-pointer hover:shadow-lg transition-shadow ${
                                    snapshot.isDragging ? 'shadow-2xl rotate-2' : ''
                                  }`}
                                  onClick={() => handleAbrirOP(op)}
                                  data-permission="Produção.Ordens Produção.visualizar"
                                  data-action="abrir-ordem-producao"
                                >
                                  <CardHeader className="p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold">
                                          OP {op.numero_op}
                                        </CardTitle>
                                        <p className="text-xs text-slate-600 mt-1">{op.cliente_nome}</p>
                                      </div>
                                      {op.risco_atraso && (
                                        <Badge className={`text-xs ${getCorRisco(op.risco_atraso)}`}>
                                          {op.risco_atraso}
                                        </Badge>
                                      )}
                                    </div>
                                  </CardHeader>

                                  <CardContent className="p-3 pt-0 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-600">Progresso</span>
                                      <span className="font-semibold">{op.progresso_fisico_percentual || 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                      <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${op.progresso_fisico_percentual || 0}%` }}
                                      />
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-600">Peso</span>
                                      <span className="font-semibold">{op.progresso_fisico_kg || 0} / {op.peso_total_kg || 0} KG</span>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t">
                                      <Badge variant="outline" className="text-xs">
                                        {op.tipo_producao}
                                      </Badge>
                                      {op.prioridade === "Urgente" && (
                                        <Badge className="text-xs bg-red-500">🔥 Urgente</Badge>
                                      )}
                                    </div>

                                    {op.gargalos_detectados?.length > 0 && (
                                      <div className="flex items-center gap-1 text-xs text-orange-600 pt-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>{op.gargalos_detectados.length} gargalo(s)</span>
                                      </div>
                                    )}
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
