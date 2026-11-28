import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, AlertCircle, Loader2, ArrowUpRight } from "lucide-react";

const STATE_STYLES = {
  sem_contexto: {
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    valueClass: "text-amber-700 text-sm",
  },
  sem_acesso: {
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    valueClass: "text-slate-500 text-sm",
  },
  carregando: {
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    valueClass: "text-sky-600 text-sm animate-pulse",
  },
  erro: {
    badge: "bg-red-50 text-red-700 border-red-200",
    valueClass: "text-red-700 text-sm",
  },
  zero_confirmado: {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    valueClass: "text-slate-800 text-lg",
  },
  ok: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    valueClass: "text-slate-900 text-lg",
  },
};

/**
 * DashboardKPIStrip — faixa executiva compacta de 8 indicadores (referência erp-integra-novo).
 * Cada indicador declara estado explícito (carregando | erro | sem_acesso | sem_contexto | zero_confirmado | ok)
 * e navega para o relatório correspondente com os mesmos filtros de período e escopo.
 */
export default function DashboardKPIStrip({ items = [], onNavigate }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section
      aria-label="Resumo executivo de indicadores"
      data-block="dashboard-kpi-strip"
      className="w-full"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          const state = item.indicatorState?.state || "ok";
          const st = STATE_STYLES[state] || STATE_STYLES.ok;
          const interactive = Boolean(item.drillDownUrl) && state !== "sem_acesso" && state !== "sem_contexto";

          const handleActivate = () => {
            if (!interactive) return;
            if (typeof item.onClick === "function") {
              item.onClick();
            } else if (typeof onNavigate === "function" && item.drillDownUrl) {
              onNavigate(item.drillDownUrl);
            }
          };

          const handleKeyDown = (e) => {
            if (!interactive) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleActivate();
            }
          };

          let displayValue = item.formattedValue;
          if (state === "carregando") displayValue = "Carregando...";
          else if (state === "sem_acesso") displayValue = "Sem acesso";
          else if (state === "sem_contexto") displayValue = "Sem contexto";
          else if (state === "erro") displayValue = "Indisponível";

          return (
            <Card
              key={item.key}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={handleActivate}
              onKeyDown={handleKeyDown}
              data-kpi-key={item.key}
              data-indicator-state={state}
              data-indicator-source={item.source || "derived"}
              data-drilldown-url={item.drillDownUrl || ""}
              data-permission={item.permission || "Dashboard.visualizar"}
              className={`border shadow-sm transition-all ${
                interactive
                  ? "cursor-pointer hover:shadow-md hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  : "opacity-90"
              } ${item.alert && state === "ok" ? "border-red-300 bg-red-50/40" : "bg-white border-slate-200"}`}
              title={
                interactive
                  ? `${item.label}: abrir relatório com filtros do período`
                  : `${item.label}: ${item.indicatorState?.label || state}`
              }
            >
              <CardContent className="p-3 flex flex-col justify-between h-full gap-1.5">
                <div className="flex items-center justify-between gap-1">
                  <div className={`p-1.5 rounded-md ${item.bgColor || "bg-slate-100"}`}>
                    {state === "sem_acesso" ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden />
                    ) : state === "erro" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" aria-hidden />
                    ) : state === "carregando" ? (
                      <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" aria-hidden />
                    ) : (
                      Icon && <Icon className={`w-3.5 h-3.5 ${item.color || "text-slate-700"}`} aria-hidden />
                    )}
                  </div>
                  {interactive && (
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500 truncate">{item.label}</p>
                  <div className={`font-bold tabular-nums truncate ${st.valueClass}`}>
                    {displayValue}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-slate-500 truncate">
                    {state === "zero_confirmado"
                      ? "Zero confirmado"
                      : state === "erro"
                        ? "Erro de consulta"
                        : state === "sem_acesso"
                          ? "Restrito RBAC"
                          : state === "carregando"
                            ? "Consultando..."
                            : item.sublabel || ""}
                  </span>
                  {item.source === "canonical" && (state === "ok" || state === "zero_confirmado") && (
                    <span className="px-1 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                      Canônico
                    </span>
                  )}
                  {item.indicatorState?.isPartial && state === "ok" && (
                    <span className="px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      Parcial
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
