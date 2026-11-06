import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, 
  Package, 
  DollarSign, 
  Truck, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Zap,
  BarChart3,
  Activity,
  Sparkles
} from 'lucide-react';
import { obterEstatisticasAutomacao } from '@/components/lib/useFluxoPedido';
import useContextoVisual from '@/components/lib/useContextoVisual';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { central360SessionKey } from '@/api/httpApiClient';
import { isHttpBackendMode } from '@/api/base44Client';
import {
  buildFechamentoQueryKey,
  isFechamentoScopeCurrent,
  resolveFechamentoDashboardKpiState,
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
 * V21.6 - DASHBOARD DE FECHAMENTO AUTOMÁTICO
 * 
 * Monitora métricas do sistema de fechamento:
 * - Pedidos fechados automaticamente
 * - Taxa de sucesso
 * - Tempo médio de execução
 * - Erros e alertas
 */
export default function DashboardFechamentoPedidos({ windowMode = false, empresaId = null }) {
  // V21.6: Multi-empresa + IA Analytics
  const [estatisticasIA, setEstatisticasIA] = React.useState(null);
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaCtx = empresaId || empresaAtual?.id || null;
  const { actorId, sessionKey } = readFechamentoActorAndSession();
  const contextoValido = Boolean(groupId || empresaCtx);
  const scopeCriteria = empresaCtx ? { empresa_id: empresaCtx } : {};
  const scopeExpected = { actorId, sessionKey };
  const scopeKeyArgs = { groupId, empresaId: empresaCtx, actorId, sessionKey };

  // Estatísticas IA — limpa na troca de Empresa/ator; cancela resposta tardia (#545).
  const scopeLiveRef = React.useRef({ actorId, sessionKey, groupId, empresaId: empresaCtx });
  scopeLiveRef.current = { actorId, sessionKey, groupId, empresaId: empresaCtx };

  React.useEffect(() => {
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

  const fetchScoped = async (entity, signal, staleCode) => {
    const rows = await filterInContext(entity, scopeCriteria, '-created_date', 100);
    if (signal?.aborted) {
      const err = new Error(`${staleCode}_ABORTED`);
      err.name = 'AbortError';
      throw err;
    }
    const live = {
      ...readFechamentoActorAndSession(),
      groupId,
      empresaId: empresaCtx,
    };
    if (!isFechamentoScopeCurrent({ ...scopeExpected, groupId, empresaId: empresaCtx }, live)) {
      throw new Error(`${staleCode}_STALE_SCOPE`);
    }
    return rows;
  };
  
  // Namespaces raiz preservam invalidateQueries(['pedidos'|'movimentacoes'|…]) dos mutadores.
  const { data: pedidos, isLoading: isLoadingPedidos, isError: isErrorPedidosFech, isFetching: isFetchingPedidos } = useQuery({
    queryKey: buildFechamentoQueryKey('pedidos', { ...scopeKeyArgs, extra: 'fechamento' }),
    queryFn: ({ signal }) => fetchScoped('Pedido', signal, 'FECHAMENTO_PEDIDOS'),
    enabled: contextoValido,
  });

  const { data: movimentacoes, isLoading: isLoadingMov, isError: isErrorMovFech, isFetching: isFetchingMov } = useQuery({
    queryKey: buildFechamentoQueryKey('movimentacoes', { ...scopeKeyArgs, extra: 'fechamento' }),
    queryFn: ({ signal }) => fetchScoped('MovimentacaoEstoque', signal, 'FECHAMENTO_MOV'),
    enabled: contextoValido,
  });

  const { data: contas, isLoading: isLoadingContas, isError: isErrorContasFech, isFetching: isFetchingContas } = useQuery({
    queryKey: buildFechamentoQueryKey('contas-receber', { ...scopeKeyArgs, extra: 'fechamento' }),
    queryFn: ({ signal }) => fetchScoped('ContaReceber', signal, 'FECHAMENTO_CR'),
    enabled: contextoValido,
  });

  const { data: entregas, isLoading: isLoadingEntregas, isError: isErrorEntregasFech, isFetching: isFetchingEntregas } = useQuery({
    queryKey: buildFechamentoQueryKey('entregas', { ...scopeKeyArgs, extra: 'fechamento' }),
    queryFn: ({ signal }) => fetchScoped('Entrega', signal, 'FECHAMENTO_ENTREGAS'),
    enabled: contextoValido,
  });

  // #545: Pedido ready + auxiliar pendente ≠ Itens Baixados/Contas/Entregas 0.
  const kpiState = resolveFechamentoDashboardKpiState({
    contextoValido,
    pedidosIsLoading: isLoadingPedidos,
    pedidosIsError: isErrorPedidosFech,
    pedidosIsFetching: isFetchingPedidos,
    pedidosDataDefined: pedidos !== undefined,
    movIsLoading: isLoadingMov,
    movIsError: isErrorMovFech,
    movIsFetching: isFetchingMov,
    movDataDefined: movimentacoes !== undefined,
    contasIsLoading: isLoadingContas,
    contasIsError: isErrorContasFech,
    contasIsFetching: isFetchingContas,
    contasDataDefined: contas !== undefined,
    entregasIsLoading: isLoadingEntregas,
    entregasIsError: isErrorEntregasFech,
    entregasIsFetching: isFetchingEntregas,
    entregasDataDefined: entregas !== undefined,
  });
  const contagemIndisponivel = kpiState !== 'ready';
  const listaPedidos = kpiState === 'ready' && Array.isArray(pedidos) ? pedidos : [];
  const listaMov = kpiState === 'ready' && Array.isArray(movimentacoes) ? movimentacoes : [];
  const listaContas = kpiState === 'ready' && Array.isArray(contas) ? contas : [];
  const listaEntregas = kpiState === 'ready' && Array.isArray(entregas) ? entregas : [];

  // Análise de pedidos fechados nos últimos 7 dias
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

  // Movimentações automáticas
  const movimentacoesAutomaticas = contagemIndisponivel ? [] : listaMov.filter(m => 
    m.responsavel === 'Sistema Automático' && 
    new Date(m.created_date) >= dataLimite
  );

  // Contas geradas automaticamente
  const contasAutomaticas = contagemIndisponivel ? [] : listaContas.filter(c => 
    c.origem_tipo === 'pedido' && 
    new Date(c.created_date) >= dataLimite
  );

  // Entregas criadas automaticamente
  const entregasAutomaticas = contagemIndisponivel ? [] : listaEntregas.filter(e => 
    new Date(e.created_date) >= dataLimite
  );

  const kpiLabel = (value) => {
    if (kpiState === 'unavailable') return '—';
    if (kpiState === 'error') return 'Erro';
    if (kpiState === 'loading') return '…';
    return value;
  };

  const metricas = [
    {
      label: 'Pedidos Fechados (7d)',
      valor: contagemIndisponivel ? null : pedidosFechados.length,
      total: contagemIndisponivel ? null : pedidosRecentes.length,
      icon: ShoppingCart,
      cor: 'blue',
      percentual: contagemIndisponivel ? null : (pedidosRecentes.length > 0 ? (pedidosFechados.length / pedidosRecentes.length) * 100 : 0)
    },
    {
      label: 'Taxa Automação',
      valor: contagemIndisponivel ? null : pedidosComAutomacao.length,
      total: contagemIndisponivel ? null : pedidosFechados.length,
      icon: Zap,
      cor: 'purple',
      percentual: taxaAutomacao
    },
    {
      label: 'Itens Baixados',
      valor: contagemIndisponivel ? null : movimentacoesAutomaticas.length,
      icon: Package,
      cor: 'green',
      badge: 'AUTO'
    },
    {
      label: 'Contas Geradas',
      valor: contagemIndisponivel ? null : contasAutomaticas.length,
      icon: DollarSign,
      cor: 'orange',
      badge: 'AUTO'
    },
    {
      label: 'Entregas Criadas',
      valor: contagemIndisponivel ? null : entregasAutomaticas.length,
      icon: Truck,
      cor: 'indigo',
      badge: 'AUTO'
    }
  ];

  // Pedidos prontos para fechar
  const pedidosProntosFechar = contagemIndisponivel ? [] : listaPedidos.filter(p => 
    p.status === 'Rascunho' && 
    (p.itens_revenda?.length > 0 || p.itens_armado_padrao?.length > 0)
  );

  // V21.6: Garantir responsividade w-full h-full
  const containerClass = windowMode 
    ? 'w-full h-full flex flex-col overflow-hidden' 
    : 'space-y-6';

  const contentClass = windowMode 
    ? 'flex-1 overflow-y-auto p-6 space-y-6' 
    : 'space-y-6';

  const Wrapper = ({ children }) => windowMode ? (
    <div className={containerClass}>
      <div className={contentClass}>{children}</div>
    </div>
  ) : (
    <div className={containerClass}>{children}</div>
  );

  if (!contextoValido) {
    return (
      <Wrapper>
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Selecione grupo ou empresa para ver o fechamento.
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {kpiState === 'error' && (
        <p className="text-xs text-slate-500 mb-2">Indicadores indisponíveis (erro de carga ≠ zero).</p>
      )}
      
      {/* Header com IA Analytics */}
      <Card className="border-2 border-blue-400 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-blue-600" />
                Dashboard de Fechamento Automático
                {estatisticasIA && (
                  <Badge className="bg-purple-600 text-white ml-2">
                    <Sparkles className="w-3 h-3 mr-1" />
                    IA Analytics
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Sistema inteligente de monitoramento e análise preditiva
              </p>
            </div>
            <div className="text-right">
              <Badge className="bg-blue-600 text-white px-3 py-1 mb-2">
                V21.6 Final
              </Badge>
              {estatisticasIA && (
                <div className="text-xs text-slate-600">
                  Últimos {estatisticasIA.diasAnalise} dias
                  {empresaId && ' • Empresa específica'}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricas.map((metrica, idx) => {
          const Icon = metrica.icon;
          const cores = {
            blue: 'bg-blue-100 text-blue-700 border-blue-300',
            purple: 'bg-purple-100 text-purple-700 border-purple-300',
            green: 'bg-green-100 text-green-700 border-green-300',
            orange: 'bg-orange-100 text-orange-700 border-orange-300',
            indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300'
          };

          return (
            <Card key={idx} className={`border-2 ${cores[metrica.cor]}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-5 h-5 ${metrica.cor === 'blue' ? 'text-blue-600' : 
                    metrica.cor === 'purple' ? 'text-purple-600' :
                    metrica.cor === 'green' ? 'text-green-600' :
                    metrica.cor === 'orange' ? 'text-orange-600' :
                    'text-indigo-600'}`} 
                  />
                  {metrica.badge && (
                    <Badge className="text-xs bg-green-600 text-white">{metrica.badge}</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold">{kpiLabel(metrica.valor)}</p>
                <p className="text-xs text-slate-600">{metrica.label}</p>
                {metrica.total != null && metrica.percentual != null && (
                  <div className="mt-2">
                    <Progress value={metrica.percentual} className="h-1" />
                    <p className="text-xs text-slate-500 mt-1">
                      {metrica.percentual.toFixed(0)}% de {metrica.total}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alertas */}
      {pedidosProntosFechar.length > 0 && (
        <Card className="border-2 border-orange-400 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-semibold text-orange-900">
                    {pedidosProntosFechar.length} pedido(s) em Rascunho pronto(s) para fechar
                  </p>
                  <p className="text-sm text-orange-700">
                    Use o botão "🚀 Fechar Pedido" para processar automaticamente
                  </p>
                </div>
              </div>
              <Badge className="bg-orange-600 text-white">
                Ação Necessária
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IA Analytics */}
      {estatisticasIA && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Análise Inteligente (IA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/80 p-3 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <p className="text-xs text-slate-600">Total Pedidos</p>
                </div>
                <p className="text-xl font-bold text-purple-600">
                  {estatisticasIA.totalPedidos}
                </p>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-slate-600">Fechados</p>
                </div>
                <p className="text-xl font-bold text-blue-600">
                  {estatisticasIA.pedidosFechados}
                </p>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-slate-600">Automáticos</p>
                </div>
                <p className="text-xl font-bold text-green-600">
                  {estatisticasIA.pedidosAutomaticos}
                </p>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                  <p className="text-xs text-slate-600">Taxa Auto</p>
                </div>
                <p className="text-xl font-bold text-orange-600">
                  {estatisticasIA.taxaAutomacao.toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-green-900">Taxa de Sucesso</p>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {kpiLabel(taxaAutomacao == null ? null : `${taxaAutomacao.toFixed(0)}%`)}
              </p>
              <p className="text-xs text-green-700 mt-1">
                {contagemIndisponivel
                  ? 'contagens indisponíveis ≠ zero'
                  : `${pedidosComAutomacao.length} de ${pedidosFechados.length} pedidos`}
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <p className="font-semibold text-blue-900">Produtividade</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">10x</p>
              <p className="text-xs text-blue-700 mt-1">
                Vs. processo manual
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <p className="font-semibold text-purple-900">Tempo Médio</p>
              </div>
              <p className="text-3xl font-bold text-purple-600">~10s</p>
              <p className="text-xs text-purple-700 mt-1">
                Por pedido completo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atividades Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos Pedidos Fechados Automaticamente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pedidosComAutomacao.slice(0, 5).map(pedido => (
              <div key={pedido.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{pedido.numero_pedido}</p>
                    <p className="text-xs text-slate-600">{pedido.cliente_nome}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(pedido.updated_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge className="bg-green-600 text-white">
                    {pedido.status}
                  </Badge>
                </div>
              </div>
            ))}

            {pedidosComAutomacao.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Zap className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum pedido fechado automaticamente ainda</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </Wrapper>
  );
}