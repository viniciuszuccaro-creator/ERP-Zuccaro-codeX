import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  Bolt, 
  TrendingUp, 
  ShoppingCart, 
  CheckCircle, 
  AlertCircle,
  Activity,
  Download
} from "lucide-react";
import ExportButton from "@/components/ExportButton";
import { base44 } from "@/api/base44Client";
import {
  CANAIS_ORIGEM_PEDIDOS_SOFT_LIMIT,
  formatCanaisOrigemKpiDisplay,
  isCappedListUnreliable,
} from "@/components/lib/dashboardKpiPolicy";

/**
 * Dashboard de Canais de Origem de Pedidos V21.6
 * Visualiza performance, conversão e volume por canal
 */
export default function DashboardCanaisOrigem({ empresaId, windowMode = false }) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaSelecionadaId = empresaId || empresaAtual?.id || null;
  const contextKey = empresaSelecionadaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewDashboard = hasPermission('Comercial', 'Relatorios', 'visualizar') ||
    hasPermission('Comercial', 'Pedidos', 'visualizar') ||
    hasPermission('Comercial', null, 'visualizar');
  const canExportDashboard = hasPermission('Comercial', 'Relatorios', 'exportar') ||
    hasPermission('Comercial', 'Pedidos', 'exportar') ||
    hasPermission('Comercial', null, 'exportar');

  const auditDashboardCanais = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Comercial',
        entidade: 'DashboardCanaisOrigem',
        tipo_auditoria: sucesso ? 'relatorio' : 'seguranca',
        descricao: motivo || 'Auditoria do dashboard de canais de origem.',
        dados_novos: detalhes,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaSelecionadaId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar dashboard de canais de origem:', error);
    }
  };
  
  // Buscar parâmetros de origem (sem initialData [] — lista vazia ≠ zero confirmado em KPI).
  const {
    data: parametros,
    isPending: loadingParametros,
    isError: errorParametros,
  } = useQuery({
    queryKey: ['parametros-origem-pedido', contextKey],
    queryFn: () => filterInContext('ParametroOrigemPedido', {}, 'canal', 500),
    enabled: contextoValido && canViewDashboard,
  });

  // Buscar pedidos para análise (amostra ≤ soft limit — total autoritativo exige count).
  const {
    data: pedidos,
    isPending: loadingPedidos,
    isError: errorPedidos,
  } = useQuery({
    queryKey: ['pedidos-canais-origem', contextKey],
    queryFn: () => filterInContext('Pedido', empresaSelecionadaId ? { empresa_id: empresaSelecionadaId } : {}, '-created_date', CANAIS_ORIGEM_PEDIDOS_SOFT_LIMIT),
    enabled: contextoValido && canViewDashboard,
  });

  // Sem permissão/contexto: não vazar cache React Query (Casa P1) — listas vazias na UI.
  const contentAllowed = Boolean(contextoValido && canViewDashboard);
  const parametrosList = contentAllowed && Array.isArray(parametros) ? parametros : [];
  const pedidosList = contentAllowed && Array.isArray(pedidos) ? pedidos : [];
  const pedidosCapped = isCappedListUnreliable(pedidosList, CANAIS_ORIGEM_PEDIDOS_SOFT_LIMIT);
  const pedidosUnavailable = !contentAllowed || errorPedidos || pedidosCapped;
  const metricsBlocked = !contentAllowed
    || errorParametros
    || errorPedidos
    || pedidosCapped;

  // Calcular métricas por canal
  const calcularMetricas = () => {
    const metricas = {};

    parametrosList.forEach(param => {
      const pedidosCanal = pedidosUnavailable
        ? []
        : pedidosList.filter(p => {
        // Mapear origem_pedido para canal
        const origemMap = {
          'Manual': 'ERP',
          'Site': 'Site',
          'E-commerce': 'E-commerce',
          'Chatbot': 'Chatbot',
          'WhatsApp': 'WhatsApp',
          'Portal': 'Portal Cliente',
          'Marketplace': 'Marketplace',
          'API': 'API',
          'App': 'App Mobile'
        };
        
        const canalPedido = origemMap[p.origem_pedido] || p.origem_pedido;
        return canalPedido === param.canal;
      });

      const totalPedidos = pedidosUnavailable ? null : pedidosCanal.length;
      const valorTotal = pedidosUnavailable ? null : pedidosCanal.reduce((sum, p) => sum + (p.valor_total || 0), 0);
      const pedidosAprovados = pedidosUnavailable
        ? null
        : pedidosCanal.filter(p => 
          p.status === 'Aprovado' || p.status === 'Faturado' || p.status === 'Entregue'
        ).length;
      const taxaConversao = (typeof totalPedidos === 'number' && totalPedidos > 0)
        ? (pedidosAprovados / totalPedidos) * 100
        : (pedidosUnavailable ? null : 0);
      const ticketMedio = (typeof totalPedidos === 'number' && totalPedidos > 0)
        ? valorTotal / totalPedidos
        : (pedidosUnavailable ? null : 0);

      metricas[param.canal] = {
        nome: param.nome,
        canal: param.canal,
        tipo: param.tipo_criacao,
        cor: param.cor_badge,
        ativo: param.ativo,
        totalPedidos,
        valorTotal,
        pedidosAprovados,
        taxaConversao,
        ticketMedio,
        pedidosUnavailable,
      };
    });

    return metricas;
  };

  const metricas = calcularMetricas();
  const canaisAtivos = Object.values(metricas).filter(m => m.ativo);
  const totalGeralPedidos = pedidosUnavailable
    ? null
    : canaisAtivos.reduce((sum, m) => sum + (Number(m.totalPedidos) || 0), 0);
  const totalGeralValor = pedidosUnavailable
    ? null
    : canaisAtivos.reduce((sum, m) => sum + (Number(m.valorTotal) || 0), 0);
  const canaisAtivosDisplay = formatCanaisOrigemKpiDisplay({ blocked: metricsBlocked, value: canaisAtivos.length });
  const totalPedidosDisplay = formatCanaisOrigemKpiDisplay({ blocked: metricsBlocked, value: totalGeralPedidos });
  const valorTotalDisplay = formatCanaisOrigemKpiDisplay({
    blocked: metricsBlocked,
    value: totalGeralValor,
    format: (n) => `R$ ${(n / 1000).toFixed(0)}k`,
  });
  const taxaConversaoDisplay = formatCanaisOrigemKpiDisplay({
    blocked: metricsBlocked || pedidosUnavailable,
    value: !pedidosUnavailable && canaisAtivos.length > 0
      ? canaisAtivos.reduce((sum, m) => sum + (Number(m.taxaConversao) || 0), 0) / canaisAtivos.length
      : (pedidosUnavailable ? null : 0),
    format: (n) => `${n.toFixed(0)}%`,
  });

  // Dados para gráficos — sem cache/erro: não inventar série com zeros falsos.
  const dadosBarras = pedidosUnavailable
    ? []
    : Object.values(metricas)
      .filter(m => Number(m.totalPedidos) > 0)
      .sort((a, b) => b.totalPedidos - a.totalPedidos)
      .slice(0, 8);

  const dadosPizza = pedidosUnavailable
    ? []
    : Object.values(metricas)
      .filter(m => Number(m.totalPedidos) > 0)
      .map(m => ({
        name: m.canal,
        value: m.totalPedidos
      }));

  const dadosExportacao = (!contentAllowed || pedidosUnavailable)
    ? []
    : Object.values(metricas).map(m => ({
      Canal: m.nome,
      Tipo: m.tipo,
      Ativo: m.ativo ? 'Sim' : 'Nao',
      'Total Pedidos': m.totalPedidos,
      'Valor Total': m.valorTotal,
      'Pedidos Aprovados': m.pedidosAprovados,
      'Taxa Conversao (%)': Number(m.taxaConversao).toFixed(2),
      'Ticket Medio': Number(m.ticketMedio).toFixed(2),
      group_id: groupId || '',
      grupo_id: groupId || '',
      empresa_id: empresaSelecionadaId || '',
    }));

  const beforeExportDashboard = async (formato) => {
    if (!contextoValido || !canExportDashboard) {
      await auditDashboardCanais({
        acao: 'DashboardCanaisOrigem.exportar_bloqueado',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        detalhes: { formato, linhas: dadosExportacao.length },
      });
      return false;
    }

    const confirmado = window.confirm(`Confirma exportar ${dadosExportacao.length} canais de origem em ${String(formato).toUpperCase()}?`);
    if (!confirmado) {
      await auditDashboardCanais({
        acao: 'DashboardCanaisOrigem.exportar_cancelado',
        sucesso: false,
        motivo: 'confirmacao_cancelada',
        detalhes: { formato, linhas: dadosExportacao.length },
      });
      return false;
    }

    await auditDashboardCanais({
      acao: 'DashboardCanaisOrigem.exportar',
      detalhes: {
        formato,
        linhas: dadosExportacao.length,
        totalPedidos: totalGeralPedidos,
        valorTotal: totalGeralValor,
      },
    });
    return true;
  };
  const CORES = {
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#a855f7',
    orange: '#f97316',
    red: '#ef4444',
    yellow: '#eab308',
    pink: '#ec4899',
    cyan: '#06b6d4'
  };

  const containerClass = windowMode 
    ? "w-full h-full flex flex-col overflow-hidden" 
    : "space-y-6";

  // Query desabilitada fica isPending sem fetch — só spin quando há consulta ativa.
  const queriesEnabled = contextoValido && canViewDashboard;
  const isLoading = queriesEnabled && (loadingParametros || loadingPedidos);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-block="canais-origem-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div
      className={containerClass}
      data-permission="Comercial.Relatorios.visualizar"
      data-context-required="group-or-company"
    >
      <div className={windowMode ? "flex-1 overflow-auto p-6" : ""}>
        {(!contextoValido || !canViewDashboard) && (
          <Alert className="mb-4 border-amber-300 bg-amber-50" data-block="canais-origem-contexto-bloqueado">
            <AlertDescription>
              Selecione grupo ou empresa e confirme permissao para visualizar canais de origem.
            </AlertDescription>
          </Alert>
        )}
        {(errorParametros || errorPedidos) && (
          <Alert className="mb-4 border-amber-300 bg-amber-50" data-block="canais-origem-consulta-indisponivel">
            <AlertDescription>
              Contagem/amostra indisponível (erro de consulta — não é zero confirmado).
            </AlertDescription>
          </Alert>
        )}
        {pedidosCapped && (
          <Alert className="mb-4 border-amber-300 bg-amber-50" data-block="canais-origem-amostra-capada">
            <AlertDescription>
              Amostra de pedidos no soft limit ({CANAIS_ORIGEM_PEDIDOS_SOFT_LIMIT}) — totais do card indisponíveis (≠ zero).
            </AlertDescription>
          </Alert>
        )}
        
        {/* KPIs Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" data-block="canais-origem-kpis">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Canais Ativos</p>
                  <p className="text-2xl font-bold text-blue-600" data-kpi="canais-ativos">{canaisAtivosDisplay}</p>
                </div>
                <Bolt className="w-8 h-8 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Total Pedidos</p>
                  <p className="text-2xl font-bold text-green-600" data-kpi="total-pedidos">{totalPedidosDisplay}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Valor Total</p>
                  <p className="text-2xl font-bold text-sky-600" data-kpi="valor-total">
                    {valorTotalDisplay}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-sky-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Taxa Conversão Média</p>
                  <p className="text-2xl font-bold text-orange-600" data-kpi="taxa-conversao">
                    {taxaConversaoDisplay}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Performance por Canal */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Performance por Canal
              </CardTitle>
              <ExportButton
                data={dadosExportacao}
                filename="performance-canais-origem"
                className="bg-green-600 hover:bg-green-700"
                disabled={!contextoValido || !canExportDashboard}
                onBeforeExport={beforeExportDashboard}
                data-action="DashboardCanaisOrigem.exportar"
                data-permission="Comercial.Relatorios.exportar"
                data-context-required="group-or-company"
                data-sensitive="true"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </ExportButton>
            </div>
          </CardHeader>
          <CardContent>
            {!contentAllowed ? (
              <p className="text-sm text-slate-600" data-block="canais-origem-performance-bloqueada" role="status">
                Performance por canal oculta sem contexto/permissão (cache não é exibido).
              </p>
            ) : pedidosUnavailable ? (
              <p className="text-sm text-amber-800" data-block="canais-origem-performance-indisponivel" role="status">
                Pedidos indisponíveis nesta amostra — linhas de volume não confirmadas (≠ zero).
              </p>
            ) : (
            <div className="space-y-3" data-block="canais-origem-performance-lista">
              {Object.values(metricas)
                .sort((a, b) => (Number(b.totalPedidos) || 0) - (Number(a.totalPedidos) || 0))
                .map((metrica, idx) => {
                  const participacao = totalGeralPedidos > 0 
                    ? (metrica.totalPedidos / totalGeralPedidos) * 100 
                    : 0;
                  const pedidosDisplay = formatCanaisOrigemKpiDisplay({
                    blocked: metrica.pedidosUnavailable,
                    value: metrica.totalPedidos,
                  });
                  const valorDisplay = formatCanaisOrigemKpiDisplay({
                    blocked: metrica.pedidosUnavailable,
                    value: metrica.valorTotal,
                    format: (n) => `R$ ${(n / 1000).toFixed(1)}k`,
                  });
                  const conversaoDisplay = formatCanaisOrigemKpiDisplay({
                    blocked: metrica.pedidosUnavailable,
                    value: metrica.taxaConversao,
                    format: (n) => `${n.toFixed(0)}%`,
                  });
                  const ticketDisplay = formatCanaisOrigemKpiDisplay({
                    blocked: metrica.pedidosUnavailable,
                    value: metrica.ticketMedio,
                    format: (n) => `R$ ${n.toFixed(0)}`,
                  });

                  return (
                    <div key={idx} className="p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-3 h-3 rounded-full`} 
                            style={{ backgroundColor: CORES[metrica.cor] || '#3b82f6' }}
                          />
                          <div>
                            <p className="font-semibold text-slate-900">{metrica.nome}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{metrica.tipo}</Badge>
                              {metrica.ativo ? (
                                <Badge className="bg-green-100 text-green-700 text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-700 text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Inativo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-6 text-right">
                          <div>
                            <p className="text-xs text-slate-600">Pedidos</p>
                            <p className="text-lg font-bold text-blue-600" data-kpi="canal-pedidos">{pedidosDisplay}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Valor Total</p>
                            <p className="text-lg font-bold text-green-600" data-kpi="canal-valor">
                              {valorDisplay}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Conversão</p>
                            <p className="text-lg font-bold text-sky-600" data-kpi="canal-conversao">
                              {conversaoDisplay}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Ticket Médio</p>
                            <p className="text-lg font-bold text-orange-600" data-kpi="canal-ticket">
                              {ticketDisplay}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>Participação</span>
                          <span>{pedidosUnavailable ? '—' : `${participacao.toFixed(1)}%`}</span>
                        </div>
                        <Progress value={pedidosUnavailable ? 0 : participacao} className="h-2" />
                      </div>
                    </div>
                  );
                })}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico de Barras - Volume por Canal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volume de Pedidos por Canal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosBarras}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="canal" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="totalPedidos" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza - Distribuição */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosPizza}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosPizza.map((entry, index) => {
                      const metrica = Object.values(metricas).find(m => m.canal === entry.name);
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={CORES[metrica?.cor] || '#3b82f6'} 
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Ranking de Conversão */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🏆 Ranking de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.values(metricas)
                  .filter(m => m.totalPedidos > 0)
                  .sort((a, b) => b.taxaConversao - a.taxaConversao)
                  .slice(0, 5)
                  .map((metrica, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-slate-300 w-8">
                        {idx + 1}º
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{metrica.nome}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={metrica.taxaConversao} className="flex-1 h-2" />
                          <span className="text-sm font-bold text-green-600">
                            {metrica.taxaConversao.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Ticket Médio por Canal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">💰 Ticket Médio por Canal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart 
                  data={Object.values(metricas)
                    .filter(m => m.totalPedidos > 0)
                    .sort((a, b) => b.ticketMedio - a.ticketMedio)}
                  layout="horizontal"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="canal" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `R$ ${typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'}`} />
                  <Bar dataKey="ticketMedio" fill="#a855f7" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Insights IA */}
        <Card className="mt-6 border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bolt className="w-5 h-5 text-sky-600" />
              💡 Insights Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const insights = [];
              
              // Canal com maior conversão
              const melhorConversao = Object.values(metricas)
                .filter(m => m.totalPedidos > 0)
                .sort((a, b) => b.taxaConversao - a.taxaConversao)[0];
              
              if (melhorConversao) {
                insights.push({
                  tipo: 'success',
                  texto: `🏆 Canal com melhor conversão: ${melhorConversao.nome} (${melhorConversao.taxaConversao.toFixed(0)}%)`
                });
              }

              // Canal com maior volume
              const maiorVolume = Object.values(metricas)
                .sort((a, b) => b.totalPedidos - a.totalPedidos)[0];
              
              if (maiorVolume && maiorVolume.totalPedidos > 0) {
                insights.push({
                  tipo: 'info',
                  texto: `📊 Canal com maior volume: ${maiorVolume.nome} (${maiorVolume.totalPedidos} pedidos)`
                });
              }

              // Canal com maior ticket médio
              const maiorTicket = Object.values(metricas)
                .filter(m => m.totalPedidos > 0)
                .sort((a, b) => b.ticketMedio - a.ticketMedio)[0];
              
              if (maiorTicket) {
                insights.push({
                  tipo: 'success',
                  texto: `💰 Maior ticket médio: ${maiorTicket.nome} (R$ ${maiorTicket.ticketMedio.toFixed(2)})`
                });
              }

              // Canais inativos
              const canaisInativos = parametrosList.filter(p => !p.ativo).length;
              if (canaisInativos > 0) {
                insights.push({
                  tipo: 'warning',
                  texto: `⚠️ ${canaisInativos} canal(is) inativo(s) - considere ativar para aumentar vendas`
                });
              }

              // Oportunidade de automação
              const canaisManuais = Object.values(metricas)
                .filter(m => m.tipo === 'Manual' && m.totalPedidos > 5);
              
              if (canaisManuais.length > 0) {
                insights.push({
                  tipo: 'info',
                  texto: `🤖 Oportunidade: ${canaisManuais.length} canal(is) manual(is) com volume alto - considere automação`
                });
              }

              return insights.map((insight, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    insight.tipo === 'success' ? 'bg-green-50 border-green-200' :
                    insight.tipo === 'warning' ? 'bg-orange-50 border-orange-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <p className="text-sm text-slate-700">{insight.texto}</p>
                </div>
              ));
            })()}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
