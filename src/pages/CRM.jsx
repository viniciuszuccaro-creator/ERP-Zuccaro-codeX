import React, { Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Target, MessageSquare, Mail, Sparkles, AlertTriangle, BarChart3, Users } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import HeaderCRMCompacto from "@/components/crm/crm-launchpad/HeaderCRMCompacto";
import KPIsCRM from "@/components/crm/crm-launchpad/KPIsCRM";
import ModulosGridCRM from "@/components/crm/crm-launchpad/ModulosGridCRM";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ModuleKPIs from "@/components/layout/ModuleKPIs";
import ModuleContent from "@/components/layout/ModuleContent";
import ModuleTabs from "@/components/layout/ModuleTabs";
import { Button } from "@/components/ui/button";
import useCRMDerivedData from "@/components/crm/hooks/useCRMDerivedData";
import { useUser } from "@/components/lib/UserContext";

const FunilVisual = React.lazy(() => import("../components/crm/FunilVisual"));
const FunilComercialInteligente = React.lazy(() => import("@/components/crm/FunilComercialInteligente"));
const FunilVendasAvancado = React.lazy(() => import("@/components/crm/FunilVendasAvancado"));
const IALeadsPriorizacao = React.lazy(() => import("../components/crm/IALeadsPriorizacao"));
const IAChurnDetection = React.lazy(() => import("../components/crm/IAChurnDetection"));
const OportunidadesLista = React.lazy(() => import("@/components/crm/OportunidadesLista"));
const InteracoesLista = React.lazy(() => import("@/components/crm/InteracoesLista"));
const CampanhasLista = React.lazy(() => import("@/components/crm/CampanhasLista"));

export default function CRMPage() {
  const { hasPermission, isLoading: loadingPermissions } = usePermissions();
  const { filtrarPorContexto, getFiltroContexto, empresaAtual, estaNoGrupo, updateInContext } = useContextoVisual();
  const bloqueadoSemEmpresa = !estaNoGrupo && !empresaAtual;
  const { openWindow } = useWindow();
  const { user } = useUser();

  const moverEtapaOportunidade = async (oportunidadeId, novaEtapa) => {
    await updateInContext('Oportunidade', oportunidadeId, { etapa: novaEtapa, etapa_funil: novaEtapa });
  };

  const { data: oportunidades = [] } = useQuery({
    queryKey: ['oportunidades', empresaAtual?.id],
    queryFn: async () => filtrarPorContexto('Oportunidade', {}, '-created_date', 100),
    staleTime: 30000,
    retry: 2,
    enabled: !bloqueadoSemEmpresa
  });

  const { data: interacoes = [] } = useQuery({
    queryKey: ['interacoes', empresaAtual?.id],
    queryFn: async () => filtrarPorContexto('Interacao', {}, '-created_date', 100),
    staleTime: 30000,
    retry: 1,
    enabled: !bloqueadoSemEmpresa
  });

  const { data: campanhas = [] } = useQuery({
    queryKey: ['campanhas', empresaAtual?.id],
    queryFn: async () => filtrarPorContexto('Campanha', {}, '-created_date', 50, 'empresa_dona_id'),
    staleTime: 30000,
    retry: 1,
    enabled: !bloqueadoSemEmpresa
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', empresaAtual?.id],
    queryFn: async () => filtrarPorContexto('Cliente', {}, '-created_date', 100),
    staleTime: 30000,
    retry: 1,
    enabled: !bloqueadoSemEmpresa
  });

  const { data: totalClientes = 0 } = useQuery({
    queryKey: ['clientes-count-crm', empresaAtual?.id],
    queryFn: async () => {
      const response = await base44.functions.invoke('countEntities', {
        entityName: 'Cliente',
        filter: getFiltroContexto('empresa_id')
      });
      return response.data?.count ?? 0;
    },
    staleTime: 60000,
    retry: 1,
    enabled: !bloqueadoSemEmpresa
  });

  // Dados já vêm filtrados do servidor
  const oportunidadesFiltradas = oportunidades;
  const interacoesFiltradas = interacoes;
  const campanhasFiltradas = campanhas;

  const { totalOportunidades, oportunidadesAbertas, valorPipeline, valorPonderado, taxaConversao } = useCRMDerivedData({ oportunidades: oportunidadesFiltradas });

  if (loadingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (bloqueadoSemEmpresa) {
    return (
      <ProtectedSection module="CRM" action="visualizar">
        <div className="w-full h-full flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white border rounded-xl p-6 text-center">
            <p className="text-lg font-semibold">Selecione uma empresa para continuar</p>
            <p className="text-slate-500 mt-1">Use o seletor de empresa no topo para habilitar os dados do módulo.</p>
          </div>
        </div>
      </ProtectedSection>
    );
  }

  const modules = [
    {
      title: 'Funil Visual',
      description: 'Drag-drop etapas',
      icon: TrendingUp,
      color: 'blue',
      component: FunilVisual,
      windowTitle: '🎯 Funil Visual',
      width: 1600,
      height: 900,
      props: {
        oportunidades: oportunidadesFiltradas,
        windowMode: true,
        onMoverEtapa: moverEtapaOportunidade,
      }
    },
    {
      title: 'Funil IA',
      description: 'Análise inteligente',
      icon: Sparkles,
      color: 'purple',
      component: FunilComercialInteligente,
      windowTitle: '🤖 Funil IA',
      width: 1500,
      height: 850,
      props: { windowMode: true }
    },
    {
      title: 'Funil Avançado',
      description: 'Scoring automático',
      icon: Target,
      color: 'cyan',
      component: FunilVendasAvancado,
      windowTitle: '🎯 Funil Avançado',
      width: 1500,
      height: 850,
      props: { windowMode: true }
    },
    {
      title: 'Oportunidades',
      description: 'Gestão completa',
      icon: Target,
      color: 'indigo',
      component: OportunidadesLista,
      windowTitle: '📊 Oportunidades',
      width: 1500,
      height: 850,
      props: { oportunidades: oportunidadesFiltradas, windowMode: true }
    },
    {
      title: 'Interações',
      description: 'Histórico contatos',
      icon: MessageSquare,
      color: 'green',
      component: InteracoesLista,
      windowTitle: '💬 Interações',
      width: 1400,
      height: 800,
      props: { interacoes: interacoesFiltradas, windowMode: true }
    },
    {
      title: 'Campanhas',
      description: 'Marketing ativo',
      icon: Mail,
      color: 'pink',
      component: CampanhasLista,
      windowTitle: '📧 Campanhas',
      width: 1400,
      height: 800,
      props: { campanhas: campanhasFiltradas, windowMode: true }
    },
    {
      title: 'IA Leads',
      description: 'Priorização automática',
      icon: Sparkles,
      color: 'purple',
      component: IALeadsPriorizacao,
      windowTitle: '🤖 IA Leads',
      width: 1400,
      height: 800,
      props: { oportunidades: oportunidadesFiltradas, windowMode: true }
    },
    {
      title: 'IA Churn',
      description: 'Detecção perda',
      icon: AlertTriangle,
      color: 'orange',
      component: IAChurnDetection,
      windowTitle: '⚠️ IA Churn',
      width: 1400,
      height: 800,
      props: { clientes, windowMode: true }
    },
  ];

  const handleModuleClick = (module) => {
    React.startTransition(() => {
      // Auditoria de abertura de seção
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        acao: 'Visualização',
        modulo: 'CRM',
        tipo_auditoria: 'acesso',
        entidade: 'Seção',
        descricao: `Abrir seção: ${module.title}`,
        data_hora: new Date().toISOString(),
      });
      openWindow(
        module.component,
        { 
          ...(module.props || {}),
          windowMode: true 
        },
        {
          title: module.windowTitle,
          width: module.width,
          height: module.height,
          uniqueKey: `crm-${module.title.toLowerCase().replace(/\s/g, '-')}`
        }
      );
    });
  };

  return (
    <ProtectedSection module="CRM" action="visualizar">
    <ErrorBoundary>
      <ModuleLayout title="CRM - Relacionamento" subtitle="Relacionamento, funil e campanhas" actions={<div className="flex items-center gap-2"><Button size="sm" onClick={() => openWindow(OportunidadesLista, { oportunidades: oportunidadesFiltradas, windowMode: true }, { title: '📊 Oportunidades', width: 1500, height: 850, uniqueKey: 'crm-oportunidades-nova' })}>Novo</Button></div>}>
        <ModuleKPIs>
          <KPIsCRM
            oportunidadesAbertas={oportunidadesAbertas}
            totalOportunidades={totalOportunidades}
            valorPipeline={valorPipeline}
            valorPonderado={valorPonderado}
            taxaConversao={taxaConversao}
          />
        </ModuleKPIs>
        <ModuleContent>
          <ModuleTabs
            listagem={<ModulosGridCRM modules={modules} onModuleClick={handleModuleClick} />}
          />
        </ModuleContent>
      </ModuleLayout>
    </ErrorBoundary>
    </ProtectedSection>
  );
}