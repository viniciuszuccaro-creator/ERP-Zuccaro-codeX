import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Shield, CheckCircle, XCircle, Brain } from 'lucide-react';
import useContextoVisual from '@/components/lib/useContextoVisual';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { central360SessionKey } from '@/api/httpApiClient';
import {
  buildPerfilRiscoClienteQueryKey,
  isPerfilRiscoClienteScopeCurrent,
  resolvePerfilRiscoClienteKpiState,
  pickClienteRiscoFromRows,
} from './perfilRiscoClienteScope';

function readPerfilRiscoActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * V21.1 - Widget de Perfil de Risco do Cliente
 * Usado na Aba 1 - Identificação
 * Bloqueia pedido se: Inapto, Alto Risco ou Limite Excedido
 *
 * Escopo multiempresa: Cliente via filterInContext (sem get unscoped).
 * Cache: cliente+Grupo+Empresa+ator+sessão. Loading/erro ≠ ausência silenciosa.
 */
export default function WidgetPerfilRiscoCliente({ clienteId, valorPedido = 0 }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readPerfilRiscoActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  const {
    data: cliente,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: buildPerfilRiscoClienteQueryKey({
      clienteId, groupId, empresaId, actorId, sessionKey,
    }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Cliente', { id: clienteId }, undefined, 1);
      if (signal?.aborted) {
        const err = new Error('PERFIL_RISCO_CLIENTE_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isPerfilRiscoClienteScopeCurrent(scopeExpected, readPerfilRiscoActorAndSession())) {
        throw new Error('PERFIL_RISCO_CLIENTE_STALE_SCOPE');
      }
      return pickClienteRiscoFromRows(rows);
    },
    enabled: Boolean(clienteId) && contextoValido,
  });

  const kpiState = resolvePerfilRiscoClienteKpiState({
    contextoValido,
    clienteId,
    isLoading,
    isError,
    isFetching,
    dataDefined: cliente !== undefined,
  });

  if (kpiState === 'unavailable') {
    return null;
  }

  if (kpiState === 'loading') {
    return (
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4 text-sm text-slate-600">
          Carregando perfil de risco do cliente…
        </CardContent>
      </Card>
    );
  }

  if (kpiState === 'error') {
    return (
      <Alert className="border-red-300 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-700" />
        <AlertDescription className="text-sm text-red-700">
          Não foi possível carregar o perfil de risco (erro ≠ ausência de cliente).
        </AlertDescription>
      </Alert>
    );
  }

  if (!cliente) {
    return (
      <Alert className="border-red-300 bg-red-50">
        <AlertDescription className="text-sm text-red-700">
          Cliente não encontrado
        </AlertDescription>
      </Alert>
    );
  }

  const limiteTotal = cliente.condicao_comercial?.limite_credito || 0;
  const limiteUtilizado = cliente.condicao_comercial?.limite_credito_utilizado || 0;
  const limiteDisponivel = limiteTotal - limiteUtilizado;
  const percentualComprometido = limiteTotal > 0 ? ((limiteUtilizado + valorPedido) / limiteTotal) * 100 : 0;

  const statusFiscal = cliente.status_fiscal_receita || 'Não Verificado';
  const risco = cliente.risco_churn || 'Baixo';
  const scoreCredito = cliente.score_confianca_ia || 50;

  // Determinar bloqueios
  const bloqueios = [];
  
  if (statusFiscal === 'Inapta' || statusFiscal === 'Suspensa' || statusFiscal === 'Baixada') {
    bloqueios.push({
      tipo: 'fiscal',
      mensagem: `Situação Fiscal: ${statusFiscal}`,
      acao: 'Permitir apenas Orçamento (não faturar)'
    });
  }

  if (percentualComprometido > 100) {
    bloqueios.push({
      tipo: 'credito',
      mensagem: `Limite excedido em ${(percentualComprometido - 100).toFixed(0)}%`,
      acao: 'Exige aprovação manual'
    });
  }

  if (risco === 'Alto' || risco === 'Crítico') {
    bloqueios.push({
      tipo: 'risco',
      mensagem: `Risco de Churn: ${risco}`,
      acao: 'Requer validação comercial'
    });
  }

  const temBloqueio = bloqueios.length > 0;

  return (
    <Card className={`border-2 ${
      temBloqueio ? 'border-red-300 bg-red-50' :
      percentualComprometido > 80 ? 'border-orange-300 bg-orange-50' :
      'border-green-300 bg-green-50'
    }`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Shield className={`w-4 h-4 ${temBloqueio ? 'text-red-600' : 'text-green-600'}`} />
            Perfil de Risco do Cliente
          </h3>
          <Badge className={
            temBloqueio ? 'bg-red-600' :
            percentualComprometido > 80 ? 'bg-orange-600' :
            'bg-green-600'
          }>
            {temBloqueio ? 'BLOQUEADO' : percentualComprometido > 80 ? 'ATENÇÃO' : 'OK'}
          </Badge>
        </div>

        {/* Situação Fiscal */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Situação Fiscal (RFB):</span>
          <Badge className={
            statusFiscal === 'Ativa' ? 'bg-green-100 text-green-700' :
            statusFiscal === 'Não Verificado' ? 'bg-slate-100 text-slate-700' :
            'bg-red-100 text-red-700'
          }>
            {statusFiscal}
          </Badge>
        </div>

        {/* Limite de Crédito */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600">Limite de Crédito:</span>
            <span className={`font-semibold ${percentualComprometido > 100 ? 'text-red-600' : 'text-slate-900'}`}>
              {percentualComprometido.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                percentualComprometido > 100 ? 'bg-red-600' :
                percentualComprometido > 80 ? 'bg-orange-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentualComprometido, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Disponível: R$ {limiteDisponivel.toLocaleString('pt-BR')} de R$ {limiteTotal.toLocaleString('pt-BR')}
          </p>
        </div>

        {/* Score IA */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 flex items-center gap-1">
            <Brain className="w-3 h-3" />
            Score IA:
          </span>
          <Badge className={
            scoreCredito >= 70 ? 'bg-green-100 text-green-700' :
            scoreCredito >= 40 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }>
            {scoreCredito}/100
          </Badge>
        </div>

        {/* Risco de Churn */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Risco de Churn:</span>
          <Badge className={
            risco === 'Baixo' ? 'bg-green-100 text-green-700' :
            risco === 'Médio' ? 'bg-yellow-100 text-yellow-700' :
            risco === 'Alto' ? 'bg-orange-100 text-orange-700' :
            'bg-red-100 text-red-700'
          }>
            {risco}
          </Badge>
        </div>

        {/* Bloqueios */}
        {temBloqueio && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-red-900 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Restrições Detectadas:
            </p>
            {bloqueios.map((bloq, idx) => (
              <Alert key={idx} className="p-2 border-red-200 bg-red-50">
                <AlertDescription className="text-xs text-red-800">
                  <p className="font-semibold">{bloq.mensagem}</p>
                  <p className="text-red-600 mt-1">→ {bloq.acao}</p>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {!temBloqueio && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 p-2 rounded">
            <CheckCircle className="w-3 h-3" />
            <span className="font-semibold">Cliente liberado para faturamento</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
