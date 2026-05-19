import React, { Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Factory, LayoutGrid, Clock, CheckCircle, AlertTriangle, Settings, BarChart3, Activity, Zap, FileText, Sparkles } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import { useWindow } from "@/components/lib/useWindow";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import HeaderProducaoCompacto from "@/components/producao/producao-launchpad/HeaderProducaoCompacto";
import KPIsProducao from "@/components/producao/producao-launchpad/KPIsProducao";
import ModulosGridProducao from "@/components/producao/producao-launchpad/ModulosGridProducao";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ModuleKPIs from "@/components/layout/ModuleKPIs";
import ModuleContent from "@/components/layout/ModuleContent";
import ModuleTabs from "@/components/layout/ModuleTabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const KanbanProducaoInteligente = React.lazy(() => import("@/components/producao/KanbanProducaoInteligente"));
const ApontamentoProducao = React.lazy(() => import("@/components/producao/ApontamentoProducao"));
const FormularioOrdemProducao = React.lazy(() => import("@/components/producao/FormularioOrdemProducao"));
const ControleRefugo = React.lazy(() => import("@/components/producao/ControleRefugo"));
const RelatoriosProducao = React.lazy(() => import("@/components/producao/RelatoriosProducao"));
const ConfiguracaoProducao = React.lazy(() => import("../components/producao/ConfiguracaoProducao"));
const DashboardRefugoIA = React.lazy(() => import("../components/producao/DashboardRefugoIA"));
const DashboardProducaoRealtime = React.lazy(() => import("../components/producao/DashboardProducaoRealtime"));
const IADiagnosticoEquipamentos = React.lazy(() => import("../components/producao/IADiagnosticoEquipamentos"));
const DocumentosProducao = React.lazy(() => import("../components/producao/DocumentosProducao"));

export default function Producao() {
  const { hasPermission, isLoading: loadingPermissions } = usePermissions();
  const { filtrarPorContexto, getFiltroContexto, empresaAtual, grupoAtual } = useContextoVisual();
  const { openWindow } = useWindow();
  const { user } = useUser();
  const { toast } = useToast();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaId || 'sem-empresa'}`;
  const canSeeProducao = hasPermission('Produção', null, 'visualizar') || hasPermission('Produção', null, 'ver') || hasPermission('Producao', null, 'visualizar') || hasPermission('Producao', null, 'ver');
  const canCreateOP = hasPermission('Produção', 'Ordens Produção', 'criar') || hasPermission('Produção', 'OrdemProducao', 'criar') || hasPermission('Producao', 'Ordens Produção', 'criar') || hasPermission('Producao', 'OrdemProducao', 'criar');

  const { data: ordensProducao = [] } = useQuery({
    queryKey: ['ordens-producao', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('OrdemProducao', {}, '-created_date', 100);
      } catch (err) {
        console.error('Erro ao buscar ordens de produção:', err);
        return [];
      }
    },
    staleTime: 30000,
    retry: 2,
    enabled: canSeeProducao && contextoValido
  });

  const { data: totalOrdensProducao = 0 } = useQuery({
    queryKey: ['ordens-producao-count', contextKey],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'OrdemProducao',
          filter: getFiltroContexto('empresa_id', true)
        });
        return response.data?.count || ordensProducao.length;
      } catch {
        return ordensProducao.length;
      }
    },
    staleTime: 60000,
    retry: 1,
    enabled: canSeeProducao && contextoValido
  });

  const totalOPs = ordensProducao.length;
  const opsLiberadas = ordensProducao.filter(op => op.status === "Liberada").length;
  const opsEmProducao = ordensProducao.filter(op =>
    ["Em Corte", "Em Dobra", "Em Armação"].includes(op.status)
  ).length;
  const opsFinalizadas = ordensProducao.filter(op => op.status === "Finalizada").length;

  if (loadingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const modules = [
    {
      title: 'Kanban',
      description: 'Visão drag-drop',
      icon: LayoutGrid,
      color: 'blue',
      component: KanbanProducaoInteligente,
      windowTitle: '📋 Kanban Produção',
      width: 1600,
      height: 900,
      props: { windowMode: true },
      sectionKey: 'Kanban',
      permission: 'Producao.Kanban.visualizar',
      action: 'abrir-kanban-producao'
    },
    {
      title: 'Ordens Produção',
      description: 'Listagem OPs',
      icon: Factory,
      color: 'orange',
      component: KanbanProducaoInteligente,
      windowTitle: '🏭 Ordens de Produção',
      width: 1500,
      height: 850,
      props: { windowMode: true },
      sectionKey: 'Ordens Produção',
      permission: 'Producao.Ordens Produção.visualizar',
      action: 'abrir-ordens-producao'
    },
    {
      title: 'Apontamentos',
      description: 'Registro produção',
      icon: Clock,
      color: 'purple',
      component: ApontamentoProducao,
      windowTitle: '⏱️ Apontamentos',
      width: 1300,
      height: 800,
      props: { windowMode: true },
      sectionKey: 'Apontamentos',
      permission: 'Producao.Apontamentos.visualizar',
      action: 'abrir-apontamentos-producao'
    },
    {
      title: 'Controle Refugo',
      description: 'Perdas e análise',
      icon: AlertTriangle,
      color: 'red',
      component: ControleRefugo,
      windowTitle: '⚠️ Controle de Refugo',
      width: 1400,
      height: 800,
      props: { ops: ordensProducao, windowMode: true },
      sectionKey: 'Controle Refugo',
      permission: 'Producao.Controle Refugo.visualizar',
      action: 'abrir-controle-refugo'
    },
    {
      title: 'Dashboard IA',
      description: 'Análise refugo',
      icon: Sparkles,
      color: 'cyan',
      component: DashboardRefugoIA,
      windowTitle: '🤖 Dashboard Refugo IA',
      width: 1400,
      height: 800,
      props: { empresaId: empresaAtual?.id, windowMode: true },
      sectionKey: 'Dashboard IA',
      permission: 'Producao.Dashboard IA.visualizar',
      action: 'abrir-dashboard-ia-producao'
    },
    {
      title: 'Dashboard Realtime',
      description: 'Métricas ao vivo',
      icon: Activity,
      color: 'green',
      component: DashboardProducaoRealtime,
      windowTitle: '📊 Dashboard Realtime',
      width: 1500,
      height: 850,
      props: { empresaId: empresaAtual?.id, windowMode: true },
      sectionKey: 'Dashboard Realtime',
      permission: 'Producao.Dashboard Realtime.visualizar',
      action: 'abrir-dashboard-realtime-producao'
    },
    {
      title: 'IoT Equipamentos',
      description: 'Diagnóstico IA',
      icon: Zap,
      color: 'indigo',
      component: IADiagnosticoEquipamentos,
      windowTitle: '⚡ IoT & Equipamentos',
      width: 1400,
      height: 800,
      props: { windowMode: true },
      sectionKey: 'IoT Equipamentos',
      permission: 'Producao.IoT Equipamentos.visualizar',
      action: 'abrir-iot-equipamentos'
    },
    {
      title: 'Documentos',
      description: 'Etiquetas e docs',
      icon: FileText,
      color: 'blue',
      component: DocumentosProducao,
      windowTitle: '📄 Documentos Produção',
      width: 1200,
      height: 700,
      props: { windowMode: true },
      sectionKey: 'Documentos',
      permission: 'Producao.Documentos.visualizar',
      action: 'abrir-documentos-producao'
    },
    {
      title: 'Relatórios',
      description: 'Análises produção',
      icon: BarChart3,
      color: 'purple',
      component: RelatoriosProducao,
      windowTitle: '📈 Relatórios Produção',
      width: 1400,
      height: 800,
      props: { ops: ordensProducao, windowMode: true },
      sectionKey: 'Relatórios',
      permission: 'Producao.Relatórios.visualizar',
      action: 'abrir-relatorios-producao'
    },
    {
      title: 'Configurações',
      description: 'Setup produção',
      icon: Settings,
      color: 'purple',
      component: ConfiguracaoProducao,
      windowTitle: '⚙️ Configurações',
      width: 1200,
      height: 700,
      props: { windowMode: true },
      sectionKey: 'Configurações',
      permission: 'Producao.Configurações.visualizar',
      action: 'abrir-configuracoes-producao'
    },
  ];

  const canViewModule = (module) => {
    const section = module.sectionKey || module.title;
    return hasPermission('Produção', section, 'visualizar') ||
      hasPermission('Produção', section, 'ver') ||
      hasPermission('Produção', null, 'visualizar') ||
      hasPermission('Produção', null, 'ver') ||
      hasPermission('Producao', section, 'visualizar') ||
      hasPermission('Producao', section, 'ver') ||
      hasPermission('Producao', null, 'visualizar') ||
      hasPermission('Producao', null, 'ver');
  };

  const allowedModules = modules.filter(canViewModule);
  const auditProducaoAction = async (acao, detalhes = {}, tipoAuditoria = 'acesso', sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || 'Usuário',
        acao,
        modulo: 'Produção',
        tipo_auditoria: tipoAuditoria,
        entidade: detalhes.entidade || 'Seção',
        registro_id: detalhes.registro_id || null,
        descricao: detalhes.descricao || acao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        detalhes: {
          contexto: empresaId ? 'empresa' : 'grupo',
          empresaId,
          groupId,
          ...detalhes,
        },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar ação de Produção:', error);
    }
  };
  const handleNovaOP = () => {
    if (!contextoValido || !empresaId) {
      auditProducaoAction('nova_op_bloqueada', {
        entidade: 'OrdemProducao',
        motivo: 'empresa_obrigatoria',
        descricao: 'Tentativa de criar OP sem empresa operacional selecionada.',
      }, 'seguranca', false);
      toast({
        title: 'Empresa obrigatória',
        description: 'Selecione uma empresa operacional antes de criar OP.',
        variant: 'destructive',
      });
      return;
    }
    if (!canCreateOP) {
      auditProducaoAction('nova_op_bloqueada', {
        entidade: 'OrdemProducao',
        motivo: 'permissao_negada',
        descricao: 'Tentativa de criar ordem de produção sem permissão.',
      }, 'seguranca', false);
      toast({
        title: 'Acesso negado',
        description: 'Seu perfil não pode criar ordem de produção.',
        variant: 'destructive',
      });
      return;
    }
    auditProducaoAction('nova_op', {
      entidade: 'OrdemProducao',
      descricao: 'Abertura do formulário de nova ordem de produção.',
    }, 'acesso', true);
    openWindow(FormularioOrdemProducao, { windowMode: true, empresaId, groupId }, {
      title: 'Nova Ordem de Produção',
      width: 1400,
      height: 900,
    });
  };
  const handleModuleClick = (module) => {
    if (!contextoValido) {
      auditProducaoAction('abrir_secao_bloqueado', {
        entidade: 'Seção',
        secao: module.title,
        motivo: 'contexto_obrigatorio',
        descricao: `Tentativa de abrir seção de Produção sem contexto: ${module.title}`,
      }, 'seguranca', false);
      toast({
        title: 'Contexto obrigatório',
        description: 'Selecione o Grupo CPA ou uma empresa antes de abrir Produção.',
        variant: 'destructive',
      });
      return;
    }

    if (!canViewModule(module)) {
      auditProducaoAction('abrir_secao_bloqueado', {
        entidade: 'Seção',
        secao: module.title,
        motivo: 'permissao_negada',
        descricao: `Tentativa de abrir seção de Produção sem permissão: ${module.title}`,
      }, 'seguranca', false);
      toast({
        title: 'Acesso negado',
        description: 'Seu perfil não possui permissão para esta seção de Produção.',
        variant: 'destructive',
      });
      return;
    }

    React.startTransition(() => {
      auditProducaoAction('abrir_secao', {
        entidade: 'Seção',
        secao: module.title,
        sectionKey: module.sectionKey || module.title,
        descricao: `Abrir seção: ${module.title}`,
      }, 'acesso', true);
      openWindow(
        module.component,
        {
          ...(module.props || {}),
          empresaId,
          groupId,
          windowMode: true
        },
        {
          title: module.windowTitle,
          width: module.width,
          height: module.height,
          uniqueKey: `producao-${module.title.toLowerCase().replace(/\s/g, '-')}`
        }
      );
    });
  };
  return (
    <ProtectedSection module="Produção" action="visualizar">
    <ErrorBoundary>
      <div className="w-full h-full" data-permission="Producao.visualizar" data-context-required="true">
      <ModuleLayout
        title="Produção"
        subtitle="Chão de fábrica, OPs e desempenho"
        actions={<div className="flex items-center gap-2"><Button size="sm" onClick={handleNovaOP} disabled={!contextoValido || !empresaId || !canCreateOP} data-permission="Producao.OrdensProducao.criar" data-action="Producao.criar_ordem_producao" data-context-required="true">Nova OP</Button></div>}
      >
        <ModuleKPIs>
          <KPIsProducao
            totalOPs={totalOPs}
            opsLiberadas={opsLiberadas}
            opsEmProducao={opsEmProducao}
            opsFinalizadas={opsFinalizadas}
          />
        </ModuleKPIs>
        <ModuleContent>
          <ModuleTabs
            listagem={<ModulosGridProducao modules={allowedModules} onModuleClick={handleModuleClick} />}
          />
        </ModuleContent>
      </ModuleLayout>
      </div>
    </ErrorBoundary>
    </ProtectedSection>
  );
}
