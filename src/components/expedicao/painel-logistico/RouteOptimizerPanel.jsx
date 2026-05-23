import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Route as RouteIcon, ListOrdered } from 'lucide-react';

export default function RouteOptimizerPanel({ entregas = [], empresaId, groupId, onSelectEntrega, contextoValido = true, canOptimize = true, onAudit }) {
  const candidatas = useMemo(() => (
    (entregas || []).filter(e => e?.endereco_entrega_completo?.latitude && e?.endereco_entrega_completo?.longitude && !['Entregue','Cancelado','Devolvido'].includes(e.status))
  ), [entregas]);

  const [capacidadeKg, setCapacidadeKg] = useState('8000');
  const [maxParadas, setMaxParadas] = useState('30');
  const [respeitarJanelas, setRespeitarJanelas] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rota, setRota] = useState(null);

  const otimizar = async () => {
    if (!contextoValido || !canOptimize) {
      await onAudit?.({ acao: "PainelLogistico.rota.otimizar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      return;
    }
    if (!candidatas.length) return;
    setLoading(true);
    try {
      const payload = {
        empresa_id: empresaId,
        group_id: groupId || null,
        entrega_ids: candidatas.map(e => e.id),
        constraints: {
          vehicle_capacity_kg: capacidadeKg ? Number(capacidadeKg) : undefined,
          max_stops: maxParadas ? Number(maxParadas) : undefined,
          respect_time_windows: !!respeitarJanelas,
        },
      };
      const { data } = await base44.functions.invoke('optimizeDeliveryRoute', payload);
      await onAudit?.({ acao: 'PainelLogistico.rota.otimizar', detalhes: { entregas: candidatas.length, constraints: payload.constraints } });
      const d = data || {};
      const view = {
        ...d,
        total_distance_km: (d.total_distance_m || 0) / 1000,
        total_duration_min: Math.round((d.total_duration_s || 0) / 60),
        stops: Array.isArray(d.ordered) ? d.ordered.map((o) => {
          const etaMin = o?.eta_iso ? Math.max(0, Math.round((new Date(o.eta_iso).getTime() - Date.now()) / 60000)) : null;
          return { id: o.entrega_id, eta_min: etaMin, ...o };
        }) : []
      };
      setRota(view);
      try { window.dispatchEvent(new CustomEvent('logistica:route', { detail: view })); } catch {}
    } catch (error) {
      await onAudit?.({ acao: 'PainelLogistico.rota.otimizar.erro', sucesso: false, motivo: error?.message || 'erro_otimizacao' });
    } finally {
      setLoading(false);
    }
  };

  const paradas = useMemo(() => {
    if (!rota) return [];
    // compatibilidade com diferentes formatos
    const arr = rota?.stops || rota?.sequence || rota?.ordered || rota?.rota || [];
    return Array.isArray(arr) ? arr : [];
  }, [rota]);

  return (
    <Card className="mt-3" data-permission="Expedicao.PainelLogistico.visualizar" data-context-required="true">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <RouteIcon className="w-4 h-4 text-emerald-600" /> Otimização de Rotas
          <Badge variant="outline" className="ml-2 text-xs">{candidatas.length} entregas válidas</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-slate-600">Capacidade do veículo (kg)</label>
            <Input value={capacidadeKg} onChange={(e)=>setCapacidadeKg(e.target.value)} placeholder="8000" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Máx. paradas</label>
            <Input value={maxParadas} onChange={(e)=>setMaxParadas(e.target.value)} placeholder="30" />
          </div>
          <div className="col-span-2 flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={respeitarJanelas} onChange={(e)=>setRespeitarJanelas(e.target.checked)} />
              Respeitar janelas de entrega
            </label>
            <Button onClick={otimizar} disabled={loading || !candidatas.length || !contextoValido || !canOptimize || !empresaId} className="ml-auto" data-permission="Expedicao.PainelLogistico.editar" data-action="PainelLogistico.rota.otimizar" data-context-required="true" data-sensitive="true">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <ListOrdered className="w-4 h-4 mr-2"/>}
              Otimizar rota
            </Button>
          </div>
        </div>

        {rota && (
          <div className="border rounded-lg p-2">
            <div className="text-xs text-slate-600 mb-2">
              Distância ~ <b>{(rota.total_distance_km ?? rota.distance_km ?? 0).toLocaleString('pt-BR')}</b> km • Duração ~ <b>{(rota.total_duration_min ?? rota.duration_min ?? 0)}</b> min
            </div>
            <ol className="space-y-1 max-h-56 overflow-auto">
              {paradas.map((p, idx) => {
                const entregaId = p.entrega_id || p.id || p.ref;
                const e = (entregas || []).find(x => x.id === entregaId);
                const nome = e?.cliente_nome || p.cliente || `Entrega ${entregaId}`;
                const eta = p.eta_min || p.eta || null;
                return (
                  <li key={`${entregaId}-${idx}`} className="flex items-center gap-2 text-sm">
                    <Badge className="bg-emerald-600">{idx + 1}</Badge>
                    <button className="text-left hover:underline" onClick={()=>onSelectEntrega && entregaId && onSelectEntrega(e || { id: entregaId })}>
                      {nome}
                      {eta != null && <span className="text-slate-500 ml-2">ETA ~{eta} min</span>}
                    </button>
                  </li>
                );
              })}
              {paradas.length === 0 && (
                <Alert><AlertDescription>Nenhuma sequência sugerida para os filtros atuais.</AlertDescription></Alert>
              )}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}