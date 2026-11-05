import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildLimiteCreditoWidgetQueryKey,
  isLimiteCreditoWidgetScopeCurrent,
  resolveLimiteCreditoWidgetKpiState,
  sumContasReceberPendentes,
} from "./limiteCreditoWidgetScope";

function readLimiteCreditoActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * Widget de limite de crédito do cliente.
 * Escopo multiempresa: ContaReceber via filterInContext (sem filter unscoped).
 * Sem default []: loading/erro ≠ zero utilizado. STALE_SCOPE em resposta tardia.
 */
export default function LimiteCreditoWidget({ 
  cliente, 
  valorPedidoAtual = 0,
  onLimiteAtualizado 
}) {
  const [limiteAtual, setLimiteAtual] = useState(cliente?.condicao_comercial?.limite_credito || 0);
  const [limiteUtilizado, setLimiteUtilizado] = useState(cliente?.condicao_comercial?.limite_credito_utilizado || 0);

  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readLimiteCreditoActorAndSession();
  const clienteId = cliente?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  const {
    data: contasReceber,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: buildLimiteCreditoWidgetQueryKey({
      clienteId, groupId, empresaId, actorId, sessionKey,
    }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext(
        'ContaReceber',
        { cliente_id: clienteId },
        '-created_date',
        500,
      );
      if (signal?.aborted) {
        const err = new Error('LIMITE_CREDITO_WIDGET_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isLimiteCreditoWidgetScopeCurrent(scopeExpected, readLimiteCreditoActorAndSession())) {
        throw new Error('LIMITE_CREDITO_WIDGET_STALE_SCOPE');
      }
      return rows;
    },
    enabled: Boolean(clienteId) && contextoValido,
  });

  const kpiState = resolveLimiteCreditoWidgetKpiState({
    contextoValido,
    clienteId,
    isLoading,
    isError,
    isFetching,
    dataDefined: contasReceber !== undefined,
  });

  useEffect(() => {
    if (kpiState !== 'ready') return;
    calcularLimiteUtilizado();
  }, [contasReceber, cliente, kpiState]);

  const calcularLimiteUtilizado = () => {
    // Soma de contas pendentes — só com KPI ready (erro/loading ≠ zero).
    const totalPendente = sumContasReceberPendentes(contasReceber);
    
    setLimiteUtilizado(totalPendente);

    // Atualizar limite dinâmico baseado no score
    if (cliente?.score_pagamento) {
      ajustarLimiteDinamico(cliente.score_pagamento);
    }
  };

  const ajustarLimiteDinamico = (score) => {
    const limiteBase = cliente?.condicao_comercial?.limite_credito || 0;
    
    // Score alto = aumenta limite
    if (score >= 90) {
      const novoLimite = limiteBase * 1.2; // +20%
      if (novoLimite > limiteAtual) {
        setLimiteAtual(novoLimite);
        if (onLimiteAtualizado) {
          onLimiteAtualizado(novoLimite, 'Aumento automático por bom histórico');
        }
      }
    }
    // Score médio-baixo = reduz limite
    else if (score < 70) {
      const novoLimite = limiteBase * 0.8; // -20%
      if (novoLimite < limiteAtual) {
        setLimiteAtual(novoLimite);
        if (onLimiteAtualizado) {
          onLimiteAtualizado(novoLimite, 'Redução automática por atrasos');
        }
      }
    }
  };

  const contagemIndisponivel = kpiState !== 'ready';
  const limiteDisponivel = limiteAtual - limiteUtilizado;
  const percentualUtilizado = limiteAtual > 0 ? (limiteUtilizado / limiteAtual) * 100 : 0;
  const percentualComPedido = limiteAtual > 0 ? ((limiteUtilizado + valorPedidoAtual) / limiteAtual) * 100 : 0;
  
  const temLimiteSuficiente = (limiteUtilizado + valorPedidoAtual) <= limiteAtual;
  const scorePagamento = cliente?.score_pagamento || 100;

  const corProgress = percentualUtilizado < 50 ? 'bg-green-500' : 
                     percentualUtilizado < 80 ? 'bg-yellow-500' : 
                     'bg-red-500';

  const corScore = scorePagamento >= 80 ? 'text-green-600' :
                  scorePagamento >= 60 ? 'text-yellow-600' :
                  'text-red-600';

  if (!clienteId) {
    return null;
  }

  if (kpiState === 'unavailable') {
    return (
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4 text-sm text-slate-600">
          Contexto de Grupo/Empresa necessário para o limite de crédito.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 ${
      contagemIndisponivel ? 'border-slate-200 bg-slate-50' :
      temLimiteSuficiente ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className={`w-5 h-5 ${
              contagemIndisponivel ? 'text-slate-500' :
              temLimiteSuficiente ? 'text-green-600' : 'text-red-600'
            }`} />
            Limite de Crédito
          </span>
          <Badge className={`${
            scorePagamento >= 80 ? 'bg-green-500' :
            scorePagamento >= 60 ? 'bg-yellow-500' :
            'bg-red-500'
          } text-white`}>
            Score: {scorePagamento}/100
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {kpiState === 'loading' && (
          <p className="text-sm text-slate-600">Carregando contas a receber…</p>
        )}
        {kpiState === 'error' && (
          <p className="text-sm text-red-700">
            Não foi possível carregar contas a receber (erro ≠ zero utilizado).
          </p>
        )}

        {/* Valores — utilizado só confiável em ready */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-slate-600 mb-1">Limite Total</p>
            <p className="text-lg font-bold text-blue-600">
              R$ {limiteAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            {cliente?.condicao_comercial?.limite_credito !== limiteAtual && (
              <Badge className="bg-blue-100 text-blue-700 text-xs mt-1">
                Ajustado
              </Badge>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Utilizado</p>
            <p className={`text-lg font-bold ${contagemIndisponivel ? 'text-slate-400' : 'text-orange-600'}`}>
              {contagemIndisponivel
                ? '—'
                : `R$ ${limiteUtilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Disponível</p>
            <p className={`text-lg font-bold ${
              contagemIndisponivel ? 'text-slate-400' :
              limiteDisponivel > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {contagemIndisponivel
                ? '—'
                : `R$ ${limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        {!contagemIndisponivel && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-600">Utilização</span>
              <span className="text-xs font-semibold">{percentualUtilizado.toFixed(1)}%</span>
            </div>
            <Progress value={percentualUtilizado} className={`h-2 ${corProgress}`} />
          </div>
        )}

        {/* Simulação com Pedido Atual */}
        {!contagemIndisponivel && valorPedidoAtual > 0 && (
          <div className={`p-3 rounded-lg ${
            temLimiteSuficiente ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {temLimiteSuficiente ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm font-semibold ${
                temLimiteSuficiente ? 'text-green-800' : 'text-red-800'
              }`}>
                {temLimiteSuficiente ? 'Limite Aprovado ✓' : 'Limite Insuficiente ✗'}
              </span>
            </div>
            <p className="text-xs mb-2">
              Pedido atual: <strong>R$ {valorPedidoAtual.toFixed(2)}</strong>
            </p>
            <Progress value={percentualComPedido} className={`h-2 ${
              temLimiteSuficiente ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <p className="text-xs mt-1">
              Utilização após pedido: <strong>{percentualComPedido.toFixed(1)}%</strong>
            </p>

            {!temLimiteSuficiente && (
              <div className="mt-3 pt-3 border-t border-red-200">
                <p className="text-xs text-red-700 mb-2">
                  <strong>Falta:</strong> R$ {((limiteUtilizado + valorPedidoAtual) - limiteAtual).toFixed(2)}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full border-red-300 text-red-700 hover:bg-red-50"
                >
                  Solicitar Aumento de Limite
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Indicadores de Score */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center">
            <p className="text-xs text-slate-600 mb-1">Histórico</p>
            <div className="flex items-center justify-center gap-1">
              {scorePagamento >= 80 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={`font-bold ${corScore}`}>
                {scorePagamento >= 80 ? 'Excelente' :
                 scorePagamento >= 60 ? 'Bom' : 'Ruim'}
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 mb-1">Atraso Médio</p>
            <p className="font-bold text-slate-700">
              {cliente?.dias_atraso_medio || 0} dias
            </p>
          </div>
        </div>

        {/* Alertas */}
        {kpiState === 'ready' && scorePagamento < 70 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-3">
              <p className="text-xs text-amber-800">
                ⚠️ Score baixo detectado. Limite foi reduzido automaticamente em 20%.
              </p>
            </CardContent>
          </Card>
        )}

        {kpiState === 'ready' && scorePagamento >= 90 && limiteAtual > (cliente?.condicao_comercial?.limite_credito || 0) && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3">
              <p className="text-xs text-green-800">
                ✅ Score excelente! Limite aumentado automaticamente em 20%.
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
