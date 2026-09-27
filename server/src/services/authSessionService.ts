/**
 * Sessão browser (supabase_user): exchange e-mail/senha → Bearer + perfis tenant.
 * Usado pelo SPA HTTP; nunca registra senha/token.
 */
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AppConfig } from '../config/env.js';
import type { DbClient } from '../db/client.js';
import { permissionViewAllows } from '../db/rbacGuard.js';

const sessionGuardSchema = z.object({
  profile_id: z.string().uuid(),
  group_id: z.string().uuid(),
  empresa_id: z.string().uuid().nullable(),
  scope_type: z.enum(['group', 'company', 'grupo', 'empresa']).optional(),
  module: z.string().trim().min(1).max(80),
  section: z.union([z.string().max(200), z.array(z.string().min(1).max(80)).max(12)]).nullable().optional(),
  action: z.string().trim().min(1).max(80),
  // Existing Layout hints: bounded metadata only, never identity or authority.
  entity_name: z.string().trim().min(1).max(120).optional(),
  operation: z.string().trim().min(1).max(80).optional(),
  function_name: z.string().trim().min(1).max(120).optional(),
}).strict();

/** Advisory UI check only. Mutations still require the domain RBAC/RLS guards. */
export function resolveSessionEntityGuard(profiles: AuthSessionProfile[], payload: unknown): boolean {
  const parsed = sessionGuardSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid guard request');
  const guard = parsed.data;
  const profile = profiles.find(p => p.id === guard.profile_id && p.groupId === guard.group_id);
  if (!profile) return false;
  const groupView = guard.empresa_id === null;
  if (guard.scope_type && ['group', 'grupo'].includes(guard.scope_type) !== groupView) return false;
  if (groupView) {
    if (profile.empresaId !== null || profile.role !== 'admin') return false;
  } else if (!profile.empresas.some(e => e.id === guard.empresa_id)
    || (profile.empresaId !== null && profile.empresaId !== guard.empresa_id)) return false;
  return permissionViewAllows(profile.permissoes, guard.module, guard.section ?? null, guard.action);
}

const loginBodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuthSessionProfile = {
  id: string;
  groupId: string;
  empresaId: string | null;
  role: string;
  fullName: string | null;
  /** Árvore RBAC do perfil (fonte server-side; nunca inventada no browser). */
  permissoes: Record<string, unknown>;
  /** Nome do grupo (Cadastros) para o seletor SPA. */
  groupName: string | null;
  /**
   * Empresas autorizadas no grupo do perfil.
   * Perfil sem empresa_id explícito → todas Ativas do grupo; role não amplia tenant.
   * Perfil vinculado a uma empresa → somente essa (se Ativa).
   */
  empresas: Array<{
    id: string;
    group_id: string;
    razao_social: string;
    nome_fantasia: string | null;
    status: string;
  }>;
};

export type AuthSessionResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; email: string };
  profiles: AuthSessionProfile[];
};

type ProfileRow = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  role: string | null;
  full_name: string | null;
  permissoes: unknown;
  /** empresa_id bruto da coluna (antes do COALESCE de fallback). */
  empresa_id_raw: string | null;
  group_name: string | null;
};

type EmpresaRow = {
  id: string;
  group_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  status: string;
};

function mapProfileRows(rows: ProfileRow[]): AuthSessionProfile[] {
  return rows
    .filter((row) => UUID_RE.test(row.id) && UUID_RE.test(row.group_id))
    .map((row) => ({
      id: row.id,
      groupId: row.group_id,
      empresaId: row.empresa_id && UUID_RE.test(row.empresa_id) ? row.empresa_id : null,
      role: typeof row.role === 'string' && row.role.trim() ? row.role.trim() : 'user',
      fullName: typeof row.full_name === 'string' ? row.full_name : null,
      permissoes: row.permissoes && typeof row.permissoes === 'object' && !Array.isArray(row.permissoes)
        ? row.permissoes as Record<string, unknown>
        : {},
      groupName: typeof row.group_name === 'string' && row.group_name.trim()
        ? row.group_name.trim()
        : null,
      empresas: [],
    }));
}

async function loadEmpresasForProfile(
  db: Pick<DbClient, 'query'>,
  profile: AuthSessionProfile,
  empresaIdRaw: string | null,
): Promise<AuthSessionProfile['empresas']> {
  const lockedToEmpresa = Boolean(empresaIdRaw && UUID_RE.test(empresaIdRaw));
  // Role não amplia tenant; mesmo contrato do middleware.
  const listAll = !lockedToEmpresa;
  try {
    if (listAll) {
      const result = await db.query<EmpresaRow>(
        `SELECT id, group_id, razao_social, nome_fantasia, status
         FROM empresas
         WHERE group_id = $1 AND status = 'Ativa'
         ORDER BY COALESCE(nome_fantasia, razao_social) ASC`,
        [profile.groupId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        group_id: row.group_id,
        razao_social: row.razao_social,
        nome_fantasia: row.nome_fantasia,
        status: row.status,
      }));
    }
    const result = await db.query<EmpresaRow>(
      `SELECT id, group_id, razao_social, nome_fantasia, status
       FROM empresas
       WHERE group_id = $1 AND id = $2 AND status = 'Ativa'
       LIMIT 1`,
      [profile.groupId, empresaIdRaw],
    );
    return result.rows.map((row) => ({
      id: row.id,
      group_id: row.group_id,
      razao_social: row.razao_social,
      nome_fantasia: row.nome_fantasia,
      status: row.status,
    }));
  } catch {
    throw new AppError(503, 'PROFILE_UNAVAILABLE', 'User profile service unavailable');
  }
}

async function loadActiveProfiles(
  db: Pick<DbClient, 'query'>,
  authUserId: string,
): Promise<AuthSessionProfile[]> {
  try {
    const result = await db.query<ProfileRow>(
      `SELECT p.id, p.group_id, p.role, p.full_name, COALESCE(p.permissoes, '{}'::jsonb) AS permissoes,
              p.empresa_id AS empresa_id_raw,
              p.empresa_id AS empresa_id,
              g.nome_do_grupo AS group_name
       FROM profiles p
       LEFT JOIN groups g ON g.id = p.group_id
       WHERE p.auth_user_id = $1 AND p.ativo = true
       ORDER BY p.empresa_id NULLS LAST, p.id
       LIMIT 20`,
      [authUserId],
    );
    const mapped = mapProfileRows(result.rows);
    const enriched: AuthSessionProfile[] = [];
    for (let i = 0; i < mapped.length; i += 1) {
      const raw = result.rows.find((row) => row.id === mapped[i].id && row.group_id === mapped[i].groupId);
      const empresas = await loadEmpresasForProfile(db, mapped[i], raw?.empresa_id_raw ?? null);
      enriched.push({ ...mapped[i], empresas });
    }
    return enriched;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'PROFILE_UNAVAILABLE', 'User profile service unavailable');
  }
}

export async function createPasswordAuthSession(options: {
  config: AppConfig;
  db: Pick<DbClient, 'query'>;
  body: unknown;
  fetchImpl?: typeof fetch;
}): Promise<AuthSessionResult> {
  const parsed = loginBodySchema.safeParse(options.body);
  if (!parsed.success) {
    throw new AppError(422, 'AUTH_LOGIN_INVALID', 'E-mail e senha válidos são obrigatórios');
  }
  if (options.config.authMode !== 'supabase_user') {
    throw new AppError(503, 'AUTH_MODE_UNSUPPORTED', 'Login por senha exige auth.mode=supabase_user');
  }
  const supabaseUrl = options.config.supabaseUrl;
  const anonKey = options.config.supabaseAnonKey;
  if (!supabaseUrl || !anonKey) {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Identity service not configured');
  }

  const tokenUrl = new URL('auth/v1/token', `${supabaseUrl.replace(/\/+$/, '')}/`);
  tokenUrl.searchParams.set('grant_type', 'password');

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: globalThis.Response;
  try {
    response = await fetchImpl(tokenUrl, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: parsed.data.email,
        password: parsed.data.password,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Identity service unavailable');
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const goTrueMsg = typeof payload.error_description === 'string'
      ? payload.error_description
      : (typeof payload.msg === 'string' ? payload.msg : typeof payload.error === 'string' ? payload.error : '');
    const looksLikeBadKey = /api.?key|invalid jwt|unauthorized/i.test(goTrueMsg);
    if (looksLikeBadKey || response.status === 403) {
      throw new AppError(503, 'AUTH_CONFIG', 'Identity service configuration mismatch');
    }
    const status = response.status >= 500 ? 503 : 401;
    throw new AppError(
      status,
      status === 503 ? 'AUTH_UNAVAILABLE' : 'AUTH_INVALID_CREDENTIALS',
      status === 503 ? 'Identity service unavailable' : 'Credenciais inválidas',
    );
  }

  const accessToken = typeof payload.access_token === 'string' ? payload.access_token.trim() : '';
  const tokenType = typeof payload.token_type === 'string' ? payload.token_type : 'bearer';
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 0;
  const userObj = payload.user && typeof payload.user === 'object'
    ? payload.user as Record<string, unknown>
    : {};
  const userId = typeof userObj.id === 'string' ? userObj.id : '';
  const email = typeof userObj.email === 'string' ? userObj.email : parsed.data.email;
  if (!accessToken || !UUID_RE.test(userId)) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Credenciais inválidas');
  }

  const profiles = await loadActiveProfiles(options.db, userId);
  if (profiles.length === 0) {
    throw new AppError(403, 'AUTH_NO_ACTIVE_PROFILE', 'Usuário autenticado sem perfil ativo no ERP');
  }

  return {
    accessToken,
    tokenType,
    expiresIn,
    user: { id: userId, email },
    profiles,
  };
}

/**
 * Revalida Bearer no Supabase e devolve perfis+permissões do Postgres.
 * Usado no restore da SPA — não confia em role/permissoes do localStorage.
 */
export async function resolveBearerAuthSession(options: {
  config: AppConfig;
  db: Pick<DbClient, 'query'>;
  authorizationHeader: string | undefined;
  fetchImpl?: typeof fetch;
}): Promise<Omit<AuthSessionResult, 'expiresIn'> & { expiresIn: number | null }> {
  if (options.config.authMode !== 'supabase_user') {
    throw new AppError(503, 'AUTH_MODE_UNSUPPORTED', 'Sessão Bearer exige auth.mode=supabase_user');
  }
  const supabaseUrl = options.config.supabaseUrl;
  const anonKey = options.config.supabaseAnonKey;
  if (!supabaseUrl || !anonKey) {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Identity service not configured');
  }
  const bearer = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(String(options.authorizationHeader || '').trim());
  if (!bearer || bearer[1].length > 8192) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Authenticated user token required');
  }
  const userUrl = new URL('auth/v1/user', `${supabaseUrl.replace(/\/+$/, '')}/`);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: globalThis.Response;
  try {
    response = await fetchImpl(userUrl, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${bearer[1]}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Identity service unavailable');
  }
  let identity: Record<string, unknown> = {};
  try {
    identity = await response.json() as Record<string, unknown>;
  } catch {
    identity = {};
  }
  if (!response.ok) {
    throw new AppError(401, 'AUTH_INVALID', 'Invalid user token');
  }
  const userId = typeof identity.id === 'string' ? identity.id : '';
  const email = typeof identity.email === 'string' ? identity.email : '';
  if (!UUID_RE.test(userId)) {
    throw new AppError(401, 'AUTH_INVALID', 'Invalid user token');
  }
  const profiles = await loadActiveProfiles(options.db, userId);
  if (profiles.length === 0) {
    throw new AppError(403, 'AUTH_NO_ACTIVE_PROFILE', 'Usuário autenticado sem perfil ativo no ERP');
  }
  return {
    accessToken: bearer[1],
    tokenType: 'bearer',
    expiresIn: null,
    user: { id: userId, email },
    profiles,
  };
}
