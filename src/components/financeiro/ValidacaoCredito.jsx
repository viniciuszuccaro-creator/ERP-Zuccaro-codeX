import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, XCircle, DollarSign, TrendingUp } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildValidacaoCreditoClienteQueryKey,
  buildValidacaoCreditoPedidosQueryKey,
  isValidacaoCreditoScopeCurrent,
  resolveValidacaoCreditoKpiState,
  filtrarPedidosComprometemCredito,
} from "./validacaoCreditoScope";

function readValidacaoCreditoActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" ? session.actorId.trim() : "";
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * Componente de validação de crédito em tempo real
 * Usado no pedido antes de aprovar
 *
 * Escopo multiempresa: Cliente via getInContext; Pedido via filterInContext.
 * Loading/erro ≠ crédito zerado. STALE_SCOPE em resposta tardia.
 */
export default function ValidacaoCredito({ clienteId, valorPedido, pedidoId }) {
  const { empresaAtual, grupoAtual, getInContext, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readValidacaoCreditoActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  const {
    data: clienteData,
    isLoading: clienteLoading,
    isError: clienteError,
    isFetching: clienteFetching,
  } = useQuery({
    queryKey: buildValidacaoCreditoClienteQueryKey({
      groupId, empresaId, actorId, sessionKey, clienteId,
    }),
    queryFn: async ({ signal }) => {
      if (!clienteId) return null;
      const row = await getInContext('Cliente', clienteId);
      if (signal?.aborted) {
        const err = new Error('VALIDACAO_CREDITO_CLIENTE_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isValidacaoCreditoScopeCurrent(scopeExpected, readValidacaoCreditoActorAndSession())) {
        throw new Error('VALIDACAO_CREDITO_CLIENTE_STALE_SCOPE');
      }
      return row || null;
    },
    enabled: contextoValido && !!clienteId,
  });

  const {
    data: pedidosData,
    isLoading: pedidosLoading,
    isError: pedidosError,
    isFetching: pedidosFetching,
  } = useQuery({
    queryKey: buildValidacaoCreditoPedidosQueryKey({
      groupId, empresaId, actorId, sessionKey, clienteId, pedidoId,
    }),
    queryFn: async ({ signal }) => {
      if (!clienteId) return [];
      const pedidos = await filterInContext('Pedido', { cliente_id: clienteId }, '-created_date', 500);
      if (signal?.aborted) {
        const err = new Error('VALIDACAO_CREDITO_PEDIDOS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isValidacaoCreditoScopeCurrent(scopeExpected, readValidacaoCreditoActorAndSession())) {
        throw new Error('VALIDACAO_CREDITO_PEDIDOS_STALE_SCOPE');
      }
      return filtrarPedidosComprometemCredito(pedidos, pedidoId);
    },
    enabled: contextoValido && !!clienteId,
  });

  const clienteKpi = resolveValidacaoCreditoKpiState({
    contextoValido,
    clienteId,
    isLoading: clienteLoading,
    isError: clienteError,
    isFetching: clienteFetching,
    dataDefined: clienteData !== undefined,
  });
  const pedidosKpi = resolveValidacaoCreditoKpiState({
    contextoValido,
    clienteId,
    isLoading: pedidosLoading,
    isError: pedidosError,
    isFetching: pedidosFetching,
    dataDefined: pedidosData !== undefined,
  });

  if (!clienteId) return null;

  if (!contextoValido || clienteKpi === 'unavailable') {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          Contexto de Grupo/Empresa necessário para validar crédito.
        </CardContent>
      </Card>
    );
  }

  if (clienteKpi === 'loading' || pedidosKpi === 'loading') {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="animate-pulse">Verificando crédito...</div>
        </CardContent>
      </Card>
    );
  }

  if (clienteKpi === 'error' || pedidosKpi === 'error') {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardContent className="p-4 text-sm text-red-700">
          Não foi possível validar crédito (erro ≠ limite zerado).
        </CardContent>
      </Card>
    );
  }

  const cliente = clienteData || null;
  const pedidosPendentes = Array.isArray(pedidosData) ? pedidosData : [];

  if (!cliente) {
    return null;
  }

  const limiteTotal = cliente.condicao_comercial?.limite_credito || 0;
  const limiteUtilizado = cliente.condicao_comercial?.limite_credito_utilizado || 0;
  const valorPendenteOutrosPedidos = pedidosPendentes.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const limiteComprometidoTotal = limiteUtilizado + valorPendenteOutrosPedidos;
  const limiteDisponivel = limiteTotal - limiteComprometidoTotal;
  const limiteAposAprovacao = limiteDisponivel - valorPedido;

  const percentualUtilizado = limiteTotal > 0 ? ((limiteComprometidoTotal + valorPedido) / limiteTotal) * 100 : 0;

  // Status
  let status = "aprovado";
  let statusTexto = "Crédito Aprovado";
  let statusIcon = CheckCircle;
  let statusCor = "green";

  if (limiteTotal === 0) {
    status = "sem_limite";
    statusTexto = "Sem Limite Configurado";
    statusIcon = AlertTriangle;
    statusCor = "amber";
  } else if (limiteAposAprovacao < 0) {
    status = "reprovado";
    statusTexto = "Crédito Insuficiente";
    statusIcon = XCircle;
    statusCor = "red";
  } else if (percentualUtilizado > 90) {
    status = "alerta";
    statusTexto = "Atenção: Limite Quase Esgotado";
    statusIcon = AlertTriangle;
    statusCor = "orange";
  }

  const StatusIcon = statusIcon;

  return (
    <Card className={`border-2 ${
      statusCor === "green" ? "border-green-300 bg-green-50" :
      statusCor === "red" ? "border-red-300 bg-red-50" :
      statusCor === "orange" ? "border-orange-300 bg-orange-50" :
      "border-amber-300 bg-amber-50"
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 text-${statusCor}-600`} />
          Análise de Crédito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge className={`${
            statusCor === "green" ? "bg-green-600" :
            statusCor === "red" ? "bg-red-600" :
            statusCor === "orange" ? "bg-orange-600" :
            "bg-amber-600"
          }`}>
            {statusTexto}
          </Badge>
        </div>

        {/* Informações de Crédito */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-700">Limite Total:</span>
            <span className="font-bold">R$ {limiteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-700">Já Utilizado:</span>
            <span className="font-medium text-orange-600">
              R$ {limiteUtilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {valorPendenteOutrosPedidos > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-700">Outros Pedidos Pendentes:</span>
              <span className="font-medium text-orange-600">
                R$ {valorPendenteOutrosPedidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="flex justify-between border-t pt-2">
            <span className="text-slate-700 font-medium">Disponível Atual:</span>
            <span className={`font-bold ${limiteDisponivel < 0 ? 'text-red-600' : 'text-green-600'}`}>
              R$ {limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between bg-blue-50 p-2 rounded">
            <span className="text-blue-900 font-medium flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              Este Pedido:
            </span>
            <span className="font-bold text-blue-900">
              R$ {(valorPedido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between border-t pt-2">
            <span className="text-slate-900 font-bold">Após Aprovação:</span>
            <span className={`font-bold text-lg ${limiteAposAprovacao < 0 ? 'text-red-600' : 'text-green-600'}`}>
              R$ {limiteAposAprovacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        {limiteTotal > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Utilização do Limite</span>
              <span className="font-medium">{percentualUtilizado.toFixed(1)}%</span>
            </div>
            <Progress 
              value={Math.min(percentualUtilizado, 100)} 
              className={`h-2 ${
                percentualUtilizado > 100 ? 'bg-red-200' :
                percentualUtilizado > 90 ? 'bg-orange-200' :
                'bg-green-200'
              }`}
            />
          </div>
        )}

        {/* Alertas */}
        {status === "reprovado" && (
          <Alert className="bg-red-100 border-red-300">
            <XCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800 text-xs">
              <strong>Bloqueado:</strong> Este pedido ultrapassa o limite de crédito disponível em R$ {Math.abs(limiteAposAprovacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
              Solicite aumento de limite ou reduza o valor do pedido.
            </AlertDescription>
          </Alert>
        )}

        {status === "alerta" && (
          <Alert className="bg-orange-100 border-orange-300">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-800 text-xs">
              <strong>Atenção:</strong> Após este pedido, restarão apenas R$ {limiteAposAprovacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de crédito disponível ({(100 - percentualUtilizado).toFixed(1)}%).
            </AlertDescription>
          </Alert>
        )}

        {status === "sem_limite" && (
          <Alert className="bg-amber-100 border-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-xs">
              Cliente sem limite de crédito configurado. Configure em Cadastros → Clientes → Condição Comercial.
            </AlertDescription>
          </Alert>
        )}

        {status === "aprovado" && (
          <Alert className="bg-green-100 border-green-300">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800 text-xs">
              Crédito suficiente. Após aprovação restarão R$ {limiteAposAprovacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} disponíveis.
            </AlertDescription>
          </Alert>
        )}

        {/* Info adicional */}
        {pedidosPendentes.length > 0 && (
          <div className="text-xs text-slate-500 flex items-center gap-1 pt-2 border-t">
            <TrendingUp className="w-3 h-3" />
            {pedidosPendentes.length} outro(s) pedido(s) aprovado(s)/em produção comprometendo o limite
          </div>
        )}
      </CardContent>
    </Card>
  );
}
