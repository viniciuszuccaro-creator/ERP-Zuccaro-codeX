import React, { Suspense } from "react";
import { Wallet, Calendar, List, Clock, FileText, TrendingUp, CreditCard, Building2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { persistOperationalAudit } from "@/components/lib/uiAudit";
import { useWindow } from "@/components/lib/useWindow";
import CaixaCentralHeader from "./caixa-central/CaixaCentralHeader";
import KPIsFinanceiros from "./caixa-central/KPIsFinanceiros";
import DistribuicaoFormasPagamento from "./caixa-central/DistribuicaoFormasPagamento";
import CaixaModulosGrid from "./caixa-central/CaixaModulosGrid";

const MovimentosDiarios = React.lazy(() => import("./caixa-central/MovimentosDiarios"));
const OrdensLiquidacaoPendentes = React.lazy(() => import("./caixa-central/OrdensLiquidacaoPendentes"));
const LiquidarReceberPagar = React.lazy(() => import("./caixa-central/LiquidarReceberPagar"));
const HistoricoLiquidacoes = React.lazy(() => import("./caixa-central/HistoricoLiquidacoes"));
const ExtratoBancarioResumo = React.lazy(() => import("./caixa-central/ExtratoBancarioResumo"));
const VisaoGeralPendencias = React.lazy(() => import("./caixa-central/VisaoGeralPendencias"));
const CartoesACompensar = React.lazy(() => import("./CartoesACompensar"));
const ConciliacaoBancariaTab = React.lazy(() => import("./ConciliacaoBancariaTab"));

export default function CaixaCentralLiquidacao({ windowMode = false }) {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission, canCreate } = usePermissions();
  const { toast } = useToast();
  const { openWindow } = useWindow();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = Boolean(groupId || empresaId);
  const canViewCaixa = hasPermission("Financeiro", "Caixa", "visualizar")
    || hasPermission("Financeiro", "Caixa Central", "visualizar")
    || hasPermission("Financeiro", null, "visualizar")
    || hasPermission("Financeiro", null, "ver");
  const canOpenSensitive = canCreate("Financeiro", "Caixa")
    || hasPermission("Financeiro", "Caixa", "editar")
    || hasPermission("Financeiro", "ContaReceber", "baixar")
    || hasPermission("Financeiro", "ContaPagar", "baixar")
    || hasPermission("Financeiro", null, "editar");
  const bloqueado = !contextoValido || !empresaId || !canViewCaixa;

  const withContext = (payload = {}) => ({
    ...payload,
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {})
  });

  const auditCaixa = async (acao, sucesso, detalhes = {}) => {
    await persistOperationalAudit({
      acao,
      sucesso,
      detalhes,
      modulo: "Financeiro",
      entidade: "CaixaCentralLiquidacao",
      descricao: `Caixa Central: ${acao}`,
      empresa_id: empresaId,
      group_id: groupId,
    });
  };

  const { data: contasReceber = [] } = useQuery({
    queryKey: ["liquidacao", "receber", contextKey],
    queryFn: () => filterInContext("ContaReceber", { status: "Pendente" }, "-data_vencimento", 50),
    enabled: contextoValido && canViewCaixa,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ["liquidacao", "pagar", contextKey],
    queryFn: () => filterInContext("ContaPagar", { status: "Pendente" }, "-data_vencimento", 50),
    enabled: contextoValido && canViewCaixa,
  });

  const totalReceber = contasReceber.reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const totalPagar = contasPagar.reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const saldoLiquido = totalReceber - totalPagar;

  const porForma = {};
  [...contasReceber, ...contasPagar].forEach((c) => {
    const forma = c.forma_recebimento || c.forma_pagamento || "Nao definido";
    if (!porForma[forma]) porForma[forma] = { receber: 0, pagar: 0 };
    if (c.valor) {
      if (contasReceber.includes(c)) porForma[forma].receber += Number(c.valor || 0);
      else porForma[forma].pagar += Number(c.valor || 0);
    }
  });

  const modules = [
    { title: "Visao Geral", description: "Pendencias consolidadas", icon: List, color: "blue", component: VisaoGeralPendencias, windowTitle: "Visao Geral Pendencias", props: { contasReceber, contasPagar }, sensitive: false },
    { title: "Movimentos Diarios", description: "Fluxo de caixa diario", icon: Calendar, color: "slate", component: MovimentosDiarios, windowTitle: "Movimentos Diarios", sensitive: false },
    { title: "Liquidar", description: "Receber e pagar titulos", icon: TrendingUp, color: "green", component: LiquidarReceberPagar, windowTitle: "Liquidacao de Titulos", sensitive: true },
    { title: "Ordens Pendentes", description: "Aguardando processamento", icon: Clock, color: "orange", component: OrdensLiquidacaoPendentes, windowTitle: "Ordens de Liquidacao", sensitive: true },
    { title: "Cartoes", description: "Compensacao de cartoes", icon: CreditCard, color: "purple", component: CartoesACompensar, windowTitle: "Cartoes a Compensar", sensitive: true },
    { title: "Extrato Bancario", description: "Resumo de extratos", icon: Building2, color: "teal", component: ExtratoBancarioResumo, windowTitle: "Extrato Bancario", sensitive: false },
    { title: "Conciliacao", description: "Matching automatico", icon: FileText, color: "indigo", component: ConciliacaoBancariaTab, windowTitle: "Conciliacao Bancaria", sensitive: true },
    { title: "Historico", description: "Liquidacoes realizadas", icon: FileText, color: "slate", component: HistoricoLiquidacoes, windowTitle: "Historico de Liquidacoes", sensitive: false },
  ];

  const handleModuleClick = async (module) => {
    if (!contextoValido || !empresaId) {
      await auditCaixa("bloqueado_sem_contexto", false, { modulo_caixa: module.title });
      toast({ title: "Selecione uma empresa do grupo antes de abrir o Caixa.", variant: "destructive" });
      return;
    }
    if (!canViewCaixa || (module.sensitive && !canOpenSensitive)) {
      await auditCaixa("bloqueado_sem_permissao", false, { modulo_caixa: module.title });
      toast({ title: "Sem permissao para abrir este modulo do Caixa.", variant: "destructive" });
      return;
    }
    await auditCaixa("abrir_modulo_caixa", true, { modulo_caixa: module.title, sensivel: module.sensitive });
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
          uniqueKey: `caixa-${module.title.toLowerCase().replace(/\s/g, "-")}`
        }
      );
    });
  };

  return (
    <div className="w-full h-full flex flex-col space-y-1.5 overflow-auto p-1.5 bg-gradient-to-br from-slate-50 to-blue-50">
      <CaixaCentralHeader />

      {bloqueado && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between gap-3 text-amber-900">
            <span>{!contextoValido || !empresaId ? "Selecione uma empresa do grupo para operar o Caixa Central." : "Seu perfil nao tem permissao para visualizar o Caixa Central."}</span>
            <Button variant="outline" size="sm" disabled data-action="caixa-contexto-bloqueado" data-context-required="group_id,empresa_id">
              Bloqueado
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <KPIsFinanceiros
        totalReceber={totalReceber}
        totalPagar={totalPagar}
        saldoLiquido={saldoLiquido}
        totalFormasPagamento={Object.keys(porForma).length}
        contasReceberCount={contasReceber.length}
        contasPagarCount={contasPagar.length}
      />

      <DistribuicaoFormasPagamento porForma={porForma} />

      <Suspense fallback={<div className="p-4 text-sm text-slate-500">Carregando modulos do Caixa...</div>}>
        <CaixaModulosGrid modules={modules} onModuleClick={handleModuleClick} />
      </Suspense>
    </div>
  );
}
