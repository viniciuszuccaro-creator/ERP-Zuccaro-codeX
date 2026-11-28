import React, { useState, useEffect, Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useContextoVisual } from '@/components/lib/useContextoVisual'; // Updated import path
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Package,
  Truck,
  UserCircle,
  ArrowRight,
  AlertCircle,
  Box,
  Calendar,
  BarChart3,
  PieChart,
  Clock,
  CheckCircle,
  Percent,
  Trophy,
  Activity,
  Shield,
  FileText,
  MessageCircle
  } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPie, // Recharts PieChart component, aliased to avoid conflict with Lucide icon
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
const PainelOperacoes3D = React.lazy(() => import("../components/dashboard/PainelOperacoes3D"));
const GamificacaoOperacoes = React.lazy(() => import("../components/dashboard/GamificacaoOperacoes"));
const DashboardTempoReal = React.lazy(() => import('../components/dashboard/DashboardTempoReal'));
const DashboardOperacionalBI = React.lazy(() => import("@/components/dashboard/DashboardOperacionalBI"));
import MapaTempoReal from "@/components/expedicao/MapaTempoReal";
const DashboardPerformance = React.lazy(() => import("@/components/sistema/DashboardPerformance"));
import { Tabs, TabsContent } from '@/components/ui/tabs';
import DashboardTabsNav from "@/components/dashboard/DashboardTabsNav";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import usePermissions from "@/components/lib/usePermissions";
const WidgetCanaisOrigem = React.lazy(() => import("@/components/dashboard/WidgetCanaisOrigem")); // kept for backward-compat (not used directly here)
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatsSection from "@/components/dashboard/StatsSection";
import KPIsOperacionaisSection from "@/components/dashboard/KPIsOperacionaisSection";
import SecondaryKPIsSection from "@/components/dashboard/SecondaryKPIsSection";
import ChartsSection from "@/components/dashboard/ChartsSection";
import TopProdutosStatusPeriodoSection from "@/components/dashboard/TopProdutosStatusPeriodoSection";
import AdvancedAnalysisSection from "@/components/dashboard/AdvancedAnalysisSection";
import QuickAccessModulesGrid from "@/components/dashboard/QuickAccessModulesGrid";
import FinancialSummary from "@/components/dashboard/FinancialSummary";
import DashboardExecutiveTopSection from "@/components/dashboard/DashboardExecutiveTopSection";
import { buildDashboardViewModel } from "@/components/dashboard/dashboardViewModel";
import WidgetEstoqueCritico from "@/components/estoque/WidgetEstoqueCritico";
const WidgetFechamentoPedidos = React.lazy(() => import("@/components/comercial/WidgetFechamentoPedidos"));
import ResizableRow from "@/components/dashboard/ResizableRow";
import { ResizablePanelGroup as PanelGroup, ResizablePanel as Panel, ResizableHandle as PanelResizeHandle } from "@/components/ui/resizable";
import useDashboardDerivedData from "@/components/dashboard/hooks/useDashboardDerivedData";
import { buildContextFilter } from "@/components/lib/cadastroCountFilter";
import {
  assertDashboardContext,
  buildDashboardQueryKey,
  buildKpiDrillDownParams,
  buildKpiDrillDownUrl,
  resolveDashboardCount,
} from "@/components/lib/dashboardKpiPolicy";

const reportDashboardFailure = (operation, error, context = {}) => {
  console.error('[Dashboard] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

export default function Dashboard({ aggregateOverride = null } = {}) {
  const navigate = useNavigate();
  const { empresaAtual, estaNoGrupo, grupoAtual, empresasDoGrupo, filterInContext, getFiltroContexto, alternarContexto, createInContext } = useContextoVisual();
  const { hasPermission, user } = usePermissions();
  const canSeeFinanceiro = hasPermission('Financeiro', null, 'ver');
  const canSeeCRM = hasPermission('CRM', null, 'ver');
  const canSeeComercial = hasPermission('Comercial', null, 'ver');
  const canSeeEstoque = hasPermission('Estoque', null, 'ver');
  const canSeeExpedicao = hasPermission('Expedição', null, 'ver');
  const canSeeRH = hasPermission('RH', null, 'ver');
  const canSeeCompras = hasPermission('Compras', null, 'ver');
  const canSeeProducao = hasPermission('Produção', null, 'ver');
  const canSeeDashboard = hasPermission('Dashboard', null, 'ver') || hasPermission('Dashboard', null, 'visualizar');
  const canSeeFiscal = hasPermission('Fiscal', null, 'ver') || hasPermission('Fiscal', null, 'visualizar');
  const canSeeSistema = hasPermission('Sistema', null, 'ver') || hasPermission('Sistema', null, 'visualizar');
  const canSeeCadastros = hasPermission('Cadastros', null, 'ver') || hasPermission('Cadastros', null, 'visualizar');
  const canSeeRelatorios = hasPermission('Relatorios', null, 'ver') || hasPermission('Relatorios', null, 'visualizar') || hasPermission('Relatórios', null, 'ver');
  const empresaId = empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const scopeType = estaNoGrupo ? 'grupo' : 'empresa';
  const hasContextoAtivo = Boolean(groupId && (scopeType === 'grupo' || empresaId));
  const userId = user?.id || null;
  const contextQueryKey = buildDashboardQueryKey({
    prefix: 'dash',
    userId,
    groupId,
    empresaId,
    scopeType,
  });

  const auditDashboardAction = async (acao, detalhes = {}) => {
    if (!hasContextoAtivo) {
      reportDashboardFailure('Auditoria ignorada por contexto incompleto', new Error('Contexto multiempresa incompleto'), {
        acao,
        scopeType,
        groupId,
        empresaId,
      });
      return;
    }
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Dashboard',
        entidade: 'Dashboard',
        origem_tela: 'Dashboard Executivo',
        tipo_auditoria: 'navegacao',
        descricao: `Dashboard: ${acao}`,
        detalhes,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      reportDashboardFailure('Falha ao auditar acao', error, { acao, scopeType, groupId, empresaId });
    }
  };

  const [periodo, setPeriodo] = useState(() => {
    try {
      return localStorage.getItem('dashboard_periodo') || "mes";
    } catch (e) {
      // Handle potential localStorage errors (e.g., security settings, full storage)
      console.warn("Could not access localStorage for 'dashboard_periodo':", e);
      return "mes"; // Fallback to default
    }
  });

  // Removed visualizacao state as it's replaced by Tabs
  const [activeTab, setActiveTab] = useState("resumo");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let initial = params.get('tab');
    if (!initial) {
      try {
        initial = localStorage.getItem('Dashboard_tab');
      } catch (error) {
        reportDashboardFailure('Falha ao carregar aba salva', error);
      }
    }
    if (initial) setActiveTab(initial);
  }, []);
  const handleTabChange = (value) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
    try {
      localStorage.setItem('Dashboard_tab', value);
    } catch (error) {
      reportDashboardFailure('Falha ao salvar aba ativa', error, { aba: value });
    }
    auditDashboardAction('alterar_aba', { aba: value });
  }; // New state for active tab

  useEffect(() => {
    try {
      localStorage.setItem('dashboard_periodo', periodo);
    } catch (e) {
      // Ignore localStorage errors, as state will still hold the value
      console.warn("Could not save 'dashboard_periodo' to localStorage:", e);
    }
  }, [periodo]);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();
  const refetchInterval = hasContextoAtivo ? ((activeTab === 'resumo' && autoRefresh) ? 60000 : 0) : false;

  const { data: pedidos = [], isError: pedidosError, isFetching: pedidosFetching, isFetched: pedidosFetched } = useQuery({
      enabled: Boolean(canSeeComercial && hasContextoAtivo),
      queryKey: ['pedidos', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('Pedido', {}, '-created_date', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: contasReceber = [], isError: contasReceberError, isFetching: contasReceberFetching, isFetched: contasReceberFetched } = useQuery({
      enabled: Boolean(canSeeFinanceiro && hasContextoAtivo),
      queryKey: ['contasReceber', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('ContaReceber', {}, '-data_vencimento', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: contasPagar = [], isError: contasPagarError, isFetching: contasPagarFetching, isFetched: contasPagarFetched } = useQuery({
      enabled: Boolean(canSeeFinanceiro && hasContextoAtivo),
      queryKey: ['contasPagar', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('ContaPagar', {}, '-data_vencimento', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: entregas = [], isError: entregasError, isFetching: entregasFetching, isFetched: entregasFetched } = useQuery({
      enabled: Boolean(canSeeExpedicao && hasContextoAtivo),
      queryKey: ['entregas', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('Entrega', {}, '-created_date', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: colaboradores = [] } = useQuery({
      enabled: Boolean(canSeeRH && hasContextoAtivo),
      queryKey: ['colaboradores', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('Colaborador', {}, '-created_date', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: produtos = [], isError: produtosListError, isFetching: produtosListFetching, isFetched: produtosListFetched } = useQuery({
      enabled: Boolean(canSeeEstoque && hasContextoAtivo),
      queryKey: ['produtos', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('Produto', {}, '-created_date', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: totalProdutos, isPending: produtosCountPending, isError: produtosCountError } = useQuery({
    enabled: Boolean(hasContextoAtivo && canSeeEstoque),
    queryKey: ['produtos-count-dash', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],
    queryFn: async () => {
      try {
        const filtro = buildContextFilter('Produto', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Produto',
          filter: filtro
        });
        const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar produtos', error, { scopeType, groupId, empresaId });
        throw error;
      }
    },
    staleTime: 120000,
    retry: 1,
  });

  const { data: clientes = [], isError: clientesListError, isFetching: clientesListFetching, isFetched: clientesListFetched } = useQuery({
      enabled: Boolean(canSeeCRM && hasContextoAtivo),
      queryKey: ['clientes', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('Cliente', {}, '-created_date', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: totalClientes, isPending: clientesCountPending, isError: clientesCountError } = useQuery({
    enabled: Boolean(hasContextoAtivo && canSeeCRM),
    queryKey: ['clientes-count', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],
    queryFn: async () => {
      try {
        const filtro = buildContextFilter('Cliente', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Cliente',
          filter: filtro
        });
        const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar clientes', error, { scopeType, groupId, empresaId });
        throw error;
      }
    },
    staleTime: 120000,
    retry: 1,
  });

  const { data: totalColaboradoresDash, isPending: colaboradoresCountPending, isError: colaboradoresCountError } = useQuery({
    enabled: Boolean(hasContextoAtivo && canSeeRH),
    queryKey: ['colaboradores-count-dash', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],
    queryFn: async () => {
      try {
        const filtro = buildContextFilter('Colaborador', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Colaborador',
          filter: filtro
        });
        const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar colaboradores', error, { scopeType, groupId, empresaId });
        throw error;
      }
    },
    staleTime: 120000,
    retry: 1,
  });

  const { data: ordensProducao = [], isError: producaoError, isFetching: producaoFetching, isFetched: producaoFetched } = useQuery({
      enabled: Boolean(canSeeProducao && hasContextoAtivo),
      queryKey: ['ordensProducao', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('OrdemProducao', {}, '-data_emissao', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const { data: notasFiscais = [], isError: notasFiscaisError, isFetching: notasFiscaisFetching, isFetched: notasFiscaisFetched } = useQuery({
      enabled: Boolean((canSeeFinanceiro || canSeeFiscal || canSeeComercial) && hasContextoAtivo),
      queryKey: ['notasFiscais', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('NotaFiscal', {}, '-created_date', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const nfAutorizadas = (notasFiscais || []).filter(n => n?.status === 'Autorizada').length;

  const { data: cobrancas = [], isError: cobrancasError, isFetching: cobrancasFetching, isFetched: cobrancasFetched } = useQuery({
      enabled: Boolean(canSeeFinanceiro && hasContextoAtivo),
      queryKey: ['cobrancas', ...contextQueryKey],
      queryFn: async () => {
        if (!hasContextoAtivo) return [];
        return await filterInContext('ContaReceber', {}, '-data_vencimento', 9999);
      },
    refetchInterval,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const cobrancasPagas = (cobrancas || []).filter(c => (c?.status === 'Recebido') || (c?.status_cobranca === 'paga')).length;

  const {
    pedidosPeriodo,
    amostraLimitada,
    totalVendas,
    ticketMedio,
    receitasPendentes,
    despesasPendentes,
    fluxoCaixa,
    produtosBaixoEstoque,
    colaboradoresAtivos,
    taxaConversao,
    entregasPendentes,
    otd,
    entregasNoPrazo,
    entregasConcluidas,
    pesoProduzido,
    aproveitamentoBarra,
    taxaInadimplencia,
    valorVencido,
    dadosVendasStatus,
    vendasUltimos30Dias,
    fluxo7Dias,
    topProdutos,
    vendasPorMesData,
    top5ClientesData,
    statusPedidosDataAll,
    fluxoCaixaMensalData,
  } = useDashboardDerivedData({
    pedidos,
    contasReceber,
    contasPagar,
    entregas,
    ordensProducao,
    colaboradores,
    clientes,
    produtos,
    periodo,
  });

  // Pedidos - listas rápidas (recentes/pendentes/aprovação)
  const pedidosRecentes = (pedidos || []).slice(0, 8);
  const pedidosPendentes = (pedidos || []).filter(p => ['Rascunho','Em Produção','Pronto para Faturar','Em Expedição'].includes(p?.status)).slice(0, 8);
  const pedidosAguardandoAprovacaoPeriodo = pedidosPeriodo.filter(p => p?.status === 'Aguardando Aprovação');
  const totalAguardandoAprovacaoPeriodo = pedidosAguardandoAprovacaoPeriodo.length;
  const pedidosAguardandoAprovacao = pedidosAguardandoAprovacaoPeriodo.slice(0, 8);


  // Dados e gráficos agora são providos por useDashboardDerivedData()

  const { data: previsoesIA = {}, isLoading: loadingPrevIA } = useQuery({
    queryKey: ['iaPrevEstoque14', ...contextQueryKey, periodo],
    queryFn: async () => {
      if (!hasContextoAtivo) return { previsoes: [] };
      const filtros = getFiltroContexto('empresa_id', true);
      const res = await base44.functions.invoke('iaFinanceAnomalyScan', {
        filtros,
        previsao_estoque: { enabled: true, horizon_days: 14 },
        agente: 'estoque',
      });
      return res?.data || { previsoes: [] };
    },
    staleTime: 120000,
    enabled: Boolean(canSeeEstoque && hasContextoAtivo)
  });

  const { data: previsoesIA30 = {} } = useQuery({
    queryKey: ['iaPrevEstoque30', ...contextQueryKey, periodo],
    queryFn: async () => {
      if (!hasContextoAtivo) return { previsoes: [] };
      const filtros = getFiltroContexto('empresa_id', true);
      const res = await base44.functions.invoke('iaFinanceAnomalyScan', {
        filtros,
        previsao_estoque: { enabled: true, horizon_days: 30 },
        agente: 'estoque',
      });
      return res?.data || { previsoes: [] };
    },
    staleTime: 120000,
    enabled: Boolean(canSeeEstoque && hasContextoAtivo)
  });

  const { data: anomaliasIA = {}, isLoading: loadingAnomIA } = useQuery({
    queryKey: ['iaAnomaliasFinanceiro', ...contextQueryKey],
    queryFn: async () => {
      if (!hasContextoAtivo) return { details: [] };
      const filtros = getFiltroContexto('empresa_id', true);
      const res = await base44.functions.invoke('iaFinanceAnomalyScan', { filtros, agente: 'financeiro' });
      return res?.data || { details: [] };
    },
    staleTime: 120000,
    enabled: Boolean(canSeeFinanceiro && hasContextoAtivo)
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Command Center metrics (24h window) from AuditLog
  const { data: ccMetrics = { errors: 0, funcs: 0, secAlerts: 0 } } = useQuery({
    queryKey: ['command-center', ...contextQueryKey],
    queryFn: async () => {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const logs = await filterInContext('AuditLog', {}, '-data_hora', 500);
      const within = (logs || []).filter(l => {
        const t = new Date(l?.data_hora || l?.created_date || Date.now()).getTime();
        return t >= since;
      });
      const str = (l) => `${l?.descricao || ''} ${l?.mensagem_erro || ''} ${l?.acao || ''}`;
      const errors = within.filter(l => /erro|error|failed|rejeit/i.test(str(l))).length;
      const funcs = within.filter(l => l?.entidade === 'Function' && l?.acao === 'Execução').length;
      const secAlerts = within.filter(l => (l?.tipo_auditoria || '').toLowerCase() === 'seguranca').length;
      return { errors, funcs, secAlerts };
    },
    staleTime: 60000,
    enabled: Boolean(hasContextoAtivo && canSeeSistema),
  });

  // KPIs Chatbot / SLA últimas 24h
  const { data: botMetrics = { chats: 0, sla_ok: 0, sla_total: 0 } } = useQuery({
    queryKey: ['bot-metrics-24h', ...contextQueryKey],
    queryFn: async () => {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const items = await filterInContext('ChatbotInteracao', {}, '-created_date', 500);
      const within = (items || []).filter(i => new Date(i?.created_date || Date.now()).getTime() >= since);
      const sla = within.reduce((acc, i) => {
        const ms = Number(i?.tempo_primeira_resposta_ms || 0);
        if (!isNaN(ms)) { acc.total++; if (ms <= 60000) acc.ok++; }
        return acc;
      }, { ok: 0, total: 0 });
      return { chats: within.length, sla_ok: sla.ok, sla_total: sla.total };
    },
    staleTime: 60000,
    enabled: Boolean(hasContextoAtivo && canSeeSistema),
  });

  // Assinaturas realtime locais (reforço) para invalidar KPIs do Dashboard
  useEffect(() => {
    if (!hasContextoAtivo || !canSeeDashboard) return;
    const subs = [];
    const add = (api, key, allowed) => {
      if (!allowed || !api?.subscribe) return;
      const unsubscribe = api.subscribe(() => {
        try {
          queryClient.invalidateQueries({ queryKey: [key, ...contextQueryKey] });
        } catch (error) {
          reportDashboardFailure('Falha ao atualizar cache realtime', error, { key, scopeType, groupId, empresaId });
        }
      });
      subs.push({ key, unsubscribe });
    };
    add(base44.entities?.Pedido, 'pedidos', canSeeComercial);
    add(base44.entities?.ContaReceber, 'contasReceber', canSeeFinanceiro);
    add(base44.entities?.ContaPagar, 'contasPagar', canSeeFinanceiro);
    add(base44.entities?.Entrega, 'entregas', canSeeExpedicao);
    add(base44.entities?.Produto, 'produtos', canSeeEstoque);
    add(base44.entities?.Cliente, 'clientes', canSeeCRM);
    add(base44.entities?.OrdemProducao, 'ordensProducao', canSeeProducao);
    add(base44.entities?.NotaFiscal, 'notasFiscais', canSeeFiscal || canSeeFinanceiro || canSeeComercial);
    return () => {
      subs.forEach(({ key, unsubscribe }) => {
        try {
          if (unsubscribe) unsubscribe();
        } catch (error) {
          reportDashboardFailure('Falha ao encerrar assinatura realtime', error, { key, scopeType, groupId, empresaId });
        }
      });
    };
  }, [
    hasContextoAtivo,
    canSeeDashboard,
    canSeeComercial,
    canSeeFinanceiro,
    canSeeExpedicao,
    canSeeEstoque,
    canSeeCRM,
    canSeeProducao,
    canSeeFiscal,
    scopeType,
    groupId,
    empresaId,
    queryClient,
  ]);

  // Pré-computos para seções avançadas (evita recalcular em cada render de subcomponente)
  // Pré-cálculos fornecidos pelo hook useDashboardDerivedData

  // DRILL-DOWN - Função para navegar ao clicar em KPI (params reproduzem o KPI)
  const handleDrillDown = (rota, kpiMeta = {}) => {
    try {
      assertDashboardContext({ groupId, empresaId, scopeType });
    } catch (error) {
      reportDashboardFailure('Drill-down bloqueado', error, { rota, scopeType, groupId, empresaId });
      return;
    }
    const params = buildKpiDrillDownParams({
      tab: kpiMeta.tab,
      kpi: kpiMeta.kpi || rota,
      periodo,
      status: kpiMeta.status,
      groupId,
      empresaId: estaNoGrupo ? null : empresaId,
      scopeType,
    });
    const url = buildKpiDrillDownUrl(rota, params);
    auditDashboardAction('abrir_modulo_por_dashboard', { rota: url, ...params });
    navigate(url);
  };

  const handleNavigateDirect = (url) => {
    if (!url) return;
    auditDashboardAction('navegar_dashboard', { rota: url, periodo, scopeType, groupId, empresaId });
    navigate(url);
  };

  const handleRefreshAll = () => {
    auditDashboardAction('atualizar_indicadores', { periodo, scopeType, groupId, empresaId });
    const dashboardKeys = new Set([
      'pedidos', 'contasReceber', 'contasPagar', 'entregas', 'colaboradores',
      'produtos', 'clientes', 'ordensProducao', 'notasFiscais', 'cobrancas',
      'produtos-count-dash', 'clientes-count', 'colaboradores-count-dash',
    ]);
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && dashboardKeys.has(q.queryKey[0]),
    });
  };

  const dashboardViewModel = buildDashboardViewModel({
    hasContextoAtivo,
    groupId,
    empresaId: estaNoGrupo ? null : empresaId,
    scopeType,
    periodo,
    permissions: {
      canSeeComercial,
      canSeeFinanceiro,
      canSeeEstoque,
      canSeeExpedicao,
      canSeeProducao,
      canSeeCRM,
      canSeeRH,
      canSeeFiscal,
    },
    queryStates: {
      pedidosPending: pedidosFetching && !pedidosFetched,
      pedidosError,
      contasReceberPending: contasReceberFetching && !contasReceberFetched,
      contasReceberError,
      contasPagarPending: contasPagarFetching && !contasPagarFetched,
      contasPagarError,
      entregasPending: entregasFetching && !entregasFetched,
      entregasError,
      producaoPending: producaoFetching && !producaoFetched,
      producaoError,
      produtosListPending: produtosListFetching && !produtosListFetched,
      produtosListError,
      clientesListPending: clientesListFetching && !clientesListFetched,
      clientesListError,
      produtosCountPending,
      produtosCountError,
      clientesCountPending,
      clientesCountError,
      colaboradoresCountPending,
      colaboradoresCountError,
      notasFiscaisPending: notasFiscaisFetching && !notasFiscaisFetched,
      notasFiscaisError,
      cobrancasPending: cobrancasFetching && !cobrancasFetched,
      cobrancasError,
    },
    counts: {
      totalClientes,
      totalProdutos,
      totalColaboradores: totalColaboradoresDash,
    },
    derived: {
      pedidosPeriodo,
      pedidosAguardandoAprovacao: totalAguardandoAprovacaoPeriodo,
      amostraLimitada,
      totalVendas,
      ticketMedio,
      receitasPendentes,
      despesasPendentes,
      fluxoCaixa,
      produtosBaixoEstoque,
      entregasPendentes,
      otd,
      pesoProduzido,
      aproveitamentoBarra,
      taxaInadimplencia,
      valorVencido,
      taxaConversao,
      nfAutorizadas,
      cobrancasPagas,
    },
    aggregatePayload: aggregateOverride,
  });

  const vmStates = dashboardViewModel.states;
  const vmEffective = dashboardViewModel.effectiveValues;
  const isAnyDashboardFetching = pedidosFetching || contasReceberFetching || contasPagarFetching || entregasFetching || producaoFetching;

  const statsCards = [
    {
      key: "vendas_periodo",
      title: "Vendas do Período",
      value: dashboardViewModel.formatDisplayByState(vmStates.vendas, dashboardViewModel.formatBRL, vmEffective.totalVendas),
      subtitle: dashboardViewModel.formatDisplayByState(vmStates.pedidosPeriodo, (n) => `${n} pedidos`, vmEffective.pedidosPeriodoCount ?? pedidosPeriodo.length),
      icon: DollarSign,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      indicatorState: vmStates.vendas,
      drillDownUrl: dashboardViewModel.drillDownUrls.vendas,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'vendas_periodo' })
    },
    {
      key: "ticket_medio",
      title: "Ticket Médio",
      value: dashboardViewModel.formatDisplayByState(vmStates.ticketMedio, dashboardViewModel.formatBRL, vmEffective.ticketMedio),
      subtitle: "por pedido válido",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      indicatorState: vmStates.ticketMedio,
      drillDownUrl: dashboardViewModel.drillDownUrls.ticketMedio,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'ticket_medio' })
    },
    {
      key: "fluxo_caixa",
      title: "Fluxo de Caixa",
      value: dashboardViewModel.formatDisplayByState(vmStates.fluxoCaixa, dashboardViewModel.formatBRL, vmEffective.fluxoCaixa),
      subtitle: dashboardViewModel.formatDisplayByState(vmStates.fluxoCaixa, (v) => (Number(v) >= 0 ? 'Positivo' : 'Negativo'), vmEffective.fluxoCaixa ?? fluxoCaixa),
      icon: DollarSign,
      color: fluxoCaixa >= 0 ? "from-emerald-500 to-emerald-600" : "from-orange-500 to-orange-600",
      bgColor: fluxoCaixa >= 0 ? "bg-emerald-50" : "bg-orange-50",
      textColor: fluxoCaixa >= 0 ? "text-emerald-600" : "text-orange-600",
      indicatorState: vmStates.fluxoCaixa,
      drillDownUrl: dashboardViewModel.drillDownUrls.fluxoCaixa,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'financeiro', kpi: 'fluxo_caixa' })
    },
    {
      key: "taxa_conversao",
      title: "Taxa de Conversão",
      value: dashboardViewModel.formatDisplayByState(vmStates.conversao, (v) => `${v}%`, taxaConversao),
      subtitle: "vendas/clientes",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      indicatorState: vmStates.conversao,
      drillDownUrl: dashboardViewModel.drillDownUrls.conversao,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'taxa_conversao' })
    }
  ];

  // NOVOS KPIs OPERACIONAIS (Cards)
  const opsConcluidasCount = (ordensProducao || []).filter(op => ["Concluída","Concluido","Concluida","Concluído","Finalizada","Finalizado","Encerrada","Encerrado","Pronto"].includes(op?.status)).length;
  const kpisOperacionais = [
    {
      key: "otd",
      title: "OTD (On-Time)",
      value: dashboardViewModel.formatDisplayByState(vmStates.otd, (v) => `${v}%`, vmEffective.otd),
      subtitle: `${entregasNoPrazo.length}/${entregasConcluidas.length} entregas`,
      icon: CheckCircle,
      color: Number(otd) >= 90 ? "text-green-600" : Number(otd) >= 70 ? "text-orange-600" : "text-red-600",
      bgColor: Number(otd) >= 90 ? "bg-green-50" : Number(otd) >= 70 ? "bg-orange-50" : "bg-red-50",
      indicatorState: vmStates.otd,
      drillDownUrl: dashboardViewModel.drillDownUrls.otd,
      drillDown: () => handleDrillDown(createPageUrl("Expedicao"), { kpi: 'otd_entregas' })
    },
    {
      key: "peso_produzido",
      title: "Peso Produzido",
      value: dashboardViewModel.formatDisplayByState(vmStates.producao, (v) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`, vmEffective.pesoProduzido),
      subtitle: `${opsConcluidasCount} OPs concluídas`,
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      indicatorState: vmStates.producao,
      drillDownUrl: dashboardViewModel.drillDownUrls.producao,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'producao', kpi: 'peso_produzido' })
    },
    {
      key: "aproveitamento",
      title: "Aproveitamento",
      value: dashboardViewModel.formatDisplayByState(vmStates.aproveitamento, (v) => `${v}%`, vmEffective.aproveitamentoBarra),
      subtitle: "aproveitamento de barra",
      icon: Percent,
      color: Number(aproveitamentoBarra) >= 90 ? "text-green-600" : Number(aproveitamentoBarra) >= 80 ? "text-orange-600" : "text-red-600",
      bgColor: Number(aproveitamentoBarra) >= 90 ? "bg-green-50" : Number(aproveitamentoBarra) >= 80 ? "bg-orange-50" : "bg-red-50",
      indicatorState: vmStates.aproveitamento,
      drillDownUrl: dashboardViewModel.drillDownUrls.aproveitamento,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'producao', kpi: 'aproveitamento_barra' })
    },
    {
      key: "inadimplencia",
      title: "Inadimplência",
      value: dashboardViewModel.formatDisplayByState(vmStates.inadimplencia, (v) => `${v}%`, vmEffective.taxaInadimplencia),
      subtitle: dashboardViewModel.formatDisplayByState(vmStates.inadimplencia, (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vencido`, vmEffective.valorVencido ?? valorVencido),
      icon: AlertCircle,
      color: Number(taxaInadimplencia) < 5 ? "text-green-600" : Number(taxaInadimplencia) < 10 ? "text-orange-600" : "text-red-600",
      bgColor: Number(taxaInadimplencia) < 5 ? "bg-green-50" : Number(taxaInadimplencia) < 10 ? "bg-orange-50" : "bg-red-50",
      indicatorState: vmStates.inadimplencia,
      drillDownUrl: dashboardViewModel.drillDownUrls.inadimplencia,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'financeiro', kpi: 'inadimplencia' })
    }
  ];

  const kpiCards = [
    {
      key: "clientes_cadastrados",
      title: "Clientes Cadastrados",
      value: !canSeeCRM ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : clientesCountPending ? 'Carregando' : totalClientes ?? 'Indisponível',
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      indicatorState: vmStates.clientesCount,
      drillDownUrl: dashboardViewModel.drillDownUrls.clientes,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'clientes_cadastrados' })
    },
    {
      key: "produtos_cadastrados",
      title: "Produtos Cadastrados",
      value: !canSeeEstoque ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : produtosCountPending ? 'Carregando' : totalProdutos ?? 'Indisponível',
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      indicatorState: vmStates.produtosCount,
      drillDownUrl: dashboardViewModel.drillDownUrls.produtos,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'estoque', kpi: 'produtos_cadastrados' })
    },
    {
      key: "colaboradores",
      title: "Colaboradores",
      value: dashboardViewModel.formatDisplayByState(vmStates.colaboradoresCount, dashboardViewModel.formatInt, vmEffective.totalColaboradores),
      icon: UserCircle,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      indicatorState: vmStates.colaboradoresCount,
      drillDownUrl: createPageUrl("RH"),
      drillDown: () => handleDrillDown(createPageUrl("RH"), { kpi: 'colaboradores_ativos' })
    },
    {
      key: "entregas_pendentes",
      title: "Entregas Pendentes",
      value: dashboardViewModel.formatDisplayByState(vmStates.entregas, dashboardViewModel.formatInt, vmEffective.entregasPendentes),
      icon: Truck,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      indicatorState: vmStates.entregas,
      drillDownUrl: dashboardViewModel.drillDownUrls.entregas,
      drillDown: () => handleDrillDown(createPageUrl("Expedicao"), { kpi: 'entregas_pendentes' })
    },
    {
      key: "estoque_baixo",
      title: "Estoque Baixo",
      value: dashboardViewModel.formatDisplayByState(vmStates.estoqueBaixo, dashboardViewModel.formatInt, vmEffective.produtosBaixoEstoque),
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      alert: Number(vmEffective.produtosBaixoEstoque) > 0,
      indicatorState: vmStates.estoqueBaixo,
      drillDownUrl: dashboardViewModel.drillDownUrls.estoque,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'estoque', kpi: 'estoque_baixo' })
    },
    {
      key: "total_pedidos",
      title: "Total Pedidos",
      value: dashboardViewModel.formatDisplayByState(vmStates.pedidosPeriodo, dashboardViewModel.formatInt, vmEffective.pedidosPeriodoCount ?? pedidos.length),
      icon: ShoppingCart,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      indicatorState: vmStates.pedidosPeriodo,
      drillDownUrl: dashboardViewModel.drillDownUrls.pedidos,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'pedidos_periodo' })
    },
    {
      key: "nfe_autorizadas",
      title: "NF-e Autorizadas",
      value: dashboardViewModel.formatDisplayByState(vmStates.nfAutorizadas, dashboardViewModel.formatInt, nfAutorizadas),
      icon: FileText,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      indicatorState: vmStates.nfAutorizadas,
      drillDownUrl: createPageUrl("Fiscal"),
      drillDown: () => handleDrillDown(createPageUrl("Fiscal"), { kpi: 'nfe_autorizadas' })
    },
    {
      key: "cobrancas_pagas",
      title: "Cobranças Pagas",
      value: dashboardViewModel.formatDisplayByState(vmStates.cobrancasPagas, dashboardViewModel.formatInt, cobrancasPagas),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      indicatorState: vmStates.cobrancasPagas,
      drillDownUrl: dashboardViewModel.drillDownUrls.cobrancas,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'financeiro', kpi: 'cobrancas_pagas', status: 'Recebido' })
    }
  ];

  const quickAccessBase = [
    {
      title: "Comercial e Vendas",
      description: "Gestão de Clientes e Vendas",
      icon: ShoppingCart,
      color: "from-blue-500 to-blue-600",
      url: createPageUrl("Comercial"),
      permission: "Comercial.visualizar",
      count: pedidosPeriodo.length
    },
    {
      title: "Estoque e Almoxarifado",
      description: "Produtos e Movimentações",
      icon: Box,
      color: "from-indigo-500 to-indigo-600",
      url: createPageUrl("Estoque"),
      permission: "Estoque.visualizar",
      count: produtosBaixoEstoque > 0 ? produtosBaixoEstoque : null,
      alert: produtosBaixoEstoque > 0
    },
    {
      title: "Expedição e Logística",
      description: "Entregas e Logística",
      icon: Truck,
      color: "from-orange-500 to-orange-600",
      url: createPageUrl("Expedicao"),
      permission: "Expedicao.visualizar",
      count: entregasPendentes
    },
    {
      title: "Financeiro e Contábil",
      description: "Contas e Fluxo de Caixa",
      icon: DollarSign,
      color: "from-green-500 to-green-600",
      url: createPageUrl("Financeiro"),
      permission: "Financeiro.visualizar",
      count: null
    },
  ];

  const quickAccess = quickAccessBase.filter((m) => (
    (m.title.includes('Comercial') && canSeeComercial) ||
    (m.title.includes('Estoque') && canSeeEstoque) ||
    (m.title.includes('Expedição') && canSeeExpedicao) ||
    (m.title.includes('Financeiro') && canSeeFinanceiro)
  ));

  return (
    <ProtectedSection module="Dashboard" action="ver">
    <div className="w-full h-full min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50" data-permission="Dashboard.visualizar">
      <div className="flex-1 overflow-hidden p-4 sm:p-6 space-y-4">
      <DashboardHeader
        empresaAtual={empresaAtual}
        estaNoGrupo={estaNoGrupo}
        grupoAtual={grupoAtual}
        autoRefresh={autoRefresh}
        setAutoRefresh={(value) => {
          setAutoRefresh(value);
          auditDashboardAction('alterar_auto_refresh', { ativo: value });
        }}
        periodo={periodo}
        setPeriodo={(value) => {
          setPeriodo(value);
          auditDashboardAction('alterar_periodo', { periodo: value });
        }}
        periodoRange={dashboardViewModel.periodoRange}
        onRefresh={handleRefreshAll}
        isRefreshing={isAnyDashboardFetching}
        canSeeRelatorios={canSeeRelatorios}
        onOpenRelatorios={() => handleNavigateDirect(dashboardViewModel.drillDownUrls.relatoriosGeral)}
        canSeeDashboard={canSeeDashboard}
      />

      <DashboardExecutiveTopSection
        estaNoGrupo={estaNoGrupo}
        hasContextoAtivo={hasContextoAtivo}
        groupId={groupId}
        empresaId={empresaId}
        grupoAtual={grupoAtual}
        empresaAtual={empresaAtual}
        empresasDoGrupo={empresasDoGrupo}
        alternarContexto={alternarContexto}
        canSeeDashboard={canSeeDashboard}
        canSeeComercial={canSeeComercial}
        canSeeFinanceiro={canSeeFinanceiro}
        canSeeEstoque={canSeeEstoque}
        canSeeExpedicao={canSeeExpedicao}
        canSeeProducao={canSeeProducao}
        canSeeCadastros={canSeeCadastros}
        canSeeRelatorios={canSeeRelatorios}
        viewModel={dashboardViewModel}
        anomaliasCount={Array.isArray(anomaliasIA?.details) ? anomaliasIA.details.length : null}
        onRetryAll={handleRefreshAll}
        onNavigate={handleNavigateDirect}
      />

      <ErrorBoundary>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Unificado em Resumo Geral */}
        <div className="hidden" />





        <TabsContent value="resumo" className="w-full h-full overflow-y-auto space-y-5 mt-3">
          <PanelGroup direction="vertical" className="gap-2 flex-1 w-full h-full">
            <Panel defaultSize={50} minSize={30} className="overflow-auto">
              {/* KPIs Principais + Widget Canais */}
              <StatsSection statsCards={statsCards} empresaId={empresaAtual?.id} />
            </Panel>
            <PanelResizeHandle className="h-1 bg-slate-200 rounded" />
            <Panel defaultSize={50} minSize={20} className="overflow-auto">
              {/* NOVOS KPIs OPERACIONAIS */}
              <KPIsOperacionaisSection kpis={kpisOperacionais} />
            </Panel>
          </PanelGroup>

          {/* KPIs Secundários */}
          <SecondaryKPIsSection kpis={kpiCards} />

          {/* Tempo Real - Mapa em card dentro do Dashboard unificado */}
          <div className="mt-4">
            <ProtectedSection module="Expedição" action="ver" hideInstead>
              <Card className="bg-white/80 backdrop-blur-sm rounded-md shadow-sm">
                <CardContent>
                  <Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}>
                    <MapaTempoReal />
                  </Suspense>
                </CardContent>
              </Card>
            </ProtectedSection>
          </div>

          {canSeeComercial && (
            <Card className="bg-white/80 backdrop-blur-sm rounded-md shadow-sm">
              <CardHeader>
                <CardTitle>Pedidos (Recentes, Pendentes, Aprovação)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Recentes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">Recentes</h3>
                      <Badge variant="outline">{pedidosRecentes.length}</Badge>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {pedidosRecentes.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200 bg-white">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">#{p.numero_pedido} • {p.cliente_nome}</div>
                            <div className="text-xs text-slate-500">{p.data_pedido ? new Date(p.data_pedido).toLocaleDateString('pt-BR') : '-'} • {p.status}</div>
                          </div>
                          <div className="text-sm font-semibold text-blue-600">R$ {(p.valor_total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                        </div>
                      ))}
                      {pedidosRecentes.length === 0 && (<p className="text-sm text-slate-500">Sem pedidos.</p>)}
                    </div>
                  </div>

                  {/* Pendentes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">Pendentes</h3>
                      <Badge className="bg-amber-100 text-amber-700">{pedidosPendentes.length}</Badge>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {pedidosPendentes.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200 bg-white">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">#{p.numero_pedido} • {p.cliente_nome}</div>
                            <div className="text-xs text-slate-500">{p.data_pedido ? new Date(p.data_pedido).toLocaleDateString('pt-BR') : '-'} • {p.status}</div>
                          </div>
                          <div className="text-sm font-semibold text-slate-700">R$ {(p.valor_total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                        </div>
                      ))}
                      {pedidosPendentes.length === 0 && (<p className="text-sm text-slate-500">Sem pendências.</p>)}
                    </div>
                  </div>

                  {/* Aguardando Aprovação */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">Aguardando Aprovação</h3>
                      <Badge className="bg-red-100 text-red-700">{totalAguardandoAprovacaoPeriodo}</Badge>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {pedidosAguardandoAprovacao.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded border border-slate-200 bg-white">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">#{p.numero_pedido} • {p.cliente_nome}</div>
                            <div className="text-xs text-slate-500">solicit.: {p.vendedor || '-'} • desc {p.desconto_solicitado_percentual ?? 0}%</div>
                          </div>
                          <Badge className="bg-rose-100 text-rose-700 text-[10px]">{p.status_aprovacao || 'pendente'}</Badge>
                        </div>
                      ))}
                      {pedidosAguardandoAprovacao.length === 0 && (<p className="text-sm text-slate-500">Sem aprovações pendentes.</p>)}
                      {totalAguardandoAprovacaoPeriodo > pedidosAguardandoAprovacao.length && (<p className="text-xs text-slate-500">Exibindo {pedidosAguardandoAprovacao.length} de {totalAguardandoAprovacaoPeriodo} no período.</p>)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button variant="outline" data-permission="Comercial.visualizar" data-action="Dashboard.abrir.Comercial" onClick={() => handleDrillDown(createPageUrl('Comercial'))}>Ver todos</Button>
                </div>
              </CardContent>
            </Card>
          )}


          {/* Anomalias Financeiras (IA) – hiperpersonalização por role */}
          {canSeeFinanceiro && (
            <Card className="bg-white/80 backdrop-blur-sm mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  Anomalias Financeiras Detectadas
                  <Badge variant="outline" className="ml-2 text-rose-700 border-rose-200">Sugestão</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAnomIA ? (
                  <div className="h-10 rounded-md bg-slate-100 animate-pulse" />
                ) : (
                  (() => {
                    const list = anomaliasIA?.details || [];
                    const hasAnomaly = anomaliasIA?.anomaly === true || list.length > 0;
                    if (!hasAnomaly) {
                      return (
                        <p className="text-sm text-slate-600">
                          Nenhuma anomalia relevante{anomaliasIA?.modo === 'sugestao' ? ' (modo sugestão)' : ''}.
                        </p>
                      );
                    }
                    const resumo = list.reduce((acc, i) => { acc[i.severity || 'baixo'] = (acc[i.severity || 'baixo'] || 0) + 1; return acc; }, {});
                    return (
                      <div className="flex flex-wrap gap-2 text-sm items-center">
                        <Badge className="bg-red-100 text-red-700">Alta: {resumo.alto || 0}</Badge>
                        <Badge className="bg-amber-100 text-amber-700">Média: {resumo.medio || 0}</Badge>
                        <Badge variant="outline">Baixa: {resumo.baixo || 0}</Badge>
                        {Number(anomaliasIA?.issues) > 0 && (
                          <span className="text-xs text-slate-500">issues: {anomaliasIA.issues}</span>
                        )}
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          )}

          {/* Estoque Crítico */}
          {canSeeEstoque && (
          <WidgetEstoqueCritico 
            preds14Count={(previsoesIA?.previsoes || []).filter(p => p.risco_ruptura && p.risco_ruptura !== 'baixo').length}
            preds30Count={(previsoesIA30?.previsoes || []).filter(p => p.risco_ruptura && p.risco_ruptura !== 'baixo').length}
            count={produtosBaixoEstoque}
            onNavigate={() => handleDrillDown(createPageUrl("Estoque"))}
          />
          )}

          {/* Fechamento de pedidos — recurso existente reconectado ao Dashboard */}
          {canSeeComercial && (
            <ErrorBoundary fallback={<div className="text-sm text-slate-500 p-3">Widget de fechamento indisponível.</div>}>
              <Suspense fallback={<div className="h-24 rounded-md bg-slate-100 animate-pulse" />}>
                <WidgetFechamentoPedidos empresaId={empresaAtual?.id || null} />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Gráficos + Top Produtos (redimensionável) */}
          <PanelGroup direction="vertical" className="gap-2 min-h-[420px]">
            <Panel defaultSize={55} minSize={30} className="overflow-auto">
              <ChartsSection vendasUltimos30Dias={vendasUltimos30Dias} fluxo7Dias={fluxo7Dias} />
            </Panel>
            <PanelResizeHandle className="w-1 bg-slate-200 rounded" />
            <Panel defaultSize={45} minSize={20} className="overflow-auto">
              <TopProdutosStatusPeriodoSection topProdutos={topProdutos} dadosVendasStatus={dadosVendasStatus} COLORS={COLORS} />
            </Panel>
          </PanelGroup>

          {/* GRÁFICOS AVANÇADOS */}
          <AdvancedAnalysisSection
            vendasPorMes={vendasPorMesData}
            top5Clientes={top5ClientesData}
            statusPedidos={statusPedidosDataAll}
            fluxoCaixaMensal={fluxoCaixaMensalData}
            COLORS={COLORS}
          />

          {/* Command Center (Executivo) - sem criar módulo novo, visível a quem tem Sistema */}
          <ProtectedSection module="Sistema" action="ver" hideInstead>
            <Card className="bg-white/80 backdrop-blur-sm mt-4">
              <CardHeader>
                <CardTitle>Command Center</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="p-4 rounded-md border border-slate-200 bg-white/70 backdrop-blur shadow-md flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Erros (24h)</div>
                      <div className="text-2xl font-bold">{ccMetrics?.errors ?? 0}</div>
                    </div>
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  </div>
                  <div className="p-4 rounded-md border border-slate-200 bg-white/70 backdrop-blur shadow-md flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Jobs/Automations</div>
                      <div className="text-2xl font-bold">{ccMetrics?.funcs ?? 0}</div>
                    </div>
                    <Activity className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="p-4 rounded-md border border-slate-200 bg-white/70 backdrop-blur shadow-md flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Integrações</div>
                      <div className="text-2xl font-bold">OK</div>
                    </div>
                    <BarChart3 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="p-4 rounded-md border border-slate-200 bg-white/70 backdrop-blur shadow-md flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Segurança</div>
                      <div className="text-2xl font-bold">{ccMetrics?.secAlerts ?? 0}</div>
                    </div>
                    <Shield className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="p-4 rounded-md border border-slate-200 bg-white/70 backdrop-blur shadow-md flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Chatbot (24h)</div>
                      <div className="text-xs text-slate-500">SLA 1ª resp.</div>
                      <div className="text-2xl font-bold">{botMetrics?.chats ?? 0} / {botMetrics?.sla_total ?? 0} • {botMetrics?.sla_total ? Math.round(100*(botMetrics.sla_ok/(botMetrics.sla_total||1))) : 0}%</div>
                    </div>
                    <MessageCircle className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </ProtectedSection>

          <ProtectedSection module="Sistema" action="ver" hideInstead>
            <Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}> 
              <DashboardPerformance />
            </Suspense>
          </ProtectedSection>

          {/* Previsões de Estoque (IA) - visível apenas para quem vê Estoque */}
          {canSeeEstoque && (
            <Card className="bg-white/80 backdrop-blur-sm rounded-md shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Previsões de Estoque (14 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPrevIA ? (
                  <div className="h-10 rounded-md bg-slate-100 animate-pulse" />
                ) : (
                  (() => {
                    const preds = (previsoesIA?.previsoes || [])
                      .filter(p => p.risco_ruptura && p.risco_ruptura !== 'baixo')
                      .sort((a, b) => (a.dias_cobertura ?? 999) - (b.dias_cobertura ?? 999))
                      .slice(0, 8);
                    if (!preds.length) return <p className="text-sm text-slate-600">Sem riscos relevantes no horizonte.</p>;
                    return (
                      <div className="grid md:grid-cols-2 gap-3">
                        {preds.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                            <div>
                              <div className="font-medium text-slate-900 truncate max-w-[340px]">{p.descricao}</div>
                              <div className="text-xs text-slate-500">Cobertura: {p.dias_cobertura ?? '-'} dias • Demanda/dia: {p.demanda_dia_estimada ?? '-'} {p.preco_previsto != null && (<span className="ml-2">• Preço previsto: R$ {p.preco_previsto}</span>)}</div>
                            </div>
                            <Badge className={p.risco_ruptura === 'alto' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                              {String(p.risco_ruptura || '').toUpperCase()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          )}

          {/* Módulos de Acesso Rápido */}
          {/* Previsões de Estoque (IA) - visível apenas para quem vê Estoque */}
          <ProtectedSection module="Estoque" action="ver" hideInstead>
          {canSeeEstoque && (
            <Card className="bg-white/80 backdrop-blur-sm rounded-md shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Previsões de Estoque (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPrevIA ? (
                  <div className="h-10 rounded-md bg-slate-100 animate-pulse" />
                ) : (
                  (() => {
                    const preds = (previsoesIA30?.previsoes || [])
                      .filter(p => p.risco_ruptura && p.risco_ruptura !== 'baixo')
                      .sort((a, b) => (a.dias_cobertura ?? 999) - (b.dias_cobertura ?? 999))
                      .slice(0, 8);
                    if (!preds.length) return <p className="text-sm text-slate-600">Sem riscos relevantes no horizonte.</p>;
                    return (
                      <div className="grid md:grid-cols-2 gap-3">
                        {preds.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                            <div>
                              <div className="font-medium text-slate-900 truncate max-w-[340px]">{p.descricao}</div>
                              <div className="text-xs text-slate-500">Cobertura: {p.dias_cobertura ?? '-'} dias • Demanda/dia: {p.demanda_dia_estimada ?? '-'} {p.preco_previsto != null && (<span className="ml-2">• Preço previsto: R$ {p.preco_previsto}</span>)}</div>
                            </div>
                            <Badge className={p.risco_ruptura === 'alto' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                              {String(p.risco_ruptura || '').toUpperCase()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          )}

          </ProtectedSection>

          {/* Módulos de Acesso Rápido */}
          <QuickAccessModulesGrid modules={quickAccess} onClick={handleDrillDown} />

          {/* Resumo Financeiro */}
          {canSeeFinanceiro && (
          <FinancialSummary receitasPendentes={receitasPendentes} despesasPendentes={despesasPendentes} fluxoCaixa={fluxoCaixa} />
          )}

          {/* NOVO: Gamificação */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-600" />
              Rankings de Performance
            </h2>
            <Suspense fallback={<div className="h-40 rounded-md bg-slate-100 animate-pulse" />}>
              <GamificacaoOperacoes />
            </Suspense>
          </div>

          {/* Placeholder or replacement if PainelOperacoes3D was still intended for "resumo" tab */}
          {/* If PainelOperacoes3D should be nested within the "Resumo Geral" tab and not a separate view,
              it would go here, possibly conditionally or within a different section.
              Based on the outline, it's removed from the main switch. */}
          {/* Example: <PainelOperacoes3D empresaId={null} grupoId={null} /> */}
        </TabsContent>
      </Tabs>
      </ErrorBoundary>
      </div>
    </div>
  </ProtectedSection>
  );
}
