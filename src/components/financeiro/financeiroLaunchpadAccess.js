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

export function canViewFinanceLaunchpadModule(hasPermission, module, options = {}) {
  if (typeof hasPermission !== 'function' || !module) return false;
  const section = module.sectionKey || module.title;
  if (!section) return false;

  if (hasView(hasPermission, section)) return true;

  const moduleView = hasView(hasPermission, null);
  if (!moduleView) return false;

  const probeTitles = options.probeTitles || FINANCEIRO_LAUNCHPAD_MODULE_TITLES;
  const anySectionGranted = probeTitles.some((title) => hasView(hasPermission, title));
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
