import React, { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

export default function DashboardHeader({ empresaAtual, estaNoGrupo, grupoAtual, autoRefresh, setAutoRefresh, periodo, setPeriodo, canSeeDashboard = true }) {
  return (
    <div className="flex justify-between items-center" data-permission="Dashboard.visualizar">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard Executivo</h1>
        <p className="text-slate-600">
          {estaNoGrupo
            ? `Visão Consolidada • ${grupoAtual?.nome_do_grupo || 'Grupo'}`
            : `${empresaAtual?.nome_fantasia || empresaAtual?.razao_social || 'Empresa'}`}
        </p>
      </div>
      <div className="flex gap-3 items-center">
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
  );
}
