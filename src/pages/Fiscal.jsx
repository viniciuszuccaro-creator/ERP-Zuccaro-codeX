import React, { Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Settings, Book, BarChart3, Upload, Sparkles } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import { useWindow } from "@/components/lib/useWindow";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import HeaderFiscalCompacto from "@/components/fiscal/fiscal-launchpad/HeaderFiscalCompacto";
import KPIsFiscal from "@/components/fiscal/fiscal-launchpad/KPIsFiscal";
import ModulosGridFiscal from "@/components/fiscal/fiscal-launchpad/ModulosGridFiscal";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ModuleKPIs from "@/components/layout/ModuleKPIs";
import ModuleContent from "@/components/layout/ModuleContent";
import ModuleTabs from "@/components/layout/ModuleTabs";
import { Button } from "@/components/ui/button";

const ConfigFiscalAutomatica = React.lazy(() => import("../components/fiscal/ConfigFiscalAutomatica"));
const PlanoDeContasTree = React.lazy(() => import("../components/fiscal/PlanoDeContasTree"));
const RelatorioDRE = React.lazy(() => import("../components/fiscal/RelatorioDRE"));
const MotorFiscalInteligente = React.lazy(() => import("@/components/fiscal/MotorFiscalInteligente"));
const ExportacaoSPED = React.lazy(() => import("../components/fiscal/ExportacaoSPED"));
const ImportarXMLNFe = React.lazy(() => import('../components/fiscal/ImportarXMLNFe'));

export default function FiscalPage() {
  const { hasPermission, isLoading: loadingPermissions } = usePermissions();
  const { filtrarPorContexto, empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const { openWindow } = useWindow();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || estaNoGrupo);
  const podeVerFiscal = hasPermission('Fiscal', null, 'ver') || hasPermission('Fiscal', null, 'visualizar');
  const podeEmitirNFe = hasPermission('Fiscal', 'Notas Fiscais', 'emitir') ||
    hasPermission('Fiscal', 'Notas Fiscais', 'criar') ||
    hasPermission('Fiscal', null, 'emitir') ||
    hasPermission('Fiscal', null, 'criar');
  const empresaObrigatoriaParaNFe = Boolean(empresaAtual?.id);

  const auditFiscalAction = async (acao, detalhes = {}, tipo = 'acesso') => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id || null,
        acao,
        modulo: 'Fiscal',
        tipo_auditoria: tipo,
        entidade: 'Fiscal',
        descricao: `Fiscal: ${acao}`,
        detalhes,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaAtual?.id || null,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };

  const { data: notasFiscais = [] } = useQuery({
    queryKey: ['notasFiscais', empresaAtual?.id, groupId, estaNoGrupo],
    queryFn: async () => {
      try {
        const filtro = empresaAtual?.id ? { empresa_faturamento_id: empresaAtual.id } : {};
        return await filtrarPorContexto('NotaFiscal', {}, '-created_date', 100, 'empresa_faturamento_id');
      } catch (err) {
        console.error('Erro ao buscar notas fiscais:', err);
        return [];
      }
    },
    staleTime: 30000,
    retry: 2,
    enabled: Boolean(contextoValido && podeVerFiscal)
  });

  // Dados já vêm filtrados do servidor
  const notasFiltradasContexto = notasFiscais;

  const statusCounts = {
    total: notasFiltradasContexto.length,
    autorizadas: notasFiltradasContexto.filter(n => n.status === "Autorizada").length,
    rascunho: notasFiltradasContexto.filter(n => n.status === "Rascunho").length,
    rejeitadas: notasFiltradasContexto.filter(n => n.status === "Rejeitada").length,
    canceladas: notasFiltradasContexto.filter(n => n.status === "Cancelada").length
  };

  if (loadingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const modules = [
    {
      title: 'Notas Fiscais',
      description: 'NF-e emitidas',
      icon: FileText,
      color: 'blue',
      component: () => <div className="p-4">Listagem de NF-e (em desenvolvimento)</div>,
      windowTitle: '📄 Notas Fiscais',
      width: 1500,
      height: 850,
    },
    {
      title: 'Motor Fiscal IA',
      description: 'Validação inteligente',
      icon: Sparkles,
      color: 'purple',
      component: MotorFiscalInteligente,
      windowTitle: '🤖 Motor Fiscal IA',
      width: 1400,
      height: 800,
      props: { windowMode: true }
    },
    {
      title: 'Configuração',
      description: 'Config fiscal automática',
      icon: Settings,
      color: 'cyan',
      component: ConfigFiscalAutomatica,
      windowTitle: '⚙️ Configuração Fiscal',
      width: 1200,
      height: 700,
      props: { empresaId: empresaAtual?.id, windowMode: true }
    },
    {
      title: 'Plano de Contas',
      description: 'Estrutura contábil',
      icon: Book,
      color: 'indigo',
      component: PlanoDeContasTree,
      windowTitle: '📚 Plano de Contas',
      width: 1200,
      height: 800,
      props: { empresaId: empresaAtual?.id, windowMode: true }
    },
    {
      title: 'DRE Gerencial',
      description: 'Demonstração resultado',
      icon: BarChart3,
      color: 'green',
      component: RelatorioDRE,
      windowTitle: '📊 DRE Gerencial',
      width: 1400,
      height: 800,
      props: { empresaId: empresaAtual?.id, windowMode: true }
    },
    {
      title: 'SPED Fiscal',
      description: 'Exportação SPED',
      icon: FileText,
      color: 'orange',
      component: ExportacaoSPED,
      windowTitle: '📁 SPED Fiscal',
      width: 1200,
      height: 700,
      props: { empresaId: empresaAtual?.id, windowMode: true }
    },
    {
      title: 'Importar XML',
      description: 'Upload NF-e',
      icon: Upload,
      color: 'blue',
      component: ImportarXMLNFe,
      windowTitle: '📤 Importar XML NF-e',
      width: 1200,
      height: 700,
      props: { empresaId: empresaAtual?.id, windowMode: true }
    },
  ];

  const canViewFiscalModule = (module) => (
    hasPermission('Fiscal', (module.sectionKey || module.title), 'ver') ||
    hasPermission('Fiscal', (module.sectionKey || module.title), 'visualizar')
  );

  const allowedModules = modules.filter(canViewFiscalModule);

   const handleModuleClick = (module) => {
    if (!contextoValido || !canViewFiscalModule(module)) {
      auditFiscalAction('acesso_bloqueado', { secao: module.title }, 'seguranca');
      return;
    }
    React.startTransition(() => {
      // Auditoria de abertura de seção
      auditFiscalAction('abrir_secao', { secao: module.title });
      /*
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        acao: 'Visualização',
        modulo: 'Fiscal',
        tipo_auditoria: 'acesso',
        entidade: 'Seção',
        descricao: `Abrir seção: ${module.title}`,
        data_hora: new Date().toISOString(),
      });
      */
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
          uniqueKey: `fiscal-${module.title.toLowerCase().replace(/\s/g, '-')}`
        }
      );
    });
  };

  return (
    <ProtectedSection module="Fiscal" action="visualizar">
    <ErrorBoundary>
      <div className="w-full h-full" data-permission="Fiscal.visualizar">
      <ModuleLayout title="Fiscal e Tributário" subtitle="NF-e, tributos e relatórios" actions={<div className="flex items-center gap-2"><Button size="sm" data-permission="Fiscal.Notas Fiscais.emitir" data-action="Fiscal.emitir_nfe" disabled={!podeEmitirNFe || !empresaObrigatoriaParaNFe} onClick={() => {
        if (!empresaObrigatoriaParaNFe) {
          auditFiscalAction('emissao_nfe_bloqueada_sem_empresa', { motivo: 'NF-e exige empresa faturadora' }, 'seguranca');
          return;
        }
        if (!podeEmitirNFe) {
          auditFiscalAction('emissao_nfe_bloqueada_sem_permissao', {}, 'seguranca');
          return;
        }
        auditFiscalAction('iniciar_nova_nfe', { empresa_faturamento_id: empresaAtual?.id }, 'sensivel');
        base44.analytics.track({ eventName: 'fiscal_primary_action' });
      }}>Nova NF-e</Button></div>}>
        <ModuleKPIs>
          <KPIsFiscal
            total={statusCounts.total}
            autorizadas={statusCounts.autorizadas}
            rascunho={statusCounts.rascunho}
            rejeitadas={statusCounts.rejeitadas}
            canceladas={statusCounts.canceladas}
          />
        </ModuleKPIs>
        <ModuleContent>
          <ModuleTabs
            listagem={<ModulosGridFiscal modules={allowedModules} onModuleClick={handleModuleClick} />}
          />
        </ModuleContent>
      </ModuleLayout>
      </div>
    </ErrorBoundary>
    </ProtectedSection>
  );
}
