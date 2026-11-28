import React from "react";
import { Building2, Layers, ShieldAlert, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * DashboardMultiempresaBanner — faixa compacta de escopo Grupo x Empresa
 * (referência erp-integra-novo adaptada ao contrato canônico { groupId, empresaId, scopeType }).
 * Permite alternar entre Visão Consolidada do Grupo e Empresas autorizadas com fail-closed.
 */
export default function DashboardMultiempresaBanner({
  estaNoGrupo = false,
  hasContextoAtivo = false,
  grupoAtual = null,
  empresaAtual = null,
  empresasDoGrupo = [],
  alternarContexto,
  canSeeDashboard = true,
  officialAggregateActive = false,
  hasQueryError = false,
}) {
  const empresasLista = Array.isArray(empresasDoGrupo) ? empresasDoGrupo.filter((e) => e && e.id) : [];
  const nomeGrupo = grupoAtual?.nome_do_grupo || grupoAtual?.nome || "Grupo";
  const nomeEmpresa = empresaAtual?.nome_fantasia || empresaAtual?.razao_social || "Empresa";

  if (!hasContextoAtivo) {
    return (
      <div
        className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900"
        role="alert"
        data-block="dashboard-multiempresa-banner"
        data-context-state="sem-contexto"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
          <div className="text-xs sm:text-sm">
            <span className="font-semibold">Contexto multiempresa obrigatório:</span>{" "}
            selecione um Grupo ou Empresa para liberar indicadores e relatórios (modo fail-closed).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border shadow-sm ${
        estaNoGrupo
          ? "bg-gradient-to-r from-indigo-50 via-blue-50 to-sky-50 border-indigo-200"
          : "bg-gradient-to-r from-sky-50 via-white to-slate-50 border-sky-200"
      }`}
      data-block="dashboard-multiempresa-banner"
      data-scope-type={estaNoGrupo ? "grupo" : "empresa"}
      data-group-id={grupoAtual?.id || empresaAtual?.group_id || ""}
      data-empresa-id={estaNoGrupo ? "" : (empresaAtual?.id || "")}
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {estaNoGrupo ? (
          <Layers className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
        ) : (
          <Building2 className="w-4 h-4 text-sky-600 shrink-0" aria-hidden />
        )}
        <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
          {estaNoGrupo ? `Visão Consolidada • ${nomeGrupo}` : `Empresa Ativa • ${nomeEmpresa}`}
        </span>
        <Badge
          variant="outline"
          className={
            estaNoGrupo
              ? "bg-indigo-100/80 text-indigo-800 border-indigo-200 text-[11px]"
              : "bg-sky-100/80 text-sky-800 border-sky-200 text-[11px]"
          }
        >
          {estaNoGrupo
            ? `${empresasLista.length} empresa${empresasLista.length === 1 ? "" : "s"}`
            : "Escopo isolado"}
        </Badge>
        {officialAggregateActive ? (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] flex items-center gap-1"
            data-aggregate-source="official"
          >
            <CheckCircle2 className="w-3 h-3" aria-hidden />
            Agregados oficiais
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-600 border-slate-200 text-[11px] flex items-center gap-1"
            title="Contagens de Clientes/Produtos/Colaboradores usam countEntities canônico; agregados operacionais de período aguardam endpoint oficial do backend."
            data-aggregate-source="canonical-count-plus-derived"
          >
            <Info className="w-3 h-3" aria-hidden />
            Contagens canônicas • Operacional derivado
          </Badge>
        )}
        {hasQueryError && (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 text-[11px]"
            data-dashboard-query-error="true"
          >
            Erro parcial de leitura
          </Badge>
        )}
      </div>

      {typeof alternarContexto === "function" && empresasLista.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Alternar contexto multiempresa">
          <Button
            type="button"
            size="sm"
            variant={estaNoGrupo ? "default" : "outline"}
            disabled={!canSeeDashboard}
            onClick={() => alternarContexto("grupo")}
            className={`h-7 px-2.5 text-xs ${estaNoGrupo ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-white"}`}
            data-action="Dashboard.contexto.grupo"
            data-permission="Dashboard.visualizar"
          >
            <Layers className="w-3 h-3 mr-1" aria-hidden />
            Grupo
          </Button>
          {empresasLista.slice(0, 6).map((emp) => {
            const active = !estaNoGrupo && empresaAtual?.id === emp.id;
            const label = emp.nome_fantasia || emp.razao_social || emp.codigo || emp.id;
            return (
              <Button
                key={emp.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={!canSeeDashboard}
                onClick={() => alternarContexto("empresa", emp)}
                className={`h-7 px-2.5 text-xs max-w-[160px] truncate ${active ? "bg-sky-600 hover:bg-sky-700 text-white" : "bg-white"}`}
                data-action={`Dashboard.contexto.empresa.${emp.id}`}
                data-permission="Dashboard.visualizar"
                title={`Alternar para ${label}`}
              >
                <Building2 className="w-3 h-3 mr-1 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
