import React, { Suspense, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Box, TrendingUp, PackageCheck, PackageMinus, PackageOpen, Clock, BarChart3, Sparkles, ArrowLeftRight, Download } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useWindow } from "@/components/lib/useWindow";
import { useUser } from "@/components/lib/UserContext";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import { Button } from "@/components/ui/button";
import HeaderEstoqueCompacto from "@/components/estoque/estoque-launchpad/HeaderEstoqueCompacto";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ModuleKPIs from "@/components/layout/ModuleKPIs";
import ModuleContent from "@/components/layout/ModuleContent";
import ModuleTabs from "@/components/layout/ModuleTabs";
import KPIsEstoque from "@/components/estoque/estoque-launchpad/KPIsEstoque";
import ModulosGridEstoque from "@/components/estoque/estoque-launchpad/ModulosGridEstoque";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import useEstoqueDerivedData from "@/components/estoque/hooks/useEstoqueDerivedData";
import TransferenciaEntreEmpresasForm from "../components/estoque/TransferenciaEntreEmpresasForm";

const ProdutosTab = React.lazy(() => import("../components/estoque/ProdutosTab"));
const MovimentacoesTab = React.lazy(() => import("../components/estoque/MovimentacoesTab"));
const SolicitacoesTab = React.lazy(() => import("../components/estoque/SolicitacoesTab"));
const RecebimentoTab = React.lazy(() => import("../components/estoque/RecebimentoTab"));
const RequisicoesAlmoxarifadoTab = React.lazy(() => import("../components/estoque/RequisicoesAlmoxarifadoTab"));
const ControleLotesValidade = React.lazy(() => import("../components/estoque/ControleLotesValidade"));
const RelatoriosEstoque = React.lazy(() => import("../components/estoque/RelatoriosEstoque"));
const IAReposicao = React.lazy(() => import("../components/estoque/IAReposicao"));

export default function Estoque() {
  const { hasPermission, isLoading: loadingPermissions } = usePermissions();
  const canSeeEstoque = hasPermission('Estoque', null, 'ver') || hasPermission('Estoque', null, 'visualizar');
  const canExportEstoque = hasPermission('Estoque', null, 'exportar') || hasPermission('Estoque', 'Relatórios', 'exportar') || hasPermission('Estoque', 'Relatorios', 'exportar');
  const canTransferirEstoque = hasPermission('Estoque', 'Transferências', 'criar') || hasPermission('Estoque', 'Transferencias', 'criar') || hasPermission('Estoque', 'Movimentações', 'criar') || hasPermission('Estoque', 'Movimentacoes', 'criar');
  const { openWindow } = useWindow();
  const { user } = useUser();
  const { estaNoGrupo, empresaAtual, grupoAtual, empresasDoGrupo, filtrarPorContexto, getFiltroContexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';

  const auditEstoqueAction = async (acao, detalhes = {}, tipoAuditoria = 'acesso', sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        acao,
        modulo: 'Estoque',
        tipo_auditoria: tipoAuditoria,
        entidade: 'Estoque',
        descricao: `Estoque: ${acao}`,
        detalhes,
        empresa_id: empresaAtual?.id || null,
        group_id: groupId || null,
        grupo_id: groupId || null,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };
  
  // Estados removidos - VisualizadorUniversalEntidade gerencia tudo internamente

  // Query removida - VisualizadorUniversalEntidade busca os dados

  // ✅ Contagens via backend otimizado - CARREGA TUDO para cálculo correto
  const { data: contagensTotais = { total: 0, revenda: 0, producao: 0, estoqueBaixo: 0 }, isLoading: loadingContagens, refetch: refetchContagens } = useQuery({
    queryKey: ['produtos-contagens-dashboard', contextKey],
    queryFn: async () => {
      const filtroBase = getFiltroContexto('empresa_id', true);

      // Buscar TODOS os produtos para contagem correta
      let todosProdutos = [];
      let skip = 0;
      const batchSize = 500;
      let hasMore = true;
      
      while (hasMore) {
        const batch = await base44.entities.Produto.filter(filtroBase, undefined, batchSize, skip);
        if (!batch || batch.length === 0) {
          hasMore = false;
        } else {
          todosProdutos = [...todosProdutos, ...batch];
          if (batch.length < batchSize) {
            hasMore = false;
          } else {
            skip += batchSize;
          }
        }
      }

      const total = todosProdutos.length;
      const revenda = todosProdutos.filter(p => p.tipo_item === 'Revenda').length;
      const producao = todosProdutos.filter(p => p.tipo_item === 'Matéria-Prima Produção').length;
      const estoqueBaixo = todosProdutos.filter(p => 
        p.status === 'Ativo' && (p.estoque_disponivel || 0) <= (p.estoque_minimo || 0)
      ).length;

      console.log(`✅ CONTAGENS CORRETAS: Total=${total}, Revenda=${revenda}, Produção=${producao}, EstoqueBaixo=${estoqueBaixo}`);

      return { total, revenda, producao, estoqueBaixo };
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    enabled: canSeeEstoque && contextoValido
  });

  // ✅ Real-time update via subscription
  React.useEffect(() => {
    const unsubscribe = base44.entities.Produto.subscribe(() => {
      if (contextoValido) refetchContagens();
    });
    return unsubscribe;
  }, [refetchContagens, contextoValido]);

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('MovimentacaoEstoque', {}, '-data_movimentacao', 50);
      } catch (err) {
        console.error('Erro ao buscar movimentações:', err);
        return [];
      }
    },
    staleTime: 30000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canSeeEstoque && contextoValido
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('SolicitacaoCompra', {}, '-data_solicitacao', 50);
      } catch (err) {
        console.error('Erro ao buscar solicitações:', err);
        return [];
      }
    },
    staleTime: 30000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canSeeEstoque && contextoValido
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ['ordensCompra', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('OrdemCompra', {}, '-data_solicitacao', 50);
      } catch (err) {
        console.error('Erro ao buscar ordens:', err);
        return [];
      }
    },
    staleTime: 30000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canSeeEstoque && contextoValido
  });

  // Buscar produtos simples para KPIs de valor de estoque
  const { data: produtosParaKPIs = [] } = useQuery({
    queryKey: ['produtos-kpis', contextKey],
    queryFn: async () => {
      try {
        return await filtrarPorContexto('Produto', {}, undefined, 5000);
      } catch (err) {
        console.error('Erro ao buscar produtos para KPIs:', err);
        return [];
      }
    },
    staleTime: 60000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canSeeEstoque && contextoValido
  });

  const movimentacoesFiltradas = movimentacoes;

  const { totalReservado, estoqueDisponivel, recebimentos, requisicoesAlmoxarifado } = useEstoqueDerivedData({
    movimentacoes: movimentacoesFiltradas,
    produtos: produtosParaKPIs,
  });

  // Exportação PDF do estoque de aço (bitolas)
  const handleExportAco = async () => {
    if (!contextoValido || !canExportEstoque) {
      await auditEstoqueAction('exportacao_aco_bloqueada', {
        motivo: !contextoValido ? 'sem_contexto_grupo_empresa' : 'sem_permissao',
        permissao: 'Estoque.Relatorios.exportar',
      }, 'seguranca', false);
      return;
    }
    try {
      const { data } = await base44.functions.invoke('exportEstoqueAco', {
        filtros: { empresa_id: empresaAtual?.id || null, group_id: groupId || null }
      });
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'estoque_aco.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      try {
        await base44.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Usuario local',
          usuario_id: user?.id || null,
          acao: 'Exportacao',
          modulo: 'Estoque',
          tipo_auditoria: 'sensivel',
          entidade: 'RelatorioEstoqueAco',
          empresa_id: empresaAtual?.id || null,
          group_id: groupId || null,
          grupo_id: groupId || null,
          descricao: 'Exportacao de estoque de aco em PDF',
          sucesso: true,
          data_hora: new Date().toISOString(),
        });
      } catch (_) {}
    } catch (e) {
      console.error('Falha ao exportar estoque de aço:', e);
    }
  };

  if (loadingPermissions) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  const modules = [
    {
      title: 'Inventário',
      description: 'Contagem e ajustes',
      icon: Box,
      color: 'cyan',
      component: React.lazy(() => import('../components/estoque/InventarioForm')),
      windowTitle: '📋 Inventário',
      width: 1200,
      height: 800,
      props: {}
    },
    {
      title: 'Produtos',
      description: 'Cadastro e estoque',
      icon: Box,
      color: 'indigo',
      component: ProdutosTab,
      windowTitle: '📦 Produtos',
      width: 1500,
      height: 850,
      props: {}
    },
    {
      title: 'Movimentações',
      description: 'Entradas e saídas',
      icon: TrendingUp,
      color: 'blue',
      component: MovimentacoesTab,
      windowTitle: '📊 Movimentações',
      width: 1500,
      height: 850,
      props: { movimentacoes: movimentacoesFiltradas, produtos: produtosParaKPIs }
    },
    {
      title: 'Recebimento',
      description: 'Entrada de mercadorias',
      icon: PackageCheck,
      color: 'green',
      component: RecebimentoTab,
      windowTitle: '📥 Recebimento',
      width: 1400,
      height: 800,
      props: { recebimentos, ordensCompra, produtos: produtosParaKPIs }
    },
    {
      title: 'Requisições Almox.',
      description: 'Saídas almoxarifado',
      icon: PackageMinus,
      color: 'orange',
      component: RequisicoesAlmoxarifadoTab,
      windowTitle: '📤 Requisições Almoxarifado',
      width: 1400,
      height: 800,
      props: { requisicoes: requisicoesAlmoxarifado, produtos: produtosParaKPIs }
    },
    {
      title: 'Solicitações Compra',
      description: 'Requisições internas',
      icon: PackageOpen,
      color: 'purple',
      component: SolicitacoesTab,
      windowTitle: '📋 Solicitações Compra',
      width: 1400,
      height: 800,
      props: { solicitacoes, produtos: produtosParaKPIs }
    },
    {
      title: 'Lotes e Validade',
      description: 'Controle de lotes',
      icon: Clock,
      color: 'orange',
      component: ControleLotesValidade,
      windowTitle: '⏰ Lotes e Validade',
      width: 1400,
      height: 800,
      props: { empresaId: empresaAtual?.id }
    },
    {
      title: 'Relatórios',
      description: 'Analytics de estoque',
      icon: BarChart3,
      color: 'indigo',
      component: RelatoriosEstoque,
      windowTitle: '📈 Relatórios Estoque',
      width: 1400,
      height: 800,
      props: { produtos: produtosParaKPIs, movimentacoes: movimentacoesFiltradas }
    },
    {
      title: 'IA Reposição',
      description: 'Sugestões inteligentes',
      icon: Sparkles,
      color: 'blue',
      component: IAReposicao,
      windowTitle: '🤖 IA Reposição',
      width: 1300,
      height: 750,
      props: { empresaId: empresaAtual?.id }
    },
  ];

  const canViewEstoqueModule = (module) => {
    const section = module.sectionKey || module.title;
    return hasPermission('Estoque', section, 'ver') || hasPermission('Estoque', section, 'visualizar');
  };

  const allowedModules = modules.filter(canViewEstoqueModule);

   const handleModuleClick = (module) => {
    if (!contextoValido || !canViewEstoqueModule(module)) {
      auditEstoqueAction('abertura_secao_bloqueada', {
        secao: module.title,
        motivo: !contextoValido ? 'sem_contexto_grupo_empresa' : 'sem_permissao',
      }, 'seguranca', false);
      return;
    }
    React.startTransition(() => {
      auditEstoqueAction('abrir_secao', { secao: module.title }, 'acesso');
      openWindow(
        module.component,
        { ...(module.props || {}), windowMode: true },
        {
          title: module.windowTitle,
          width: module.width,
          height: module.height,
          uniqueKey: `estoque-${module.title.toLowerCase().replace(/\s/g, '-')}`
        }
      );
    });
  };

  return (
    <ProtectedSection module="Estoque" action="visualizar">
    <ErrorBoundary>
      <div className="w-full h-full" data-permission="Estoque.visualizar" data-context-required="true">
      <ModuleLayout
        title="Estoque e Almoxarifado"
        subtitle="Produtos, níveis e movimentações"
        actions={<div className="flex items-center gap-2">
          <Button
            onClick={handleExportAco}
            disabled={!contextoValido || !canExportEstoque}
            variant="outline"
            className="gap-2"
            data-permission="Estoque.Relatorios.exportar"
            data-action="Estoque.exportar_aco_pdf"
          >
            <Download className="w-3 h-3" /> Exportar Aço (PDF)
          </Button>
        </div>}
      >
        <ModuleKPIs>
          <KPIsEstoque
            produtosAtivos={contagensTotais.total}
            produtosBaixoEstoque={contagensTotais.estoqueBaixo}
            totalReservado={totalReservado}
            estoqueDisponivel={estoqueDisponivel}
            produtosRevenda={contagensTotais.revenda}
            produtosProducao={contagensTotais.producao}
          />
        </ModuleKPIs>
        <ModuleContent>
          {estaNoGrupo && (
            <Button
              onClick={() => {
                if (!contextoValido || !canTransferirEstoque) {
                  auditEstoqueAction('transferencia_entre_empresas_bloqueada', {
                    motivo: !contextoValido ? 'sem_contexto_grupo_empresa' : 'sem_permissao',
                    permissao: 'Estoque.Transferencias.criar',
                  }, 'seguranca', false);
                  return;
                }
                auditEstoqueAction('abrir_transferencia_entre_empresas', {
                  total_empresas_contexto: empresasDoGrupo?.length || 0,
                }, 'sensivel');
                openWindow(TransferenciaEntreEmpresasForm, {
                  empresasDoGrupo,
                  produtos: produtosParaKPIs,
                  windowMode: true
                }, {
                  title: '↔️ Transferência Entre Empresas',
                  width: 900,
                  height: 600
                });
              }}
              className="bg-purple-600 hover:bg-purple-700 mb-2"
              disabled={!contextoValido || !canTransferirEstoque}
              data-permission="Estoque.Transferencias.criar"
              data-action="Estoque.transferir_entre_empresas"
              size="sm"
            >
              <ArrowLeftRight className="w-3 h-3 mr-2" />
              Transferir entre Empresas
            </Button>
          )}
          <ModuleTabs
            listagem={<ModulosGridEstoque modules={allowedModules} onModuleClick={handleModuleClick} />}
          />
        </ModuleContent>
      </ModuleLayout>
      </div>
    </ErrorBoundary>
    </ProtectedSection>
  );
}
