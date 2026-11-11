/**
 * Financeiro autorizado no Cliente360 — soft-land até BFF ContasReceber por cliente.
 * Não inventa títulos/saldos; estados explícitos.
 */

/**
 * @param {(module: string, resource: string|null, action: string) => boolean} hasPermission
 */
export function canViewCentral360Financeiro(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Financeiro', 'ContasReceber', 'visualizar')
    || hasPermission('Financeiro', 'contas_receber', 'visualizar')
    || hasPermission('Financeiro', 'Contas a Receber', 'visualizar')
    || hasPermission('Financeiro', null, 'visualizar')
  );
}

/**
 * Soft-land: sem list HTTP canônico por cliente neste tip.
 * @param {{ forbidden?: boolean, httpPending?: boolean }} [flags]
 */
export function classifyCentral360Financeiro(flags = {}) {
  if (flags.forbidden) {
    return {
      status: 'forbidden',
      message: 'Financeiro não autorizado ao perfil',
    };
  }
  if (flags.httpPending !== false) {
    return {
      status: 'pending_bff',
      message: 'Financeiro autorizado ao perfil — listagem ContasReceber por cliente aguarda contrato BFF (sem inventar títulos)',
    };
  }
  return {
    status: 'unavailable',
    message: 'Financeiro indisponível',
  };
}
