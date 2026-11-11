import React, { Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Package, FileText, Route, Activity, BarChart3, Settings, Map, MessageCircle, Camera, Scan, Building2 } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useWindow } from "@/components/lib/useWindow";
import { useUser } from "@/components/lib/UserContext";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ModuleKPIs from "@/components/layout/ModuleKPIs";
import ModuleContent from "@/components/layout/ModuleContent";
import ModuleTabs from "@/components/layout/ModuleTabs";
import { Button } from "@/components/ui/button";
import HeaderExpedicaoCompacto from "@/components/expedicao/expedicao-launchpad/HeaderExpedicaoCompacto";
import KPIsExpedicao from "@/components/expedicao/expedicao-launchpad/KPIsExpedicao";
import ModulosGridExpedicao from "@/components/expedicao/expedicao-launchpad/ModulosGridExpedicao";
import { useRealtimeEntregas } from '@/components/lib/useRealtimeData';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import NotificadorAutomaticoEntrega from "../components/logistica/NotificadorAutomaticoEntrega";
import ComprovanteEntregaDigital from "../components/logistica/ComprovanteEntregaDigital";
import RegistroOcorrenciaLogistica from "../components/logistica/RegistroOcorrenciaLogistica";
import IntegracaoRomaneio from "../components/logistica/IntegracaoRomaneio";
import {
  isPedidoStatusElegivelRomaneio,
} from "@/components/lib/expedicaoFluxoOperacionalPolicy";

const EntregasListagem = React.lazy(() => import("../components/expedicao/EntregasListagem"));
const FormularioEntrega = React.lazy(() => import("../components/expedicao/FormularioEntrega"));
const SeparacaoConferencia = React.lazy(() => import("../components/expedicao/SeparacaoConferencia"));
const SeparacaoConferenciaIA = React.lazy(() => import("@/components/expedicao/SeparacaoConferenciaIA"));
const RoteirizacaoInteligente = React.lazy(() => import("@/components/expedicao/RoteirizacaoInteligente"));
const PainelMetricasRealtime = React.lazy(() => import("../components/logistica/PainelMetricasRealtime"));
const DashboardLogisticaInteligente = React.lazy(() => import("../components/logistica/DashboardLogisticaInteligente"));
const DashboardLogistico = React.lazy(() => import("../components/expedicao/DashboardLogistico"));
const DashboardEntregasRealtime = React.lazy(() => import("../components/expedicao/DashboardEntregasRealtime"));
const RelatoriosLogistica = React.lazy(() => import("../components/expedicao/RelatoriosLogistica"));
const ConfiguracaoExpedicao = React.lazy(() => import("../components/expedicao/ConfiguracaoExpedicao"));
const MapaRoteirizacaoIA = React.lazy(() => import("../components/logistica/MapaRoteirizacaoIA"));
const RoteirizacaoMapa = React.lazy(() => import("../components/expedicao/RoteirizacaoMapa"));
const ComprovanteDigital = React.lazy(() => import("../components/expedicao/ComprovanteDigital"));
const LogisticaFinanceiroPanel = React.lazy(() => import("../components/expedicao/financeiro/LogisticaFinanceiroPanel"));
const ConfigFinanceiroLogistica = React.lazy(() => import("../components/expedicao/financeiro/ConfigFinanceiroLogistica"));
const RelatorioFinanceiroLogistica = React.lazy(() => import("../components/expedicao/financeiro/RelatorioFinanceiroLogistica"));

export default function Expedicao() {
  const { hasPermission, isLoading: loadingPermissions } = usePermissions();
  const canSeeExpedicao = hasPermission('Expedição', null, 'ver') || hasPermission('Expedição', null, 'visualizar') || hasPermission('Expedicao', null, 'ver') || hasPermission('Expedicao', null, 'visualizar');
  const { openWindow } = useWindow();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { estaNoGrupo, empresaAtual, empresasDoGrupo, filtrarPorContexto, getFiltroContexto, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const contextKey = estaNoGrupo ? `grupo:${groupId || 'sem-grupo'}` : `empresa:${empresaId || 'sem-empresa'}`;

  const [comprovanteModal, setComprovanteModal] = React.useState(null);
  const [entregaSelecionada, setEntregaSelecionada] = React.useState(null);
  const [notificadorOpen, setNotificadorOpen] = React.useState(false);
  const [comprovanteOpen, setComprovanteOpen] = React.useState(false);
  const [ocorrenciaOpen, setOcorrenciaOpen] = React.useState(false);

  // Erro/negativa ≠ lista vazia nem KPI 0. Auxiliares isolados: falha de um não zera o restante.
  const { data: entregas, isError: isErrorEntregas, isLoading: isLoadingEntregas } = useQuery({
    queryKey: ['entregas', contextKey],
    queryFn: () => filtrarPorContexto('Entrega', {}, '-created_date', 100),
    staleTime: 30000,
    retry: 2,
    enabled: canSeeExpedicao && contextoValido
  });

  // Contagem auxiliar isolada — falha aqui não zera KPIs de status nem lista.
  useQuery({
    queryKey: ['entregas-count', contextKey],
    queryFn: async () => {
      const response = await base44.functions.invoke('countEntities', {
        entityName: 'Entrega',
        filter: getFiltroContexto('empresa_id', true)
      });
      const n = response.data?.count;
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
        throw new Error('READ_COUNT_UNAVAILABLE');
      }
      return n;
    },
    staleTime: 60000,
    retry: 1,
    enabled: canSeeExpedicao && contextoValido
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes', contextKey],
    queryFn: () => filtrarPorContexto('Cliente', {}, '-created_date', 100),
    staleTime: 30000,
    retry: 1,
    enabled: canSeeExpedicao && contextoValido
  });

  const { data: pedidos } = useQuery({
    queryKey: ['pedidos', contextKey],
    queryFn: () => filtrarPorContexto('Pedido', {}, '-created_date', 100),
    staleTime: 30000,
    retry: 1,
    enabled: canSeeExpedicao && contextoValido
  });

  // Romaneios/rotas: consumidores próprios nas janelas; falha isolada (sem default []).
  useQuery({
    queryKey: ['romaneios', contextKey],
    queryFn: () => filtrarPorContexto('Romaneio', {}, '-created_date', 50),
    staleTime: 30000,
    retry: 1,
    enabled: canSeeExpedicao && contextoValido
  });

  useQuery({
    queryKey: ['rotas', contextKey],
    queryFn: () => filtrarPorContexto('Rota', {}, '-created_date', 50),
    staleTime: 30000,
    retry: 1,
    enabled: canSeeExpedicao && contextoValido
  });

  const entregasFiltradas = Array.isArray(entregas) ? entregas : [];
  const clientesLista = Array.isArray(clientes) ? clientes : [];
  const pedidosLista = Array.isArray(pedidos) ? pedidos : [];
  // Erro de listagem ≠ loading; loading não inventa zero confirmado.
  const kpisUnavailable = Boolean(isErrorEntregas);
  useRealtimeEntregas(empresaAtual?.id);

  const statusCounts = kpisUnavailable
    ? {
      total: null,
      aguardando: null,
      separacao: null,
      pronto: null,
      transito: null,
      entregue: null,
      frustrada: null,
      unavailable: true,
    }
    : isLoadingEntregas && !Array.isArray(entregas)
      ? {
        total: null,
        aguardando: null,
        separacao: null,
        pronto: null,
        transito: null,
        entregue: null,
        frustrada: null,
        unavailable: true,
      }
      : {
        total: entregasFiltradas.length,
        aguardando: entregasFiltradas.filter(e => e.status === "Aguardando Separação").length,
        separacao: entregasFiltradas.filter(e => e.status === "Em Separação").length,
        pronto: entregasFiltradas.filter(e => e.status === "Pronto para Expedir").length,
        transito: entregasFiltradas.filter(e => e.status === "Em Trânsito" || e.status === "Saiu para Entrega").length,
        entregue: entregasFiltradas.filter(e => e.status === "Entregue").length,
        frustrada: entregasFiltradas.filter(e => e.status === "Entrega Frustrada").length,
        unavailable: false,
      };

  if (loadingPermissions) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  const modules = [
    {
      title: 'Entregas',
      description: 'Lista e gestão',
      icon: Truck,
      color: 'blue',
      component: EntregasListagem,
      windowTitle: '🚚 Entregas',
      width: 1600,
      height: 900,
      props: { entregas: entregasFiltradas, clientes: clientesLista, pedidos: pedidosLista, empresasDoGrupo, estaNoGrupo }
    },
    {
      title: 'Separação',
      description: 'Picking de pedidos',
      icon: Package,
      color: 'blue',
      component: SeparacaoConferenciaIA,
      windowTitle: '📦 Separação IA',
      width: 1400,
      height: 850,
    },
    // Matriz keep both curto: clássica permanece disponível (não só a variante IA).
    // Sem entregaId pré-selecionado: componente lista candidatas (não tela vazia).
    {
      title: 'Separação Conferência',
      sectionKey: 'Separação',
      description: 'Conferência operacional',
      icon: Package,
      color: 'blue',
      component: SeparacaoConferencia,
      windowTitle: '📦 Separação Conferência',
      width: 1400,
      height: 850,
      props: {
        empresaId: empresaAtual?.id,
        entregasCandidatas: entregasFiltradas,
        pedidosCandidatos: pedidosLista,
      },
    },
    {
      title: 'Romaneios',
      description: 'Gestão de cargas',
      icon: FileText,
      color: 'blue',
      component: IntegracaoRomaneio,
      windowTitle: '📋 Romaneios',
      width: 1400,
      height: 800,
      // Só pré-seleciona pedidos com empresa_id + status elegível (policy).
      // Órfãos só com group_id bloqueavam effectiveEmpresaId em visão grupo.
      props: {
        pedidosSelecionados: pedidosLista.filter((p) => (
          Boolean(p?.empresa_id) && isPedidoStatusElegivelRomaneio(p?.status)
        )),
      },
    },
    {
      title: 'Rotas e Mapa',
      description: 'Visualização cartográfica',
      icon: Map,
      color: 'blue',
      component: RoteirizacaoMapa,
      windowTitle: '🗺️ Rotas e Mapa',
      width: 1400,
      height: 800,
      props: { entregas: entregasFiltradas.filter(e => e.status === "Pronto para Expedir"), empresaId: empresaAtual?.id }
    },
    {
      title: 'Roteirização IA',
      description: 'Otimização automática',
      icon: Route,
      color: 'blue',
      component: RoteirizacaoInteligente,
      windowTitle: '🤖 Roteirização IA',
      width: 1400,
      height: 800,
    },
    // Canônico existente desconectado do launchpad (lazy import órfão).
    {
      title: 'Mapa Roteirização IA',
      sectionKey: 'Roteirizacao',
      description: 'Mapa com otimização IA',
      icon: Map,
      color: 'blue',
      component: MapaRoteirizacaoIA,
      windowTitle: '🗺️ Mapa Roteirização IA',
      width: 1400,
      height: 850,
      props: {
        pedidosSelecionados: pedidosLista.filter((p) => (
          Boolean(p?.empresa_id) && isPedidoStatusElegivelRomaneio(p?.status)
        )),
      },
    },
    {
      title: 'Métricas Realtime',
      description: 'Monitoramento ao vivo',
      icon: Activity,
      color: 'blue',
      component: PainelMetricasRealtime,
      windowTitle: '⚡ Métricas Tempo Real',
      width: 1200,
      height: 700,
    },
    {
      title: 'Dashboard IA',
      description: 'Analytics inteligente',
      icon: BarChart3,
      color: 'blue',
      component: DashboardLogisticaInteligente,
      windowTitle: '📊 Dashboard IA',
      width: 1300,
      height: 750,
    },
    {
      title: 'Dashboard Entregas',
      description: 'Visão geral realtime',
      icon: Activity,
      color: 'blue',
      component: DashboardEntregasRealtime,
      windowTitle: '📊 Dashboard Entregas',
      width: 1300,
      height: 750,
      props: { empresaId: empresaAtual?.id }
    },
    {
      title: 'Financeiro Logístico',
      description: 'CR/CP e conciliação',
      icon: BarChart3,
      color: 'blue',
      component: LogisticaFinanceiroPanel,
      windowTitle: '💸 Financeiro Logístico',
      width: 1300,
      height: 800,
      props: { empresaId: empresaAtual?.id }
    },
    {
      title: 'Config Financeiro Logística',
      sectionKey: 'Financeiro Logistica',
      description: 'Parâmetros financeiros',
      icon: Settings,
      color: 'blue',
      component: ConfigFinanceiroLogistica,
      windowTitle: '⚙️ Config Financeiro Logística',
      width: 1200,
      height: 700,
      props: { empresaId: empresaAtual?.id }
    },
    {
      title: 'Relatório Financeiro',
      description: 'KPIs, grupos e detalhamento',
      icon: BarChart3,
      color: 'blue',
      component: RelatorioFinanceiroLogistica,
      windowTitle: '📊 Relatório Financeiro Logístico',
      width: 1300,
      height: 900
    },
    {
      title: 'Relatórios',
      description: 'Análises e exportação',
      icon: FileText,
      color: 'blue',
      component: RelatoriosLogistica,
      windowTitle: '📄 Relatórios Logística',
      width: 1400,
      height: 800,
      props: { empresaId: empresaAtual?.id }
    },
    {
      title: 'Configurações',
      description: 'Parâmetros e ajustes',
      icon: Settings,
      color: 'blue',
      component: ConfiguracaoExpedicao,
      windowTitle: '⚙️ Configurações',
      width: 1200,
      height: 700,
      props: { empresaId: empresaAtual?.id }
    },
  {
    title: 'Painel Logístico',
    description: 'Mapa + filas em tempo real',
    icon: Activity,
    color: 'blue',
    component: DashboardLogistico,
    windowTitle: '🗺️ Painel Logístico',
    width: 1400,
    height: 800,
    props: { empresaId: empresaAtual?.id, entregas: entregasFiltradas }
  }
  ];

  const canViewModule = (module) => {
    const section = module.sectionKey || module.title;
    return hasPermission('Expedição', section, 'ver') || hasPermission('Expedição', section, 'visualizar') || hasPermission('Expedicao', section, 'ver') || hasPermission('Expedicao', section, 'visualizar');
  };

  const allowedModules = modules.filter(canViewModule);
  const auditExpedicaoAction = async (acao, module, detalhes = {}) => {
    try {
      await base44.entities.AuditLog.create({
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || 'Usuário',
        acao,
        modulo: 'Expedição',
        tipo_auditoria: detalhes.sucesso === false ? 'seguranca' : 'acesso',
        entidade: 'Seção',
        descricao: detalhes.descricao || `Abrir seção: ${module?.title || 'Expedição'}`,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso: detalhes.sucesso !== false,
        detalhes: {
          sectionKey: module?.sectionKey || module?.title || null,
          contexto: estaNoGrupo ? 'grupo' : 'empresa',
          ...detalhes,
        },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar ação de Expedição:', error);
    }
  };

  const handlePrimaryAction = async () => {
    if (!contextoValido) {
      await auditExpedicaoAction('nova_entrega_bloqueada', { title: 'Nova Entrega' }, {
        sucesso: false,
        motivo: 'contexto_obrigatorio',
        descricao: 'Tentativa de criar entrega sem contexto de grupo/empresa.',
      });
      toast({
        title: 'Contexto obrigatório',
        description: 'Selecione o Grupo CPA ou uma empresa antes de criar entrega.',
        variant: 'destructive',
      });
      return;
    }

    const canCreateEntrega = hasPermission('Expedição', 'Entregas', 'criar') || hasPermission('Expedição', 'Entregas', 'incluir') || hasPermission('Expedicao', 'Entregas', 'criar') || hasPermission('Expedicao', 'Entregas', 'incluir');
    if (!canCreateEntrega) {
      await auditExpedicaoAction('nova_entrega_bloqueada', { title: 'Nova Entrega' }, {
        sucesso: false,
        motivo: 'permissao_negada',
        descricao: 'Tentativa de criar entrega sem permissão.',
      });
      toast({
        title: 'Acesso negado',
        description: 'Seu perfil não possui permissão para criar entregas.',
        variant: 'destructive',
      });
      return;
    }

    await auditExpedicaoAction('nova_entrega', { title: 'Nova Entrega' }, {
      descricao: 'Acionamento do comando principal de nova entrega.',
    });
    base44.analytics.track({ eventName: 'expedicao_primary_action' });
    // Reutiliza FormularioEntrega existente (HTTP canônico quando VITE_ERP_HTTP_EXPEDICAO).
    React.startTransition(() => {
      openWindow(
        FormularioEntrega,
        {
          clientes: clientesLista,
          pedidos: pedidosLista,
          empresasDoGrupo,
          estaNoGrupo,
          windowMode: true,
          isEditing: false,
        },
        {
          title: 'Nova Entrega',
          width: 1100,
          height: 650,
          uniqueKey: 'expedicao-nova-entrega',
        },
      );
    });
  };
  const handleModuleClick = (module) => {
    if (!contextoValido) {
      auditExpedicaoAction('abrir_secao_bloqueado', module, {
        sucesso: false,
        motivo: 'contexto_obrigatorio',
        descricao: `Tentativa de abrir seção sem contexto: ${module.title}`,
      });
      toast({
        title: 'Contexto obrigatório',
        description: 'Selecione o Grupo CPA ou uma empresa antes de abrir o módulo.',
        variant: 'destructive',
      });
      return;
    }

    if (!canViewModule(module)) {
      auditExpedicaoAction('abrir_secao_bloqueado', module, {
        sucesso: false,
        motivo: 'permissao_negada',
        descricao: `Tentativa de abrir seção sem permissão: ${module.title}`,
      });
      toast({
        title: 'Acesso negado',
        description: 'Seu perfil não possui permissão para esta seção de Expedição.',
        variant: 'destructive',
      });
      return;
    }

    React.startTransition(() => {
      auditExpedicaoAction('abrir_secao', module, {
        descricao: `Abrir seção: ${module.title}`,
      });
      openWindow(
         module.component,
        { ...(module.props || {}), windowMode: true },
        {
          title: module.windowTitle,
          width: module.width,
          height: module.height,
          uniqueKey: `expedicao-${module.title.toLowerCase().replace(/\s/g, '-')}`
        }
      );
    });
  };
  return (
    <ProtectedSection module="Expedição" action="visualizar">
    <ErrorBoundary>
      <div className="w-full h-full" data-permission="Expedicao.visualizar" data-context-required="true">
      <ModuleLayout title="Expedição e Logística" subtitle="Entregas, romaneios e rotas" actions={<div className="flex items-center gap-2"><Button size="sm" onClick={handlePrimaryAction} data-permission="Expedicao.Entregas.criar" data-action="Expedicao.nova_entrega">Nova Entrega</Button></div>}>
        <ModuleKPIs>
          <KPIsExpedicao statusCounts={statusCounts} />
          {kpisUnavailable && (
            <Badge className="bg-amber-100 text-amber-900 px-3 py-1.5" data-kpis-error="true" role="status">
              KPIs de entrega indisponíveis — não é zero confirmado
            </Badge>
          )}
          {estaNoGrupo && (
            <Badge className="bg-blue-100 text-blue-700 px-3 py-1.5">
              <Building2 className="w-3 h-3 mr-2" /> Visão Consolidada do Grupo
            </Badge>
          )}
        </ModuleKPIs>
        <ModuleContent>
          <ModuleTabs
            listagem={<ModulosGridExpedicao modules={allowedModules} onModuleClick={handleModuleClick} />}
          />
        </ModuleContent>
      </ModuleLayout>
      </div>

      <Dialog open={notificadorOpen} onOpenChange={setNotificadorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          {entregaSelecionada && (
            <NotificadorAutomaticoEntrega
              pedido={pedidosLista.find(p => p.id === entregaSelecionada.pedido_id)}
              entrega={entregaSelecionada}
              onClose={() => setNotificadorOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={comprovanteOpen} onOpenChange={setComprovanteOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          {entregaSelecionada && (
            <ComprovanteEntregaDigital
              pedido={pedidosLista.find(p => p.id === entregaSelecionada.pedido_id)}
              entrega={entregaSelecionada}
              onSuccess={() => setComprovanteOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ocorrenciaOpen} onOpenChange={setOcorrenciaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          {entregaSelecionada && (
            <RegistroOcorrenciaLogistica
              pedido={pedidosLista.find(p => p.id === entregaSelecionada.pedido_id)}
              entrega={entregaSelecionada}
              onClose={() => setOcorrenciaOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {comprovanteModal && (
        <Suspense fallback={<div className="h-[400px] w-full bg-white/60 animate-pulse rounded" />}> 
          <ComprovanteDigital
            entrega={comprovanteModal}
            isOpen={!!comprovanteModal}
            onClose={() => setComprovanteModal(null)}
          />
        </Suspense>
      )}
    </ErrorBoundary>
    </ProtectedSection>
  );
}
