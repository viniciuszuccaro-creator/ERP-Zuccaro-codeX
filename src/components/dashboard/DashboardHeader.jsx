import React, { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

export default function DashboardHeader({ empresaAtual, estaNoGrupo, grupoAtual, autoRefresh, setAutoRefresh, periodo, setPeriodo, canSeeDashboard = true }) {
  const contextoLabel = estaNoGrupo
    ? (grupoAtual?.nome_do_grupo || 'Grupo')
    : (empresaAtual?.nome_fantasia || empresaAtual?.razao_social || 'Empresa');
  return (
    <div className="w-full space-y-2" data-permission="Dashboard.visualizar" data-block="dashboard-header">
      <div
        className="sticky top-0 z-10 rounded-md border border-sky-200 bg-white/95 backdrop-blur px-3 py-2 shadow-sm"
        data-block="dashboard-contexto-escopo"
        role="status"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
          <span>
            Escopo:{' '}
            <strong className="text-sky-950">
              {estaNoGrupo ? 'Grupo (consolidado)' : 'Empresa'}
            </strong>
          </span>
          <span>
            Contexto:{' '}
            <strong className={contextoLabel ? 'text-sky-950' : 'text-slate-400'}>
              {contextoLabel || 'selecione grupo/empresa'}
            </strong>
          </span>
          <span className="text-slate-500">
            KPIs e gráficos abaixo usam somente este escopo autorizado.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 truncate">Dashboard Executivo</h1>
          <p className="text-sm text-slate-600 truncate">
            {estaNoGrupo
              ? `Visão consolidada • ${contextoLabel}`
              : contextoLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={autoRefresh ? "bg-green-50 text-green-700" : "bg-slate-100"}>
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-400'} mr-2`} />
              {autoRefresh ? 'Atualização automática (60s)' : 'Atualização manual'}
            </Badge>
            <Button size="sm" variant="outline" data-permission="Dashboard.visualizar" data-action="Dashboard.alterar_auto_refresh" disabled={!canSeeDashboard} onClick={() => setAutoRefresh(!autoRefresh)}>
              {autoRefresh ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-40" data-permission="Dashboard.visualizar" data-action="Dashboard.alterar_periodo">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Hoje</SelectItem>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ano">Este Ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
