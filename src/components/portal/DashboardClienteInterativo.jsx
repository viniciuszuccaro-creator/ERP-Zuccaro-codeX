import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ShoppingBag, Truck, DollarSign, FileText, Clock, 
  CheckCircle2, Package, TrendingUp, AlertCircle, Loader2,
  Target, RefreshCw, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/lib/UserContext";
import { format } from "date-fns";
import { resolvePortalSessionState } from "@/components/lib/portalClientePolicy";

/**
 * V21.5 - Dashboard Interativo COMPLETO com Tempo Real
 * ✅ Status de pedidos em tempo real (15s refresh)
 * ✅ Rastreamento de entregas atualizado (10s refresh)
 * ✅ Timeline de atividades
 * ✅ Métricas dinâmicas e KPIs visuais
 * ✅ Oportunidades em tempo real
 * ✅ Alertas inteligentes
 * ✅ 100% Responsivo w-full h-full
 */
export default function DashboardClienteInterativo() {
  const { user, isLoading: authLoading, error: authError } = useUser();
  const startedAtRef = React.useRef(Date.now());
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const vinculoQuery = useQuery({
    queryKey: ['cliente-portal', user?.id],
    queryFn: async () => {
      const clientes = await base44.entities.Cliente.filter({ portal_usuario_id: user.id });
      return clientes[0] || null;
    },
    enabled: !!user?.id && !authLoading,
    refetchInterval: 30000
  });
  const session = resolvePortalSessionState({
    authLoading,
    authError,
    user,
    vinculoLoading: vinculoQuery.isLoading,
    vinculoFetched: vinculoQuery.isFetched,
    vinculoError: vinculoQuery.error,
    vinculoCliente: vinculoQuery.data || null,
    elapsedMs: Date.now() - startedAtRef.current,
  });
  const cliente = session.state === 'pronto' ? session.cliente : null;

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-dashboard', cliente?.id],
    queryFn: () => base44.entities.Pedido.filter({ 
      cliente_id: cliente.id,
      pode_ver_no_portal: true 
    }, '-data_pedido', 50),
    enabled: !!cliente?.id,
    refetchInterval: 15000 // Tempo real
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-dashboard', cliente?.id],
    queryFn: () => base44.entities.Entrega.filter({ cliente_id: cliente.id }, '-created_date', 20),
    enabled: !!cliente?.id,
    refetchInterval: 10000 // Tempo real
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-dashboard', cliente?.id],
    queryFn: () => base44.entities.ContaReceber.filter({ cliente_id: cliente.id }),
    enabled: !!cliente?.id
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos-dashboard', cliente?.id],
    queryFn: () => base44.entities.OrcamentoCliente.filter({ 
      cliente_id: cliente.id,
      status: 'Pendente' 
    }),
    enabled: !!cliente?.id
  });

  const { data: oportunidades = [] } = useQuery({
    queryKey: ['oportunidades-dashboard', cliente?.id],
    queryFn: async () => {
      if (!cliente?.id) return [];
      return await base44.entities.Oportunidade.filter(
        { cliente_id: cliente.id },
        '-data_abertura',
        10
      );
    },
    enabled: !!cliente?.id,
    refetchInterval: 30000
  });

  if (session.state !== 'pronto' || !cliente) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full h-full p-6" data-portal-state={session.state}>
        <div className="text-center space-y-2">
          {['autenticando', 'vinculando', 'carregando'].includes(session.state)
            ? <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
            : <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />}
          <p className="font-semibold text-slate-900">{session.title}</p>
          <p className="text-sm text-slate-600">{session.message}</p>
        </div>
      </div>
    );
  }

  // Métricas
  const pedidosAtivos = pedidos.filter(p => !['Entregue', 'Cancelado'].includes(p.status));
  const entregasAndamento = entregas.filter(e => ['Saiu para Entrega', 'Em Trânsito'].includes(e.status));
  const contasAbertas = contasReceber.filter(c => c.status === 'Pendente');
  const contasAtrasadas = contasAbertas.filter(c => new Date(c.data_vencimento) < new Date());

  // Timeline de atividades recentes
  const atividadesRecentes = [
    ...pedidos.slice(0, 3).map(p => ({
      tipo: 'pedido',
      data: p.data_pedido,
      titulo: `Pedido ${p.numero_pedido}`,
      status: p.status,
      descricao: `${p.status} - R$ ${p.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    })),
    ...entregas.slice(0, 3).map(e => ({
      tipo: 'entrega',
      data: e.created_date,
      titulo: `Entrega ${e.numero_pedido}`,
      status: e.status,
      descricao: e.status
    }))
  ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);

  const getStatusColor = (status) => {
    const cores = {
      'Aprovado': 'bg-blue-100 text-blue-700',
      'Em Produção': 'bg-purple-100 text-purple-700',
      'Faturado': 'bg-cyan-100 text-cyan-700',
      'Em Trânsito': 'bg-orange-100 text-orange-700',
      'Entregue': 'bg-green-100 text-green-700',
      'Saiu para Entrega': 'bg-orange-100 text-orange-700',
      'Pendente': 'bg-yellow-100 text-yellow-700'
    };
    return cores[status] || 'bg-slate-100 text-slate-700';
  };

  const oportunidadesAbertas = oportunidades.filter(o => 
    o.status !== 'Ganho' && o.status !== 'Perdido' && o.status !== 'Cancelado'
  );

  const valorPipelineTotal = oportunidadesAbertas.reduce((sum, o) => sum + (o.valor_estimado || 0), 0);

  return (
    <div className="space-y-6 w-full h-full">
      {/* Saudação + Auto-Refresh */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-xl p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              Olá, {cliente.nome || user?.full_name}! 👋
            </h1>
            <p className="text-blue-100 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Dados atualizados em tempo real
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
            className="bg-white/20 hover:bg-white/30 text-white border-0"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {contasAtrasadas.length > 0 && (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">
                  {contasAtrasadas.length} conta(s) em atraso
                </p>
                <p className="text-sm text-red-700">
                  Regularize para continuar comprando
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {orcamentos.length > 0 && (
        <Card className="border-2 border-orange-300 bg-orange-50 animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900">
                  {orcamentos.length} orçamento(s) aguardando aprovação
                </p>
                <p className="text-sm text-orange-700">
                  Clique em "Orçamentos" para aprovar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Métricas - 100% Responsivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-slate-600 mb-1">Pedidos Ativos</p>
            <p className="text-4xl font-bold text-blue-600">{pedidosAtivos.length}</p>
            <p className="text-xs text-slate-500 mt-2">
              Total: {pedidos.length} pedidos
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
              {entregasAndamento.length > 0 && (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            <p className="text-sm text-slate-600 mb-1">Em Entrega</p>
            <p className="text-4xl font-bold text-green-600">{entregasAndamento.length}</p>
            <p className="text-xs text-slate-500 mt-2">
              Rastreamento em tempo real
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              {contasAtrasadas.length > 0 && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
            <p className="text-sm text-slate-600 mb-1">Contas Abertas</p>
            <p className="text-4xl font-bold text-orange-600">{contasAbertas.length}</p>
            <p className="text-xs text-slate-500 mt-2">
              {contasAtrasadas.length > 0 ? `${contasAtrasadas.length} em atraso` : 'Tudo em dia'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              {orcamentos.length > 0 && (
                <Clock className="w-5 h-5 text-orange-500 animate-pulse" />
              )}
            </div>
            <p className="text-sm text-slate-600 mb-1">Orçamentos</p>
            <p className="text-4xl font-bold text-purple-600">{orcamentos.length}</p>
            <p className="text-xs text-slate-500 mt-2">
              Aguardando aprovação
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-slate-600 mb-1">Oportunidades</p>
            <p className="text-4xl font-bold text-indigo-600">{oportunidadesAbertas.length}</p>
            <p className="text-xs text-slate-500 mt-2">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorPipelineTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Pedidos + Timeline - 100% Responsivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Pedidos em Andamento */}
        <Card className="shadow-lg w-full h-full">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-blue-600" />
              Pedidos em Andamento
              <Badge className="ml-auto bg-blue-600 text-white">{pedidosAtivos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 w-full h-full">
            <div className="space-y-3 max-h-[400px] overflow-y-auto w-full">
              {pedidosAtivos.slice(0, 5).map(pedido => {
                const progressMap = {
                  'Aprovado': 25,
                  'Em Produção': 50,
                  'Faturado': 75,
                  'Em Trânsito': 90,
                  'Entregue': 100
                };
                const progress = progressMap[pedido.status] || 10;

                return (
                  <Card key={pedido.id} className="border-2 border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg">{pedido.numero_pedido}</p>
                          <p className="text-xs text-slate-600">
                            {format(new Date(pedido.data_pedido), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <Badge className={getStatusColor(pedido.status)}>
                          {pedido.status}
                        </Badge>
                      </div>

                      <Progress value={progress} className="mb-2 h-2" />

                      <div className="flex justify-between items-center text-sm">
                        <p className="text-slate-600">{progress}% concluído</p>
                        <p className="font-semibold text-green-600">
                          R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {pedidosAtivos.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum pedido ativo</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline de Atividades */}
        <Card className="shadow-lg w-full h-full">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-green-600" />
              Atividades Recentes
              <div className="ml-auto w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 w-full h-full">
            <div className="space-y-4 max-h-[400px] overflow-y-auto w-full">
              {atividadesRecentes.map((atividade, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      atividade.tipo === 'pedido' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {atividade.tipo === 'pedido' ? (
                        <ShoppingBag className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Truck className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {idx < atividadesRecentes.length - 1 && (
                      <div className="w-0.5 h-full bg-slate-200 mt-2" />
                    )}
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-sm">{atividade.titulo}</p>
                      <Badge className={getStatusColor(atividade.status)}>
                        {atividade.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">{atividade.descricao}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(atividade.data), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}

              {atividadesRecentes.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma atividade recente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entregas em Tempo Real */}
      {entregasAndamento.length > 0 && (
        <Card className="border-2 border-green-300 bg-green-50 shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="w-5 h-5 text-green-600" />
              Entregas em Tempo Real
              <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <Badge className="ml-auto bg-green-600 text-white">
                {entregasAndamento.length} ativa(s)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid md:grid-cols-2 gap-4">
              {entregasAndamento.map(entrega => (
                <Card key={entrega.id} className="border-2 border-green-200 bg-white">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <p className="font-bold">{entrega.numero_pedido}</p>
                      <Badge className="bg-green-600 text-white">
                        {entrega.status}
                      </Badge>
                    </div>

                    {entrega.codigo_rastreamento && (
                      <div className="p-2 bg-slate-50 rounded border mb-3">
                        <p className="text-xs text-slate-600">Rastreamento:</p>
                        <p className="font-mono text-sm font-semibold">
                          {entrega.codigo_rastreamento}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <p>Atualização em tempo real</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}