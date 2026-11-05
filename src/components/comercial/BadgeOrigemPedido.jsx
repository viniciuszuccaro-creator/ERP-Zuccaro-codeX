import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Lock, Bolt, User } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildBadgeOrigemQueryKey,
  isBadgeOrigemScopeCurrent,
} from "./badgeOrigemScope";

function readBadgeActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * Badge visual inteligente para origem de pedido
 * Mostra cor e ícone baseado no parâmetro configurado
 * 
 * @param {{origemPedido: string, showLock?: boolean, className?: string}} props
 */
export default function BadgeOrigemPedido({ 
  origemPedido, 
  showLock = true,
  className = "" 
}) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readBadgeActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  // Escopo multiempresa: ParametroOrigemPedido via filterInContext (sem list unscoped).
  // Sem initialData vazio — loading ≠ fallback silencioso. Cache ator/sessão.
  const {
    data: parametros,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: buildBadgeOrigemQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('ParametroOrigemPedido', {}, 'canal', 200);
      if (signal?.aborted) {
        const err = new Error('BADGE_ORIGEM_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isBadgeOrigemScopeCurrent(scopeExpected, readBadgeActorAndSession())) {
        throw new Error('BADGE_ORIGEM_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const lista = Array.isArray(parametros) ? parametros : [];
  const parametrosIndisponiveis = !contextoValido || isLoading || isError || (isFetching && parametros === undefined);

  // Mapear origem para canal
  const origemParaCanal = {
    'Manual': 'ERP',
    'Site': 'Site',
    'E-commerce': 'E-commerce',
    'Chatbot': 'Chatbot',
    'WhatsApp': 'WhatsApp',
    'Portal': 'Portal Cliente',
    'Marketplace': 'Marketplace',
    'API': 'API',
    'App': 'App Mobile',
    'Importado': 'API'
  };

  const canal = origemParaCanal[origemPedido] || 'ERP';
  const parametro = parametrosIndisponiveis ? null : lista.find(p => p.canal === canal);

  // Cores por badge
  const coresClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    pink: 'bg-pink-100 text-pink-800 border-pink-300',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-300'
  };

  const corClasse = parametro?.cor_badge 
    ? coresClasses[parametro.cor_badge] 
    : coresClasses.blue;

  const iconesTipo = {
    'Manual': User,
    'Automático': Bolt,
    'Misto': Bolt
  };

  const Icone = parametro?.tipo_criacao 
    ? iconesTipo[parametro.tipo_criacao] 
    : User;

  const ehBloqueado = parametro?.tipo_criacao === 'Automático' && parametro?.bloquear_edicao_automatico;

  // Fail-closed de apresentação: sem contexto/erro mostra origem crua, sem inventar parâmetro.
  const rotulo = parametrosIndisponiveis
    ? (origemPedido || '—')
    : (parametro?.nome || origemPedido);

  return (
    <Badge
      className={`${corClasse} border ${className}`}
      title={isError ? 'Parâmetros de origem indisponíveis (erro de carga ≠ zero)' : undefined}
      data-origem-indisponivel={parametrosIndisponiveis ? '1' : '0'}
    >
      <Icone className="w-3 h-3 mr-1" />
      {rotulo}
      {ehBloqueado && showLock && (
        <Lock className="w-3 h-3 ml-1" />
      )}
    </Badge>
  );
}
