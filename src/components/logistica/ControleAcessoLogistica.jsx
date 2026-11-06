import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  resolveControleAcessoLogisticaKpiState,
  isControleAcessoLogisticaScopeCurrent,
  buildControleAcessoLogisticaQueryKey,
  buildPermissoesLogistica,
} from "./controleAcessoLogisticaScope";

function readControleAcessoLogisticaActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token) };
}

/**
 * PerfilAcesso via getInContext; sem auth.me / filter unscoped; fail-closed ≠ liberar.
 */
export function usePermissoesLogistica() {
  const { user, isLoading: loadingUser } = useUser();
  const { getInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'grupo' ? null : (empresaAtual?.id || null);
  const contextoValido = Boolean(groupId || empresaId);
  const { actorId, sessionKey } = readControleAcessoLogisticaActorAndSession();
  const scopeExpected = { actorId, sessionKey };
  const perfilId = user?.perfil_acesso_id || null;

  const perfilQuery = useQuery({
    queryKey: buildControleAcessoLogisticaQueryKey({
      groupId, empresaId, actorId, sessionKey, perfilId,
    }),
    queryFn: async ({ signal }) => {
      if (!perfilId) return null;
      const perfil = await getInContext('PerfilAcesso', perfilId);
      if (signal?.aborted) {
        const err = new Error('CONTROLE_ACESSO_LOGISTICA_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isControleAcessoLogisticaScopeCurrent(scopeExpected, readControleAcessoLogisticaActorAndSession())) {
        throw new Error('CONTROLE_ACESSO_LOGISTICA_STALE_SCOPE');
      }
      return perfil || null;
    },
    enabled: Boolean(perfilId) && contextoValido && !loadingUser,
  });

  const kpiState = resolveControleAcessoLogisticaKpiState({
    hasUser: Boolean(user) && !loadingUser,
    contextoValido,
    isLoading: loadingUser || perfilQuery.isLoading,
    isError: perfilQuery.isError,
    isFetching: perfilQuery.isFetching,
    dataDefined: !perfilId || perfilQuery.data !== undefined,
  });

  const flags = buildPermissoesLogistica(perfilQuery.data, user, kpiState);

  return {
    ...flags,
    user,
    perfil: kpiState === 'ready' ? (perfilQuery.data || null) : null,
  };
}

/**
 * Componente para proteger ações de logística
 */
export function ProtegerAcaoLogistica({ acao, children, fallback = null }) {
  const permissoes = usePermissoesLogistica();

  const mapeamentoAcoes = {
    'criarRomaneio': permissoes.podeCriarRomaneio,
    'confirmarEntrega': permissoes.podeConfirmarEntrega,
    'registrarOcorrencia': permissoes.podeRegistrarOcorrencia,
    'roteirizar': permissoes.podeRoteirizar,
    'visualizarRotas': permissoes.podeVisualizarRotas
  };

  const temPermissao = mapeamentoAcoes[acao] === true;

  if (!temPermissao) {
    return fallback;
  }

  return <>{children}</>;
}

export default usePermissoesLogistica;
