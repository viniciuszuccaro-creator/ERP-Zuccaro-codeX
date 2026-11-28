import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, RefreshCw, FileBarChart } from "lucide-react";

const formatBrDate = (iso) => {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export default function DashboardHeader({
  empresaAtual,
  estaNoGrupo,
  grupoAtual,
  autoRefresh,
  setAutoRefresh,
  periodo,
  setPeriodo,
  periodoRange = null,
  onRefresh,
  isRefreshing = false,
  onOpenRelatorios,
  canSeeRelatorios = false,
  canSeeDashboard = true,
}) {
  const intervalLabel = periodoRange?.data_inicio && periodoRange?.data_fim
    ? `${formatBrDate(periodoRange.data_inicio)} – ${formatBrDate(periodoRange.data_fim)}`
    : null;

  return (
    <div
      className="w-full flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm"
      data-permission="Dashboard.visualizar"
      data-block="dashboard-header"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Dashboard Executivo</h1>
          {intervalLabel && (
            <Badge
              variant="outline"
              className="bg-slate-50 text-slate-600 border-slate-200 text-[11px] font-medium tabular-nums"
              data-dashboard-period-range={`${periodoRange.data_inicio}:${periodoRange.data_fim}`}
            >
              {intervalLabel}
            </Badge>
          )}
        </div>
        <p className="break-words text-xs sm:text-sm text-slate-600">
          {estaNoGrupo
            ? `Visão Consolidada • ${grupoAtual?.nome_do_grupo || grupoAtual?.nome || "Grupo"}`
            : `${empresaAtual?.nome_fantasia || empresaAtual?.razao_social || "Empresa"}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={autoRefresh ? "bg-green-50 text-green-700 border-green-200 text-xs" : "bg-slate-100 text-slate-600 text-xs"}>
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-slate-400"} mr-1.5`} />
            {autoRefresh ? "Auto (60s)" : "Manual"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            data-permission="Dashboard.visualizar"
            data-action="Dashboard.alterar_auto_refresh"
            disabled={!canSeeDashboard}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Pausar" : "Ativar Auto"}
          </Button>
          {typeof onRefresh === "function" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              data-permission="Dashboard.visualizar"
              data-action="Dashboard.atualizar"
              disabled={!canSeeDashboard || isRefreshing}
              onClick={onRefresh}
              title="Recarregar indicadores do contexto atual"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden />
              Atualizar
            </Button>
          )}
        </div>
        <Select value={periodo} onValueChange={setPeriodo} disabled={!canSeeDashboard}>
          <SelectTrigger className="w-36 h-8 text-xs" data-permission="Dashboard.visualizar" data-action="Dashboard.alterar_periodo">
            <Calendar className="w-3.5 h-3.5 mr-1.5" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Hoje</SelectItem>
            <SelectItem value="semana">Últimos 7 dias</SelectItem>
            <SelectItem value="mes">Este Mês</SelectItem>
            <SelectItem value="trimestre">Trimestre</SelectItem>
            <SelectItem value="ano">Este Ano</SelectItem>
          </SelectContent>
        </Select>
        {canSeeRelatorios && typeof onOpenRelatorios === "function" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            data-permission="Relatorios.visualizar"
            data-action="Dashboard.abrir_relatorios"
            disabled={!canSeeDashboard}
            onClick={onOpenRelatorios}
          >
            <FileBarChart className="w-3.5 h-3.5 mr-1" aria-hidden />
            Relatórios
          </Button>
        )}
      </div>
    </div>
  );
}
