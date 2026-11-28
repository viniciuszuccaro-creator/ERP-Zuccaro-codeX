/**
 * DashboardAlertsBar — alertas acionáveis no topo do Dashboard.
 * Referência Base44 (erp-integra-novo DashboardAlertsBar) + escopo multiempresa
 * com dismiss isolado por groupId/empresaId e drill-down preservando filtros do período.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, X, ChevronRight, Package, DollarSign, ShoppingCart, Zap, RefreshCw } from "lucide-react";

const ALERT_CONFIG = {
  estoque: { icon: Package, color: "text-red-700", bg: "bg-red-50 border-red-200", label: "Estoque crítico" },
  inadimplencia: { icon: DollarSign, color: "text-orange-700", bg: "bg-orange-50 border-orange-200", label: "Inadimplência" },
  pedidos: { icon: ShoppingCart, color: "text-amber-800", bg: "bg-amber-50 border-amber-200", label: "Pedidos aguardando" },
  anomalia: { icon: Zap, color: "text-purple-700", bg: "bg-purple-50 border-purple-200", label: "Anomalia financeira" },
};

const DISMISS_TTL_MS = 15 * 60 * 1000;

/** Chave por grupo/empresa — dismiss de uma empresa não esconde alertas de outra. */
export function dashboardAlertsDismissKey(groupId, empresaId) {
  const g = String(groupId || "").trim();
  if (!g) return null;
  const e = String(empresaId || "").trim();
  return `dashboard_alerts_dismissed_at:${g}:${e || "grupo"}`;
}

function readDismissed(storageKey) {
  if (!storageKey) return false;
  try {
    const ts = Number(localStorage.getItem(storageKey) || 0);
    return ts > 0 && Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function AlertChip({ type, message, to, onNavigate, permission, action }) {
  const cfg = ALERT_CONFIG[type] || ALERT_CONFIG.anomalia;
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof onNavigate === "function" && to) onNavigate(to);
      }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${cfg.bg}`}
      data-permission={permission}
      data-action={action}
      data-drilldown-url={to}
      data-context-required="true"
      title={`${cfg.label} — abrir relatório filtrado`}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.color}`} aria-hidden />
      <span className={`${cfg.color} truncate max-w-[240px]`}>{message}</span>
      <ChevronRight className={`w-3 h-3 flex-shrink-0 ${cfg.color} opacity-60`} aria-hidden />
    </button>
  );
}

/**
 * Contagens/KPIs: number | string | null (nunca fabrica alerta de loading/null/erro).
 */
export default function DashboardAlertsBar(/** @type {any} */ {
  groupId = null,
  empresaId = null,
  produtosBaixoEstoque = null,
  taxaInadimplencia = null,
  pedidosAguardando = null,
  anomaliasCount = null,
  hasContextoAtivo = true,
  canSeeEstoque = true,
  canSeeFinanceiro = true,
  canSeeComercial = true,
  failedSources = [],
  onRetryAll,
  drillDownUrls = {},
  onNavigate,
}) {
  const storageKey = useMemo(
    () => dashboardAlertsDismissKey(groupId, empresaId),
    [groupId, empresaId],
  );
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));
  const sessionTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (!storageKey) return undefined;
    const hidden = readDismissed(storageKey);
    setDismissed(hidden);
    if (!hidden) return undefined;
    let remaining = 0;
    try {
      const ts = Number(localStorage.getItem(storageKey) || 0);
      remaining = Math.max(0, DISMISS_TTL_MS - (Date.now() - ts));
    } catch {
      setDismissed(false);
      return undefined;
    }
    if (remaining === 0) {
      setDismissed(false);
      return undefined;
    }
    const timer = setTimeout(() => setDismissed(false), remaining);
    return () => clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => () => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
  }, []);

  if (!hasContextoAtivo) return null;

  const estoqueN = produtosBaixoEstoque === null || produtosBaixoEstoque === undefined ? NaN : Number(produtosBaixoEstoque);
  const inadN = taxaInadimplencia === null || taxaInadimplencia === undefined ? NaN : Number(taxaInadimplencia);
  const pedN = pedidosAguardando === null || pedidosAguardando === undefined ? NaN : Number(pedidosAguardando);
  const anomN = anomaliasCount === null || anomaliasCount === undefined ? NaN : Number(anomaliasCount);

  const alerts = dismissed ? [] : [
    canSeeEstoque && Number.isFinite(estoqueN) && estoqueN > 0 && {
      type: "estoque",
      message: `${estoqueN} produto${estoqueN > 1 ? "s" : ""} com estoque baixo`,
      to: drillDownUrls.estoque || "/Relatorios?tab=estoque",
      permission: "Estoque.visualizar",
      action: "Dashboard.alerta.estoque-critico",
    },
    canSeeFinanceiro && Number.isFinite(inadN) && inadN >= 10 && {
      type: "inadimplencia",
      message: `Inadimplência em ${inadN}% — atenção`,
      to: drillDownUrls.inadimplencia || "/Relatorios?tab=financeiro",
      permission: "Financeiro.visualizar",
      action: "Dashboard.alerta.inadimplencia",
    },
    canSeeComercial && Number.isFinite(pedN) && pedN > 0 && {
      type: "pedidos",
      message: `${pedN} pedido${pedN > 1 ? "s" : ""} aguardando aprovação`,
      to: drillDownUrls.pedidos || "/Relatorios?tab=vendas",
      permission: "Comercial.visualizar",
      action: "Dashboard.alerta.aprovacao",
    },
    canSeeFinanceiro && Number.isFinite(anomN) && anomN > 0 && {
      type: "anomalia",
      message: `${anomN} anomalia${anomN > 1 ? "s" : ""} financeira${anomN > 1 ? "s" : ""}`,
      to: drillDownUrls.anomalia || "/Relatorios?tab=financeiro",
      permission: "Financeiro.visualizar",
      action: "Dashboard.alerta.anomalia",
    },
  ].filter(Boolean);

  const failedList = Array.isArray(failedSources) ? failedSources.filter(Boolean) : [];
  if (!alerts.length && !failedList.length) return null;

  return (
    <div className="w-full space-y-2" data-block="dashboard-alerts-container">
      {failedList.length > 0 && (
        <div
          className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-800 text-xs"
          role="alert"
          data-block="dashboard-error-banner"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden />
            <span>
              <strong>Indicadores indisponíveis por erro de consulta</strong> ({failedList.join(", ")}).
              Valores indisponíveis são exibidos como &ldquo;Indisponível&rdquo; e nunca como zero.
            </span>
          </div>
          {typeof onRetryAll === "function" && (
            <button
              type="button"
              onClick={onRetryAll}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-300 bg-white text-red-700 hover:bg-red-100 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              data-action="Dashboard.recarregar_fontes"
            >
              <RefreshCw className="w-3 h-3" aria-hidden />
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {alerts.length > 0 && (
        <div
          className="w-full flex flex-wrap items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-md border border-slate-200 shadow-sm"
          data-block="dashboard-alerts-bar"
          role="status"
          aria-label="Alertas do dashboard"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden />
          <span className="text-xs text-slate-600 font-medium flex-shrink-0">Alertas confirmados:</span>
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
            {alerts.map((a) => (
              <AlertChip key={a.action} {...a} onNavigate={onNavigate} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (sessionTimerRef.current) {
                clearTimeout(sessionTimerRef.current);
                sessionTimerRef.current = null;
              }
              if (storageKey) {
                try {
                  localStorage.setItem(storageKey, String(Date.now()));
                } catch {
                  /* fallback TTL em sessão */
                }
              }
              setDismissed(true);
              sessionTimerRef.current = setTimeout(() => {
                sessionTimerRef.current = null;
                setDismissed(false);
              }, DISMISS_TTL_MS);
            }}
            className="ml-auto flex-shrink-0 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
            aria-label="Dispensar alertas por 15 minutos"
            data-action="Dashboard.alerta.dispensar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
