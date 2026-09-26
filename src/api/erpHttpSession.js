import { resolveErpApiBaseUrl } from './runtimeBackend.js';

const SCOPE_KEY = 'erp_runtime_scope';
const TOKEN_KEY = 'base44_access_token';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {Storage | null | undefined} explicit
 * @returns {Storage | null}
 */
function resolveStorage(explicit) {
  if (explicit) return explicit;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* ignore */
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Persiste Bearer + tenant no storage do browser (sem logar segredos).
 * @param {{
 *   accessToken: string,
 *   groupId: string,
 *   empresaId?: string | null,
 *   actorId: string,
 *   email?: string,
 *   role?: string | null,
 *   fullName?: string | null,
 *   expiresAt?: string | number | null,
 *   expiresIn?: number | null,
 *   storage?: Storage,
 * }} input
 */
export function persistErpHttpSession(input) {
  const storage = resolveStorage(input.storage);
  if (!storage) return;
  const token = String(input.accessToken || '').trim();
  const groupId = String(input.groupId || '').trim();
  const actorId = String(input.actorId || '').trim();
  const empresaId = input.empresaId ? String(input.empresaId).trim() : '';
  const roleRaw = String(input.role || 'user').trim().toLowerCase() || 'user';
  const role = roleRaw === 'admin' ? 'admin' : 'user';
  const fullName = input.fullName ? String(input.fullName).trim() : '';
  if (!token || !isUuid(groupId) || !isUuid(actorId)) {
    throw new Error('Sessão incompleta: token, grupo e perfil são obrigatórios');
  }
  if (empresaId && !isUuid(empresaId)) {
    throw new Error('Sessão inválida: empresaId adulterado');
  }

  let expiresAt = null;
  if (input.expiresAt != null && input.expiresAt !== '') {
    const ms = typeof input.expiresAt === 'number'
      ? input.expiresAt
      : Date.parse(String(input.expiresAt));
    if (!Number.isFinite(ms)) {
      throw new Error('Sessão inválida: expiresAt adulterado');
    }
    expiresAt = new Date(ms).toISOString();
  } else if (typeof input.expiresIn === 'number' && Number.isFinite(input.expiresIn) && input.expiresIn > 0) {
    expiresAt = new Date(Date.now() + Math.floor(input.expiresIn) * 1000).toISOString();
  }

  storage.setItem(TOKEN_KEY, token);
  storage.setItem(SCOPE_KEY, JSON.stringify({
    token,
    groupId,
    empresaId: empresaId || null,
    actorId,
    email: input.email || null,
    role,
    fullName: fullName || null,
    expiresAt,
  }));
}

export function clearErpHttpSession(storage = null) {
  const store = resolveStorage(storage);
  if (!store) return;
  store.removeItem(TOKEN_KEY);
  store.removeItem(SCOPE_KEY);
}

/**
 * Lê sessão HTTP. Fail-closed: JSON inválido, campos adulterados ou expirada → null + limpa.
 * @param {Storage | null} [storage]
 * @param {{ now?: number }} [options]
 */
export function readErpHttpSession(storage = null, options = {}) {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(SCOPE_KEY);
    if (raw == null || raw === '') {
      const orphanToken = String(store.getItem(TOKEN_KEY) || '').trim();
      if (orphanToken) clearErpHttpSession(store);
      return null;
    }
    let scope;
    try {
      scope = JSON.parse(raw);
    } catch {
      clearErpHttpSession(store);
      return null;
    }
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
      clearErpHttpSession(store);
      return null;
    }

    const token = typeof scope.token === 'string' && scope.token.trim()
      ? scope.token.trim()
      : String(store.getItem(TOKEN_KEY) || '').trim();
    const groupId = typeof scope.groupId === 'string' ? scope.groupId.trim() : '';
    const empresaId = typeof scope.empresaId === 'string' ? scope.empresaId.trim() : '';
    const actorId = typeof scope.actorId === 'string' ? scope.actorId.trim() : '';
    const roleRaw = typeof scope.role === 'string' ? scope.role.trim().toLowerCase() : '';

    if (!token || !isUuid(groupId) || !isUuid(actorId)) {
      clearErpHttpSession(store);
      return null;
    }
    if (scope.empresaId != null && scope.empresaId !== '' && !isUuid(empresaId)) {
      clearErpHttpSession(store);
      return null;
    }
    if (roleRaw && roleRaw !== 'admin' && roleRaw !== 'user') {
      clearErpHttpSession(store);
      return null;
    }

    let expiresAt = null;
    if (scope.expiresAt != null && scope.expiresAt !== '') {
      const ms = Date.parse(String(scope.expiresAt));
      if (!Number.isFinite(ms)) {
        clearErpHttpSession(store);
        return null;
      }
      expiresAt = new Date(ms).toISOString();
      const now = typeof options.now === 'number' ? options.now : Date.now();
      if (ms <= now) {
        clearErpHttpSession(store);
        return null;
      }
    }

    return {
      token,
      groupId,
      empresaId: empresaId || null,
      actorId,
      email: typeof scope.email === 'string' ? scope.email : null,
      role: roleRaw === 'admin' ? 'admin' : 'user',
      fullName: typeof scope.fullName === 'string' && scope.fullName.trim()
        ? scope.fullName.trim()
        : null,
      expiresAt,
    };
  } catch {
    clearErpHttpSession(store);
    return null;
  }
}

/**
 * Atualiza somente a empresa da sessão HTTP (troca de contexto), preservando token/expiração.
 * @param {{
 *   empresaId: string | null,
 *   storage?: Storage | null,
 * }} input
 */
export function switchErpHttpSessionEmpresa(input) {
  const storage = resolveStorage(input.storage);
  const current = readErpHttpSession(storage);
  if (!current) {
    throw new Error('Sessão HTTP ausente ou inválida para troca de empresa');
  }
  const empresaId = input.empresaId ? String(input.empresaId).trim() : '';
  if (empresaId && !isUuid(empresaId)) {
    throw new Error('empresaId inválido na troca de contexto');
  }
  persistErpHttpSession({
    accessToken: current.token,
    groupId: current.groupId,
    empresaId: empresaId || null,
    actorId: current.actorId,
    email: current.email || undefined,
    role: current.role,
    fullName: current.fullName,
    expiresAt: current.expiresAt,
    storage,
  });
  return readErpHttpSession(storage);
}

/**
 * Monta o usuário UI a partir da sessão HTTP + role do perfil no Postgres.
 * Admin/proprietário só quando `role=admin` no perfil — sem privilegiar synth por default.
 * @param {{
 *   token?: string,
 *   groupId: string,
 *   empresaId?: string | null,
 *   actorId: string,
 *   email?: string | null,
 *   role?: string | null,
 *   fullName?: string | null,
 * }} session
 */
export function buildHttpSessionUser(session) {
  const groupId = String(session?.groupId || '').trim();
  const actorId = String(session?.actorId || '').trim();
  const empresaId = session?.empresaId ? String(session.empresaId).trim() : '';
  const email = session?.email || null;
  const role = String(session?.role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
  const isAdmin = role === 'admin';
  const fullName = session?.fullName
    ? String(session.fullName).trim()
    : (isAdmin ? 'Administrador' : (email || 'Usuário'));
  if (!groupId || !actorId) return null;
  return {
    id: actorId,
    email: email || 'usuario@erp.local',
    full_name: fullName || (email || 'Usuário'),
    role,
    _app_role: role,
    perfil_acesso_id: isAdmin ? 'local_perfil_admin' : null,
    mestre_local: false,
    disabled: false,
    is_verified: true,
    contexto_atual: empresaId ? 'empresa' : 'grupo',
    grupo_atual_id: groupId,
    grupo_padrao_id: groupId,
    empresa_atual_id: empresaId || null,
    empresa_padrao_id: empresaId || null,
    pode_operar_em_grupo: isAdmin,
    pode_ver_todas_empresas: isAdmin,
    empresas_vinculadas: empresaId ? [{ empresa_id: empresaId, ativo: true }] : [],
    grupos_vinculados: [{ grupo_id: groupId, ativo: true }],
  };
}

/** @deprecated Use buildHttpSessionUser — mantido para imports existentes. */
export function buildHttpDevAdminUser(session) {
  return buildHttpSessionUser(session);
}

/**
 * Espelha Grupo/Empresa do Postgres no localBase44 (IDs reais da sessão)
 * para o seletor multiempresa e o PerfilAcesso admin existirem no browser.
 * Usa upsert direto (sem RBAC create) — bootstrap de sessão HTTP.
 * @param {{ groupId: string, empresaId?: string | null, base44Client?: unknown }} input
 */
export async function ensureHttpTenantLocalMirror(input) {
  const groupId = String(input?.groupId || '').trim();
  const empresaId = input?.empresaId ? String(input.empresaId).trim() : '';
  if (!groupId) return { group: false, empresa: false, perfil: false };

  const { upsertHttpTenantLocalMirror } = await import('./localBase44Client.js');
  const result = upsertHttpTenantLocalMirror({ groupId, empresaId });

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('group_atual_id', groupId);
      localStorage.setItem('contexto_atual', empresaId ? 'empresa' : 'grupo');
      if (empresaId) localStorage.setItem('empresa_atual_id', empresaId);
      else localStorage.removeItem('empresa_atual_id');
    }
  } catch {
    /* storage indisponível */
  }

  return result;
}

/**
 * Login password via BFF (same-origin /api).
 * @param {{ email: string, password: string, baseUrl?: string, fetchImpl?: typeof fetch }} input
 */
export async function loginErpHttpSession(input) {
  const baseUrl = (input.baseUrl ?? resolveErpApiBaseUrl(import.meta.env) ?? '').replace(/\/$/, '');
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: input.email, password: input.password }),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body?.error?.message || `Falha no login (HTTP ${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.code = body?.error?.code;
    throw err;
  }
  const data = body?.data || {};
  const accessToken = String(data.access_token || '').trim();
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 0;
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  const profile = profiles.find((p) => p?.group_id && p?.id) || profiles[0];
  if (!accessToken || !profile?.id || !profile?.group_id) {
    throw new Error('Login sem perfil ativo no ERP');
  }
  if (expiresIn <= 0) {
    throw new Error('Login sem expires_in válido');
  }
  const role = String(profile.role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
  const fullName = typeof profile.full_name === 'string' && profile.full_name.trim()
    ? profile.full_name.trim()
    : null;
  const session = {
    accessToken,
    groupId: String(profile.group_id),
    empresaId: profile.empresa_id ? String(profile.empresa_id) : null,
    actorId: String(profile.id),
    email: data.user?.email || input.email,
    role,
    fullName,
    expiresIn,
  };
  const expiresAt = new Date(Date.now() + Math.floor(expiresIn) * 1000).toISOString();
  persistErpHttpSession({ ...session, expiresAt });
  const uiUser = buildHttpSessionUser({
    groupId: session.groupId,
    empresaId: session.empresaId,
    actorId: session.actorId,
    email: session.email,
    role: session.role,
    fullName: session.fullName,
  });
  return {
    ...session,
    expiresAt,
    profiles,
    user: uiUser || {
      id: data.user?.id || profile.id,
      email: session.email,
      full_name: session.fullName || session.email,
      role: session.role,
      grupo_atual_id: session.groupId,
      empresa_atual_id: session.empresaId,
    },
  };
}
