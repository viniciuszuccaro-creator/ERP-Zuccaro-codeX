const PAGE_MODULES = {
  CRM: 'CRM',
  Comercial: 'Comercial',
  Estoque: 'Estoque',
  Compras: 'Compras',
  Financeiro: 'Financeiro',
  Fiscal: 'Fiscal',
  RH: 'RH',
  Expedicao: 'Expedição',
  Producao: 'Produção',
};

const fallbackGuardState = {};

const readStorage = (storage, key) => {
  try {
    return storage?.getItem?.(key) || null;
  } catch {
    return null;
  }
};

/**
 * @param {{
 *   permission?: string,
 *   actionName?: string,
 *   path?: string,
 *   storage?: Pick<Storage, 'getItem'>|null
 * }} options
 */
export function buildSensitiveGuardRequest({ permission, actionName, path = '', storage } = {}) {
  const permissionParts = String(permission || '').split('.').filter(Boolean);
  const actionParts = String(actionName || '').split('.').filter(Boolean);
  const page = String(path).split('/').filter(Boolean).pop() || '';
  const scopeType = readStorage(storage, 'contexto_atual') === 'grupo' ? 'group' : 'company';
  const groupId = readStorage(storage, 'group_atual_id');
  const empresaId = readStorage(storage, 'empresa_atual_id');
  const module = permissionParts[0] || actionParts[0] || PAGE_MODULES[page] || 'Sistema';
  const action = permissionParts.length > 1
    ? permissionParts[permissionParts.length - 1]
    : (actionParts.length > 1 ? actionParts[actionParts.length - 1] : 'executar');
  const sectionParts = permissionParts.length > 2
    ? permissionParts.slice(1, -1)
    : actionParts.slice(1, -1);

  return {
    valid: Boolean(groupId && (scopeType === 'group' || empresaId)),
    key: `${module}|${sectionParts.join('.') || '-'}|${action}|${empresaId || '-'}|${groupId || '-'}`,
    payload: {
      module,
      section: sectionParts.join('.') || null,
      action,
      empresa_id: scopeType === 'company' ? empresaId : null,
      group_id: groupId,
      scope_type: scopeType,
    },
  };
}

export const isSensitiveGuardAllowed = (response) => response?.data?.allowed === true;

/**
 * @param {(Window & {
 *   __entityGuardCache?: Map<string, {allowed: boolean, ts: number}>,
 *   __entityGuardInflight?: Map<string, Promise<boolean>>
 * })|null} host
 */
export function getSensitiveGuardState(host = typeof window !== 'undefined' ? window : null) {
  const target = host || fallbackGuardState;
  target.__entityGuardCache ||= new Map();
  target.__entityGuardInflight ||= new Map();
  return {
    cache: target.__entityGuardCache,
    inflight: target.__entityGuardInflight,
  };
}
