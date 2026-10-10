import React, { Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, ShoppingCart, FileText, Upload, Package } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import HeaderComprasCompacto from "@/components/compras/compras-launchpad/HeaderComprasCompacto";
import KPIsCompras from "@/components/compras/compras-launchpad/KPIsCompras";
import ModulosGridCompras from "@/components/compras/compras-launchpad/ModulosGridCompras";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ModuleKPIs from "@/components/layout/ModuleKPIs";
import ModuleContent from "@/components/layout/ModuleContent";
import ModuleTabs from "@/components/layout/ModuleTabs";
import { Button } from "@/components/ui/button";

const FornecedoresTab = React.lazy(() => import("../components/compras/FornecedoresTab"));
const OrdensCompraTab = React.lazy(() => import("../components/compras/OrdensCompraTab"));
const SolicitacoesCompraTab = React.lazy(() => import("../components/compras/SolicitacoesCompraTab"));
const CotacoesTab = React.lazy(() => import("../components/compras/CotacoesTab"));
const ImportacaoNFeRecebimento = React.lazy(() => import("../components/compras/ImportacaoNFeRecebimento"));
const OrdemCompraForm = React.lazy(() => import("../components/compras/OrdemCompraForm"));

export default function Compras() {
  const { hasPermission, isLoading: loadingPermissions } = usePermissions();
  const { filtrarPorContexto, getFiltroContexto, empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { openWindow } = useWindow();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeCriarOC = hasPermission("Compras", "ordens_compra", "criar")
    || hasPermission("Compras", "Ordens de Compra", "criar")
    || hasPermission("Compras", "Ordens Compra", "criar");

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('Fornecedor', {}, '-created_date', 100, 'empresa_dona_id');
      } catch (err) {
        console.error('Erro ao buscar fornecedores:', err);
        return [];
      }
    },
    staleTime: 30000,
    retry: 2,
    enabled: contextoValido
  });

  const { data: totalFornecedores = 0 } = useQuery({
    queryKey: ['fornecedores-count-compras', contextKey],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Fornecedor',
          filter: getFiltroContexto('empresa_dona_id', true)
        });
        return response.data?.count || fornecedores.length;
      } catch {
        return fornecedores.length;
      }
    },
    staleTime: 60000,
    retry: 1,
    enabled: contextoValido
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ['ordensCompra', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('OrdemCompra', {}, '-created_date', 100);
      } catch (err) {
        console.error('Erro ao buscar ordens de compra:', err);
        return [];
      }
    },
    staleTime: 30000,
    retry: 2,
    enabled: contextoValido
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-compra', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('SolicitacaoCompra', {}, '-data_solicitacao', 100);
      } catch (err) {
        console.error('Erro ao buscar solicitações:', err);
        return [];
      }
    },
    staleTime: 30000,
    retry: 1,
    enabled: contextoValido
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('Empresa', {}, '-created_date', 9999);
      } catch (err) {
        console.error('Erro ao buscar empresas:', err);
        return [];
      }
    },
    staleTime: 60000,
    retry: 1,
    enabled: contextoValido
  });

  // Dados já vêm filtrados do servidor
  const fornecedoresFiltrados = fornecedores;
  const ordensCompraFiltradas = ordensCompra;
  const solicitacoesFiltradas = solicitacoes;

  const totalCompras = ordensCompraFiltradas
    .filter(o => o.status !== 'Cancelada')
    .reduce((sum, o) => sum + (o.valor_total || 0), 0);

  const fornecedoresAtivos = fornecedoresFiltrados.filter(f => f.status === 'Ativo').length;
  const solicitacoesPendentes = solicitacoesFiltradas.filter(s => s.status === 'Pendente').length;

  if (loadingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const modules = [
    {
      title: 'Fornecedores',
      sectionKey: 'fornecedores',
      description: 'Cadastro e gestão',
      icon: Users,
      color: 'cyan',
      component: FornecedoresTab,
      windowTitle: '👥 Fornecedores',
      width: 1500,
      height: 850,
      props: { fornecedores: fornecedoresFiltrados, isLoading: false }
    },
    {
      title: 'Recebimento NF-e',
      sectionKey: 'ordens_compra',
      description: 'Importação automática',
      icon: Upload,
      color: 'blue',
      component: ImportacaoNFeRecebimento,
      windowTitle: '📥 Recebimento NF-e',
      width: 1400,
      height: 800,
    },
    {
      title: 'Solicitações',
      sectionKey: 'solicitacoes',
      description: 'Requisições internas',
      icon: FileText,
      color: 'orange',
      component: SolicitacoesCompraTab,
      windowTitle: '📋 Solicitações de Compra',
      width: 1400,
      height: 800,
      props: { solicitacoes: solicitacoesFiltradas },
      badge: solicitacoesPendentes > 0 ? `${solicitacoesPendentes} pendentes` : null
    },
    {
      title: 'Cotações',
      sectionKey: 'cotacoes',
      description: 'Comparativo de preços',
      icon: FileText,
      color: 'indigo',
      component: CotacoesTab,
      windowTitle: '💰 Cotações',
      width: 1400,
      height: 800,
    },
    {
      title: 'Ordens de Compra',
      sectionKey: 'ordens_compra',
      description: 'Pedidos a fornecedores',
      icon: ShoppingCart,
      color: 'purple',
      component: OrdensCompraTab,
      windowTitle: '🛒 Ordens de Compra',
      width: 1500,
      height: 850,
      props: { ordensCompra: ordensCompraFiltradas, fornecedores: fornecedoresFiltrados, empresas, isLoading: false }
    },
  ];

  const allowedModules = modules.filter((m) => (
    hasPermission('Compras', (m.sectionKey || m.title), 'ver')
    || hasPermission('Compras', (m.sectionKey || m.title), 'visualizar')
  ));

   const handleModuleClick = (module) => {
    React.startTransition(() => {
      // Auditoria de abertura de seção
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        acao: 'Visualização',
        modulo: 'Compras',
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
          uniqueKey: `compras-${module.title.toLowerCase().replace(/\s/g, '-')}`
        }
      );
    });
  };

  return (
    <ProtectedSection module="Compras" action="visualizar">
    <ErrorBoundary>
      <ModuleLayout title="Compras e Suprimentos" subtitle="Fornecedores, OCs e recebimento" actions={<div className="flex items-center gap-2"><Button size="sm" disabled={!contextoValido || !podeCriarOC} onClick={() => openWindow(OrdemCompraForm, { windowMode: true, onSubmit: (data) => createInContext('OrdemCompra', data) }, { title: 'Nova Ordem de Compra', width: 1200, height: 780 })}>Nova OC</Button></div>}>
        <ModuleKPIs>
          <KPIsCompras
            totalFornecedores={totalFornecedores}
            fornecedoresAtivos={fornecedoresAtivos}
            totalOrdens={ordensCompraFiltradas.length}
            totalCompras={totalCompras}
          />
        </ModuleKPIs>
        <ModuleContent>
          <ModuleTabs
            listagem={<ModulosGridCompras modules={allowedModules} onModuleClick={handleModuleClick} />}
          />
        </ModuleContent>
      </ModuleLayout>
    </ErrorBoundary>
    </ProtectedSection>
  );
}
