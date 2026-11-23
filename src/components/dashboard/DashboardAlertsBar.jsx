/**
 * DashboardAlertsBar — alertas acionáveis no topo do Dashboard.
 * Origem Base44 (erp-integra-novo DashboardAlertsBar @ 5a8c26fab).
 * Extração do Dashboard.jsx (>600 linhas): concentra chips que já existiam
 * espalhados (estoque, aprovação, inadimplência, anomalia) com drill-down.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X, ChevronRight, Package, DollarSign, ShoppingCart, Zap } from 'lucide-react';
import { createPageUrl } from '@/utils';

const ALERT_CONFIG = {
  estoque: { icon: Package, color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Estoque crítico' },
  inadimplencia: { icon: DollarSign, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'Inadimplência' },
  pedidos: { icon: ShoppingCart, color: 'text-amber-800', bg: 'bg-amber-50 border-amber-200', label: 'Pedidos aguardando' },
  anomalia: { icon: Zap, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', label: 'Anomalia financeira' },
};

const DISMISS_TTL_MS = 15 * 60 * 1000;

/** Chave por grupo/empresa — dismiss de uma empresa não esconde alertas de outra. */
export function dashboardAlertsDismissKey(groupId, empresaId) {
  const g = String(groupId || '').trim();
  if (!g) return null;
  const e = String(empresaId || '').trim();
  return `dashboard_alerts_dismissed_at:${g}:${e || 'grupo'}`;
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
        if (typeof onNavigate === 'function') onNavigate(to);
      }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${cfg.bg}`}
      data-permission={permission}
      data-action={action}
      data-context-required="true"
      title={cfg.label}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.color}`} aria-hidden />
      <span className={`${cfg.color} truncate max-w-[200px]`}>{message}</span>
      <ChevronRight className={`w-3 h-3 flex-shrink-0 ${cfg.color} opacity-60`} aria-hidden />
    </button>
  );
}

/**
 * Contagens/KPIs: number | string | null (policy pode usar toFixed → string).
 * Escopo de dismiss vem do Dashboard pai (mesmo groupId/empresaId do hasContextoAtivo).
 * @param {{
 *   groupId?: string | null,
 *   empresaId?: string | null,
 *   produtosBaixoEstoque?: number | string | null,
 *   taxaInadimplencia?: number | string | null,
 *   pedidosAguardando?: number | string | null,
 *   anomaliasCount?: number | string | null,
 *   hasContextoAtivo?: boolean,
 *   canSeeEstoque?: boolean,
 *   canSeeFinanceiro?: boolean,
 *   canSeeComercial?: boolean,
 *   onNavigate?: (url: string) => void,
 * }} props
 */
export default function DashboardAlertsBar({
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
  onNavigate,
}) {
  const storageKey = useMemo(
    () => dashboardAlertsDismissKey(groupId, empresaId),
    [groupId, empresaId],
  );
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));
  const sessionTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  // Troca de grupo/empresa: reaplica dismiss só do storage dessa chave.
  // Sem chave: não zera dismiss de sessão (evita reaparecer no próximo effect).
  useEffect(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (!storageKey) {
      return undefined;
    }
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

  if (!hasContextoAtivo || dismissed) return null;

  const estoqueN = Number(produtosBaixoEstoque);
  const inadN = Number(taxaInadimplencia);
  const pedN = Number(pedidosAguardando);
  const anomN = Number(anomaliasCount);

  /** Só alerta com número confirmado > 0 (nunca fabricar alerta de loading/null). */
  const alerts = [
    canSeeEstoque && Number.isFinite(estoqueN) && estoqueN > 0 && {
      type: 'estoque',
      message: `${estoqueN} produto${estoqueN > 1 ? 's' : ''} com estoque baixo`,
      to: createPageUrl('Estoque'),
      permission: 'Estoque.visualizar',
      action: 'Dashboard.alerta.estoque-critico',
    },
    canSeeFinanceiro && Number.isFinite(inadN) && inadN >= 10 && {
      type: 'inadimplencia',
      message: `Inadimplência em ${inadN}% — atenção`,
      to: createPageUrl('Financeiro'),
      permission: 'Financeiro.visualizar',
      action: 'Dashboard.alerta.inadimplencia',
    },
    canSeeComercial && Number.isFinite(pedN) && pedN > 0 && {
      type: 'pedidos',
      message: `${pedN} pedido${pedN > 1 ? 's' : ''} aguardando aprovação`,
      to: createPageUrl('Comercial'),
      permission: 'Comercial.visualizar',
      action: 'Dashboard.alerta.aprovacao',
    },
    canSeeFinanceiro && Number.isFinite(anomN) && anomN > 0 && {
      type: 'anomalia',
      message: `${anomN} anomalia${anomN > 1 ? 's' : ''} financeira${anomN > 1 ? 's' : ''}`,
      to: createPageUrl('Financeiro'),
      permission: 'Financeiro.visualizar',
      action: 'Dashboard.alerta.anomalia',
    },
  ].filter(Boolean);

  if (!alerts.length) return null;

  return (
    <div
      className="w-full flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-md border border-slate-200 shadow-sm"
      data-block="dashboard-alerts-bar"
      role="status"
      aria-label="Alertas do dashboard"
    >
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden />
      <span className="text-xs text-slate-500 font-medium flex-shrink-0">Alertas:</span>
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
              /* ignore — ainda esconde na sessão com TTL abaixo */
            }
          }
          setDismissed(true);
          // TTL mesmo sem storage (sessão) ou se setItem falhar — não depende de dismissTick.
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
  );
}
