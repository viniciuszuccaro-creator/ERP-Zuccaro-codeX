import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Building2, Filter, X } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";

const PERIODOS = [
  { label: 'Hoje', dias: 0 },
  { label: '7 dias', dias: 7 },
  { label: '30 dias', dias: 30 },
  { label: 'Este mês', mes: true },
  { label: 'Este ano', ano: true },
];

export default function FiltrosPeriodoEmpresa({ filtros, setFiltros }) {
  const { empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();

  const aplicarPeriodo = (p) => {
    const hoje = new Date();
    const fim = hoje.toISOString().split('T')[0];
    let inicio;
    if (p.ano) {
      inicio = new Date(hoje.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else if (p.mes) {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    } else if (p.dias === 0) {
      inicio = fim;
    } else {
      const d = new Date(hoje);
      d.setDate(d.getDate() - p.dias);
      inicio = d.toISOString().split('T')[0];
    }
    setFiltros(f => ({ ...f, data_inicio: inicio, data_fim: fim }));
  };

  const limparOrigemDashboard = () => {
    setFiltros((f) => ({ ...f, status: null, kpi: null, origem: null, periodoLabel: null }));
  };

  const nomeGrupo = grupoAtual?.nome_do_grupo || grupoAtual?.nome || grupoAtual?.razao_social || 'Grupo';

  return (
    <Card className="border-0 shadow-md bg-gradient-to-r from-slate-50 to-blue-50">
      <CardContent className="p-4 space-y-2.5">
        {filtros?.origem === 'dashboard' && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-900"
            data-report-dashboard-sync="true"
            data-report-kpi={filtros.kpi || ""}
            data-report-status={filtros.status || ""}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" aria-hidden />
              <span className="font-semibold">Filtro sincronizado do Dashboard:</span>
              {filtros.periodoLabel && <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-800">{filtros.periodoLabel}</Badge>}
              {filtros.kpi && <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-800">KPI: {filtros.kpi}</Badge>}
              {filtros.status && <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-800">Status: {filtros.status}</Badge>}
            </div>
            <button
              type="button"
              onClick={limparOrigemDashboard}
              className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-medium"
              aria-label="Limpar filtro vindo do Dashboard"
            >
              <X className="w-3.5 h-3.5" aria-hidden />
              Limpar filtro
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
            <Building2 className="w-4 h-4" />
            <span>{estaNoGrupo ? `Grupo: ${nomeGrupo}` : `Empresa: ${empresaAtual?.nome_fantasia || empresaAtual?.razao_social || 'N/A'}`}</span>
          </div>

          <div className="flex-1 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">Data Início</Label>
              <Input type="date" value={filtros.data_inicio} onChange={e => setFiltros(f => ({ ...f, data_inicio: e.target.value }))} className="h-8 text-sm w-36" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">Data Fim</Label>
              <Input type="date" value={filtros.data_fim} onChange={e => setFiltros(f => ({ ...f, data_fim: e.target.value }))} className="h-8 text-sm w-36" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {PERIODOS.map(p => (
                <Button key={p.label} size="sm" variant="outline" className="h-8 text-xs" onClick={() => aplicarPeriodo(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}