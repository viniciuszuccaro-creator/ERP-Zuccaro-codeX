import React from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardSeguranca from "@/components/sistema/DashboardSeguranca";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  resolveSegurancaDashboardKpiState,
  isSegurancaDashboardScopeCurrent,
  buildSegurancaDashboardQueryKey,
  usuarioNoEscopoSegurancaDashboard,
  buildSegurancaDashboardEstatisticas,
} from "./segurancaDashboardScope";

function readSegurancaDashboardActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token) };
}

/**
 * User/Perfil/AuditLog via filterInContext; KPI 0 ≠ ready em loading/erro.
 */
export default function SegurancaDashboard() {
  const { filterInContext, createInContext, contexto, empresasDoGrupo = [], empresaAtual, grupoAtual } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const canView =
    isAdmin() ||
    hasPermission("Sistema", "Seguranca", "visualizar") ||
    hasPermission("Sistema", "Segurança", "visualizar");
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "grupo" ? null : (empresaAtual?.id || null);
  const contextoValido = Boolean(groupId || empresaId);
  const { actorId, sessionKey } = readSegurancaDashboardActorAndSession();
  const scopeExpected = { actorId, sessionKey };
  const escopoOpts = {
    contexto,
    grupoAtivoId: groupId,
    empresaAtivaId: empresaId,
    empresasDoGrupo,
  };

  const dashboardQuery = useQuery({
    queryKey: buildSegurancaDashboardQueryKey({ groupId, empresaId, actorId, sessionKey }),
    enabled: canView && contextoValido,
    queryFn: async ({ signal }) => {
      const [usuariosRaw, perfis, auditoriaAcessos] = await Promise.all([
        filterInContext("User", {}, "-updated_date", 500),
        filterInContext("PerfilAcesso", {}, "-updated_date", 500),
        filterInContext("AuditLog", {}, "-data_hora", 100),
      ]);
      if (signal?.aborted) {
        const err = new Error('SEGURANCA_DASHBOARD_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isSegurancaDashboardScopeCurrent(scopeExpected, readSegurancaDashboardActorAndSession())) {
        throw new Error('SEGURANCA_DASHBOARD_STALE_SCOPE');
      }
      const usuarios = (Array.isArray(usuariosRaw) ? usuariosRaw : [])
        .filter((u) => usuarioNoEscopoSegurancaDashboard(u, escopoOpts));
      return {
        usuarios,
        perfis: Array.isArray(perfis) ? perfis : [],
        auditoriaAcessos: Array.isArray(auditoriaAcessos) ? auditoriaAcessos : [],
        estatisticas: buildSegurancaDashboardEstatisticas(usuarios, auditoriaAcessos),
      };
    },
  });

  const kpiState = resolveSegurancaDashboardKpiState({
    canView,
    contextoValido,
    isLoading: dashboardQuery.isLoading,
    isError: dashboardQuery.isError,
    isFetching: dashboardQuery.isFetching,
    dataDefined: dashboardQuery.data !== undefined,
  });
  const ready = kpiState === 'ready';
  const data = ready ? dashboardQuery.data : null;

  React.useEffect(() => {
    const acao = canView ? "visualizar_dashboard_seguranca" : "bloqueio_dashboard_seguranca";
    if (!contextoValido && canView) return;
    void createInContext("AuditLog", {
      acao,
      entidade: "DashboardSeguranca",
      descricao: canView
        ? "Visualizacao do dashboard de seguranca contextual"
        : "Bloqueio de acesso ao dashboard de seguranca por RBAC",
      severidade: canView ? "info" : "warning",
      sucesso: canView,
      group_id: groupId || null,
      grupo_id: groupId || null,
      empresa_id: empresaId,
      dados_novos: {
        contexto: contexto || "indefinido",
        escopo: groupId || empresaId || "sem-contexto",
        permissao: "Sistema.Seguranca.visualizar",
      },
    }).catch((error) => {
      console.warn("Falha ao auditar dashboard de seguranca:", error);
    });
  }, [canView, contexto, contextoValido, createInContext, empresaId, groupId]);

  if (!canView) {
    return <div className="w-full h-full p-4 text-sm text-slate-500">Acesso restrito.</div>;
  }

  if (!contextoValido) {
    return (
      <div className="w-full h-full p-4 text-sm text-slate-500" data-context-required="true">
        Selecione Grupo ou Empresa para visualizar o dashboard de seguranca.
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="w-full h-full p-4 text-sm text-slate-500">
        {kpiState === 'loading' ? 'Carregando dashboard de seguranca…' : 'Erro ao carregar dashboard de seguranca.'}
      </div>
    );
  }

  return (
    <div className="w-full h-full" data-permission="Sistema.Seguranca.visualizar">
      <DashboardSeguranca
        estatisticas={data?.estatisticas}
        perfis={data?.perfis || []}
        usuarios={data?.usuarios || []}
        auditoriaAcessos={data?.auditoriaAcessos || []}
      />
    </div>
  );
}
