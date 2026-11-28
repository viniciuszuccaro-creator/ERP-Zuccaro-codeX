import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

const STATE_LABELS = {
  carregando: { text: "Carregando", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  erro: { text: "Indisponível", cls: "bg-red-50 text-red-700 border-red-200" },
  sem_acesso: { text: "Sem acesso", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  sem_contexto: { text: "Sem contexto", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  zero_confirmado: { text: "Zero confirmado", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

export default function KPIsOperacionaisSection({ kpis }) {
  return (
    <div className="w-full" data-block="dashboard-kpis-operacionais">
      <h2 className="text-lg font-semibold text-slate-900 mb-3">KPIs Operacionais</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {kpis.map((kpi, index) => {
          const state = kpi.indicatorState?.state || "ok";
          const badge = STATE_LABELS[state];
          const interactive = typeof kpi.drillDown === "function" && state !== "sem_acesso" && state !== "sem_contexto";

          return (
            <Card
              key={kpi.key || index}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? kpi.drillDown : undefined}
              onKeyDown={(e) => {
                if (!interactive) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  kpi.drillDown();
                }
              }}
              data-indicator-state={state}
              data-drilldown-url={kpi.drillDownUrl || ""}
              className={`border border-slate-200 shadow-sm transition-all ${
                interactive
                  ? "cursor-pointer hover:shadow-md hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  : "opacity-90"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} aria-hidden />
                  </div>
                  <div className="flex items-center gap-1">
                    {badge && (
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                    )}
                    {interactive && <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" aria-hidden />}
                  </div>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
                <p className="text-xs font-medium text-slate-700 mt-1">{kpi.title}</p>
                {kpi.subtitle && <p className="text-xs text-slate-500 mt-0.5">{kpi.subtitle}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}