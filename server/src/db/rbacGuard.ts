import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { DbClient } from './client.js';

export type RbacAction =
  | 'visualizar'
  | 'criar'
  | 'editar'
  | 'inativar'
  | 'restaurar'
  | 'importar'
  | 'exportar';

export type PermissionTree = Record<string, unknown>;

export interface RbacGuard {
  assertAllowed(
    ctx: RequestContext,
    moduleName: string,
    section: string,
    action: RbacAction,
  ): Promise<void>;
}

function actionListAllows(value: unknown, action: RbacAction): boolean {
  return Array.isArray(value)
    && value.some((item) => String(item).trim().toLowerCase() === action);
}

function nodeAllows(node: unknown, action: RbacAction): boolean {
  if (actionListAllows(node, action)) return true;
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  return Object.values(node as Record<string, unknown>)
    .some((value) => nodeAllows(value, action));
}

/**
 * Adaptador server-side do contrato canônico do entityGuard:
 * { Cadastros: { cliente: ['visualizar', 'criar', ...] } }.
 */
export function permissionTreeAllows(
  permissions: PermissionTree,
  moduleName: string,
  section: string,
  action: RbacAction,
): boolean {
  if (nodeAllows(permissions['*'], action)) return true;
  const moduleNode = permissions[moduleName];
  if (!moduleNode || typeof moduleNode !== 'object' || Array.isArray(moduleNode)) return false;
  return nodeAllows((moduleNode as Record<string, unknown>)[section], action);
}

function denied(): never {
  throw new AppError(403, 'PERMISSION_DENIED', 'Permission denied');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PostgresRbacGuard implements RbacGuard {
  constructor(private readonly db: DbClient) {}

  async assertAllowed(
    ctx: RequestContext,
    moduleName: string,
    section: string,
    action: RbacAction,
  ): Promise<void> {
    if (!ctx.actorId || !UUID_RE.test(ctx.actorId)) denied();

    const result = await this.db.query<{ permissoes: PermissionTree }>(
      `SELECT permissoes
       FROM profiles
       WHERE id = $1
         AND ativo = true
         AND group_id = $2
         AND (
           ($3::uuid IS NULL AND empresa_id IS NULL)
           OR ($3::uuid IS NOT NULL AND (empresa_id IS NULL OR empresa_id = $3))
         )
       LIMIT 1`,
      [ctx.actorId, ctx.groupId, ctx.empresaId ?? null],
    );
    const permissions = result.rows[0]?.permissoes;
    if (!permissions || !permissionTreeAllows(permissions, moduleName, section, action)) denied();
  }
}

type InMemoryProfile = {
  actorId: string;
  groupId: string;
  empresaId?: string | null;
  permissions: PermissionTree;
  ativo?: boolean;
};

export class InMemoryRbacGuard implements RbacGuard {
  private readonly profiles = new Map<string, InMemoryProfile>();

  link(profile: InMemoryProfile) {
    this.profiles.set(profile.actorId, { ...profile });
  }

  async assertAllowed(
    ctx: RequestContext,
    moduleName: string,
    section: string,
    action: RbacAction,
  ): Promise<void> {
    if (!ctx.actorId) denied();
    const profile = this.profiles.get(ctx.actorId);
    if (!profile || profile.ativo === false || profile.groupId !== ctx.groupId) denied();

    const empresaAllowed = ctx.empresaId
      ? profile.empresaId == null || profile.empresaId === ctx.empresaId
      : profile.empresaId == null;
    if (!empresaAllowed) denied();
    if (!permissionTreeAllows(profile.permissions, moduleName, section, action)) denied();
  }
}
