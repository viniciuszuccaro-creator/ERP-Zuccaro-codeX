import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, TrendingUp, Target, Zap } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildSugestorCanalQueryKey,
  isSugestorCanalScopeCurrent,
  resolveSugestorCanalKpiState,
} from "./sugestorCanalScope";

function readSugestorActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * V21.6 - IA que sugere o melhor canal de venda por cliente
 * Baseado no histórico de compras e preferências.
 *
 * Escopo multiempresa: Pedido/Cliente via filterInContext (sem filter/list unscoped).
 * Sem initialData vazio; loading/erro ≠ zero pedidos (não some o widget silenciosamente).
 */
export default function SugestorCanalInteligente({ clienteId, className = "" }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readSugestorActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };
  const scopeInput = { clienteId, groupId, empresaId, actorId, sessionKey };

  const {
    data: pedidosCliente,
    isLoading: isLoadingPedidos,
    isError: isErrorPedidos,
    isFetching: isFetchingPedidos,
  } = useQuery({
    queryKey: buildSugestorCanalQueryKey('sugestor-canal-pedidos', scopeInput),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext(
        'Pedido',
        { cliente_id: clienteId },
        '-created_date',
        200,
      );
      if (signal?.aborted) {
        const err = new Error('SUGESTOR_CANAL_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isSugestorCanalScopeCurrent(scopeExpected, readSugestorActorAndSession())) {
        throw new Error('SUGESTOR_CANAL_STALE_SCOPE');
      }
      return rows;
    },
    enabled: Boolean(clienteId) && contextoValido,
  });

  const {
    data: cliente,
    isLoading: isLoadingCliente,
    isError: isErrorCliente,
    isFetching: isFetchingCliente,
  } = useQuery({
    queryKey: buildSugestorCanalQueryKey('sugestor-canal-cliente', scopeInput),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Cliente', { id: clienteId }, undefined, 1);
      if (signal?.aborted) {
        const err = new Error('SUGESTOR_CANAL_CLIENTE_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isSugestorCanalScopeCurrent(scopeExpected, readSugestorActorAndSession())) {
        throw new Error('SUGESTOR_CANAL_CLIENTE_STALE_SCOPE');
      }
      return Array.isArray(rows) ? rows[0] || null : null;
    },
    enabled: Boolean(clienteId) && contextoValido,
  });

  const kpiState = resolveSugestorCanalKpiState({
    contextoValido,
    clienteId,
    isLoading: isLoadingPedidos || isLoadingCliente,
    isError: isErrorPedidos || isErrorCliente,
    isFetching: isFetchingPedidos || isFetchingCliente,
    dataDefined: pedidosCliente !== undefined,
  });

  if (kpiState === 'unavailable') {
    return null;
  }

  if (kpiState === 'loading') {
    return (
      <Card className={`border-slate-200 bg-slate-50 ${className}`}>
        <CardContent className="p-4 text-sm text-slate-600">
          Analisando canais do cliente…
        </CardContent>
      </Card>
    );
  }

  if (kpiState === 'error') {
    return (
      <Card className={`border-red-300 bg-red-50 ${className}`}>
        <CardContent className="p-4 text-sm text-red-900">
          Não foi possível analisar canais (erro ≠ zero pedidos).
        </CardContent>
      </Card>
    );
  }

  const lista = Array.isArray(pedidosCliente) ? pedidosCliente : [];
  if (lista.length === 0) {
    return null;
  }

  // Analisar padrões
  const analise = lista.reduce((acc, p) => {
    const origem = p.origem_pedido || 'Manual';
    if (!acc[origem]) {
      acc[origem] = { count: 0, valorTotal: 0, ultimaCompra: null };
    }
    acc[origem].count++;
    acc[origem].valorTotal += (p.valor_total || 0);
    if (!acc[origem].ultimaCompra || p.data_pedido > acc[origem].ultimaCompra) {
      acc[origem].ultimaCompra = p.data_pedido;
    }
    return acc;
  }, {});

  // Canal preferido (mais usado)
  const canalPreferido = Object.entries(analise)
    .sort((a, b) => b[1].count - a[1].count)[0];

  // Canal mais rentável
  const canalRentavel = Object.entries(analise)
    .sort((a, b) => b[1].valorTotal - a[1].valorTotal)[0];

  // Análise de uso do portal
  const usaPortal = cliente?.uso_portal?.total_acessos > 0;

  // Gerar recomendação IA
  const gerarRecomendacao = () => {
    const insights = [];

    if (canalPreferido) {
      const [canal, dados] = canalPreferido;
      const percentual = (dados.count / lista.length) * 100;
      
      insights.push({
        tipo: 'preferencia',
        icone: Target,
        cor: 'blue',
        titulo: 'Canal Preferido',
        texto: `${percentual.toFixed(0)}% dos pedidos via ${canal}`,
        sugestao: `Continue usando ${canal} - cliente tem familiaridade`
      });
    }

    if (canalRentavel && canalRentavel[0] !== canalPreferido?.[0]) {
      const [canal, dados] = canalRentavel;
      const ticketMedio = dados.valorTotal / dados.count;
      
      insights.push({
        tipo: 'rentavel',
        icone: TrendingUp,
        cor: 'green',
        titulo: 'Maior Ticket Médio',
        texto: `${canal}: R$ ${ticketMedio.toFixed(2)}`,
        sugestao: `Incentive vendas via ${canal} para maior valor`
      });
    }

    if (usaPortal && !canalPreferido?.[0]?.includes('Portal')) {
      insights.push({
        tipo: 'oportunidade',
        icone: Zap,
        cor: 'purple',
        titulo: 'Oportunidade: Portal',
        texto: `Cliente acessa portal (${cliente.uso_portal.total_acessos} vezes)`,
        sugestao: `Ative auto-pedido no portal para este cliente`
      });
    }

    const canaisUsados = Object.keys(analise).length;
    if (canaisUsados >= 3) {
      insights.push({
        tipo: 'multicanal',
        icone: Sparkles,
        cor: 'orange',
        titulo: 'Cliente Multi-canal',
        texto: `Usa ${canaisUsados} canais diferentes`,
        sugestao: `Cliente avançado - ofereça todos os canais`
      });
    }

    return insights;
  };

  const insights = gerarRecomendacao();

  if (insights.length === 0) {
    return null;
  }

  const coresClasse = {
    blue: 'border-blue-300 bg-blue-50',
    green: 'border-green-300 bg-green-50',
    purple: 'border-sky-300 bg-sky-50',
    orange: 'border-orange-300 bg-orange-50'
  };

  const coresBadge = {
    blue: 'bg-blue-600 text-white',
    green: 'bg-green-600 text-white',
    purple: 'bg-sky-600 text-white',
    orange: 'bg-orange-600 text-white'
  };

  return (
    <Card className={`border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-5 h-5 text-sky-600 animate-pulse" />
          💡 IA: Sugestões de Canal de Venda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, idx) => {
          const Icone = insight.icone;
          return (
            <Alert 
              key={idx} 
              className={`${coresClasse[insight.cor]} border-2`}
            >
              <Icone className={`w-4 h-4 text-${insight.cor}-600`} />
              <AlertDescription>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-900 mb-1">
                      {insight.titulo}
                    </p>
                    <p className="text-xs text-slate-700 mb-2">
                      {insight.texto}
                    </p>
                    <p className="text-xs text-slate-600 italic">
                      💡 {insight.sugestao}
                    </p>
                  </div>
                  <Badge className={coresBadge[insight.cor]}>
                    IA
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          );
        })}

        <div className="text-xs text-slate-500 text-center pt-2 border-t">
          🤖 Análise baseada em {lista.length} pedido(s) do cliente
        </div>
      </CardContent>
    </Card>
  );
}
