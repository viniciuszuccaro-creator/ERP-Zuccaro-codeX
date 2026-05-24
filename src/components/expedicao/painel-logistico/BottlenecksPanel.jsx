import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function msToH(ms){ return Math.round(ms/36e5); }

export default function BottlenecksPanel({ entregas = [], rules, onSelectEntrega, contextoValido = true, canView = true, onAudit }) {
  const itens = React.useMemo(() => {
    const now = new Date();
    const list = [];

    (entregas || []).forEach((e) => {
      // Busca timestamp da última vez que entrou em "Pronto para Expedir"
      let tsPronto = null;
      if (Array.isArray(e.historico_status)) {
        const match = [...e.historico_status].reverse().find(h => h.status === 'Pronto para Expedir' && h.data_hora);
        if (match) tsPronto = new Date(match.data_hora);
      }
      if (!tsPronto && e.data_separacao) tsPronto = new Date(e.data_separacao);

      if (tsPronto && (e.status === 'Pronto para Expedir' || e.status === 'Em Separação')) {
        const esperaH = msToH(now - tsPronto);
        const thr = rules?.maxEsperaCentroHoras ?? 4;
        if (esperaH >= 1) {
          list.push({
            id: e.id,
            chave: e.rota_id || e.regiao_entrega_nome || 'CD/Filial',
            cliente: e.cliente_nome,
            esperaH,
            critica: esperaH >= thr
          });
        }
      }
    });

    // Agrupa por chave (rota/região) e calcula médias
    const byKey = list.reduce((acc, it) => {
      const k = it.chave;
      const arr = acc[k] || [];
      arr.push(it);
      acc[k] = arr;
      return acc;
    }, {});

    const rows = Object.entries(byKey).map(([k, arr]) => {
      const media = Math.round(arr.reduce((s, x) => s + x.esperaH, 0) / arr.length);
      const max = Math.max(...arr.map(x => x.esperaH));
      const criticos = arr.filter(x => x.critica).length;
      return { chave: k, media, max, qtd: arr.length, criticos, exemplos: arr.slice(0,5) };
    }).sort((a,b) => (b.media - a.media) || (b.qtd - a.qtd));

    return rows;
  }, [entregas, rules]);

  return (
    <Card className="h-full" data-permission="Expedicao.PainelLogistico.visualizar" data-context-required="true">
      <CardHeader className="pb-2"><CardTitle className="text-base">Gargalos em Tempo Real (CD/Rotas)</CardTitle></CardHeader>
      <CardContent className="space-y-2 overflow-auto max-h-[32vh] text-sm">
        {(!contextoValido || !canView) && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {!contextoValido ? 'Selecione grupo/empresa para visualizar gargalos.' : 'Seu perfil nao tem permissao para visualizar gargalos.'}
          </div>
        )}
        {itens.length === 0 && <div className="text-slate-500">Sem gargalos detectados.</div>}
        {itens.map((r, idx) => (
          <div key={idx} className="border rounded p-2">
            <div className="flex items-center justify-between font-medium">
              <div className="truncate max-w-[65%]">{r.chave}</div>
              <div className={`${r.media >= (rules?.maxEsperaCentroHoras ?? 4) ? 'text-red-600' : 'text-slate-600'}`}>{r.media}h média</div>
            </div>
            <div className="text-xs text-slate-600">Máx: {r.max}h • Qtd: {r.qtd} • Críticos: {r.criticos}</div>
            <div className="mt-1 grid gap-1">
              {r.exemplos.map((e) => (
                <button key={e.id} disabled={!contextoValido || !canView} data-action="PainelLogistico.gargalo.selecionar" data-context-required="true" onClick={async () => { await onAudit?.({ acao: 'PainelLogistico.gargalo.selecionar', detalhes: { entrega_id: e.id, chave: r.chave } }); onSelectEntrega?.({ id: e.id }); }} className="text-left text-[11px] px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed">
                  {e.cliente} • {e.esperaH}h
                </button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}