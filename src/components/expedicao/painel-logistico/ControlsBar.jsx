import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";

const ALL_STATUSES = [
  'Aguardando Separação', 'Em Separação', 'Pronto para Expedir', 'Saiu para Entrega', 'Em Trânsito', 'Entregue', 'Entrega Frustrada'
];

export default function ControlsBar({ filters, setFilters, rules, onSaveRules, loadingRules, contextoValido = true, canEditRules = true, canSimulate = true, onAudit }) {
  const [open, setOpen] = React.useState(false);
  const [local, setLocal] = React.useState(rules || {});

  React.useEffect(() => setLocal(rules || {}), [rules]);

  const toggleStatus = (s) => {
    const curr = new Set(filters.statuses || []);
    if (curr.has(s)) curr.delete(s); else curr.add(s);
    setFilters({ ...filters, statuses: Array.from(curr) });
  };

  function SimuladorWhatIf({ onClose }) {
    const [params, setParams] = React.useState({ vehicles: 1, maxCapacityKg: 3000, maxVolumeM3: 12, considerTimeWindows: true, prioritizeUrgent: true, groupByRegion: true });
    const setNumericParam = (key, value, fallback = 0) => {
      const parsed = Number(value);
      setParams((prev) => ({ ...prev, [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback }));
    };
    const [loading, setLoading] = React.useState(false);

    const run = async () => {
      if (!contextoValido || !canSimulate) {
        await onAudit?.({ acao: "PainelLogistico.simulacao.bloqueada", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        return;
      }
      const confirmado = window.confirm('Confirma executar a simulacao logistica com os parametros atuais?');
      if (!confirmado) {
        await onAudit?.({ acao: 'PainelLogistico.simulacao.cancelada', sucesso: false, motivo: 'confirmacao_cancelada' });
        return;
      }
      setLoading(true);
      try {
        const res = await base44.functions.invoke('optimizeDeliveryRoute', { mode: 'simulation', constraints: params });
        await onAudit?.({ acao: 'PainelLogistico.simulacao', detalhes: { constraints: params } });
        // Notifica o painel via evento custom
        window.dispatchEvent(new CustomEvent('logistica:simulation', { detail: res?.data }));
        onClose?.();
      } catch (error) {
        await onAudit?.({ acao: 'PainelLogistico.simulacao.erro', sucesso: false, motivo: error?.message || 'erro_simulacao' });
      } finally { setLoading(false); }
    };

    return (
      <div className="space-y-3">
        <div className="grid md:grid-cols-2 gap-2">
          <div>
            <label className="text-sm">Veículos</label>
            <input className="w-full border rounded px-2 py-1" type="number" value={params.vehicles} onChange={(e)=>setNumericParam('vehicles', e.target.value, 1)} />
          </div>
          <div>
            <label className="text-sm">Capacidade (kg)</label>
            <input className="w-full border rounded px-2 py-1" type="number" value={params.maxCapacityKg} onChange={(e)=>setNumericParam('maxCapacityKg', e.target.value, 0)} />
          </div>
          <div>
            <label className="text-sm">Volume (m³)</label>
            <input className="w-full border rounded px-2 py-1" type="number" value={params.maxVolumeM3} onChange={(e)=>setNumericParam('maxVolumeM3', e.target.value, 0)} />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="tw" type="checkbox" checked={params.considerTimeWindows} onChange={(e)=>setParams({...params, considerTimeWindows: e.target.checked})} />
            <label htmlFor="tw" className="text-sm">Considerar janelas de entrega</label>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="urg" type="checkbox" checked={params.prioritizeUrgent} onChange={(e)=>setParams({...params, prioritizeUrgent: e.target.checked})} />
            <label htmlFor="urg" className="text-sm">Priorizar Urgentes</label>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="grp" type="checkbox" checked={params.groupByRegion} onChange={(e)=>setParams({...params, groupByRegion: e.target.checked})} />
            <label htmlFor="grp" className="text-sm">Agrupar por Região</label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={()=>onClose?.()}>Cancelar</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" onClick={run} disabled={loading || !contextoValido || !canSimulate} data-permission="Expedicao.PainelLogistico.editar" data-action="PainelLogistico.simular" data-context-required="true" data-sensitive="true">{loading?'Simulando...':'Simular'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-wrap items-center gap-2" data-permission="Expedicao.PainelLogistico.visualizar" data-context-required="true">
      <Input placeholder="Buscar cliente, pedido..." value={filters.q || ''} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className="w-[220px]" />
      <div className="flex flex-wrap gap-1">
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => toggleStatus(s)} className={`text-xs px-2 py-1 rounded border ${filters.statuses?.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{s}</button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Regras: atraso≥{local.minAtrasoHoras ?? 1}h • filaRota&gt;{local.maxFilaRota ?? 8} • trânsito≥{local.maxTransitoHoras ?? 6}h • esperaCD≥{local.maxEsperaCentroHoras ?? 4}h</Badge>
        <Button variant="outline" onClick={() => setOpen(true)} disabled={!contextoValido || !canEditRules} data-permission="Expedicao.PainelLogistico.editar" data-action="PainelLogistico.regras.abrir" data-context-required="true" data-sensitive="true">Configurar Regras</Button>
        <Button onClick={() => setOpen('sim')} disabled={!contextoValido || !canSimulate} data-permission="Expedicao.PainelLogistico.editar" data-action="PainelLogistico.simulacao.abrir" data-context-required="true" data-sensitive="true">Simular Cenário</Button>
      </div>

      <Dialog open={open===true} onOpenChange={(v)=>setOpen(v?true:false)}>
        <DialogContent className="max-w-md">
          <div className="space-y-3">
            <div>
              <label className="text-sm">Atraso mínimo (horas)</label>
              <Input type="number" value={local.minAtrasoHoras ?? 1} onChange={(e) => setLocal({ ...local, minAtrasoHoras: Number(e.target.value)||1 })} />
            </div>
            <div>
              <label className="text-sm">Máx. fila por rota</label>
              <Input type="number" value={local.maxFilaRota ?? 8} onChange={(e) => setLocal({ ...local, maxFilaRota: Number(e.target.value)||8 })} />
            </div>
            <div>
              <label className="text-sm">Máx. horas em trânsito</label>
              <Input type="number" value={local.maxTransitoHoras ?? 6} onChange={(e) => setLocal({ ...local, maxTransitoHoras: Number(e.target.value)||6 })} />
            </div>
            <div>
              <label className="text-sm">Máx. horas de espera no CD</label>
              <Input type="number" value={local.maxEsperaCentroHoras ?? 4} onChange={(e) => setLocal({ ...local, maxEsperaCentroHoras: Number(e.target.value)||4 })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!contextoValido || !canEditRules) {
                  await onAudit?.({ acao: 'PainelLogistico.regras.salvar.bloqueado', sucesso: false, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' });
                  return;
                }
                onSaveRules?.(local);
                setOpen(false);
              }} disabled={loadingRules || !contextoValido || !canEditRules} data-permission="Expedicao.PainelLogistico.editar" data-action="PainelLogistico.regras.salvar" data-context-required="true" data-sensitive="true">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo de simulação */}
      <Dialog open={open==='sim'} onOpenChange={(v)=>setOpen(v?'sim':false)}>
        <DialogContent className="max-w-lg">
          <SimuladorWhatIf onClose={()=>setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}