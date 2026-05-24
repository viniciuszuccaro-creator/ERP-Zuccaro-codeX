import React, { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function PerformanceReportDialog({ open, onOpenChange, entregas = [], contextoValido = true, canExport = true, onAudit }) {
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });

  const filtradas = useMemo(() => {
    const de = periodo.de ? new Date(periodo.de) : null;
    const ate = periodo.ate ? new Date(periodo.ate) : null;
    return (entregas || []).filter((e) => {
      const d = e.data_saida ? new Date(e.data_saida) : null;
      if (de && d && d < de) return false;
      if (ate && d && d > ate) return false;
      return true;
    });
  }, [entregas, periodo]);

  const byKey = (key) => {
    const map = new Map();
    filtradas.forEach((e) => {
      const k = e[key] || '—';
      const rec = map.get(k) || { total: 0, entregues: 0, frustradas: 0, atraso: 0 };
      rec.total += 1;
      if (e.status === 'Entregue') rec.entregues += 1;
      if (e.status === 'Entrega Frustrada') rec.frustradas += 1;
      const prev = e.data_previsao ? new Date(e.data_previsao) : null;
      const real = e.data_entrega ? new Date(e.data_entrega) : null;
      if (prev && real && real > prev) rec.atraso += 1;
      map.set(k, rec);
    });
    return Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v, sla: v.total ? Math.round((v.entregues - v.atraso) * 100 / v.total) : 0 }));
  };

  const porMotorista = byKey('motorista');
  const porRota = byKey('rota_id');

  const exportCSV = async (rows, filename) => {
    if (!contextoValido || !canExport) {
      await onAudit?.({ acao: "PainelLogistico.relatorio.exportar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { filename } });
      return;
    }
    if (!rows.length) {
      await onAudit?.({ acao: 'PainelLogistico.relatorio.exportar.bloqueado', sucesso: false, motivo: 'sem_linhas', detalhes: { filename } });
      return;
    }
    const confirmado = window.confirm(`Confirma exportar ${rows.length} linhas do relatorio logistico?`);
    if (!confirmado) {
      await onAudit?.({ acao: 'PainelLogistico.relatorio.exportar.cancelado', sucesso: false, motivo: 'confirmacao_cancelada', detalhes: { filename, linhas: rows.length } });
      return;
    }
    const headers = Object.keys(rows[0] || { key: 'Chave', total: 0, entregues: 0, frustradas: 0, atraso: 0, sla: 0 });
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    await onAudit?.({ acao: "PainelLogistico.relatorio.exportar", detalhes: { filename, linhas: rows.length, periodo } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full" data-permission="Expedicao.Relatorios.visualizar" data-context-required="true">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Relatório de Performance Logística</h3>
          <div className="flex items-center gap-2">
            <input type="date" value={periodo.de} onChange={(e)=>setPeriodo({ ...periodo, de: e.target.value })} className="border rounded px-2 py-1 text-sm"/>
            <span className="text-sm">até</span>
            <input type="date" value={periodo.ate} onChange={(e)=>setPeriodo({ ...periodo, ate: e.target.value })} className="border rounded px-2 py-1 text-sm"/>
          </div>
        </div>

        {(!contextoValido || !canExport) && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {!contextoValido ? 'Selecione grupo/empresa para exportar relatorios.' : 'Seu perfil nao tem permissao para exportar relatorios.'}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 max-h-[60vh] overflow-auto">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium">Por Motorista</h4>
              {porMotorista.length>0 && (
                <Button size="sm" variant="outline" onClick={()=>exportCSV(porMotorista, 'performance_motorista.csv')} disabled={!contextoValido || !canExport} data-permission="Expedicao.Relatorios.exportar" data-action="PainelLogistico.relatorio.exportar_motorista" data-context-required="true" data-sensitive="true">Exportar CSV</Button>
              )}
            </div>
            <div className="border rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2">Motorista</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Entregues</th>
                    <th className="text-right p-2">Frustradas</th>
                    <th className="text-right p-2">Atraso</th>
                    <th className="text-right p-2">SLA%</th>
                  </tr>
                </thead>
                <tbody>
                  {porMotorista.map((r) => (
                    <tr key={r.key} className="border-t">
                      <td className="p-2">{r.key}</td>
                      <td className="p-2 text-right">{r.total}</td>
                      <td className="p-2 text-right">{r.entregues}</td>
                      <td className="p-2 text-right">{r.frustradas}</td>
                      <td className="p-2 text-right">{r.atraso}</td>
                      <td className="p-2 text-right">{r.sla}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium">Por Rota</h4>
              {porRota.length>0 && (
                <Button size="sm" variant="outline" onClick={()=>exportCSV(porRota, 'performance_rota.csv')} disabled={!contextoValido || !canExport} data-permission="Expedicao.Relatorios.exportar" data-action="PainelLogistico.relatorio.exportar_rota" data-context-required="true" data-sensitive="true">Exportar CSV</Button>
              )}
            </div>
            <div className="border rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2">Rota</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Entregues</th>
                    <th className="text-right p-2">Frustradas</th>
                    <th className="text-right p-2">Atraso</th>
                    <th className="text-right p-2">SLA%</th>
                  </tr>
                </thead>
                <tbody>
                  {porRota.map((r) => (
                    <tr key={r.key} className="border-t">
                      <td className="p-2">{r.key}</td>
                      <td className="p-2 text-right">{r.total}</td>
                      <td className="p-2 text-right">{r.entregues}</td>
                      <td className="p-2 text-right">{r.frustradas}</td>
                      <td className="p-2 text-right">{r.atraso}</td>
                      <td className="p-2 text-right">{r.sla}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}