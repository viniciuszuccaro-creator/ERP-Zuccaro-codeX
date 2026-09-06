export const GRANULAR_PERMISSION_ACTIONS = [
  'visualizar',
  'criar',
  'editar',
  'inativar',
  'restaurar',
  'aprovar',
  'rejeitar',
  'emitir',
  'cancelar',
  'receber',
  'pagar',
  'conciliar',
  'estornar',
  'importar',
  'exportar',
  'configurar',
  'executar',
  'excluir',
];

const ACTION_ALIASES = {
  ver: 'visualizar',
  view: 'visualizar',
  read: 'visualizar',
  listar: 'visualizar',
  consultar: 'visualizar',
  status: 'visualizar',
  delete: 'excluir',
  remove: 'excluir',
  apagar: 'excluir',
  destroy: 'excluir',
  create: 'criar',
  add: 'criar',
  update: 'editar',
  edit: 'editar',
  corrigir: 'editar',
  approve: 'aprovar',
  approvar: 'aprovar',
  ajustar: 'aprovar',
  ajuste: 'aprovar',
  inventario: 'aprovar',
  export: 'exportar',
  imprimir: 'exportar',
  print: 'exportar',
  cancel: 'cancelar',
};

export const normalizeGuardAction = (action) => {
  const normalized = String(action || 'visualizar').trim().toLowerCase();
  return ACTION_ALIASES[normalized] || normalized;
};

export const isReadOnlyGuardAction = (action) => normalizeGuardAction(action) === 'visualizar';

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

export const normalizeGuardContext = (input = {}) => {
  const groupId = firstValue(input.groupId, input.group_id, input.grupoId, input.grupo_id) || null;
  const rawEmpresaId = firstValue(input.empresaId, input.empresa_id, input.companyId, input.company_id) || null;
  const rawScope = String(firstValue(input.scopeType, input.scope_type, input.contexto) || '').trim().toLowerCase();
  const scopeType = ['grupo', 'group'].includes(rawScope)
    ? 'grupo'
    : (['empresa', 'company'].includes(rawScope) ? 'empresa' : (rawEmpresaId ? 'empresa' : (groupId ? 'grupo' : null)));

  return { groupId, empresaId: scopeType === 'grupo' ? null : rawEmpresaId, scopeType };
};

export const validateGuardContext = (input = {}) => {
  const context = normalizeGuardContext(input);
  if (!context.scopeType) return { ...context, valid: false, error: 'scope_type_required' };
  if (!context.groupId) return { ...context, valid: false, error: 'group_id_required' };
  if (context.scopeType === 'empresa' && !context.empresaId) {
    return { ...context, valid: false, error: 'empresa_id_required' };
  }
  return { ...context, valid: true, error: null };
};

const actionListAllows = (actions, desired) => Array.isArray(actions)
  && actions.map(normalizeGuardAction).includes(desired);

export const permissionNodeAllows = (node, action) => {
  const desired = normalizeGuardAction(action);
  const stack = [node];

  while (stack.length) {
    const current = stack.pop();
    if (actionListAllows(current, desired)) return true;
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      Object.values(current).forEach((value) => stack.push(value));
    }
  }

  return false;
};

export const resolveGuardPermission = ({ permissions, moduleName, section, action }) => {
  if (!permissions || typeof permissions !== 'object') return false;
  if (permissionNodeAllows(permissions['*'], action)) return true;
  const moduleNode = permissions[moduleName];
  if (!moduleNode) return false;

  if (!section) return permissionNodeAllows(moduleNode, action);

  const path = Array.isArray(section) ? section : String(section).split('.').filter(Boolean);
  let cursor = moduleNode;
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') return false;
    cursor = cursor[segment];
  }

  return permissionNodeAllows(cursor, action);
};
