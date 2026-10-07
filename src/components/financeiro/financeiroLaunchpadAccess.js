/**
 * Acesso aos cards do launchpad Financeiro.
 * Fail-closed sem permissão.
 *
 * - Grant plano no módulo (`Financeiro: ['visualizar']` / ações na raiz): libera todos os cards
 *   (antes o filtro só por seção escondia o grid inteiro).
 * - Árvore granular por seção: só cards com grant explícito na seção.
 */
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
