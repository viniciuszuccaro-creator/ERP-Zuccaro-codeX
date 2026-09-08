import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Zap, Clock, Package, Truck, CheckCircle2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import {
  buildDashboardQueryKey,
  resolveMetaOperacional,
  DASHBOARD_REALTIME_LIMIT,
} from "@/components/lib/dashboardKpiPolicy";

/**
 * Painel de métricas em tempo real (logística).
 * Escopo por grupo/empresa; meta derivada do dia (fail-closed sem contexto).
 */
export default function PainelMetricasRealtime({ windowMode = false }) {
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());
  const { empresaAtual, grupoAtual, estaNoGrupo, filterInContext } = useContextoVisual();
  const { hasPermission, user } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo ? "grupo" : "empresa";
  const contextoValido = Boolean(groupId && (scopeType === "grupo" || empresaId));
  const canView =
    hasPermission("Dashboard", null, "visualizar") ||
    hasPermission("Dashboard", null, "ver") ||
    hasPermission("Expedição", null, "visualizar") ||
    hasPermission("Expedição", null, "ver") ||
    hasPermission("Logística", null, "visualizar") ||
    hasPermission("Logística", null, "ver");
  const contextKey = buildDashboardQueryKey({
    prefix: "painel-metricas",
    userId: user?.id || user?.email,
    groupId,
    empresaId,
    scopeType,
  });

  const { data: pedidos = [], refetch: refetchPedidos } = useQuery({
    queryKey: ["painel-metricas-pedidos", ...contextKey],
    queryFn: () => filterInContext("Pedido", {}, "-created_date", DASHBOARD_REALTIME_LIMIT),
    refetchInterval: 30000,
    enabled: contextoValido && canView,
  });

  const { data: entregas = [], refetch: refetchEntregas } = useQuery({
    queryKey: ["painel-metricas-entregas", ...contextKey],
    queryFn: () => filterInContext("Entrega", {}, "-created_date", DASHBOARD_REALTIME_LIMIT),
    refetchInterval: 30000,
    enabled: contextoValido && canView,
  });

  useEffect(() => {
    if (!contextoValido || !canView) return undefined;
    const interval = setInterval(() => {
      setUltimaAtualizacao(new Date());
      refetchPedidos();
      refetchEntregas();
    }, 30000);

    return () => clearInterval(interval);
  }, [contextoValido, canView, refetchPedidos, refetchEntregas]);

  const metricasHoje = useMemo(() => {
    const empty = {
      pedidosAprovados: 0,
      emExpedicao: 0,
      emTransito: 0,
      entreguesHoje: 0,
      ocorrenciasHoje: 0,
      prontosFaturar: 0,
      valorEmTransito: 0,
    };
    if (!contextoValido || !canView) return empty;

    const hoje = new Date();
    const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    return {
      pedidosAprovados: pedidos.filter(
        (p) => p.status === "Aprovado" && new Date(p.updated_date) >= inicioDoDia
      ).length,
      emExpedicao: pedidos.filter((p) => p.status === "Em Expedição").length,
      emTransito: pedidos.filter((p) => p.status === "Em Trânsito").length,
      entreguesHoje: pedidos.filter(
        (p) => p.status === "Entregue" && new Date(p.updated_date) >= inicioDoDia
      ).length,
      ocorrenciasHoje: entregas.filter((e) =>
        e.ocorrencias?.some((o) => new Date(o.data_hora) >= inicioDoDia)
      ).length,
      prontosFaturar: pedidos.filter((p) => p.status === "Pronto para Faturar").length,
      valorEmTransito: pedidos
        .filter((p) => p.status === "Em Trânsito")
        .reduce((sum, p) => sum + (p.valor_total || 0), 0),
    };
  }, [contextoValido, canView, pedidos, entregas]);

  const meta = resolveMetaOperacional({
    entregasHoje: metricasHoje.entreguesHoje,
    valorHoje: metricasHoje.valorEmTransito,
  });

  const progressoEntregas = Math.min((metricasHoje.entreguesHoje / meta.entregasDia) * 100, 100);

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  if (!contextoValido) {
    return (
      <div className={containerClass}>
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Selecione grupo e empresa para ver métricas em tempo real.
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className={containerClass}>
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm">
          Sem permissão para visualizar o painel de métricas.
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-6 h-6" />
              📊 Métricas em Tempo Real
            </CardTitle>
            <Badge className="bg-white/20 text-white">
              <Clock className="w-3 h-3 mr-1" />
              Atualiza a cada 30s
            </Badge>
          </div>
          <p className="text-sm opacity-90">
            Última atualização: {ultimaAtualizacao.toLocaleTimeString("pt-BR")} · escopo grupo/empresa
          </p>
        </CardHeader>
      </Card>

      {/* Métricas do Dia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-green-700 font-medium">Entregas Hoje</p>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{metricasHoje.entreguesHoje}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-green-700 mb-1">
                <span>Meta: {meta.entregasDia}</span>
                <span>{progressoEntregas.toFixed(0)}%</span>
              </div>
              <Progress value={progressoEntregas} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-purple-700 font-medium">Em Trânsito</p>
              <Truck className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-900">{metricasHoje.emTransito}</p>
            <p className="text-xs text-purple-600 mt-2">
              R$ {metricasHoje.valorEmTransito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-orange-700 font-medium">Em Expedição</p>
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-900">{metricasHoje.emExpedicao}</p>
            <p className="text-xs text-orange-600 mt-2">
              {metricasHoje.prontosFaturar} prontos p/ faturar
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-red-700 font-medium">Ocorrências Hoje</p>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-900">{metricasHoje.ocorrenciasHoje}</p>
            <p className="text-xs text-red-600 mt-2">
              {metricasHoje.ocorrenciasHoje === 0 ? '✅ Sem problemas' : '⚠️ Requer atenção'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparação com Ontem */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">📈 Comparação com Ontem</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-slate-600">Pedidos Aprovados</p>
                <p className="font-bold text-slate-900">{metricasHoje.pedidosAprovados}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-slate-600">Entregas</p>
                <p className="font-bold text-slate-900">{metricasHoje.entreguesHoje}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {metricasHoje.ocorrenciasHoje > 0 ? (
                <TrendingUp className="w-4 h-4 text-red-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-600" />
              )}
              <div>
                <p className="text-xs text-slate-600">Ocorrências</p>
                <p className="font-bold text-slate-900">{metricasHoje.ocorrenciasHoje}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-slate-600">Eficiência</p>
                <p className="font-bold text-slate-900">{progressoEntregas.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas em Tempo Real */}
      {(metricasHoje.prontosFaturar > 10 || metricasHoje.emExpedicao > 15 || metricasHoje.ocorrenciasHoje > 3) && (
        <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-base flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              🚨 Alertas Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {metricasHoje.prontosFaturar > 10 && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-300 text-sm text-yellow-900">
                <p className="font-semibold">⚠️ Alto volume aguardando faturamento</p>
                <p className="text-xs mt-1">{metricasHoje.prontosFaturar} pedidos prontos - acelere emissão de NF-e</p>
              </div>
            )}

            {metricasHoje.emExpedicao > 15 && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-300 text-sm text-orange-900">
                <p className="font-semibold">📦 Gargalo na expedição detectado</p>
                <p className="text-xs mt-1">{metricasHoje.emExpedicao} pedidos em separação - reforce equipe</p>
              </div>
            )}

            {metricasHoje.ocorrenciasHoje > 3 && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-300 text-sm text-red-900">
                <p className="font-semibold">🚨 Múltiplas ocorrências hoje</p>
                <p className="text-xs mt-1">{metricasHoje.ocorrenciasHoje} problemas registrados - análise urgente necessária</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}