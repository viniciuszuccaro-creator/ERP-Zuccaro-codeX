import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { central360SessionKey } from '@/api/httpApiClient';
import {
  resolveVisaoConsolidadaKpiState,
  isVisaoConsolidadaScopeCurrent,
  assertVisaoConsolidadaGroupMatch,
  sumVisaoConsolidadaPendente,
  sumVisaoConsolidadaAtrasado,
  buildVisaoConsolidadaPorEmpresa,
} from './visaoConsolidadaGrupoScope';

function formatMoney(value) {
  return (value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function KpiMoney({ state, value, positiveClass, negativeClass, zeroClass }) {
  if (state === 'loading') {
    return <span className="text-sm text-slate-500 animate-pulse">Carregando…</span>;
  }
  if (state === 'error') {
    return <span className="text-sm text-red-600">Erro ≠ R$ 0,00</span>;
  }
  if (state === 'unavailable') {
    return <span className="text-sm text-amber-700">Contexto necessário</span>;
  }
  const cls = value > 0 ? positiveClass : value < 0 ? negativeClass : zeroClass;
  return <span className={`text-2xl font-bold ${cls}`}>R$ {formatMoney(value)}</span>;
}

export default function VisaoConsolidadaGrupo({ groupId, windowMode = false }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const resolvedGroupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  let effectiveGroupId = null;
  let groupMismatch = false;
  try {
    effectiveGroupId = assertVisaoConsolidadaGroupMatch(groupId, resolvedGroupId);
  } catch {
    groupMismatch = true;
  }
  const contextoValido = Boolean(effectiveGroupId) && !groupMismatch;

  const sessionSnapshot = readErpHttpSession();
  const actorId = typeof sessionSnapshot?.actorId === 'string' && sessionSnapshot.actorId.trim()
    ? sessionSnapshot.actorId.trim()
    : null;
  const sessionKey = central360SessionKey(sessionSnapshot?.token);
  const scopeExpected = { actorId, sessionKey };
  const readActorAndSession = () => {
    const session = readErpHttpSession();
    const nextActor = typeof session?.actorId === 'string' && session.actorId.trim()
      ? session.actorId.trim()
      : null;
    return { actorId: nextActor, sessionKey: central360SessionKey(session?.token) };
  };

  const empresasQuery = useQuery({
    queryKey: ['empresas-grupo', effectiveGroupId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Empresa', { group_id: effectiveGroupId });
      if (signal?.aborted) {
        const err = new Error('VISAO_CONSOLIDADA_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isVisaoConsolidadaScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('VISAO_CONSOLIDADA_EMPRESAS_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const pagarQuery = useQuery({
    queryKey: ['contas-pagar-grupo', effectiveGroupId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('ContaPagar', { group_id: effectiveGroupId });
      if (signal?.aborted) {
        const err = new Error('VISAO_CONSOLIDADA_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isVisaoConsolidadaScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('VISAO_CONSOLIDADA_PAGAR_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const receberQuery = useQuery({
    queryKey: ['contas-receber-grupo', effectiveGroupId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('ContaReceber', { group_id: effectiveGroupId });
      if (signal?.aborted) {
        const err = new Error('VISAO_CONSOLIDADA_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isVisaoConsolidadaScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('VISAO_CONSOLIDADA_RECEBER_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const empresasKpi = resolveVisaoConsolidadaKpiState({
    contextoValido,
    isLoading: empresasQuery.isLoading,
    isError: empresasQuery.isError || groupMismatch,
    isFetching: empresasQuery.isFetching,
    dataDefined: empresasQuery.data !== undefined,
  });
  const pagarKpi = resolveVisaoConsolidadaKpiState({
    contextoValido,
    isLoading: pagarQuery.isLoading,
    isError: pagarQuery.isError || groupMismatch,
    isFetching: pagarQuery.isFetching,
    dataDefined: pagarQuery.data !== undefined,
  });
  const receberKpi = resolveVisaoConsolidadaKpiState({
    contextoValido,
    isLoading: receberQuery.isLoading,
    isError: receberQuery.isError || groupMismatch,
    isFetching: receberQuery.isFetching,
    dataDefined: receberQuery.data !== undefined,
  });

  const agregadosKpi = [empresasKpi, pagarKpi, receberKpi].includes('error')
    ? 'error'
    : [empresasKpi, pagarKpi, receberKpi].includes('unavailable')
      ? 'unavailable'
      : [empresasKpi, pagarKpi, receberKpi].includes('loading')
        ? 'loading'
        : empresasKpi === 'ready' && pagarKpi === 'ready' && receberKpi === 'ready'
          ? 'ready'
          : 'loading';

  const empresas = empresasKpi === 'ready' && Array.isArray(empresasQuery.data) ? empresasQuery.data : [];
  const contasPagar = pagarKpi === 'ready' && Array.isArray(pagarQuery.data) ? pagarQuery.data : [];
  const contasReceber = receberKpi === 'ready' && Array.isArray(receberQuery.data) ? receberQuery.data : [];

  const totalPagar = agregadosKpi === 'ready' ? sumVisaoConsolidadaPendente(contasPagar) : null;
  const totalReceber = agregadosKpi === 'ready' ? sumVisaoConsolidadaPendente(contasReceber) : null;
  const saldoConsolidado = agregadosKpi === 'ready' ? (totalReceber - totalPagar) : null;
  const pagarAtrasado = agregadosKpi === 'ready' ? sumVisaoConsolidadaAtrasado(contasPagar) : null;
  const receberAtrasado = agregadosKpi === 'ready' ? sumVisaoConsolidadaAtrasado(contasReceber) : null;
  const dadosPorEmpresa = agregadosKpi === 'ready'
    ? buildVisaoConsolidadaPorEmpresa(empresas, contasPagar, contasReceber)
    : [];

  return (
    <div className={windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-4"}>
      <div className={windowMode ? "p-6 space-y-4 flex-1" : "space-y-4 p-6"}>
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-slate-900">Visão Consolidada do Grupo</h2>
      </div>

      {groupMismatch && (
        <p className="text-sm text-red-600 mb-2" role="alert">
          Grupo da prop diverge do contexto visual — consulta bloqueada (≠ R$ 0,00).
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Total a Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <KpiMoney
                state={agregadosKpi}
                value={totalReceber}
                positiveClass="text-green-600"
                negativeClass="text-green-600"
                zeroClass="text-green-600"
              />
            </div>
            {agregadosKpi === 'ready' && receberAtrasado > 0 && (
              <p className="text-xs text-red-600 mt-1">
                R$ {formatMoney(receberAtrasado)} atrasado
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Total a Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <KpiMoney
                state={agregadosKpi}
                value={totalPagar}
                positiveClass="text-red-600"
                negativeClass="text-red-600"
                zeroClass="text-red-600"
              />
            </div>
            {agregadosKpi === 'ready' && pagarAtrasado > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                R$ {formatMoney(pagarAtrasado)} atrasado
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Saldo Consolidado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className={`w-5 h-5 ${saldoConsolidado >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
              <KpiMoney
                state={agregadosKpi}
                value={saldoConsolidado}
                positiveClass="text-blue-600"
                negativeClass="text-red-600"
                zeroClass="text-blue-600"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Empresas no Grupo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              {empresasKpi === 'ready' ? (
                <span className="text-2xl font-bold text-slate-900">{empresas.length}</span>
              ) : empresasKpi === 'loading' ? (
                <span className="text-sm text-slate-500 animate-pulse">Carregando…</span>
              ) : empresasKpi === 'error' || groupMismatch ? (
                <span className="text-sm text-red-600">Erro ≠ 0</span>
              ) : (
                <span className="text-sm text-amber-700">Contexto necessário</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Saldos por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agregadosKpi === 'loading' && (
            <p className="text-sm text-slate-500 animate-pulse">Carregando saldos…</p>
          )}
          {agregadosKpi === 'error' && (
            <p className="text-sm text-red-600">Erro ≠ lista vazia / R$ 0,00</p>
          )}
          {agregadosKpi === 'unavailable' && (
            <p className="text-sm text-amber-700">Selecione o Grupo para consolidar.</p>
          )}
          {agregadosKpi === 'ready' && (
          <div className="space-y-3">
            {dadosPorEmpresa.map((dado) => (
              <div key={dado.empresaId || dado.empresa} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{dado.empresa}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">A Receber</p>
                    <p className="font-semibold text-green-600">R$ {formatMoney(dado.receber)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">A Pagar</p>
                    <p className="font-semibold text-red-600">R$ {formatMoney(dado.pagar)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Saldo</p>
                    <p className={`font-bold ${dado.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      R$ {formatMoney(dado.saldo)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>
    </div></div>
  );
}
