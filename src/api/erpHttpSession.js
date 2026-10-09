import { resolveErpApiBaseUrl } from './runtimeBackend.js';

const SCOPE_KEY = 'erp_runtime_scope';
const TOKEN_KEY = 'base44_access_token';
export const HTTP_CONTEXT_CHANGED = 'erp-http-context-changed';

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
 *   profileEmpresaId?: string | null,
 *   scopeType?: string,
 *   email?: string,
 *   role?: string | null,
 *   fullName?: string | null,
 *   expiresAt?: string | number | null,
 *   expiresIn?: number | null,
 *   groupName?: string | null,
 *   empresas?: Array<{ id: string, group_id?: string, razao_social?: string, nome_fantasia?: string | null, cnpj?: string | null, status?: string }>,
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
  const groupName = input.groupName ? String(input.groupName).trim() : '';
  const empresas = Array.isArray(input.empresas)
    ? input.empresas
      .map((e) => {
        const id = e?.id ? String(e.id).trim() : '';
        if (!id || !isUuid(id)) return null;
        const cnpjRaw = e?.cnpj == null ? '' : String(e.cnpj).trim();
        return {
          id,
          group_id: e.group_id ? String(e.group_id) : groupId,
          razao_social: String(e.razao_social || e.nome_fantasia || 'Empresa'),
          nome_fantasia: e.nome_fantasia == null ? null : String(e.nome_fantasia),
          cnpj: cnpjRaw || null,
          status: String(e.status || 'Ativa'),
        };
      })
      .filter(Boolean)
    : [];
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
    groupName: groupName || null,
    empresas,
    profileEmpresaId: input.profileEmpresaId || null,
    scopeType: input.scopeType || (empresaId ? 'empresa' : 'grupo'),
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
      groupName: typeof scope.groupName === 'string' && scope.groupName.trim()
        ? scope.groupName.trim()
        : null,
      empresas: Array.isArray(scope.empresas) ? scope.empresas : [],
      profileEmpresaId: scope.profileEmpresaId || null,
      scopeType: scope.scopeType === 'grupo' ? 'grupo' : 'empresa',
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
  if (!empresaId && (current.profileEmpresaId || current.role !== 'admin')) {
    throw new Error('Perfil sem autorização para operar no Grupo');
  }
  // Só permite empresa listada pelo servidor na sessão (anti-fabricação no browser).
  const authorized = Array.isArray(current.empresas) ? current.empresas : [];
  if (empresaId) {
    const allowed = authorized.some((e) => String(e?.id || '') === empresaId)
      || (authorized.length === 0 && current.empresaId === empresaId);
    if (!allowed) {
      throw new Error('Empresa não autorizada para este perfil. Faça login novamente.');
    }
  }
  persistErpHttpSession({
    accessToken: current.token,
    groupId: current.groupId,
    empresaId: empresaId || null,
    actorId: current.actorId,
    email: current.email || undefined,
    role: current.role,
    fullName: current.fullName,
    groupName: current.groupName,
    empresas: current.empresas,
    profileEmpresaId: current.profileEmpresaId,
    scopeType: empresaId ? 'empresa' : 'grupo',
    expiresAt: current.expiresAt,
    storage,
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HTTP_CONTEXT_CHANGED));
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
 *   profileEmpresaId?: string | null,
 *   scopeType?: string,
 *   email?: string | null,
 *   role?: string | null,
 *   fullName?: string | null,
 *   groupName?: string | null,
 *   empresas?: Array<{ id: string, group_id?: string, razao_social?: string, nome_fantasia?: string | null, cnpj?: string | null, status?: string }>,
 *   permissoes?: Record<string, unknown>,
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
  const permissoes = session?.permissoes && typeof session.permissoes === 'object' && !Array.isArray(session.permissoes)
    ? session.permissoes
    : {};
  const empresasServer = Array.isArray(session?.empresas) ? session.empresas : [];
  const empresasVinculadas = empresasServer
    .map((e) => {
      const id = e?.id ? String(e.id).trim() : '';
      return id && isUuid(id) ? { empresa_id: id, ativo: true } : null;
    })
    .filter(Boolean);
  if (empresasVinculadas.length === 0 && empresaId && isUuid(empresaId)) {
    empresasVinculadas.push({ empresa_id: empresaId, ativo: true });
  }
  const empresaAtual = session.scopeType === 'grupo' ? null : empresaId && isUuid(empresaId)
    ? empresaId
    : (empresasVinculadas[0]?.empresa_id || null);
  const perfilAcessoId = `http_perfil_${actorId}`;
  return {
    id: actorId,
    email: email || 'usuario@erp.local',
    full_name: fullName || (email || 'Usuário'),
    role,
    _app_role: role,
    perfil_acesso_id: perfilAcessoId,
    permissoes,
    mestre_local: false,
    disabled: false,
    is_verified: true,
    contexto_atual: empresaAtual ? 'empresa' : 'grupo',
    grupo_atual_id: groupId,
    grupo_padrao_id: groupId,
    empresa_atual_id: empresaAtual,
    empresa_padrao_id: empresaAtual,
    pode_operar_em_grupo: isAdmin && !session.profileEmpresaId,
    pode_ver_todas_empresas: isAdmin || empresasVinculadas.length > 1,
    empresas_vinculadas: empresasVinculadas,
    grupos_vinculados: [{ grupo_id: groupId, ativo: true }],
    group_name: session?.groupName || null,
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
 * @param {{
 *   groupId: string,
 *   empresaId?: string | null,
 *   groupName?: string | null,
 *   empresas?: Array<{ id: string, group_id?: string, razao_social?: string, nome_fantasia?: string | null, cnpj?: string | null, status?: string }>,
 *   perfilAcessoId?: string | null,
 *   permissoes?: Record<string, unknown> | null,
 *   perfilNome?: string | null,
 *   base44Client?: unknown,
 * }} input
 */
export async function ensureHttpTenantLocalMirror(input) {
  const groupId = String(input?.groupId || '').trim();
  const empresaId = input?.empresaId ? String(input.empresaId).trim() : '';
  if (!groupId) return { group: false, empresa: false, perfil: false };

  const { upsertHttpTenantLocalMirror } = await import('./localBase44Client.js');
  const result = upsertHttpTenantLocalMirror({
    groupId,
    empresaId,
    groupName: input?.groupName || null,
    empresas: Array.isArray(input?.empresas) ? input.empresas : [],
    perfilAcessoId: input?.perfilAcessoId || null,
    permissoes: input?.permissoes || null,
    perfilNome: input?.perfilNome || null,
  });

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
  const permissoes = profile.permissoes && typeof profile.permissoes === 'object' && !Array.isArray(profile.permissoes)
    ? profile.permissoes
    : {};
  const groupName = typeof profile.group_name === 'string' && profile.group_name.trim()
    ? profile.group_name.trim()
    : null;
  const empresas = Array.isArray(profile.empresas) ? profile.empresas : [];
  const session = {
    accessToken,
    groupId: String(profile.group_id),
    empresaId: profile.empresa_id ? String(profile.empresa_id) : null,
    actorId: String(profile.id),
    email: data.user?.email || input.email,
    role,
    fullName,
    groupName,
    empresas,
    profileEmpresaId: profile.empresa_id || null,
    scopeType: !profile.empresa_id && role === 'admin' ? 'grupo' : 'empresa',
    expiresIn,
  };
  const expiresAt = new Date(Date.now() + Math.floor(expiresIn) * 1000).toISOString();
  persistErpHttpSession({ ...session, expiresAt });
  try {
    await ensureHttpTenantLocalMirror({
      groupId: session.groupId,
      empresaId: session.empresaId,
      groupName,
      empresas,
      perfilAcessoId: `http_perfil_${session.actorId}`,
      permissoes,
      perfilNome: fullName || session.email,
    });
  } catch {
    /* espelho best-effort no login */
  }
  const uiUser = buildHttpSessionUser({
    groupId: session.groupId,
    empresaId: session.empresaId,
    actorId: session.actorId,
    email: session.email,
    role: session.role,
    fullName: session.fullName,
    groupName,
    empresas,
    permissoes,
    profileEmpresaId: session.profileEmpresaId,
    scopeType: session.scopeType,
  });
  return {
    ...session,
    expiresAt,
    permissoes,
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

/**
 * Revalida token no BFF (GET /api/v1/auth/session) e reconstrói usuário com role/permissões do servidor.
 * Fail-closed: 401/403/erro → limpa storage e retorna null.
 * @param {{
 *   storage?: Storage | null,
 *   baseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   preferredActorId?: string | null,
 *   preferredGroupId?: string | null,
 *   preferredEmpresaId?: string | null,
 * }} [input]
 */
export async function refreshErpHttpSessionFromServer(input = {}) {
  const storage = resolveStorage(input.storage);
  const local = readErpHttpSession(storage);
  if (!local?.token) {
    clearErpHttpSession(storage);
    return null;
  }
  const initialContextStillCurrent = () => {
    const current = readErpHttpSession(storage);
    return current?.token === local.token
      && current.actorId === local.actorId
      && current.groupId === local.groupId
      && current.empresaId === local.empresaId
      && current.scopeType === local.scopeType;
  };
  const baseUrl = (input.baseUrl ?? resolveErpApiBaseUrl(import.meta.env) ?? '').replace(/\/$/, '');
  const fetchImpl = input.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/v1/auth/session`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${local.token}`,
      },
    });
  } catch {
    if (initialContextStillCurrent()) clearErpHttpSession(storage);
    return null;
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    if (initialContextStillCurrent()) clearErpHttpSession(storage);
    return null;
  }
  // Diversos consumidores (seletor, Cadastros, Visualizador) revalidam em paralelo.
  // A resposta antiga não pode regravar o escopo capturado antes da troca de Empresa.
  const active = readErpHttpSession(storage);
  if (!active || active.token !== local.token) return null;
  const contextChanged = active.actorId !== local.actorId
    || active.groupId !== local.groupId
    || active.empresaId !== local.empresaId
    || active.scopeType !== local.scopeType;
  const data = body?.data || {};
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  const preferredActor = String((contextChanged ? active.actorId : input.preferredActorId) || active.actorId || '').trim();
  const preferredGroup = String((contextChanged ? active.groupId : input.preferredGroupId) || active.groupId || '').trim();
  const matchedSameGroup = profiles.find(
    (p) => String(p?.id) === preferredActor && String(p?.group_id) === preferredGroup,
  );
  const profile = matchedSameGroup
    || profiles.find((p) => String(p?.id) === preferredActor)
    || profiles.find((p) => p?.group_id && p?.id)
    || profiles[0];
  if (!profile?.id || !profile?.group_id) {
    clearErpHttpSession(storage);
    return null;
  }
  const role = String(profile.role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
  const fullName = typeof profile.full_name === 'string' && profile.full_name.trim()
    ? profile.full_name.trim()
    : null;
  const permissoes = profile.permissoes && typeof profile.permissoes === 'object' && !Array.isArray(profile.permissoes)
    ? profile.permissoes
    : {};
  const groupName = typeof profile.group_name === 'string' && profile.group_name.trim()
    ? profile.group_name.trim()
    : null;
  const empresas = Array.isArray(profile.empresas) ? profile.empresas : [];
  // Preferência de empresa só vale no mesmo grupo do perfil escolhido (nunca misturar tenant).
  const sameGroupAsPreference = String(profile.group_id) === preferredGroup;
  const rawPreferred = contextChanged ? active.empresaId : input.preferredEmpresaId !== undefined
    ? input.preferredEmpresaId
    : active.empresaId;
  let empresaId = resolveRefreshEmpresaId({
    profile,
    profiles,
    preferredEmpresaId: sameGroupAsPreference ? rawPreferred : null,
  });
  // Se o servidor listou empresas e a preferência/perfil não bate, usa a primeira autorizada.
  const groupView = !profile.empresa_id && role === 'admin' && active.scopeType === 'grupo';
  if (groupView) empresaId = null;
  if (!groupView && !empresaId && empresas.length > 0) {
    empresaId = String(empresas[0].id);
  }
  persistErpHttpSession({
    accessToken: active.token,
    groupId: String(profile.group_id),
    empresaId,
    actorId: String(profile.id),
    email: data.user?.email || active.email || undefined,
    role,
    fullName,
    groupName,
    empresas,
    profileEmpresaId: profile.empresa_id || null,
    scopeType: groupView ? 'grupo' : 'empresa',
    expiresAt: active.expiresAt,
    storage,
  });
  try {
    await ensureHttpTenantLocalMirror({
      groupId: String(profile.group_id),
      empresaId,
      groupName,
      empresas,
      perfilAcessoId: `http_perfil_${profile.id}`,
      permissoes,
      perfilNome: fullName || data.user?.email || active.email,
    });
  } catch {
    /* espelho best-effort */
  }
  return {
    token: active.token,
    groupId: String(profile.group_id),
    empresaId,
    actorId: String(profile.id),
    email: data.user?.email || active.email || null,
    role,
    fullName,
    groupName,
    empresas,
    profileEmpresaId: profile.empresa_id || null,
    scopeType: groupView ? 'grupo' : 'empresa',
    expiresAt: active.expiresAt,
    permissoes,
    profiles,
  };
}

/**
 * Resolve empresa no restore de sessão (fail-closed).
 * - Perfil com `empresa_id` explícito → exclusivo (ignora preferência local revogada).
 * - Perfil de Grupo (`empresa_id` null): só preserva preferência se UUID e houver
 *   evidência de autorização no mesmo grupo (outro perfil do grupo com essa empresa).
 * - Preferência incompatível → contexto autorizado do perfil ou null; nunca mistura.
 * @param {{
 *   profile: { group_id?: string, empresa_id?: string | null },
 *   profiles: Array<{ group_id?: string, empresa_id?: string | null }>,
 *   preferredEmpresaId?: string | null,
 * }} input
 * @returns {string | null}
 */
export function resolveRefreshEmpresaId(input) {
  const profileEmpresa = input?.profile?.empresa_id ? String(input.profile.empresa_id).trim() : '';
  const empresas = Array.isArray(input?.profile?.empresas) ? input.profile.empresas : [];
  const authorizedIds = new Set(
    empresas.map((e) => String(e?.id || '').trim()).filter((id) => isUuid(id)),
  );

  if (profileEmpresa) {
    if (!isUuid(profileEmpresa)) return null;
    // Se o servidor listou empresas, o vínculo explícito também precisa estar na lista.
    if (authorizedIds.size > 0 && !authorizedIds.has(profileEmpresa)) {
      return [...authorizedIds][0] || null;
    }
    return profileEmpresa;
  }

  const preferred = input?.preferredEmpresaId ? String(input.preferredEmpresaId).trim() : '';
  if (!preferred || !isUuid(preferred)) return null;

  if (authorizedIds.size > 0) {
    return authorizedIds.has(preferred) ? preferred : null;
  }

  const groupId = String(input?.profile?.group_id || '').trim();
  if (!groupId || !isUuid(groupId)) return null;

  const authorizedInGroup = (Array.isArray(input.profiles) ? input.profiles : []).some((p) => {
    if (String(p?.group_id || '') !== groupId) return false;
    const eid = p?.empresa_id ? String(p.empresa_id).trim() : '';
    return eid === preferred;
  });
  return authorizedInGroup ? preferred : null;
}
