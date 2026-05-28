import React, { Suspense } from 'react';
import { Wallet, Calendar, List, Clock, FileText, TrendingUp, CreditCard, Building2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWindow } from '@/components/lib/useWindow';
import CaixaCentralHeader from './caixa-central/CaixaCentralHeader';
import KPIsFinanceiros from './caixa-central/KPIsFinanceiros';
import DistribuicaoFormasPagamento from './caixa-central/DistribuicaoFormasPagamento';
import CaixaModulosGrid from './caixa-central/CaixaModulosGrid';

const MovimentosDiarios = React.lazy(() => import('./caixa-central/MovimentosDiarios'));
const OrdensLiquidacaoPendentes = React.lazy(() => import('./caixa-central/OrdensLiquidacaoPendentes'));
const LiquidarReceberPagar = React.lazy(() => import('./caixa-central/LiquidarReceberPagar'));
const HistoricoLiquidacoes = React.lazy(() => import('./caixa-central/HistoricoLiquidacoes'));
const ExtratoBancarioResumo = React.lazy(() => import('./caixa-central/ExtratoBancarioResumo'));
const VisaoGeralPendencias = React.lazy(() => import('./caixa-central/VisaoGeralPendencias'));
const CartoesACompensar = React.lazy(() => import('./CartoesACompensar'));
const ConciliacaoBancariaTab = React.lazy(() => import('./ConciliacaoBancariaTab'));

export default function CaixaCentralLiquidacao({ windowMode = false }) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { openWindow } = useWindow();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canViewCaixa = hasPermission('Financeiro', 'Caixa Central', 'visualizar') ||
    hasPermission('Financeiro', 'Caixa', 'visualizar') ||
    hasPermission('Financeiro', null, 'visualizar');

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['liquidacao', 'receber', groupId, empresaId],
    queryFn: () => filterInContext('ContaReceber', { status: 'Pendente' }, '-data_vencimento', 50),
    enabled: contextoValido && canViewCaixa,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['liquidacao', 'pagar', groupId, empresaId],
    queryFn: () => filterInContext('ContaPagar', { status: 'Pendente' }, '-data_vencimento', 50),
    enabled: contextoValido && canViewCaixa,
  });

  const totalReceber = contasReceber.reduce((sum, c) => sum + (c.valor || 0), 0);
  const totalPagar = contasPagar.reduce((sum, c) => sum + (c.valor || 0), 0);
  const saldoLiquido = totalReceber - totalPagar;

  const porForma = {};
  [...contasReceber, ...contasPagar].forEach(c => {
    const forma = c.forma_recebimento || c.forma_pagamento || 'Não definido';
    if (!porForma[forma]) porForma[forma] = { receber: 0, pagar: 0 };
    if (c.valor) {
      if (contasReceber.includes(c)) porForma[forma].receber += c.valor;
      else porForma[forma].pagar += c.valor;
    }
  });

  const modules = [
    {
      title: 'Visão Geral',
      description: 'Pendências consolidadas',
      icon: List,
      color: 'blue',
      component: VisaoGeralPendencias,
      windowTitle: '📋 Visão Geral Pendências',
      props: { contasReceber, contasPagar }
    },
    {
      title: 'Movimentos Diários',
      description: 'Fluxo de caixa diário',
      icon: Calendar,
      color: 'slate',
      component: MovimentosDiarios,
      windowTitle: '📅 Movimentos Diários',
    },
    {
      title: 'Liquidar',
      description: 'Receber e pagar títulos',
      icon: TrendingUp,
      color: 'green',
      component: LiquidarReceberPagar,
      windowTitle: '💰 Liquidação de Títulos',
    },
    {
      title: 'Ordens Pendentes',
      description: 'Aguardando processamento',
      icon: Clock,
      color: 'orange',
      component: OrdensLiquidacaoPendentes,
      windowTitle: '⏳ Ordens de Liquidação',
    },
    {
      title: 'Cartões',
      description: 'Compensação de cartões',
      icon: CreditCard,
      color: 'purple',
      component: CartoesACompensar,
      windowTitle: '💳 Cartões a Compensar',
    },
    {
      title: 'Extrato Bancário',
      description: 'Resumo de extratos',
      icon: Building2,
      color: 'teal',
      component: ExtratoBancarioResumo,
      windowTitle: '🏦 Extrato Bancário',
    },
    {
      title: 'Conciliação',
      description: 'Matching automático',
      icon: FileText,
      color: 'indigo',
      component: ConciliacaoBancariaTab,
      windowTitle: '🔄 Conciliação Bancária',
    },
    {
      title: 'Histórico',
      description: 'Liquidações realizadas',
      icon: FileText,
      color: 'slate',
      component: HistoricoLiquidacoes,
      windowTitle: '📜 Histórico de Liquidações',
    },
  ];

  const handleModuleClick = (module) => {
    if (!contextoValido || !canViewCaixa) return;
    React.startTransition(() => {
      openWindow(
        module.component,
        { 
          ...(module.props || {}),
          windowMode: true 
        },
        {
          title: module.windowTitle,
          width: 1400,
          height: 800,
          uniqueKey: `caixa-${module.title.toLowerCase().replace(/\s/g, '-')}`
        }
      );
    });
  };

  return (
    <div className="w-full h-full flex flex-col space-y-1.5 overflow-auto p-1.5 bg-gradient-to-br from-slate-50 to-blue-50">
      {(!contextoValido || !canViewCaixa) && (
        <Alert className="border-amber-300 bg-amber-50" data-permission="Financeiro.CaixaCentral.visualizar" data-context-required="true">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar a central de liquidacao.</AlertDescription>
        </Alert>
      )}
      <CaixaCentralHeader />

      <KPIsFinanceiros 
        totalReceber={totalReceber}
        totalPagar={totalPagar}
        saldoLiquido={saldoLiquido}
        totalFormasPagamento={Object.keys(porForma).length}
        contasReceberCount={contasReceber.length}
        contasPagarCount={contasPagar.length}
      />

      <DistribuicaoFormasPagamento porForma={porForma} />

      <CaixaModulosGrid 
        modules={modules}
        onModuleClick={handleModuleClick}
      />
    </div>
  );
}
