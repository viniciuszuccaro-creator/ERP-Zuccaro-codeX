import React from "react";
import DashboardMultiempresaBanner from "@/components/dashboard/DashboardMultiempresaBanner";
import DashboardAlertsBar from "@/components/dashboard/DashboardAlertsBar";
import DashboardKPIStrip from "@/components/dashboard/DashboardKPIStrip";
import DashboardAcoesRapidas from "@/components/dashboard/DashboardAcoesRapidas";

/**
 * DashboardExecutiveTopSection — bloco superior modular do Dashboard (ref. erp-integra-novo),
 * reunindo contexto multiempresa, alertas confirmados, faixa executiva de 8 KPIs e atalhos rápidos.
 */
export default function DashboardExecutiveTopSection({
  estaNoGrupo = false,
  hasContextoAtivo = false,
  groupId = null,
  empresaId = null,
  grupoAtual = null,
  empresaAtual = null,
  empresasDoGrupo = [],
  alternarContexto,
  canSeeDashboard = true,
  canSeeComercial = false,
  canSeeFinanceiro = false,
  canSeeEstoque = false,
  canSeeExpedicao = false,
  canSeeProducao = false,
  canSeeCadastros = false,
  canSeeRelatorios = false,
  viewModel,
  anomaliasCount = null,
  onRetryAll,
  onNavigate,
}) {
  const effective = viewModel?.effectiveValues || {};
  const states = viewModel?.states || {};

  // Só repassa alertas se a fonte correspondente não estiver em erro/carregando/sem acesso
  const confirmedEstoqueBaixo =
    states.estoqueBaixo?.state === "ok" || states.estoqueBaixo?.state === "zero_confirmado"
      ? effective.produtosBaixoEstoque
      : null;
  const confirmedInadimplencia =
    states.inadimplencia?.state === "ok" || states.inadimplencia?.state === "zero_confirmado"
      ? effective.taxaInadimplencia
      : null;
  const confirmedPedidosAguardando =
    states.pedidosPeriodo?.state === "ok" || states.pedidosPeriodo?.state === "zero_confirmado"
      ? effective.pedidosAguardando
      : null;

  return (
    <div className="w-full space-y-3" data-block="dashboard-executive-top">
      <DashboardMultiempresaBanner
        estaNoGrupo={estaNoGrupo}
        hasContextoAtivo={hasContextoAtivo}
        grupoAtual={grupoAtual}
        empresaAtual={empresaAtual}
        empresasDoGrupo={empresasDoGrupo}
        alternarContexto={alternarContexto}
        canSeeDashboard={canSeeDashboard}
        officialAggregateActive={Boolean(viewModel?.officialAggregateActive)}
        hasQueryError={(viewModel?.failedSources || []).length > 0}
      />

      <DashboardAlertsBar
        groupId={groupId}
        empresaId={estaNoGrupo ? null : empresaId}
        produtosBaixoEstoque={confirmedEstoqueBaixo}
        taxaInadimplencia={confirmedInadimplencia}
        pedidosAguardando={confirmedPedidosAguardando}
        anomaliasCount={anomaliasCount}
        hasContextoAtivo={hasContextoAtivo}
        canSeeEstoque={canSeeEstoque}
        canSeeFinanceiro={canSeeFinanceiro}
        canSeeComercial={canSeeComercial}
        failedSources={viewModel?.failedSources || []}
        onRetryAll={onRetryAll}
        drillDownUrls={{
          estoque: viewModel?.drillDownUrls?.estoque,
          inadimplencia: viewModel?.drillDownUrls?.inadimplencia,
          pedidos: viewModel?.drillDownUrls?.pedidosAprovacao,
          anomalia: viewModel?.drillDownUrls?.anomalia,
        }}
        onNavigate={onNavigate}
      />

      <DashboardKPIStrip
        items={viewModel?.stripItems || []}
        onNavigate={onNavigate}
      />

      <DashboardAcoesRapidas
        hasContextoAtivo={hasContextoAtivo}
        canSeeComercial={canSeeComercial}
        canSeeFinanceiro={canSeeFinanceiro}
        canSeeEstoque={canSeeEstoque}
        canSeeExpedicao={canSeeExpedicao}
        canSeeProducao={canSeeProducao}
        canSeeCadastros={canSeeCadastros}
        canSeeRelatorios={canSeeRelatorios}
        relatoriosUrl={viewModel?.drillDownUrls?.relatoriosGeral || ""}
        onNavigate={onNavigate}
      />
    </div>
  );
}
