const INACTIVE_STATUSES = new Set(['inativo', 'desligado', 'bloqueado', 'inativa', 'suspenso', 'suspensa']);

const stripAccents = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const firstActiveId = (list, idField) => {
  const match = (Array.isArray(list) ? list : []).find((item) => item && item[idField] && item.ativo !== false);
  return match?.[idField] || null;
};

export const resolveUserGroupId = (user = {}) => (
  user.grupo_atual_id
  || user.grupo_padrao_id
  || user.group_id
  || user.grupo_id
  || firstActiveId(user.grupos_vinculados, 'grupo_id')
  || firstActiveId(user.grupos_vinculados, 'group_id')
  || null
);

export const resolveUserEmpresaId = (user = {}) => (
  user.empresa_atual_id
  || user.empresa_padrao_id
  || user.empresa_id
  || firstActiveId(user.empresas_vinculadas, 'empresa_id')
  || null
);

export const createAuthDeniedError = (evaluation = {}) => {
  const error = new Error(evaluation.reason || 'auth_required');
  error.status = 403;
  error.authType = evaluation.type || 'auth_required';
  return error;
};

export const evaluateLocalUserSession = (user, session = null, nowMs = Date.now()) => {
  if (!user || !user.id) {
    return { allowed: false, reason: 'unauthenticated', type: 'auth_required' };
  }

  if (user.disabled === true) {
    return { allowed: false, reason: 'disabled', type: 'account_disabled' };
  }

  const status = stripAccents(user.status);
  if (user.ativo === false || INACTIVE_STATUSES.has(status)) {
    return { allowed: false, reason: 'inactive', type: 'account_inactive' };
  }

  const groupId = resolveUserGroupId(user);
  if (!groupId) {
    return { allowed: false, reason: 'missing_group', type: 'missing_group' };
  }

  const empresaId = resolveUserEmpresaId(user);
  if (!user.pode_operar_em_grupo && !empresaId) {
    return { allowed: false, reason: 'missing_company', type: 'missing_company' };
  }

  if (session) {
    const sessionStatus = stripAccents(session.status);
    if (session.ativa === false || sessionStatus === 'encerrada' || sessionStatus === 'revogada') {
      return { allowed: false, reason: 'session_revoked', type: 'auth_required' };
    }

    const lastAccess = new Date(session.data_hora_ultimo_acesso || session.data_hora_inicio || 0).getTime();
    const maxIdleMs = Number(session.max_idle_ms || 8 * 60 * 60 * 1000);
    if (Number.isFinite(lastAccess) && lastAccess > 0 && nowMs - lastAccess > maxIdleMs) {
      return { allowed: false, reason: 'session_expired', type: 'auth_required' };
    }
  }

  return {
    allowed: true,
    reason: null,
    type: null,
    groupId,
    empresaId: empresaId || null,
  };
};
