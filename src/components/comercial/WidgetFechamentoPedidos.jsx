import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, TrendingUp, CheckCircle2, ArrowRight, Sparkles, Activity } from 'lucide-react';
import { useWindow } from '@/components/lib/useWindow';
import DashboardFechamentoPedidos from './DashboardFechamentoPedidos';
import { obterEstatisticasAutomacao } from '@/components/lib/useFluxoPedido';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { central360SessionKey } from '@/api/httpApiClient';
import { isHttpBackendMode } from '@/api/base44Client';
import {
  buildFechamentoQueryKey,
  isFechamentoScopeCurrent,
  resolveFechamentoKpiState,
} from '@/components/comercial/fechamentoCacheScope';

/** HTTP: sessão ERP. Legado/remoto: sem limpar token Base44 órfão. */
function readFechamentoActorAndSession(userId = null) {
  if (isHttpBackendMode) {
    const session = readErpHttpSession();
    const actorId = (typeof session?.actorId === 'string' && session.actorId.trim())
      || (typeof userId === 'string' && userId.trim())
      || null;
    return { actorId, sessionKey: central360SessionKey(session?.token) };
  }
  const actorId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  return { actorId, sessionKey: actorId ? `legacy-actor:${actorId}` : null };
}

/**
 * V21.6 FINAL - WIDGET RESUMIDO COM IA ANALYTICS
 */
export default function WidgetFechamentoPedidos({ empresaId = null }) {
  const { openWindow } = useWindow();
  const [estatisticasIA, setEstatisticasIA] = useState(null);
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const canOpenFechamento = hasPermission('Comercial', 'Fechamento', 'visualizar')
    || hasPermission('Comercial', 'Pedidos', 'visualizar');
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaCtx = empresaId || empresaAtual?.id || null;
  const { actorId, sessionKey } = readFechamentoActorAndSession();
  const contextoValido = Boolean(groupId || empresaCtx);
  const scopeExpected = { actorId, sessionKey };

  // Estatísticas IA — limpa na troca; cancela/descarta resposta tardia (#545).
  const scopeLiveRef = useRef({ actorId, sessionKey, groupId, empresaId: empresaCtx });
  scopeLiveRef.current = { actorId, sessionKey, groupId, empresaId: empresaCtx };

  useEffect(() => {
    setEstatisticasIA(null);
    if (!contextoValido) return undefined;
    let cancelled = false;
    const generation = { actorId, sessionKey, groupId, empresaId: empresaCtx };
    obterEstatisticasAutomacao(empresaCtx, 7).then((stats) => {
      if (cancelled) return;
      const liveSession = readFechamentoActorAndSession();
      const live = {
        actorId: liveSession.actorId,
        sessionKey: liveSession.sessionKey,
        groupId: scopeLiveRef.current.groupId,
        empresaId: scopeLiveRef.current.empresaId,
      };
      if (!isFechamentoScopeCurrent(generation, live)) return;
      setEstatisticasIA(stats);
    }).catch(() => {
      if (!cancelled) setEstatisticasIA(null);
    });
    return () => { cancelled = true; };
  }, [empresaCtx, contextoValido, groupId, actorId, sessionKey]);

  // Escopo multiempresa: Pedido via filterInContext (sem list unscoped).
  // Sem initialData vazio — loading/erro ≠ zero. Cache ator/sessão/Grupo/Empresa.
  const {
    data: pedidos,
    isLoading,
    isError: isErrorPedidosWidget,
    isFetching,
  } = useQuery({
    queryKey: buildFechamentoQueryKey('pedidos', {
      groupId, empresaId: empresaCtx, actorId, sessionKey, extra: 'widget-fechamento',
    }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext(
        'Pedido',
        empresaCtx ? { empresa_id: empresaCtx } : {},
        '-created_date',
        50
      );
      if (signal?.aborted) {
        const err = new Error('WIDGET_FECHAMENTO_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      const live = {
        ...readFechamentoActorAndSession(),
        groupId,
        empresaId: empresaCtx,
      };
      if (!isFechamentoScopeCurrent({ ...scopeExpected, groupId, empresaId: empresaCtx }, live)) {
        throw new Error('WIDGET_FECHAMENTO_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const kpiState = resolveFechamentoKpiState({
    contextoValido,
    isLoading,
    isError: isErrorPedidosWidget,
    isFetching,
    dataDefined: pedidos !== undefined,
  });
  const contagemIndisponivel = kpiState !== 'ready';
  const listaPedidos = kpiState === 'ready' && Array.isArray(pedidos) ? pedidos : [];

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 7);

  const pedidosRecentes = contagemIndisponivel ? [] : listaPedidos.filter(p => {
    const dataPedido = new Date(p.created_date);
    return dataPedido >= dataLimite;
  });

  const pedidosFechados = pedidosRecentes.filter(p => 
    p.status === 'Pronto para Faturar' || 
    p.status === 'Faturado' || 
    p.status === 'Em Expedição'
  );

  const pedidosComAutomacao = pedidosFechados.filter(p => 
    p.observacoes_internas?.includes('[AUTOMAÇÃO')
  );

  const taxaAutomacao = contagemIndisponivel
    ? null
    : (pedidosFechados.length > 0
      ? (pedidosComAutomacao.length / pedidosFechados.length) * 100
      : 0);

  const pedidosProntosFechar = contagemIndisponivel ? [] : listaPedidos.filter(p => 
    p.status === 'Rascunho' && 
    (p.itens_revenda?.length > 0 || p.itens_armado_padrao?.length > 0)
  );
  const kpiLabel = (value) => {
    if (kpiState === 'unavailable') return '—';
    if (kpiState === 'error') return 'Erro';
    if (kpiState === 'loading') return '…';
    return value;
  };

  if (!contextoValido) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          Selecione grupo ou empresa para o widget de fechamento.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-sky-50 hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-blue-600" />
            Fechamento Automático
            {estatisticasIA && (
              <Badge className="bg-sky-600 text-white text-xs ml-1">
                <Sparkles className="w-3 h-3 mr-1" />
                IA
              </Badge>
            )}
          </CardTitle>
          <Badge className="bg-blue-600 text-white">7 dias</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isErrorPedidosWidget && (
          <p className="text-xs text-slate-500">Indicadores indisponíveis (erro de carga ≠ zero).</p>
        )}
        
        {/* Taxa de Automação */}
        <div className="bg-white/80 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Taxa de Automação</p>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{kpiLabel(taxaAutomacao == null ? null : `${taxaAutomacao.toFixed(0)}%`)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {contagemIndisponivel ? 'contagens indisponíveis ≠ zero' : `${pedidosComAutomacao.length} de ${pedidosFechados.length} pedidos`}
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/80 p-3 rounded-lg border text-center">
            <p className="text-xl font-bold text-green-600">{kpiLabel(contagemIndisponivel ? null : pedidosComAutomacao.length)}</p>
            <p className="text-xs text-slate-600">Fechados</p>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border text-center">
            <p className="text-xl font-bold text-orange-600">{kpiLabel(contagemIndisponivel ? null : pedidosProntosFechar.length)}</p>
            <p className="text-xs text-slate-600">Prontos</p>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border text-center">
            <p className="text-xl font-bold text-sky-600">~10s</p>
            <p className="text-xs text-slate-600">Tempo</p>
          </div>
        </div>

        {/* V21.6 FINAL: IA Analytics Mini */}
        {estatisticasIA && (
          <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-sky-700 flex items-center gap-1 font-semibold">
                <Activity className="w-3 h-3" />
                Analytics IA
              </span>
              <Badge className="bg-sky-600 text-white text-xs px-2">
                {estatisticasIA.diasAnalise}d
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-white/50 rounded p-2">
                <div className="text-lg font-bold text-sky-600">
                  {estatisticasIA.totalPedidos}
                </div>
                <div className="text-xs text-sky-700">Total</div>
              </div>
              <div className="text-center bg-white/50 rounded p-2">
                <div className="text-lg font-bold text-green-600">
                  {estatisticasIA.pedidosAutomaticos}
                </div>
                <div className="text-xs text-green-700">Auto</div>
              </div>
              <div className="text-center bg-white/50 rounded p-2">
                <div className="text-lg font-bold text-orange-600">
                  {estatisticasIA.taxaAutomacao.toFixed(0)}%
                </div>
                <div className="text-xs text-orange-700">Taxa</div>
              </div>
            </div>
          </div>
        )}

        {/* Ação */}
        <Button
          disabled={!canOpenFechamento}
          data-permission="Comercial.Fechamento.visualizar"
          onClick={() => {
            if (!canOpenFechamento) return;
            openWindow(
              DashboardFechamentoPedidos,
              { windowMode: true, empresaId },
              {
                title: '📊 Dashboard de Fechamento Automático',
                width: 1200,
                height: 700
              }
            );
          }}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          size="sm"
        >
          Ver Dashboard Completo
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

      </CardContent>
    </Card>
  );
}
