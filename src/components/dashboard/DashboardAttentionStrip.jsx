/**
 * DashboardAttentionStrip — faixa operacional: atrasados, pronto para expedir, recebimentos.
 * Extração do Dashboard.jsx (>600 linhas). Origem Base44 (AcoesRapidas / resumo operacional)
 * consolidada no Dashboard existente com drill-down e estados fail-closed.
 */
import React from 'react';
import { AlertTriangle, Truck, Wallet } from 'lucide-react';

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

/**
 * @param {{
 *   hasContextoAtivo?: boolean,
 *   periodoLabel?: string,
 *   escopoLabel?: string,
 *   canSeeComercial?: boolean,
 *   canSeeExpedicao?: boolean,
 *   canSeeFinanceiro?: boolean,
 *   aprovacaoCount?: number | null,
 *   prontoExpedirCount?: number | null,
 *   receitasPendentes?: number | string | null,
 *   valorVencido?: number | string | null,
 *   onNavigate?: (target: 'comercial' | 'expedicao' | 'financeiro') => void,
 * }} props
 */
export default function DashboardAttentionStrip({
  hasContextoAtivo = true,
  periodoLabel = 'período atual',
  escopoLabel = 'empresa/grupo',
  canSeeComercial = true,
  canSeeExpedicao = true,
  canSeeFinanceiro = true,
  aprovacaoCount = null,
  prontoExpedirCount = null,
  receitasPendentes = null,
  valorVencido = null,
  onNavigate,
}) {
  if (!hasContextoAtivo) {
    return (
      <div
        className="w-full rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
        data-block="dashboard-attention-strip"
        role="status"
      >
        Selecione grupo/empresa para ver o que está atrasado, pronto para expedir e a receber.
      </div>
    );
  }

  const go = (target) => {
    if (typeof onNavigate === 'function') onNavigate(target);
  };

  const aprovN = Number(aprovacaoCount);
  const expedN = Number(prontoExpedirCount);
  const receitasN = Number(receitasPendentes);
  const vencidoN = Number(valorVencido);

  const cards = [
    canSeeComercial && {
      key: 'atrasados',
      icon: AlertTriangle,
      title: 'Atrasados / aprovação',
      period: periodoLabel,
      scope: escopoLabel,
      permission: 'Comercial.visualizar',
      action: 'Dashboard.atencao.aprovacao',
      target: 'comercial',
      accent: Number.isFinite(aprovN) && aprovN > 0,
      primary: !Number.isFinite(aprovN)
        ? '—'
        : `${aprovN} pedido${aprovN === 1 ? '' : 's'} aguardando`,
      secondary: Number.isFinite(aprovN) && aprovN === 0
        ? 'Nada pendente de aprovação (zero confirmado)'
        : 'Requer ação comercial',
    },
    canSeeExpedicao && {
      key: 'expedir',
      icon: Truck,
      title: 'Pronto para expedir',
      period: periodoLabel,
      scope: escopoLabel,
      permission: 'Expedição.visualizar',
      action: 'Dashboard.atencao.expedicao',
      target: 'expedicao',
      accent: Number.isFinite(expedN) && expedN > 0,
      primary: !Number.isFinite(expedN)
        ? '—'
        : `${expedN} entrega${expedN === 1 ? '' : 's'} pendente${expedN === 1 ? '' : 's'}`,
      secondary: Number.isFinite(expedN) && expedN === 0
        ? 'Fila de expedição zerada'
        : 'Ir para Expedição',
    },
    canSeeFinanceiro && {
      key: 'receber',
      icon: Wallet,
      title: 'Recebimentos',
      period: periodoLabel,
      scope: escopoLabel,
      permission: 'Financeiro.visualizar',
      action: 'Dashboard.atencao.receber',
      target: 'financeiro',
      accent: (Number.isFinite(vencidoN) && vencidoN > 0) || (Number.isFinite(receitasN) && receitasN > 0),
      primary: (() => {
        const money = formatMoney(receitasPendentes);
        if (money == null) return '—';
        return `${money} em aberto`;
      })(),
      secondary: (() => {
        const venc = formatMoney(valorVencido);
        if (venc == null) return 'Saldo a receber no escopo';
        if (Number.isFinite(vencidoN) && vencidoN === 0) return 'Sem vencidos (zero confirmado)';
        return `${venc} vencido`;
      })(),
    },
  ].filter(Boolean);

  if (!cards.length) {
    return (
      <div
        className="w-full rounded-md border border-slate-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        data-block="dashboard-attention-strip"
        role="status"
      >
        Sem permissão Comercial/Expedição/Financeiro para a faixa de atenção.
      </div>
    );
  }

  return (
    <div
      className="w-full grid grid-cols-1 md:grid-cols-3 gap-2"
      data-block="dashboard-attention-strip"
      role="region"
      aria-label="Atenção operacional do dashboard"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => go(card.target)}
            className={`text-left rounded-md border p-3 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              card.accent ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-white'
            }`}
            data-permission={card.permission}
            data-action={card.action}
            data-context-required="true"
          >
            <div className="flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${card.accent ? 'text-amber-700' : 'text-slate-500'}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800 truncate">{card.title}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {card.period} · {card.scope}
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-1 truncate">{card.primary}</div>
                <div className="text-[11px] text-slate-600 truncate">{card.secondary}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
