import React from "react";
import { Badge } from "@/components/ui/badge";
import { filterEntregasPendencias } from "@/components/lib/expedicaoFluxoOperacionalPolicy";

const lanes = [
  { key: "Aguardando Separação", label: "Aguardando", color: "bg-amber-50", tipos: ["separacao"] },
  { key: "Em Separação", label: "Separação", color: "bg-blue-50", tipos: ["separacao", "divergencia"] },
  { key: "Pronto para Expedir", label: "Pronto", color: "bg-emerald-50", tipos: ["romaneio"] },
  { key: "Saiu para Entrega", label: "Saiu", color: "bg-cyan-50", tipos: ["em_rota", "atrasada"] },
  { key: "Em Trânsito", label: "Trânsito", color: "bg-sky-50", tipos: ["em_rota", "atrasada"] },
  { key: "Entrega Frustrada", label: "Frustrada", color: "bg-red-50", tipos: ["ocorrencia"] },
  { key: "Entrega Parcial", label: "Parcial", color: "bg-orange-50", tipos: ["parcial"] },
];

export default function QueuesLogistica({ entregas = [], empresaId = null, groupId = null }) {
  const pendencias = filterEntregasPendencias(entregas, { empresaId, groupId });
  const group = lanes.map(l => ({
    ...l,
    items: entregas.filter(e =>
      (e.status === l.key)
      || (l.key === "Saiu para Entrega" && e.status === "Saiu para Entrega")
      || (l.key === "Em Trânsito" && (e.status === "Em Trânsito" || e.status === "Em Transito"))
      || (l.key === "Entrega Parcial" && String(e.status || '').toLowerCase().includes('parcial'))
    ),
    pendenciasLane: pendencias.filter((p) => (l.tipos || []).includes(p.pendencia?.tipo)),
  }));

  return (
    <div className="w-full h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 p-3 overflow-auto" data-testid="queues-logistica-pendencias">
      <div className="rounded-lg border bg-slate-50 p-3" data-testid="queues-logistica-resumo-pendencias">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold text-slate-700">Pendências do fluxo</div>
          <Badge variant="secondary">{pendencias.length}</Badge>
        </div>
        <div className="text-xs text-slate-600">
          {pendencias.length === 0
            ? "Sem pendências no contexto."
            : pendencias.slice(0, 5).map((p) => p.pendencia?.label).filter(Boolean).join(" · ")}
        </div>
      </div>
      {group.map(l => (
        <div key={l.key} className={`rounded-lg border ${l.color} p-3 min-h-[140px]`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-700">{l.label}</div>
            <div className="flex items-center gap-1">
              {l.pendenciasLane.length > 0 && (
                <Badge variant="destructive">{l.pendenciasLane.length}</Badge>
              )}
              <Badge variant="secondary">{l.items.length}</Badge>
            </div>
          </div>
          <div className="space-y-1 max-h-40 overflow-auto pr-1">
            {l.items.slice(0, 12).map((e) => (
              <div key={e.id} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                <span className="truncate">{e.cliente_nome || e.numero_pedido || e.id}</span>
                <span className="text-slate-500">{e.endereco_entrega_completo?.cidade || "-"}</span>
              </div>
            ))}
            {l.items.length === 0 && (
              <div className="text-xs text-slate-500">Sem itens</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}