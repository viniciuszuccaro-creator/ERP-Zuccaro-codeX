/**
 * Hook para Dados em Tempo Real
 * Usa polling inteligente com React Query (sem WebSocket)
 */

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEffect, useState } from 'react';
import { useContextoVisual } from './useContextoVisual';

/**
 * Hook principal de tempo real
 * @param {string} queryKey - Chave da query
 * @param {function} queryFn - Função de fetch
 * @param {number} refetchInterval - Intervalo de atualização em ms (padrão: 5000)
 * @param {boolean} enabled - Se está habilitado
 */
export function useRealtimeData(queryKey, queryFn, options = {}) {
  const {
    refetchInterval = 5000, // 5 segundos
    enabled = true,
    onUpdate = null,
    ...otherOptions
  } = options;

  const [currentInterval, setCurrentInterval] = useState(refetchInterval);

  const [lastData, setLastData] = useState(null);
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
    keepPreviousData: true,
    staleTime: typeof currentInterval === 'number' ? Math.max(0, currentInterval - 1000) : 10000,
    enabled: enabled && isReady,
    ...otherOptions
  });

  // Detectar mudanças
  useEffect(() => {
    if (query.data && lastData) {
      const hasChanged = JSON.stringify(query.data) !== JSON.stringify(lastData);
      setHasChanges(hasChanged);
      
      if (hasChanged && onUpdate) {
        onUpdate(query.data, lastData);
      }
    }
    
    if (query.data) {
      setLastData(query.data);
    }
  }, [query.data]);

  // Backoff automático em 429 e reset ao normal quando voltar a responder
  useEffect(() => {
    const err = query.error;
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
export function useRealtimeKPIs(empresaId, intervalo = 30000, groupId = null, enabled = true) {
  const defaultKPIs = {
    pedidos: { hoje: 0, valorHoje: 0, aguardandoAprovacao: 0, emProducao: 0 },
    financeiro: { vencendoHoje: 0, valorHoje: 0, atrasados: 0, recebidosHoje: 0 },
    producao: { opsEmAndamento: 0, percentualMedio: 0, opsAtrasadas: 0, opsFinalizadasHoje: 0 },
    expedicao: { entregasHoje: 0, pendentes: 0, realizadas: 0, emRota: 0 },
    ultimaAtualizacao: null,
  };
  const { filterInContext } = useContextoVisual();
  return useRealtimeData(
    ['kpis-realtime', empresaId, groupId],
    async () => {
      try {
        const getByContext = (entity, order, limit) => {
          if (empresaId) return base44.entities[entity].filter({ empresa_id: empresaId }, order, limit);
          if (groupId) return base44.entities[entity].filter({ group_id: groupId }, order, limit);
          return Promise.resolve([]);
        };
        const results = await Promise.allSettled([
          getByContext('Pedido', '-created_date', 20),
          getByContext('ContaReceber', '-data_vencimento', 20),
          (base44.entities.OrdemProducao?.filter || base44.entities.OrdemProducao?.list)
            ? (empresaId || groupId
                ? base44.entities.OrdemProducao.filter({ [empresaId ? 'empresa_id' : 'group_id']: empresaId || groupId }, '-data_emissao', 20)
                : Promise.resolve([]))
            : Promise.resolve([]),
          getByContext('Entrega', '-created_date', 10)
        ]);

        const rejectedCount = results.filter(r => r.status === 'rejected').length;
        if (rejectedCount >= 2) {
          const firstErr = results.find(r => r.status === 'rejected')?.reason || {};
          const e = new Error(String(firstErr?.message || 'Rate limit exceeded'));
          e.status = firstErr?.status || 429;
          throw e;
        }

        const pedidos = results[0].status === 'fulfilled' ? results[0].value : [];
        const contas = results[1].status === 'fulfilled' ? results[1].value : [];
        const ops     = results[2].status === 'fulfilled' ? results[2].value : [];
        const entregas= results[3].status === 'fulfilled' ? results[3].value : [];

        // Pedidos
        const pedidosHoje = pedidos.filter(p => {
          const hoje = new Date().toISOString().split('T')[0];
          const data = (p.data_pedido || p.created_date || '').split('T')[0];
          return data === hoje;
        });

        const valorPedidosHoje = pedidosHoje.reduce((sum, p) => sum + (p.valor_total || 0), 0);

        // Financeiro
        const contasVencendoHoje = contas.filter(c => {
          const hoje = new Date().toISOString().split('T')[0];
          return c.data_vencimento === hoje && c.status === 'Pendente';
        });

        const valorAReceberHoje = contasVencendoHoje.reduce((sum, c) => sum + (c.valor || 0), 0);

        // Produção
        const opsEmAndamento = (ops || []).filter(op => 
          ['Liberada', 'Em Corte', 'Em Dobra', 'Em Armação', 'Em Produção', 'Produzindo'].includes(op.status)
        );

        const mediaPercentualConclusao = opsEmAndamento.length > 0
          ? opsEmAndamento.reduce((sum, op) => sum + (op.percentual_conclusao || 0), 0) / opsEmAndamento.length
          : 0;

        // Expedição
        const entregasHoje = (entregas || []).filter(e => {
          const hoje = new Date().toISOString().split('T')[0];
          const prev = e.data_previsao || e.data_prevista; // compat
          const entrega = e.data_entrega || e.data_entrega_real;
          return (prev === hoje) || (entrega && entrega.split('T')[0] === hoje);
        });

        const entregasPendentes = entregasHoje.filter(e => 
          ['Aguardando Separação', 'Em Separação', 'Pronto para Expedir', 'Saiu para Entrega', 'Em Trânsito'].includes(e.status)
        ).length;

        const entregasRealizadas = entregasHoje.filter(e => e.status === 'Entregue').length;

        return {
          pedidos: {
            hoje: pedidosHoje.length,
            valorHoje: valorPedidosHoje,
            aguardandoAprovacao: pedidos.filter(p => p.status === 'Aguardando Aprovação').length,
            emProducao: pedidos.filter(p => p.status === 'Em Produção').length
          },
          financeiro: {
            vencendoHoje: contasVencendoHoje.length,
            valorHoje: valorAReceberHoje,
            atrasados: contas.filter(c => c.status === 'Atrasado').length,
            recebidosHoje: contas.filter(c => {
              const hoje = new Date().toISOString().split('T')[0];
              return c.data_recebimento?.split('T')[0] === hoje;
            }).length
          },
          producao: {
            opsEmAndamento: opsEmAndamento.length,
            percentualMedio: Math.round(mediaPercentualConclusao),
            opsAtrasadas: ops.filter(op => {
              if (!op.data_prevista_conclusao) return false;
              const hoje = new Date();
              const previsao = new Date(op.data_prevista_conclusao);
              return previsao < hoje && !['Finalizada', 'Cancelada'].includes(op.status);
            }).length,
            opsFinalizadasHoje: ops.filter(op => {
              const hoje = new Date().toISOString().split('T')[0];
              return op.data_conclusao_real?.split('T')[0] === hoje;
            }).length
          },
          expedicao: {
            entregasHoje: entregasHoje.length,
            pendentes: entregasPendentes,
            realizadas: entregasRealizadas,
            emRota: entregas.filter(e => ['Saiu para Entrega', 'Em Trânsito'].includes(e.status)).length
          },
          ultimaAtualizacao: new Date().toISOString()
        };
      } catch (e) {
        return {
          pedidos: { hoje: 0, valorHoje: 0, aguardandoAprovacao: 0, emProducao: 0 },
          financeiro: { vencendoHoje: 0, valorHoje: 0, atrasados: 0, recebidosHoje: 0 },
          producao: { opsEmAndamento: 0, percentualMedio: 0, opsAtrasadas: 0, opsFinalizadasHoje: 0 },
          expedicao: { entregasHoje: 0, pendentes: 0, realizadas: 0, emRota: 0 },
          ultimaAtualizacao: new Date().toISOString()
        };
      }
    },
    { refetchInterval: intervalo, enabled: enabled && Boolean(empresaId || groupId), initialData: defaultKPIs, retry: false }
  );
}

/**
 * Hook para Status de Pedidos em tempo real
 */
export function useRealtimePedidos(empresaId, limite = 10, groupId = null, enabled = true) {
  const { filterInContext } = useContextoVisual();
  return useRealtimeData(
    ['pedidos-realtime', empresaId, groupId],
    () => (
      empresaId
        ? base44.entities.Pedido.filter({ empresa_id: empresaId }, '-created_date', limite)
        : groupId
          ? base44.entities.Pedido.filter({ group_id: groupId }, '-created_date', limite)
          : Promise.resolve([])
    ),
    { 
      refetchInterval: 30000,
      enabled: enabled && Boolean(empresaId || groupId),
      initialData: [],
      retry: false,
      onUpdate: (novos, anteriores) => {
        // Detectar novos pedidos
        const novosPedidosIds = novos.map(p => p.id);
        const anterioresIds = anteriores.map(p => p.id);
        
        const pedidosAdicionados = novos.filter(p => !anterioresIds.includes(p.id));
        
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
export function useRealtimeEntregas(empresaId, groupId = null, enabled = true) {
  const { filterInContext } = useContextoVisual();
  return useRealtimeData(
    ['entregas-realtime', empresaId, groupId],
    async () => {
      const entregas = await (
        empresaId
          ? base44.entities.Entrega.filter({ empresa_id: empresaId }, '-created_date', 20)
          : groupId
            ? base44.entities.Entrega.filter({ group_id: groupId }, '-created_date', 20)
            : Promise.resolve([])
      );
      
      return entregas.filter(e => !['Entregue', 'Cancelado', 'Devolvido'].includes(e.status));
    },
    { refetchInterval: 35000, enabled: enabled && Boolean(empresaId || groupId), initialData: [], retry: false }
    );
}

/**
 * Hook para Notificações em tempo real
 */
export function useRealtimeNotificacoes(usuarioId) {
  return useRealtimeData(
    ['notificacoes-realtime', usuarioId],
    async () => {
      const notifs = await base44.entities.Notificacao.filter({
        destinatario_id: usuarioId,
        lida: false
      }, '-created_date', 50);
      
      return notifs;
    },
    { refetchInterval: 5000 }
  );
}

/**
 * Hook para Posições GPS em tempo real
 */
export function useRealtimeGPS(romaneioId) {
  return useRealtimeData(
    ['gps-realtime', romaneioId],
    async () => {
      const posicoes = await base44.entities.PosicaoVeiculo.filter({
        romaneio_id: romaneioId
      }, '-data_hora', 1);
      
      return posicoes[0] || null;
    },
    { 
      refetchInterval: 15000, // 15 segundos para GPS
      enabled: !!romaneioId
    }
  );
}

/**
 * Hook para Apontamentos de Produção em tempo real
 */
export function useRealtimeApontamentos(opId) {
  return useRealtimeData(
    ['apontamentos-realtime', opId],
    async () => {
      const op = await base44.entities.OrdemProducao.filter({ id: opId });
      return op[0] || null;
    },
    { 
      refetchInterval: 10000,
      enabled: !!opId
    }
  );
}

/**
 * Hook genérico para subscription
 */
export function useSubscription(entityName, filters = {}, options = {}) {
  const { refetchInterval = 5000, enabled = true } = options;

  return useRealtimeData(
    ['subscription', entityName, JSON.stringify(filters)],
    async () => {
      const data = await base44.entities[entityName].filter(filters);
      return data;
    },
    { refetchInterval, enabled }
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