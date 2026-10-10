/**
 * Acesso aos cards do launchpad Financeiro.
 * Fail-closed sem permissão.
 *
 * - Grant plano no módulo (`Financeiro: ['visualizar']` / ações na raiz): libera todos os cards
 *   (antes o filtro só por seção escondia o grid inteiro).
 * - Árvore granular por seção: só cards com grant explícito na seção.
 */
import { buildMultiempresaQueryScopeKey } from '../lib/contextoMultiempresaPolicy.js';

export const FINANCEIRO_LAUNCHPAD_MODULE_TITLES = Object.freeze([
  'Caixa Central',
  'Formas de Pagamento',
  'Caixa PDV Completo',
  'Vendas Multicanal',
  'Remessa/Retorno CNAB',
  'Contas a Receber',
  'Contas a Pagar',
  'Aprovações Descontos',
  'Conciliação Bancária',
  'Custos Logísticos',
  'Relatórios Financeiros',
  'Alertas por Empresa',
  'IA Anomalias',
  'Régua de Cobrança IA',
  'Rateio Multi-Empresa',
]);

export { buildMultiempresaQueryScopeKey as buildFinanceiroQueryScopeKey };

function hasView(hasPermission, section) {
  return (
    hasPermission('Financeiro', section, 'ver') ||
    hasPermission('Financeiro', section, 'visualizar')
  );
}

const FINANCEIRO_OWNER_SECTION_KEYS = Object.freeze([
  'caixa',
  'contas_receber',
  'contas_pagar',
  'conciliacao',
  'relatorios',
]);

export function canViewFinanceLaunchpadModule(hasPermission, module, options = {}) {
  if (typeof hasPermission !== 'function' || !module) return false;
  const section = module.sectionKey || module.title;
  if (!section) return false;

  if (hasView(hasPermission, section)) return true;
  // Compat: árvore legada por título UI ainda concede quando sectionKey canônico não casa.
  if (module.sectionKey && module.title && hasView(hasPermission, module.title)) return true;

  const moduleView = hasView(hasPermission, null);
  if (!moduleView) return false;

  const probeTitles = options.probeTitles || FINANCEIRO_LAUNCHPAD_MODULE_TITLES;
  const anySectionGranted = probeTitles.some((title) => hasView(hasPermission, title))
    || FINANCEIRO_OWNER_SECTION_KEYS.some((key) => hasView(hasPermission, key));
  // Grant plano (sem nós de seção do launchpad): módulo visualizar basta.
  if (!anySectionGranted) return true;
  // Árvore granular: esta seção não tem grant.
  return false;
}

const emptyBaixaReceber = () => ({
  data_recebimento: new Date().toISOString().split('T')[0],
  valor_recebido: 0,
  forma_recebimento: 'PIX',
  juros: 0,
  multa: 0,
  desconto: 0,
  observacoes: '',
});

const emptyBaixaPagar = () => ({
  data_pagamento: new Date().toISOString().split('T')[0],
  valor_pago: 0,
  forma_pagamento: 'PIX',
  juros: 0,
  multa: 0,
  desconto: 0,
  observacoes: '',
});

/**
 * Troca de grupo/empresa em Contas a Receber/Pagar: zera seleção residual,
 * fecha diálogos e limpa rascunho de baixa (sem preservar IDs cross-tenant).
 */
export function buildFinanceiroTitulosScopeSwitchReset(kind = 'receber') {
  const base = {
    contasSelecionadas: [],
    contaAtual: null,
    dialogBaixaOpen: false,
  };
  if (kind === 'pagar') {
    return { ...base, dadosBaixa: emptyBaixaPagar() };
  }
  return {
    ...base,
    gerarCobrancaDialogOpen: false,
    simularPagamentoDialogOpen: false,
    gerarLinkDialogOpen: false,
    contaParaCobranca: null,
    contaParaSimulacao: null,
    contaParaLink: null,
    dadosBaixa: emptyBaixaReceber(),
  };
}

/**
 * Prefixos de queryKey Financeiro escopados por empresa.
 * Na troca CPA↔3Z: cancelar in-flight + remover cache do scope anterior
 * para uma resposta atrasada não pintar a tela da empresa atual.
 */
export const FINANCEIRO_SCOPE_QUERY_ROOTS = Object.freeze([
  'contasReceber',
  'contasPagar',
  'contas-receber-count',
  'contas-pagar-count',
  'empresas',
  'configs-cobranca',
  'liquidacao',
  'liquidacao-lote',
  'movimento-cartao',
  'caixa-ordens-liquidacao',
  'extratos',
  'contas-receber',
  'contas-pagar',
]);

/** True somente se o resultado ainda pertence ao scope ativo. */
export function shouldApplyFinanceiroQueryResult(activeScopeKey, resultScopeKey) {
  if (!activeScopeKey || activeScopeKey === 'sem-contexto') return false;
  return activeScopeKey === resultScopeKey;
}

/**
 * Cancela fetches em voo e remove cache do scope anterior.
 * Aceita QueryClient (ou mock de teste com cancelQueries/removeQueries).
 */
export function cancelFinanceiroQueriesOnScopeSwitch(queryClient, previousScopeKey) {
  if (!queryClient || typeof queryClient.cancelQueries !== 'function') {
    return { cancelledRoots: 0, removedPrevious: false };
  }
  let cancelledRoots = 0;
  for (const root of FINANCEIRO_SCOPE_QUERY_ROOTS) {
    queryClient.cancelQueries({ queryKey: [root] });
    cancelledRoots += 1;
  }
  let removedPrevious = false;
  if (previousScopeKey && previousScopeKey !== 'sem-contexto'
      && typeof queryClient.removeQueries === 'function') {
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query?.queryKey;
        if (!Array.isArray(key)) return false;
        return key.includes(previousScopeKey);
      },
    });
    removedPrevious = true;
  }
  return { cancelledRoots, removedPrevious };
}
