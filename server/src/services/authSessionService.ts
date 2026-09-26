/**
 * Sessão browser (supabase_user): exchange e-mail/senha → Bearer + perfis tenant.
 * Usado pelo SPA HTTP; nunca registra senha/token.
 */
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AppConfig } from '../config/env.js';
import type { DbClient } from '../db/client.js';

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
};

export type AuthSessionResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; email: string };
  profiles: AuthSessionProfile[];
};

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

  let profiles: AuthSessionProfile[] = [];
  try {
    const result = await options.db.query<{
      id: string;
      group_id: string;
      empresa_id: string | null;
      role: string | null;
      full_name: string | null;
    }>(
      `SELECT p.id, p.group_id, p.role, p.full_name,
              COALESCE(
                p.empresa_id,
                (SELECT e.id FROM empresas e
                  WHERE e.group_id = p.group_id
                  ORDER BY e.id
                  LIMIT 1)
              ) AS empresa_id
       FROM profiles p
       WHERE p.auth_user_id = $1 AND p.ativo = true
       ORDER BY p.empresa_id NULLS LAST, p.id
       LIMIT 20`,
      [userId],
    );
    profiles = result.rows
      .filter((row) => UUID_RE.test(row.id) && UUID_RE.test(row.group_id))
      .map((row) => ({
        id: row.id,
        groupId: row.group_id,
        empresaId: row.empresa_id && UUID_RE.test(row.empresa_id) ? row.empresa_id : null,
        role: typeof row.role === 'string' && row.role.trim() ? row.role.trim() : 'user',
        fullName: typeof row.full_name === 'string' ? row.full_name : null,
      }));
  } catch {
    throw new AppError(503, 'PROFILE_UNAVAILABLE', 'User profile service unavailable');
  }

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
