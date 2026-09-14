import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, DollarSign, Factory, Package, Sparkles, Target, Truck } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveRealtimeDashboardScope } from '@/components/lib/dashboardKpiPolicy';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useRealtimeEntregas, useRealtimeKPIs, useRealtimePedidos } from '@/components/lib/useRealtimeData';
import DashboardTempoRealOperations from './DashboardTempoRealOperations';

/** @typedef {import('@/components/lib/useRealtimeData').RealtimeKpis} RealtimeKpis */
/** @typedef {import('@/components/lib/useRealtimeData').RealtimePedido} RealtimePedido */
/** @typedef {import('@/components/lib/useRealtimeData').RealtimeEntrega} RealtimeEntrega */

/**
 * Dashboard em Tempo Real.
 * @param {{ empresaId?: string | null, windowMode?: boolean }} props
 */
function DashboardTempoReal({ empresaId = null, windowMode: _windowMode = false }) {
  const [pulseActive, setPulseActive] = useState(false);
  const { contexto, empresaAtual, empresasDoGrupo, estaNoGrupo, grupoAtual } = useContextoVisual();
  const { hasPermission, user } = usePermissions();
  const dashboardScope = resolveRealtimeDashboardScope({
    scopeType: contexto === 'grupo' || estaNoGrupo ? 'grupo' : 'empresa',
    groupId: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
    requestedEmpresaId: empresaId,
    currentEmpresa: empresaAtual,
    groupCompanies: empresasDoGrupo,
  });
  const canViewDashboard = hasPermission('Dashboard', 'Tempo Real', 'visualizar')
    || hasPermission('Dashboard', null, 'visualizar')
    || hasPermission('Sistema', 'Dashboard', 'visualizar');
  const canRefreshDashboard = canViewDashboard || hasPermission('Dashboard', 'Tempo Real', 'atualizar');
  const dashboardEnabled = dashboardScope.valid && canViewDashboard;
  const userId = user?.id || user?.email || null;

  const kpiQuery = useRealtimeKPIs(
    dashboardScope.empresaId,
    45000,
    dashboardScope.groupId,
    dashboardEnabled,
    userId,
  );
  const pedidosQuery = useRealtimePedidos(
    dashboardScope.empresaId,
    5,
    dashboardScope.groupId,
    dashboardEnabled,
    userId,
  );
  const entregasQuery = useRealtimeEntregas(
    dashboardScope.empresaId,
    dashboardScope.groupId,
    dashboardEnabled,
    userId,
  );
  const kpis = /** @type {RealtimeKpis | undefined} */ (kpiQuery.data);
  const pedidosRecentes = /** @type {RealtimePedido[]} */ (Array.isArray(pedidosQuery.data) ? pedidosQuery.data : []);
  const entregasAtivas = /** @type {RealtimeEntrega[]} */ (Array.isArray(entregasQuery.data) ? entregasQuery.data : []);

  useEffect(() => {
    if (!kpiQuery.hasChanges) return undefined;
    setPulseActive(true);
    const timeoutId = setTimeout(() => setPulseActive(false), 1000);
    return () => clearTimeout(timeoutId);
  }, [kpiQuery.hasChanges]);

  if (!dashboardEnabled) {
    return (
      <div className="w-full h-full" data-permission="Dashboard.Tempo Real.visualizar" data-context-required="group-or-company">
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {!dashboardScope.valid
              ? dashboardScope.error
              : 'Seu perfil não possui permissão para visualizar o dashboard em tempo real.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="w-full h-full flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Carregando dados em tempo real...</p>
        </div>
      </div>
    );
  }

  const semDadosKPI = kpis.pedidos.hoje
    + kpis.financeiro.vencendoHoje
    + kpis.producao.opsEmAndamento
    + kpis.expedicao.entregasHoje === 0;
  const ultimaAtualizacao = kpis.ultimaAtualizacao
    ? new Date(kpis.ultimaAtualizacao).toLocaleTimeString('pt-BR')
    : '-';

  return (
    <div className="w-full h-full flex flex-col" data-permission="Dashboard.Tempo Real.visualizar" data-context-required="group-or-company">
      <div className="p-4 md:p-6 space-y-6 flex-1 overflow-auto">
        <Alert className="border-green-300 bg-green-50">
          <Activity className={`w-5 h-5 text-green-600 ${pulseActive ? 'animate-pulse' : ''}`} />
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-green-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Dashboard em Tempo Real Ativo
                </p>
                <p className="text-sm text-green-700">
                  {estaNoGrupo ? 'Visão Consolidada do Grupo' : empresaAtual?.nome_fantasia || empresaAtual?.razao_social || 'Empresa'} • Atualização: {ultimaAtualizacao}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-green-600 px-3">
                  <Target className="w-3 h-3 mr-1" />
                  {estaNoGrupo ? 'GRUPO' : 'EMPRESA'}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${pulseActive ? 'bg-green-600 animate-ping' : 'bg-green-600'}`} aria-label={`Atualização: ${ultimaAtualizacao}`} />
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {kpiQuery.error && (
          <Alert className="border-red-300 bg-red-50">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Erro ao carregar dados em tempo real. Tente novamente após alguns instantes.</span>
              <Button size="sm" variant="outline" onClick={() => canRefreshDashboard && kpiQuery.refetch()} disabled={!canRefreshDashboard} data-permission="Dashboard.Tempo Real.atualizar">
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {semDadosKPI && !kpiQuery.error && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Nenhum dado recente por enquanto.</span>
              <Button size="sm" variant="outline" onClick={() => canRefreshDashboard && kpiQuery.refetch()} disabled={!canRefreshDashboard} data-permission="Dashboard.Tempo Real.atualizar">
                Atualizar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch sticky top-0 z-20 bg-white/90 border-b border-slate-200/60 py-2">
          <KpiCard
            color="blue"
            icon={Package}
            title="Pedidos Hoje"
            value={kpis.pedidos.hoje}
            subtitle={`R$ ${kpis.pedidos.valorHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          >
            <Badge className="bg-orange-100 text-orange-700 text-xs">{kpis.pedidos.aguardandoAprovacao} aguardando</Badge>
            <Badge className="bg-purple-100 text-purple-700 text-xs">{kpis.pedidos.emProducao} produzindo</Badge>
          </KpiCard>
          <KpiCard
            color="green"
            icon={DollarSign}
            title="Financeiro Hoje"
            value={kpis.financeiro.vencendoHoje}
            subtitle={`R$ ${kpis.financeiro.valorHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          >
            {kpis.financeiro.atrasados > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{kpis.financeiro.atrasados} atrasados</Badge>}
            {kpis.financeiro.recebidosHoje > 0 && <Badge className="bg-green-100 text-green-700 text-xs">{kpis.financeiro.recebidosHoje} recebidos</Badge>}
          </KpiCard>
          <KpiCard
            color="purple"
            icon={Factory}
            title="Produção Ativa"
            value={kpis.producao.opsEmAndamento}
            subtitle={`${kpis.producao.percentualMedio}% conclusão média`}
          >
            {kpis.producao.opsAtrasadas > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{kpis.producao.opsAtrasadas} atrasadas</Badge>}
            {kpis.producao.opsFinalizadasHoje > 0 && <Badge className="bg-green-100 text-green-700 text-xs">{kpis.producao.opsFinalizadasHoje} finalizadas</Badge>}
          </KpiCard>
          <KpiCard
            color="orange"
            icon={Truck}
            title="Entregas Hoje"
            value={kpis.expedicao.entregasHoje}
            subtitle={`${kpis.expedicao.realizadas} realizadas`}
          >
            <Badge className="bg-blue-100 text-blue-700 text-xs">{kpis.expedicao.pendentes} pendentes</Badge>
            <Badge className="bg-orange-100 text-orange-700 text-xs">{kpis.expedicao.emRota} em rota</Badge>
          </KpiCard>
        </div>

        <DashboardTempoRealOperations kpis={kpis} pedidosRecentes={pedidosRecentes} entregasAtivas={entregasAtivas} />
      </div>
    </div>
  );
}

const KPI_STYLES = {
  blue: { card: 'border-blue-200 bg-gradient-to-br from-white to-blue-50/60', text: 'text-blue-600', title: 'text-blue-700' },
  green: { card: 'border-green-200 bg-gradient-to-br from-white to-green-50/60', text: 'text-green-600', title: 'text-green-700' },
  purple: { card: 'border-purple-200 bg-gradient-to-br from-white to-purple-50/60', text: 'text-purple-600', title: 'text-purple-700' },
  orange: { card: 'border-orange-200 bg-gradient-to-br from-white to-orange-50/60', text: 'text-orange-600', title: 'text-orange-700' },
};

/** @param {{ color: keyof typeof KPI_STYLES, icon: React.ElementType, title: string, value: number, subtitle: string, children?: React.ReactNode }} props */
function KpiCard({ color, icon: Icon, title, value, subtitle, children }) {
  const styles = KPI_STYLES[color];
  return (
    <motion.div className="h-full" initial={false} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
      <Card className={`h-full border ${styles.card}`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-sm font-medium flex items-center gap-2 ${styles.title}`}>
            <Icon className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${styles.text}`}>{value}</div>
          <p className={`text-sm mt-1 ${styles.text}`}>{subtitle}</p>
          <div className="flex flex-wrap gap-2 mt-3">{children}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(DashboardTempoReal);
