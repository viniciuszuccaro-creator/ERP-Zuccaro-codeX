import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
  Factory, 
  TrendingUp, 
  AlertTriangle, 
  Clock,
  Package,
  Activity,
  Zap,
  Target
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from "@/components/lib/usePermissions";

/**
 * ETAPA 5: DASHBOARD PRODUÇÃO TEMPO REAL V21.4
 * Consolidação e melhoria do módulo de produção
 */

function DashboardProducaoRealtime({ empresaId, windowMode = false }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaOperacionalId = empresaId || empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(groupId || empresaOperacionalId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaOperacionalId || "sem-empresa"}`;
  const canViewDashboard = hasPermission("Produção", "Dashboard", "visualizar") ||
    hasPermission("Produção", "Dashboard", "ver") ||
    hasPermission("Produção", null, "visualizar") ||
    hasPermission("Producao", "Dashboard", "visualizar") ||
    hasPermission("Producao", null, "visualizar");
  const [metricas, setMetricas] = useState({
    eficienciaGeral: 0,
    opsAtrasadas: 0,
    pesoProducaoHoje: 0,
    tempoMedioProducao: 0,
    taxaRefugo: 0,
    oee: 0
  });

  const { data: ops = [] } = useQuery({
    queryKey: ['ordens-producao-dashboard', contextKey],
    queryFn: () => filterInContext('OrdemProducao', {}, '-created_date', 500),
    enabled: contextoValido && canViewDashboard,
  });

  const { data: apontamentos = [] } = useQuery({
    queryKey: ['apontamentos-producao-dashboard', contextKey],
    queryFn: () => filterInContext('ApontamentoProducao', {}, '-created_date', 500),
    enabled: contextoValido && canViewDashboard,
  });

  // Calcular métricas em tempo real
  useEffect(() => {
    if (ops.length > 0) {
      const opsAtivas = ops.filter(op => !['Concluída', 'Cancelada'].includes(op.status));
      const opsAtrasadas = opsAtivas.filter(op => {
        if (!op.data_previsao_conclusao) return false;
        return new Date(op.data_previsao_conclusao) < new Date();
      }).length;

      const hoje = new Date().toISOString().split('T')[0];
      const apontamentosHoje = apontamentos.filter(a => a.data_hora_inicio?.startsWith(hoje));
      const pesoHoje = apontamentosHoje.reduce((sum, a) => sum + (a.peso_produzido_kg || 0), 0);

      const temposProducao = apontamentos.map(a => a.tempo_total_minutos || 0).filter(t => t > 0);
      const tempoMedio = temposProducao.length > 0 
        ? temposProducao.reduce((a, b) => a + b, 0) / temposProducao.length 
        : 0;

      const totalProduzido = apontamentos.reduce((sum, a) => sum + (a.peso_produzido_kg || 0), 0);
      const totalRefugo = apontamentos.reduce((sum, a) => sum + (a.peso_refugo_kg || 0), 0);
      const taxaRefugo = totalProduzido > 0 ? (totalRefugo / totalProduzido) * 100 : 0;

      const eficiencia = opsAtivas.length > 0
        ? (opsAtivas.filter(op => (op.progresso_fisico_percentual || 0) >= 80).length / opsAtivas.length) * 100
        : 0;

      // OEE simplificado (Overall Equipment Effectiveness)
      const disponibilidade = 85; // Mock - seria calculado com dados reais de máquinas
      const performance = eficiencia;
      const qualidade = 100 - taxaRefugo;
      const oee = (disponibilidade * performance * qualidade) / 10000;

      setMetricas({
        eficienciaGeral: eficiencia.toFixed(1),
        opsAtrasadas,
        pesoProducaoHoje: pesoHoje.toFixed(2),
        tempoMedioProducao: tempoMedio.toFixed(0),
        taxaRefugo: taxaRefugo.toFixed(2),
        oee: oee.toFixed(1)
      });
    }
  }, [ops, apontamentos]);

  // Dados para gráficos
  const dadosProducaoPorStatus = [
    { status: 'Planejada', qtd: ops.filter(op => op.status === 'Planejada').length },
    { status: 'Em Corte', qtd: ops.filter(op => op.status === 'Em Corte').length },
    { status: 'Em Dobra', qtd: ops.filter(op => op.status === 'Em Dobra').length },
    { status: 'Inspeção', qtd: ops.filter(op => op.status === 'Inspeção').length },
    { status: 'Pronto', qtd: ops.filter(op => op.status === 'Pronto para Expedição').length },
    { status: 'Concluída', qtd: ops.filter(op => op.status === 'Concluída').length }
  ];

  const COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#22c55e'];

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "w-full h-full space-y-6";

  if (!contextoValido || !canViewDashboard) {
    return (
      <div className={containerClass} data-permission="Producao.Dashboard.visualizar" data-context-required="true">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 flex items-center gap-3 text-amber-800">
            <AlertTriangle className="w-5 h-5" />
            <span>{!contextoValido ? "Selecione um grupo ou empresa para visualizar o dashboard de produção." : "Seu perfil não possui permissão para visualizar o dashboard de produção."}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={containerClass} data-permission="Producao.Dashboard.visualizar" data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1 overflow-auto" : "space-y-6"}>
      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Eficiência Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${metricas.eficienciaGeral >= 80 ? 'text-green-600' : 'text-yellow-600'}`} />
              <span className="text-2xl font-bold">{metricas.eficienciaGeral}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">OPs Atrasadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{metricas.opsAtrasadas}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Produção Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">{metricas.pesoProducaoHoje}</span>
              <span className="text-sm text-slate-600">kg</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Tempo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <span className="text-2xl font-bold">{metricas.tempoMedioProducao}</span>
              <span className="text-sm text-slate-600">min</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Taxa Refugo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${metricas.taxaRefugo <= 3 ? 'text-green-600' : 'text-red-600'}`} />
              <span className="text-2xl font-bold">{metricas.taxaRefugo}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">OEE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className={`w-5 h-5 ${metricas.oee >= 75 ? 'text-green-600' : 'text-yellow-600'}`} />
              <span className="text-2xl font-bold">{metricas.oee}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosProducaoPorStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, qtd }) => `${status}: ${qtd}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="qtd"
                >
                  {dadosProducaoPorStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">OPs por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosProducaoPorStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qtd" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas em tempo real */}
      <Card className="border-red-200">
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            Alertas e Gargalos Detectados (IA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metricas.opsAtrasadas > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Alto</Badge>
                  <span className="font-medium">{metricas.opsAtrasadas} OPs com atraso detectado</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Ação sugerida: Repriorizar recursos para OPs críticas
                </p>
              </div>
            )}
            
            {metricas.taxaRefugo > 3 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-600">Médio</Badge>
                  <span className="font-medium">Taxa de refugo acima da meta ({metricas.taxaRefugo}%)</span>
                </div>
                <p className="text-sm text-orange-600 mt-1">
                  Ação sugerida: Revisar processos de qualidade e treinamento
                </p>
              </div>
            )}

            {metricas.oee < 75 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-600">Baixo</Badge>
                  <span className="font-medium">OEE abaixo do ideal ({metricas.oee}%)</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  Ação sugerida: Analisar disponibilidade de equipamentos e setup
                </p>
              </div>
            )}

            {metricas.opsAtrasadas === 0 && metricas.taxaRefugo <= 3 && metricas.oee >= 75 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-center">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">Produção operando dentro dos padrões!</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
export default React.memo(DashboardProducaoRealtime);
