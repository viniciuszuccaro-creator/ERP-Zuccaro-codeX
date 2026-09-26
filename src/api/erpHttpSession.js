import { resolveErpApiBaseUrl } from './runtimeBackend.js';

const SCOPE_KEY = 'erp_runtime_scope';
const TOKEN_KEY = 'base44_access_token';

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
 *   storage?: Storage,
 * }} input
 */
export function persistErpHttpSession(input) {
  const storage = input.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) return;
  const token = String(input.accessToken || '').trim();
  const groupId = String(input.groupId || '').trim();
  const actorId = String(input.actorId || '').trim();
  const empresaId = input.empresaId ? String(input.empresaId).trim() : '';
  const role = String(input.role || 'user').trim().toLowerCase() || 'user';
  const fullName = input.fullName ? String(input.fullName).trim() : '';
  if (!token || !groupId || !actorId) {
    throw new Error('Sessão incompleta: token, grupo e perfil são obrigatórios');
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
  }));
}

export function clearErpHttpSession(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return;
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(SCOPE_KEY);
}

export function readErpHttpSession(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SCOPE_KEY);
    const scope = raw ? JSON.parse(raw) : {};
    const token = typeof scope.token === 'string' && scope.token.trim()
      ? scope.token.trim()
      : String(storage.getItem(TOKEN_KEY) || '').trim();
    const groupId = typeof scope.groupId === 'string' ? scope.groupId.trim() : '';
    const empresaId = typeof scope.empresaId === 'string' ? scope.empresaId.trim() : '';
    const actorId = typeof scope.actorId === 'string' ? scope.actorId.trim() : '';
    if (!token || !groupId || !actorId) return null;
    const roleRaw = typeof scope.role === 'string' ? scope.role.trim().toLowerCase() : '';
    return {
      token,
      groupId,
      empresaId: empresaId || null,
      actorId,
      email: typeof scope.email === 'string' ? scope.email : null,
      role: roleRaw === 'admin' ? 'admin' : (roleRaw || 'user'),
      fullName: typeof scope.fullName === 'string' && scope.fullName.trim()
        ? scope.fullName.trim()
        : null,
    };
  } catch {
    return null;
  }
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
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  const profile = profiles.find((p) => p?.group_id && p?.id) || profiles[0];
  if (!accessToken || !profile?.id || !profile?.group_id) {
    throw new Error('Login sem perfil ativo no ERP');
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
  };
  persistErpHttpSession(session);
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
