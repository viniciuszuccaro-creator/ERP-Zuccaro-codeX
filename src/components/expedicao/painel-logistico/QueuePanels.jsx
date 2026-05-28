import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function GroupList({ title, groups, onSelectEntrega, contextoValido = true, canView = true, onAudit }) {
  return (
    <Card className="h-full" data-permission="Expedicao.PainelLogistico.visualizar" data-context-required="true">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2 overflow-auto max-h-[32vh]">
        {Object.keys(groups).length === 0 && (
          <div className="text-sm text-slate-500">Sem itens.</div>
        )}
        {Object.entries(groups).sort((a,b) => (b[1]?.length||0)-(a[1]?.length||0)).map(([key, list]) => (
          <div key={key} className="border rounded p-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="truncate max-w-[70%]">{key || '—'}</span>
              <span className="text-slate-500">{list.length}</span>
            </div>
            <div className="mt-1 grid gap-1">
              {list.slice(0, 6).map((e) => (
                <button key={e.id} className="text-left text-xs px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed" disabled={!contextoValido || !canView} data-action="PainelLogistico.fila.selecionar" data-context-required="true" onClick={async () => { await onAudit?.({ acao: 'PainelLogistico.fila.selecionar', detalhes: { entrega_id: e.id, fila: title } }); onSelectEntrega?.(e); }}>
                  {e.cliente_nome} • {e.status}
                </button>
              ))}
              {list.length > 6 && (
                <div className="text-[11px] text-slate-500">+{list.length - 6} mais…</div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function QueuePanels({ entregas = [], onSelectEntrega, contextoValido = true, canView = true, onAudit }) {
  const byStatus = React.useMemo(() => {
    return (entregas || []).reduce((acc, e) => {
      const k = e.status || '—';
      acc[k] = acc[k] || [];
      acc[k].push(e);
      return acc;
    }, {});
  }, [entregas]);

  const byRota = React.useMemo(() => {
    return (entregas || []).reduce((acc, e) => {
      const k = e.rota_id || 'Sem Rota';
      acc[k] = acc[k] || [];
      acc[k].push(e);
      return acc;
    }, {});
  }, [entregas]);

  const byMotorista = React.useMemo(() => {
    return (entregas || []).reduce((acc, e) => {
      const k = e.motorista || 'Sem Motorista';
      acc[k] = acc[k] || [];
      acc[k].push(e);
      return acc;
    }, {});
  }, [entregas]);

  return (
    <div className="grid gap-3">
      <GroupList title="Filas por Status" groups={byStatus} onSelectEntrega={onSelectEntrega} contextoValido={contextoValido} canView={canView} onAudit={onAudit} />
      <GroupList title="Filas por Rota" groups={byRota} onSelectEntrega={onSelectEntrega} contextoValido={contextoValido} canView={canView} onAudit={onAudit} />
      <GroupList title="Filas por Motorista" groups={byMotorista} onSelectEntrega={onSelectEntrega} contextoValido={contextoValido} canView={canView} onAudit={onAudit} />
    </div>
  );
}