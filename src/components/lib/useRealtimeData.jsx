/**
 * Hook para Dados em Tempo Real
 * Usa polling inteligente com React Query (sem WebSocket)
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { central360SessionKey } from '@/api/httpApiClient';
import { useContextoVisual } from './useContextoVisual';
import {
  buildDashboardQueryKey,
  computeRealtimeKpisFromStores,
  DASHBOARD_REALTIME_LIMIT,
} from './dashboardKpiPolicy';
import {
  isRealtimeScopeCurrent,
  assertRealtimeContext,
  filterActiveRealtimeEntregas,
  pickRealtimeFirstRow,
} from './realtimeDataScope';

function readRealtimeActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token) };
}

/** @typedef {{ hoje: number, valorHoje: number, aguardandoAprovacao: number, emProducao: number, amostraLimitada?: boolean }} RealtimePedidosKpi */
/** @typedef {{ vencendoHoje: number, valorHoje: number, atrasados: number, recebidosHoje: number, amostraLimitada?: boolean }} RealtimeFinanceiroKpi */
/** @typedef {{ opsEmAndamento: number, percentualMedio: number, opsAtrasadas: number, opsFinalizadasHoje: number, amostraLimitada?: boolean }} RealtimeProducaoKpi */
/** @typedef {{ entregasHoje: number, pendentes: number, realizadas: number, emRota: number, amostraLimitada?: boolean }} RealtimeExpedicaoKpi */
/** @typedef {{ pedidos: RealtimePedidosKpi, financeiro: RealtimeFinanceiroKpi, producao: RealtimeProducaoKpi, expedicao: RealtimeExpedicaoKpi, ultimaAtualizacao: string | null }} RealtimeKpis */
/** @typedef {{ id?: string, numero_pedido?: string, status?: string, prioridade?: string, cliente_nome?: string, valor_total?: number, created_date?: string }} RealtimePedido */
/** @typedef {{ id?: string, numero_pedido?: string, status?: string, cliente_nome?: string, endereco_entrega_completo?: { cidade?: string }, motorista?: string, placa?: string, data_previsao?: string }} RealtimeEntrega */

/**
 * Hook principal de tempo real
 * @template T
 * @param {readonly unknown[]} queryKey - Chave contextual da query
 * @param {() => Promise<T> | T} queryFn - Função de fetch
 * @param {{ refetchInterval?: number, enabled?: boolean, onUpdate?: ((novos: T, anteriores: T) => void) | null, [key: string]: any }} [options]
 */
export function useRealtimeData(queryKey, queryFn, options = {}) {
  const {
    refetchInterval = 5000, // 5 segundos
    enabled = true,
    onUpdate = null,
    ...otherOptions
  } = options;

  const [currentInterval, setCurrentInterval] = useState(refetchInterval);

  const [lastData, setLastData] = useState(/** @type {T | null} */ (null));
  const [hasChanges, setHasChanges] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 500 + Math.floor(Math.random() * 1200));
    return () => clearTimeout(t);
  }, []);

  const query = useQuery({
    queryKey,
    queryFn,
    refetchInterval: () => (enabled && isReady ? (currentInterval + Math.floor(Math.random() * 3000)) : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    gcTime: 300000,
    placeholderData: keepPreviousData,
    staleTime: typeof currentInterval === 'number' ? Math.max(0, currentInterval - 1000) : 10000,
    enabled: enabled && isReady,
    ...otherOptions
  });
  const currentData = /** @type {T | undefined} */ (query.data);

  // Detectar mudanças
  useEffect(() => {
    if (currentData && lastData) {
      const hasChanged = JSON.stringify(currentData) !== JSON.stringify(lastData);
      setHasChanges(hasChanged);
      
      if (hasChanged && onUpdate) {
        onUpdate(currentData, lastData);
      }
    }
    
    if (currentData) {
      setLastData(currentData);
    }
  }, [currentData]);

  // Backoff automático em 429 e reset ao normal quando voltar a responder
  useEffect(() => {
    const err = /** @type {(Error & { status?: number, response?: { status?: number } }) | null} */ (query.error);
    if (err) {
      const msg = String(err?.message || '');
      const status = err?.status || err?.response?.status;
      if (status === 429 || /429|rate limit/i.test(msg)) {
        setCurrentInterval(prev => Math.min((prev || refetchInterval) * 2, 120000));
      }
    } else if (query.data) {
      if (currentInterval !== refetchInterval) setCurrentInterval(refetchInterval);
    }
  }, [query.error, query.data, refetchInterval]);

  return {
    ...query,
    hasChanges,
    isRealtime: enabled
  };
}

/**
 * Hook para KPIs em tempo real
 */
export function useRealtimeKPIs(empresaId, intervalo = 30000, groupId = null, enabled = true, userId = null) {
  const { filterInContext } = useContextoVisual();
  const sessionScope = readRealtimeActorAndSession();
  return useRealtimeData(
    [
      ...buildDashboardQueryKey({
        prefix: 'kpis-realtime',
        userId,
        groupId,
        empresaId,
        scopeType: empresaId ? 'empresa' : 'grupo',
      }),
      sessionScope.actorId,
      sessionScope.sessionKey,
    ],
    async () => {
      assertRealtimeContext(groupId, empresaId);
      const scopeExpected = readRealtimeActorAndSession();
      const limit = DASHBOARD_REALTIME_LIMIT;
      const getByContext = async (entity, order) => filterInContext(entity, {}, order, limit);
      const results = await Promise.allSettled([
        getByContext('Pedido', '-created_date'),
        getByContext('ContaReceber', '-data_vencimento'),
        getByContext('OrdemProducao', '-data_emissao'),
        getByContext('Entrega', '-created_date'),
      ]);

      if (!isRealtimeScopeCurrent(scopeExpected, readRealtimeActorAndSession())) {
        throw new Error('REALTIME_KPI_STALE_SCOPE');
      }

      const rejectedCount = results.filter(r => r.status === 'rejected').length;
      if (rejectedCount >= 2) {
        const firstErr = results.find(r => r.status === 'rejected')?.reason || {};
        const e = /** @type {Error & { status?: number }} */ (new Error(String(firstErr?.message || 'Rate limit exceeded')));
        e.status = firstErr?.status || 429;
        throw e;
      }

      const pedidos = results[0].status === 'fulfilled' ? results[0].value : [];
      const contas = results[1].status === 'fulfilled' ? results[1].value : [];
      const ops = results[2].status === 'fulfilled' ? results[2].value : [];
      const entregas = results[3].status === 'fulfilled' ? results[3].value : [];

      return computeRealtimeKpisFromStores({ pedidos, contas, ops, entregas });
    },
    // Sem initialData zerado: loading/erro ≠ KPI 0 (fail-closed).
    { refetchInterval: intervalo, enabled: enabled && Boolean(empresaId || groupId), retry: false }
  );
}

/**
 * Hook para Status de Pedidos em tempo real
 */
export function useRealtimePedidos(empresaId, limite = 10, groupId = null, enabled = true, userId = null) {
  const { filterInContext } = useContextoVisual();
  const sessionScope = readRealtimeActorAndSession();
  return useRealtimeData(
    [
      ...buildDashboardQueryKey({
        prefix: 'pedidos-realtime',
        userId,
        groupId,
        empresaId,
        scopeType: empresaId ? 'empresa' : 'grupo',
      }),
      sessionScope.actorId,
      sessionScope.sessionKey,
    ],
    async () => {
      assertRealtimeContext(groupId, empresaId);
      const scopeExpected = readRealtimeActorAndSession();
      const rows = await filterInContext('Pedido', {}, '-created_date', limite);
      if (!isRealtimeScopeCurrent(scopeExpected, readRealtimeActorAndSession())) {
        throw new Error('REALTIME_PEDIDOS_STALE_SCOPE');
      }
      return rows;
    },
    { 
      refetchInterval: 30000,
      enabled: enabled && Boolean(empresaId || groupId),
      retry: false,
      onUpdate: (novos, anteriores) => {
        const anterioresIds = (anteriores || []).map(p => p.id);
        const pedidosAdicionados = (novos || []).filter(p => !anterioresIds.includes(p.id));
        if (pedidosAdicionados.length > 0) {
          console.log('📦 Novos pedidos detectados:', pedidosAdicionados.length);
        }
      }
    }
  );
}

/**
 * Hook para Entregas em tempo real
 */
export function useRealtimeEntregas(empresaId, groupId = null, enabled = true, userId = null) {
  const { filterInContext } = useContextoVisual();
  const sessionScope = readRealtimeActorAndSession();
  return useRealtimeData(
    [
      ...buildDashboardQueryKey({
        prefix: 'entregas-realtime',
        userId,
        groupId,
        empresaId,
        scopeType: empresaId ? 'empresa' : 'grupo',
      }),
      sessionScope.actorId,
      sessionScope.sessionKey,
    ],
    async () => {
      assertRealtimeContext(groupId, empresaId);
      const scopeExpected = readRealtimeActorAndSession();
      const entregas = await filterInContext('Entrega', {}, '-created_date', 20);
      if (!isRealtimeScopeCurrent(scopeExpected, readRealtimeActorAndSession())) {
        throw new Error('REALTIME_ENTREGAS_STALE_SCOPE');
      }
      return filterActiveRealtimeEntregas(entregas);
    },
    { refetchInterval: 35000, enabled: enabled && Boolean(empresaId || groupId), retry: false }
    );
}

/**
 * Hook para Notificações em tempo real
 */
export function useRealtimeNotificacoes(usuarioId) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const sessionScope = readRealtimeActorAndSession();
  return useRealtimeData(
    ['notificacoes-realtime', usuarioId, groupId, empresaId, sessionScope.actorId, sessionScope.sessionKey],
    async () => {
      assertRealtimeContext(groupId, empresaId);
      const scopeExpected = readRealtimeActorAndSession();
      const notifs = await filterInContext('Notificacao', {
        destinatario_id: usuarioId,
        lida: false
      }, '-created_date', 50);
      if (!isRealtimeScopeCurrent(scopeExpected, readRealtimeActorAndSession())) {
        throw new Error('REALTIME_NOTIFICACOES_STALE_SCOPE');
      }
      return notifs;
    },
    { refetchInterval: 5000, enabled: Boolean(usuarioId) && Boolean(groupId || empresaId) }
  );
}

/**
 * Hook para Posições GPS em tempo real
 */
export function useRealtimeGPS(romaneioId) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const sessionScope = readRealtimeActorAndSession();
  return useRealtimeData(
    ['gps-realtime', romaneioId, groupId, empresaId, sessionScope.actorId, sessionScope.sessionKey],
    async () => {
      assertRealtimeContext(groupId, empresaId);
      const scopeExpected = readRealtimeActorAndSession();
      const posicoes = await filterInContext('PosicaoVeiculo', {
        romaneio_id: romaneioId
      }, '-data_hora', 1);
      if (!isRealtimeScopeCurrent(scopeExpected, readRealtimeActorAndSession())) {
        throw new Error('REALTIME_GPS_STALE_SCOPE');
      }
      return pickRealtimeFirstRow(posicoes);
    },
    { 
      refetchInterval: 15000, // 15 segundos para GPS
      enabled: Boolean(romaneioId) && Boolean(groupId || empresaId)
    }
  );
}

/**
 * Hook para Apontamentos de Produção em tempo real
 */
export function useRealtimeApontamentos(opId) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const sessionScope = readRealtimeActorAndSession();
  return useRealtimeData(
    ['apontamentos-realtime', opId, groupId, empresaId, sessionScope.actorId, sessionScope.sessionKey],
    async () => {
      assertRealtimeContext(groupId, empresaId);
      const scopeExpected = readRealtimeActorAndSession();
      const op = await filterInContext('OrdemProducao', { id: opId }, undefined, 1);
      if (!isRealtimeScopeCurrent(scopeExpected, readRealtimeActorAndSession())) {
        throw new Error('REALTIME_APONTAMENTOS_STALE_SCOPE');
      }
      return pickRealtimeFirstRow(op);
    },
    { 
      refetchInterval: 10000,
      enabled: Boolean(opId) && Boolean(groupId || empresaId)
    }
  );
}

/**
 * Hook genérico para subscription
 */
export function useSubscription(entityName, filters = {}, options = {}) {
  const { refetchInterval = 5000, enabled = true } = options;
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const sessionScope = readRealtimeActorAndSession();

  return useRealtimeData(
    ['subscription', entityName, JSON.stringify(filters), groupId, empresaId, sessionScope.actorId, sessionScope.sessionKey],
    async () => {
      assertRealtimeContext(groupId, empresaId);
      const scopeExpected = readRealtimeActorAndSession();
      const data = await filterInContext(entityName, filters);
      if (!isRealtimeScopeCurrent(scopeExpected, readRealtimeActorAndSession())) {
        throw new Error('REALTIME_SUBSCRIPTION_STALE_SCOPE');
      }
      return data;
    },
    { refetchInterval, enabled: enabled && Boolean(groupId || empresaId) }
  );
}

export default {
  useRealtimeData,
  useRealtimeKPIs,
  useRealtimePedidos,
  useRealtimeEntregas,
  useRealtimeNotificacoes,
  useRealtimeGPS,
  useRealtimeApontamentos,
  useSubscription
};
