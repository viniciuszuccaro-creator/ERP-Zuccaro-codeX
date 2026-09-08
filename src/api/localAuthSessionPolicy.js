const INACTIVE_STATUSES = new Set(['inativo', 'desligado', 'bloqueado', 'inativa', 'suspenso', 'suspensa']);

export const LOCAL_AUTH_STATE_KEY = 'erp_integra_local_auth_state_v1';
export const LOCAL_SESSION_ID_KEY = 'sessao_id';

const stripAccents = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const firstActiveId = (list, idField) => {
  const match = (Array.isArray(list) ? list : []).find((item) => item && item[idField] && item.ativo !== false);
  return match?.[idField] || null;
};

const safeGetItem = (storage, key) => {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
};

const safeSetItem = (storage, key, value) => {
  try {
    storage?.setItem?.(key, value);
  } catch {
    /* ignore quota/private mode */
  }
};

const safeRemoveItem = (storage, key) => {
  try {
    storage?.removeItem?.(key);
  } catch {
    /* ignore */
  }
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

export const readLocalAuthState = (storage = globalThis?.localStorage) => {
  const raw = safeGetItem(storage, LOCAL_AUTH_STATE_KEY);
  if (!raw) {
    return { logged_in: true, bootstrapped: false };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      logged_in: parsed?.logged_in !== false,
      sessao_id: parsed?.sessao_id || safeGetItem(storage, LOCAL_SESSION_ID_KEY) || null,
      bootstrapped: true,
    };
  } catch {
    return { logged_in: true, bootstrapped: false };
  }
};

export const writeLocalAuthState = (state = {}, storage = globalThis?.localStorage) => {
  const next = {
    logged_in: state.logged_in !== false,
    sessao_id: state.sessao_id || null,
    updated_at: new Date().toISOString(),
  };
  safeSetItem(storage, LOCAL_AUTH_STATE_KEY, JSON.stringify(next));
  if (next.sessao_id) safeSetItem(storage, LOCAL_SESSION_ID_KEY, next.sessao_id);
  else safeRemoveItem(storage, LOCAL_SESSION_ID_KEY);
  return next;
};

export const markLocalLoggedOut = (storage = globalThis?.localStorage) => (
  writeLocalAuthState({ logged_in: false, sessao_id: null }, storage)
);

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

/** API key sozinha nao autentica sessao interativa no browser. */
export const assertInteractiveAuthAllowed = ({
  isLocalOnlyMode = false,
  hasApiKey = false,
  hasUserToken = false,
} = {}) => {
  if (isLocalOnlyMode) return { allowed: true, reason: null };
  if (hasApiKey && !hasUserToken) {
    return {
      allowed: false,
      reason: 'api_key_not_interactive',
      type: 'auth_required',
    };
  }
  return { allowed: true, reason: null };
};
