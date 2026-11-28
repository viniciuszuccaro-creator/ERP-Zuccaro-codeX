import React, { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

const WidgetCanaisOrigem = React.lazy(() => import("@/components/dashboard/WidgetCanaisOrigem"));

const STATE_BADGE_MAP = {
  carregando: { text: "Carregando", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  erro: { text: "Indisponível", cls: "bg-red-50 text-red-700 border-red-200" },
  sem_acesso: { text: "Sem acesso", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  sem_contexto: { text: "Sem contexto", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  zero_confirmado: { text: "Zero confirmado", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

export default function StatsSection({ statsCards, empresaId }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsCards.map((stat, index) => {
        const state = stat.indicatorState?.state || "ok";
        const stateBadge = STATE_BADGE_MAP[state];
        const interactive = typeof stat.drillDown === "function" && state !== "sem_acesso" && state !== "sem_contexto";

        return (
          <Card
            key={stat.key || index}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? stat.drillDown : undefined}
            onKeyDown={(e) => {
              if (!interactive) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                stat.drillDown();
              }
            }}
            data-indicator-state={state}
            data-drilldown-url={stat.drillDownUrl || ""}
            className={`relative border border-slate-200 shadow-sm overflow-hidden group transition-all duration-200 ${
              interactive
                ? "cursor-pointer hover:shadow-md hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                : "opacity-90"
            }`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                {stat.title}
                {interactive && <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" aria-hidden />}
              </CardTitle>
              <div className={`p-2.5 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.textColor}`} aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tabular-nums ${stat.textColor} mb-1`}>{stat.value}</div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 truncate">{stat.subtitle}</p>
                {stateBadge && (
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium shrink-0 ${stateBadge.cls}`}>
                    {stateBadge.text}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="md:col-span-2 lg:col-span-2">
        <Suspense fallback={<div className="h-28 rounded-md bg-slate-100 animate-pulse" />}>
          <WidgetCanaisOrigem empresaId={empresaId} />
        </Suspense>
      </div>
    </div>
  );
}