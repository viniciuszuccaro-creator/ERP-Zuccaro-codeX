const ACTION_ALIASES = {
  ver: 'visualizar',
  view: 'visualizar',
  read: 'visualizar',
  listar: 'visualizar',
  delete: 'excluir',
  remove: 'excluir',
  apagar: 'excluir',
  create: 'criar',
  add: 'criar',
  update: 'editar',
  edit: 'editar',
  approve: 'aprovar',
  export: 'exportar',
};

export const normalizeGuardAction = (action) => {
  const normalized = String(action || 'visualizar').trim().toLowerCase();
  return ACTION_ALIASES[normalized] || normalized;
};

export const isReadOnlyGuardAction = (action) => normalizeGuardAction(action) === 'visualizar';

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
