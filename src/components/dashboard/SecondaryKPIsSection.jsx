import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function SecondaryKPIsSection({ kpis }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-4">Indicadores de Performance (KPIs)</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, index) => (
          <Card
            key={index}
            onClick={kpi.drillDown}
            className={`border-0 shadow-md cursor-pointer hover:shadow-lg transition-all ${kpi.alert ? 'ring-2 ring-red-300' : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <p className="text-xs text-slate-600 mt-1">{kpi.title}</p>
              {kpi.subtitle ? (
                <p className="text-[10px] text-slate-500 mt-0.5" data-kpi-fonte="true">{kpi.subtitle}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}