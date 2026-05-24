import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  Package,
  Search,
  Eye,
  Image,
  Download,
  AlertCircle,
  AlertTriangle,
  Navigation,
  Bell,
  BarChart3,
  Route,
  Zap,
  MessageCircle,
  Camera,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DashboardLogisticaInteligente from "../logistica/DashboardLogisticaInteligente";
import NotificadorAutomaticoEntrega from "../logistica/NotificadorAutomaticoEntrega";
import MapaRoteirizacaoIA from "../logistica/MapaRoteirizacaoIA";
import TimelineEntregaVisual from "../logistica/TimelineEntregaVisual";
import IAPrevisaoEntrega from "../logistica/IAPrevisaoEntrega";
import ComprovanteEntregaDigital from "../logistica/ComprovanteEntregaDigital";
import RegistroOcorrenciaLogistica from "../logistica/RegistroOcorrenciaLogistica";
import IntegracaoRomaneio from "../logistica/IntegracaoRomaneio";
import PainelMetricasRealtime from "../logistica/PainelMetricasRealtime";
import { useWindow } from "@/components/lib/useWindow";
import { usePermissoesLogistica } from "../logistica/ControleAcessoLogistica";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

/**
 * 🚚 PEDIDOS PARA ENTREGA V21.5
 * Gestão de pedidos aprovados que precisam ser entregues
 * - Agrupamento por região de atendimento
 * - Rastreamento de status de entrega
 * - Upload/visualização de canhoto e fotos
 * - Integração com Expedição
 */
export default function PedidosEntregaTab({ windowMode = false }) {
  const [busca, setBusca] = useState("");
  const [regiaoFiltro, setRegiaoFiltro] = useState("todas");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState(null);
  const [notificadorOpen, setNotificadorOpen] = useState(false);
  const [comprovanteOpen, setComprovanteOpen] = useState(false);
  const [ocorrenciaOpen, setOcorrenciaOpen] = useState(false);
  const [romaneioOpen, setRomaneioOpen] = useState(false);

  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const permissoes = usePermissoesLogistica();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const effectiveEmpresaId = empresaAtual?.id || null;
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canView = hasPermission("Comercial", "Pedido", "visualizar") || hasPermission("Expedicao", "Entregas", "visualizar") || hasPermission("Expedicao", "Painel Logistico", "visualizar");
  const canEdit = hasPermission("Comercial", "Pedido", "editar") || hasPermission("Expedicao", "Entregas", "editar") || hasPermission("Expedicao", "Entrega", "editar");
  const canStockMove = hasPermission("Estoque", "Movimentacoes", "criar") || hasPermission("Estoque", "Produto", "editar");

  const auditEntrega = async ({ acao, sucesso = true, motivo = null, detalhes = {}, dadosAnteriores = null, dadosNovos = null, registroId = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Comercial",
        entidade: "PedidoEntrega",
        registro_id: registroId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        empresa_id: effectiveEmpresaId,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        sucesso,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar pedidos para entrega", error);
    }
  };

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-entrega", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Pedido", {}, "-created_date", 1000),
    enabled: contextoValido && canView,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["entregas-comercial", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Entrega", {}, "-created_date", 1000),
    enabled: contextoValido && canView,
  });

  const { data: regioes = [] } = useQuery({
    queryKey: ["regioes-entrega", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("RegiaoAtendimento", {}, "nome", 300),
    enabled: contextoValido && canView,
  });

  // Filtrar pedidos para entrega (tipo_frete = CIF ou FOB, status = Aprovado ou posterior)
  const pedidosParaEntrega = useMemo(() => {
    return pedidos.filter(p => 
      (p.tipo_frete === 'CIF' || p.tipo_frete === 'FOB') &&
      ['Aprovado', 'Pronto para Faturar', 'Faturado', 'Em Expedição', 'Em Trânsito'].includes(p.status)
    );
  }, [pedidos]);

  // Agrupar por região
  const pedidosPorRegiao = useMemo(() => {
    const grupos = {};
    
    pedidosParaEntrega.forEach(pedido => {
      const regiao = pedido.endereco_entrega_principal?.cidade || 'Sem Região';
      if (!grupos[regiao]) {
        grupos[regiao] = [];
      }
      grupos[regiao].push(pedido);
    });
    
    return grupos;
  }, [pedidosParaEntrega]);

  // Aplicar filtros
  const pedidosFiltrados = useMemo(() => {
    let resultado = pedidosParaEntrega;
    
    if (busca) {
      resultado = resultado.filter(p =>
        p.numero_pedido?.toLowerCase().includes(busca.toLowerCase()) ||
        p.cliente_nome?.toLowerCase().includes(busca.toLowerCase())
      );
    }
    
    if (statusFiltro !== "todos") {
      resultado = resultado.filter(p => p.status === statusFiltro);
    }
    
    if (regiaoFiltro !== "todas") {
      resultado = resultado.filter(p => 
        (p.endereco_entrega_principal?.cidade || 'Sem Região') === regiaoFiltro
      );
    }
    
    return resultado;
  }, [pedidosParaEntrega, busca, statusFiltro, regiaoFiltro]);

  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ pedido, pedidoId, entrega, novoStatus, motivo }) => {
      const pedidoAlvo = pedido || pedidos.find(p => p.id === pedidoId);
      if (!pedidoAlvo) throw new Error("Pedido nao encontrado para atualizar status.");
      if (!contextoValido || !canEdit) {
        await auditEntrega({ acao: "PedidoEntrega.status_bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { pedido_id: pedidoAlvo.id, novoStatus }, registroId: pedidoAlvo.id });
        throw new Error("Contexto e permissao sao obrigatorios para alterar status.");
      }
      if (!window.confirm(`Confirma alterar o status do pedido para ${novoStatus}?`)) {
        await auditEntrega({ acao: "PedidoEntrega.status_cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { pedido_id: pedidoAlvo.id, novoStatus }, registroId: pedidoAlvo.id });
        throw new Error("Alteracao cancelada pelo usuario.");
      }
      const pedidoAtualizado = await updateInContext("Pedido", pedidoAlvo.id, {
        status: novoStatus,
        group_id: pedidoAlvo.group_id || effectiveGroupId,
        grupo_id: pedidoAlvo.grupo_id || pedidoAlvo.group_id || effectiveGroupId,
        empresa_id: pedidoAlvo.empresa_id || effectiveEmpresaId,
        historico_status: [...(pedidoAlvo.historico_status || []), { status: novoStatus, data_hora: new Date().toISOString(), usuario: user?.full_name || user?.email || "Sistema", usuario_id: user?.id, observacao: motivo || `Status alterado para ${novoStatus}.` }]
      });
      const entregaAlvo = entrega || entregas.find(e => e.pedido_id === pedidoAlvo.id);
      let entregaAtualizada = null;
      if (entregaAlvo?.id) {
        entregaAtualizada = await updateInContext("Entrega", entregaAlvo.id, {
          status: novoStatus,
          group_id: entregaAlvo.group_id || pedidoAlvo.group_id || effectiveGroupId,
          grupo_id: entregaAlvo.grupo_id || entregaAlvo.group_id || pedidoAlvo.group_id || effectiveGroupId,
          empresa_id: entregaAlvo.empresa_id || pedidoAlvo.empresa_id || effectiveEmpresaId,
          historico_status: [...(entregaAlvo.historico_status || []), { status: novoStatus, data_hora: new Date().toISOString(), usuario: user?.full_name || user?.email || "Sistema", usuario_id: user?.id, observacao: motivo || `Status sincronizado com pedido ${pedidoAlvo.numero_pedido}.` }]
        });
      }
      await auditEntrega({ acao: "PedidoEntrega.alterar_status", detalhes: { pedido_id: pedidoAlvo.id, entrega_id: entregaAlvo?.id, novoStatus }, dadosAnteriores: { pedido: pedidoAlvo, entrega: entregaAlvo }, dadosNovos: { pedido: pedidoAtualizado, entrega: entregaAtualizada }, registroId: pedidoAlvo.id });
      return { pedidoAtualizado, entregaAtualizada };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-entrega"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-comercial"] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      toast.success("Status atualizado.");
    },
    onError: (error) => {
      if (error?.message !== "Alteracao cancelada pelo usuario.") toast.error(error?.message || "Erro ao atualizar status.");
    }
  });

  const handleVerDetalhes = (pedido) => {
    const entrega = entregas.find(e => e.pedido_id === pedido.id);
    setEntregaSelecionada({ pedido, entrega });
    setDetalhesOpen(true);
  };

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "w-full h-full space-y-6";

  if (!contextoValido || !canView) {
    return (
      <div className={containerClass} data-permission="Expedicao.Entregas.visualizar" data-context-required="true">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-sm text-yellow-800">
            Selecione um contexto grupo/empresa e confirme permissao para visualizar pedidos para entrega.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-600" />
            Logística de Entrega
          </h2>
          <p className="text-slate-600 text-sm">Pedidos aprovados aguardando entrega</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => openWindow(PainelMetricasRealtime, { windowMode: true }, {
              title: '⚡ Métricas em Tempo Real',
              width: 1100,
              height: 650
            })}
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            <Zap className="w-4 h-4 mr-2" />
            Tempo Real
          </Button>

          <Button
            onClick={() => openWindow(DashboardLogisticaInteligente, { windowMode: true }, {
              title: '📊 Dashboard Logística IA',
              width: 1200,
              height: 700
            })}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics IA
          </Button>
          
          <Button
            onClick={() => openWindow(MapaRoteirizacaoIA, { windowMode: true }, {
              title: '🗺️ Roteirização Inteligente',
              width: 1000,
              height: 700
            })}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Route className="w-4 h-4 mr-2" />
            🤖 Otimizar Rotas
          </Button>

          {permissoes.podeCriarRomaneio && (
            <Button
              onClick={() => setRomaneioOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              Criar Romaneio
            </Button>
          )}
        </div>
      </div>

      {/* Estatísticas por Região */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Total para Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{pedidosParaEntrega.length}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Em Expedição</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {pedidosParaEntrega.filter(p => p.status === 'Em Expedição').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Em Trânsito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {pedidosParaEntrega.filter(p => p.status === 'Em Trânsito').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Regiões Atendidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {Object.keys(pedidosPorRegiao).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por pedido ou cliente..."
                className="pl-10"
              />
            </div>

            <Select value={regiaoFiltro} onValueChange={setRegiaoFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as regiões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Regiões</SelectItem>
                {Object.keys(pedidosPorRegiao).map(regiao => (
                  <SelectItem key={regiao} value={regiao}>
                    {regiao} ({pedidosPorRegiao[regiao].length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Pronto para Faturar">Pronto para Faturar</SelectItem>
                <SelectItem value="Faturado">Faturado</SelectItem>
                <SelectItem value="Em Expedição">Em Expedição</SelectItem>
                <SelectItem value="Em Trânsito">Em Trânsito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agrupamento por Região */}
      <Tabs defaultValue={Object.keys(pedidosPorRegiao)[0] || "geral"} className="w-full">
        <TabsList className="bg-white border shadow-sm flex-wrap">
          <TabsTrigger value="geral">
            📋 Visão Geral ({pedidosFiltrados.length})
          </TabsTrigger>
          {Object.keys(pedidosPorRegiao).slice(0, 5).map(regiao => (
            <TabsTrigger key={regiao} value={regiao}>
              📍 {regiao} ({pedidosPorRegiao[regiao].length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosFiltrados.map(pedido => {
                    const regiao = pedido.endereco_entrega_principal?.cidade || 'Sem Região';
                    const entrega = entregas.find(e => e.pedido_id === pedido.id);
                    
                    return (
                      <TableRow key={pedido.id} className="hover:bg-slate-50">
                        <TableCell className="font-semibold">{pedido.numero_pedido}</TableCell>
                        <TableCell>{pedido.cliente_nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <MapPin className="w-3 h-3 mr-1" />
                            {regiao}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold">
                          R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {pedido.data_prevista_entrega ? 
                            new Date(pedido.data_prevista_entrega).toLocaleDateString('pt-BR') : 
                            '-'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            pedido.status === 'Entregue' ? 'bg-green-600' :
                            pedido.status === 'Em Trânsito' ? 'bg-purple-600' :
                            pedido.status === 'Em Expedição' ? 'bg-orange-600' :
                            pedido.status === 'Faturado' ? 'bg-blue-600' :
                            pedido.status === 'Pronto para Faturar' ? 'bg-indigo-600' :
                            'bg-slate-600'
                          }>
                            {pedido.status === 'Entregue' ? '✅ Entregue' : pedido.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerDetalhes(pedido)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEntregaSelecionada({ pedido, entrega });
                                setNotificadorOpen(true);
                              }}
                              className="border-green-300 text-green-700 hover:bg-green-50"
                            >
                              <Bell className="w-4 h-4 mr-1" />
                              Notificar
                            </Button>

                            {pedido.status === 'Em Trânsito' && permissoes.podeConfirmarEntrega && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEntregaSelecionada({ pedido, entrega });
                                  setComprovanteOpen(true);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Confirmar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {pedidosFiltrados.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhum pedido para entrega encontrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tabs por Região */}
        {Object.keys(pedidosPorRegiao).slice(0, 5).map(regiao => (
          <TabsContent key={regiao} value={regiao} className="mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-blue-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Região: {regiao}
                </CardTitle>
                <p className="text-sm text-slate-600">
                  {pedidosPorRegiao[regiao].length} pedido(s) nesta região
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidosPorRegiao[regiao].map(pedido => (
                      <TableRow key={pedido.id} className="hover:bg-slate-50">
                        <TableCell className="font-semibold">{pedido.numero_pedido}</TableCell>
                        <TableCell>{pedido.cliente_nome}</TableCell>
                        <TableCell className="text-sm">
                          {pedido.endereco_entrega_principal?.logradouro}, {pedido.endereco_entrega_principal?.numero}
                          {pedido.endereco_entrega_principal?.mapa_url && (
                            <a 
                              href={pedido.endereco_entrega_principal.mapa_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-600 hover:underline inline-flex items-center"
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              Maps
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            pedido.status === 'Entregue' ? 'bg-green-600' :
                            pedido.status === 'Em Trânsito' ? 'bg-purple-600' :
                            pedido.status === 'Em Expedição' ? 'bg-orange-600' :
                            'bg-blue-600'
                          }>
                            {pedido.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleVerDetalhes(pedido)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Detalhes
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialog de Notificação */}
      <Dialog open={notificadorOpen} onOpenChange={setNotificadorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          {entregaSelecionada && (
            <NotificadorAutomaticoEntrega
              pedido={entregaSelecionada.pedido}
              entrega={entregaSelecionada.entrega}
              onClose={() => setNotificadorOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Comprovante */}
      <Dialog open={comprovanteOpen} onOpenChange={setComprovanteOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          {entregaSelecionada && (
            <ComprovanteEntregaDigital
              pedido={entregaSelecionada.pedido}
              entrega={entregaSelecionada.entrega}
              onSuccess={() => {
                setComprovanteOpen(false);
                setDetalhesOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Ocorrência */}
      <Dialog open={ocorrenciaOpen} onOpenChange={setOcorrenciaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          {entregaSelecionada && (
            <RegistroOcorrenciaLogistica
              pedido={entregaSelecionada.pedido}
              entrega={entregaSelecionada.entrega}
              onClose={() => setOcorrenciaOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Romaneio */}
      <Dialog open={romaneioOpen} onOpenChange={setRomaneioOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <IntegracaoRomaneio
            pedidosSelecionados={pedidosFiltrados}
            onClose={() => setRomaneioOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes da Entrega */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              🚚 Detalhes da Entrega - {entregaSelecionada?.pedido?.numero_pedido}
            </DialogTitle>
          </DialogHeader>
          
          {entregaSelecionada && (
            <div className="space-y-4">
              {/* Timeline Visual */}
              <TimelineEntregaVisual 
                pedido={entregaSelecionada.pedido} 
                entrega={entregaSelecionada.entrega} 
              />

              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Cliente</p>
                      <p className="font-semibold">{entregaSelecionada.pedido.cliente_nome}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Valor Total</p>
                      <p className="font-bold text-green-600">
                        R$ {(entregaSelecionada.pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Endereço</p>
                      <p className="text-sm">
                        {entregaSelecionada.pedido.endereco_entrega_principal?.logradouro}, 
                        {entregaSelecionada.pedido.endereco_entrega_principal?.numero}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Status Atual</p>
                      <Badge className="mt-1">{entregaSelecionada.pedido.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ações Automáticas de Status */}
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    🤖 Ações Automáticas de Entrega
                  </CardTitle>
                  <p className="text-sm text-slate-600">Clique para atualizar o status automaticamente</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {entregaSelecionada.pedido.status === 'Aprovado' || entregaSelecionada.pedido.status === 'Pronto para Faturar' ? (
                    <Button
                      onClick={() => {
                        atualizarStatusMutation.mutate({
                          pedidoId: entregaSelecionada.pedido.id,
                          novoStatus: 'Em Expedição'
                        });
                        setDetalhesOpen(false);
                        toast.success("📦 Pedido enviado para expedição!");
                      }}
                      className="bg-orange-600 hover:bg-orange-700 w-full"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      📦 Iniciar Separação/Expedição
                    </Button>
                  ) : null}

                  {entregaSelecionada.pedido.status === 'Em Expedição' || entregaSelecionada.pedido.status === 'Faturado' ? (
                    <Button
                      onClick={() => {
                        atualizarStatusMutation.mutate({
                          pedidoId: entregaSelecionada.pedido.id,
                          novoStatus: 'Em Trânsito'
                        });
                        setDetalhesOpen(false);
                        toast.success("🚚 Pedido saiu para entrega!");
                      }}
                      className="bg-purple-600 hover:bg-purple-700 w-full"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      🚚 Confirmar Saída do Veículo
                    </Button>
                  ) : null}

                  {entregaSelecionada.pedido.status === 'Em Trânsito' ? (
                    <Button
                      onClick={async () => {
                        const pedido = entregaSelecionada.pedido;
                        const entrega = entregaSelecionada.entrega;
                        if (!contextoValido || !canEdit || !canStockMove) {
                          await auditEntrega({ acao: "PedidoEntrega.confirmar_bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { pedido_id: pedido.id }, registroId: pedido.id });
                          toast.error("Contexto e permissoes de entrega/estoque sao obrigatorios.");
                          return;
                        }
                        if (!window.confirm("Confirma a entrega e a baixa automatica de estoque deste pedido?")) {
                          await auditEntrega({ acao: "PedidoEntrega.confirmar_cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { pedido_id: pedido.id }, registroId: pedido.id });
                          return;
                        }
                        for (const item of pedido.itens_revenda || []) {
                          if (!item.produto_id) continue;
                          const produtos = await filterInContext("Produto", { id: item.produto_id }, undefined, 1);
                          const produto = produtos[0];
                          if (!produto) continue;
                          const quantidade = Number(item.quantidade || 0);
                          const estoqueAnterior = Number(produto.estoque_atual || 0);
                          if (estoqueAnterior < quantidade) {
                            await auditEntrega({ acao: "PedidoEntrega.estoque_insuficiente", sucesso: false, motivo: "estoque_insuficiente", detalhes: { pedido_id: pedido.id, produto_id: item.produto_id, estoqueAnterior, quantidade }, registroId: pedido.id });
                            continue;
                          }
                          const novoEstoque = estoqueAnterior - quantidade;
                          await createInContext("MovimentacaoEstoque", {
                            group_id: pedido.group_id || effectiveGroupId,
                            grupo_id: pedido.grupo_id || pedido.group_id || effectiveGroupId,
                            empresa_id: pedido.empresa_id || effectiveEmpresaId,
                            tipo_movimento: "saida",
                            origem_movimento: "pedido",
                            origem_documento_id: pedido.id,
                            produto_id: item.produto_id,
                            produto_descricao: item.descricao || item.produto_descricao,
                            quantidade,
                            unidade_medida: item.unidade,
                            estoque_anterior: estoqueAnterior,
                            estoque_atual: novoEstoque,
                            data_movimentacao: new Date().toISOString(),
                            documento: pedido.numero_pedido,
                            motivo: "Entrega confirmada",
                            aprovado: true
                          });
                          await updateInContext("Produto", item.produto_id, {
                            estoque_atual: novoEstoque,
                            group_id: produto.group_id || pedido.group_id || effectiveGroupId,
                            grupo_id: produto.grupo_id || produto.group_id || pedido.group_id || effectiveGroupId,
                            empresa_id: produto.empresa_id || pedido.empresa_id || effectiveEmpresaId
                          });
                        }
                        atualizarStatusMutation.mutate({ pedido, entrega, novoStatus: 'Entregue', motivo: 'Entrega confirmada com baixa automatica de estoque.' });
                        setDetalhesOpen(false);
                      }}
                      className="bg-green-600 hover:bg-green-700 w-full"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      ✅ Confirmar Entrega (Baixa Estoque Automática)
                    </Button>
                  ) : null}

                  {entregaSelecionada.pedido.status === 'Entregue' && (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="font-semibold text-green-800">Pedido já foi entregue!</p>
                      <p className="text-sm text-green-700">Estoque baixado automaticamente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* IA: Previsão de Entrega */}
              <IAPrevisaoEntrega 
                pedido={entregaSelecionada.pedido}
                historico={entregas.filter(e => e.status === 'Entregue').slice(0, 10)}
              />

              {/* Ações Adicionais */}
              <Card className="bg-slate-50">
                <CardContent className="p-4 space-y-2">
                  <Button
                    onClick={() => setNotificadorOpen(true)}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    💬 Notificar Cliente
                  </Button>

                  {permissoes.podeConfirmarEntrega && entregaSelecionada.pedido.status === 'Em Trânsito' && (
                    <Button
                      onClick={() => setComprovanteOpen(true)}
                      variant="outline"
                      className="w-full border-green-300 text-green-700 hover:bg-green-50"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      📸 Registrar Comprovante
                    </Button>
                  )}

                  {permissoes.podeRegistrarOcorrencia && (
                    <Button
                      onClick={() => setOcorrenciaOpen(true)}
                      variant="outline"
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      ⚠️ Registrar Ocorrência
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Comprovante de Entrega */}
              {entregaSelecionada.entrega?.comprovante_entrega && (
                <Card className="border-green-300 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Comprovante de Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-600">Recebedor</p>
                        <p className="font-semibold">{entregaSelecionada.entrega.comprovante_entrega.nome_recebedor}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Data/Hora</p>
                        <p className="font-semibold">
                          {new Date(entregaSelecionada.entrega.comprovante_entrega.data_hora_recebimento).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    {entregaSelecionada.entrega.comprovante_entrega.foto_comprovante && (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" asChild>
                          <a href={entregaSelecionada.entrega.comprovante_entrega.foto_comprovante} target="_blank" rel="noopener noreferrer">
                            <Image className="w-4 h-4 mr-2" />
                            Ver Foto do Comprovante
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}