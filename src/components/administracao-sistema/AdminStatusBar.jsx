import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { CheckCircle2, AlertCircle, XCircle, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * AdminStatusBar — barra de saúde em tempo real do sistema.
 * Mostra status de integrações, segurança e IA em um único painel compacto.
 */
export default function AdminStatusBar() {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const eId = empresaAtual?.id;
  const gId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();

  const { data: configs = [], isFetching } = useQuery({
    queryKey: ["admin-status-bar", eId ?? "sem", gId ?? "sem"],
    queryFn: async () => {
      try {
        const orConds = [];
        if (gId) orConds.push({ group_id: gId });
        if (eId) orConds.push({ empresa_id: eId });
        orConds.push({ empresa_id: null, group_id: null });
        const res = await base44.functions.invoke("getEntityRecord", {
          entityName: "ConfiguracaoSistema",
          filter: orConds.length > 1 ? { $or: orConds } : (orConds[0] || {}),
          group_id: gId || null,
          empresa_id: eId || null,
          limit: 200,
          sort: "-updated_date",
        });
        return Array.isArray(res?.data) ? res.data : [];
      } catch (error) {
        console.warn("[AdminStatusBar] Falha ao consultar configuracoes:", error);
        return [];
      }
    },
    enabled: true,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 60000, // Atualiza a cada 1 min
  });

  const getToggle = (chave) => {
    const match = configs.find((c) => c.chave === chave && (
      (eId && c.empresa_id === eId) ||
      (gId && c.group_id === gId) ||
      (!c.empresa_id && !c.group_id)
    ));
    return match?.ativa === true;
  };

  const getIntegracao = (chave, campo) => {
    const match = configs.find((c) => c.chave === chave);
    return !!(match?.[campo]?.api_key || match?.[campo]?.ativa);
  };

  const indicators = [
    { label: "NF-e", ok: getIntegracao("integracao_nfe", "integracao_nfe") || getToggle("integracao_nfe") },
    { label: "Boleto/PIX", ok: getIntegracao("integracao_boletos", "integracao_boletos") || getToggle("integracao_boletos") },
    { label: "WhatsApp", ok: getToggle("integracao_whatsapp") },
    { label: "Notif. Pedido", ok: getToggle("notif_pedido_aprovado") },
    { label: "IA Vendas", ok: getToggle("ia_preditiva_vendas") },
    { label: "IA Finanças", ok: getToggle("ia_anomalia_financeira") },
  ];

  const okCount = indicators.filter((i) => i.ok).length;
  const totalCount = indicators.length;
  const healthPct = Math.round((okCount / totalCount) * 100);
  const healthColor =
    healthPct >= 80 ? "text-green-600" : healthPct >= 50 ? "text-amber-600" : "text-red-600";
  const healthBg =
    healthPct >= 80 ? "bg-green-50 border-green-200" : healthPct >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className={`w-full border rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3 ${healthBg}`}>
      {/* Score geral */}
      <div className="flex items-center gap-2 min-w-[120px]">
        {isFetching ? (
          <Wifi className="w-4 h-4 text-blue-400 animate-pulse" />
        ) : healthPct >= 80 ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-600" />
        )}
        <span className={`font-bold text-sm ${healthColor}`}>
          Saúde: {healthPct}%
        </span>
        <span className="text-xs text-slate-500">({okCount}/{totalCount} ativos)</span>
      </div>

      <div className="h-4 w-px bg-slate-300 hidden sm:block" />

      {/* Indicadores individuais */}
      <div className="flex flex-wrap gap-1.5">
        {indicators.map(({ label, ok }) => (
          <Badge
            key={label}
            className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${
              ok
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {ok ? (
              <CheckCircle2 className="w-2.5 h-2.5" />
            ) : (
              <XCircle className="w-2.5 h-2.5 text-slate-400" />
            )}
            {label}
          </Badge>
        ))}
      </div>

      {!eId && !gId && (
        <span className="text-xs text-amber-700 ml-auto">
          ⚠️ Selecione empresa/grupo para ver status real
        </span>
      )}
    </div>
  );
}
