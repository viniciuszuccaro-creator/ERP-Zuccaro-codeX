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
    return {
      token,
      groupId,
      empresaId: empresaId || null,
      actorId,
      email: typeof scope.email === 'string' ? scope.email : null,
    };
  } catch {
    return null;
  }
}

/**
 * Usuário UI pós-login HTTP DEV: admin total para homologação
 * (funcionários/setores virão depois via PerfilAcesso real).
 * @param {{ token?: string, groupId: string, empresaId?: string | null, actorId: string, email?: string | null }} session
 */
export function buildHttpDevAdminUser(session) {
  const groupId = String(session?.groupId || '').trim();
  const actorId = String(session?.actorId || '').trim();
  const empresaId = session?.empresaId ? String(session.empresaId).trim() : '';
  const email = session?.email || 'admin-dev@erp.local';
  if (!groupId || !actorId) return null;
  return {
    id: actorId,
    email,
    full_name: 'Administrador DEV',
    role: 'admin',
    _app_role: 'admin',
    perfil_acesso_id: 'local_perfil_admin',
    mestre_local: false,
    disabled: false,
    is_verified: true,
    contexto_atual: empresaId ? 'empresa' : 'grupo',
    grupo_atual_id: groupId,
    grupo_padrao_id: groupId,
    empresa_atual_id: empresaId || null,
    empresa_padrao_id: empresaId || null,
    pode_operar_em_grupo: true,
    pode_ver_todas_empresas: true,
    empresas_vinculadas: empresaId ? [{ empresa_id: empresaId, ativo: true }] : [],
    grupos_vinculados: [{ grupo_id: groupId, ativo: true }],
  };
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
  const session = {
    accessToken,
    groupId: String(profile.group_id),
    empresaId: profile.empresa_id ? String(profile.empresa_id) : null,
    actorId: String(profile.id),
    email: data.user?.email || input.email,
  };
  persistErpHttpSession(session);
  return {
    ...session,
    profiles,
    user: {
      id: data.user?.id || profile.id,
      email: session.email,
      full_name: session.email,
      role: 'user',
      grupo_atual_id: session.groupId,
      empresa_atual_id: session.empresaId,
    },
  };
}
