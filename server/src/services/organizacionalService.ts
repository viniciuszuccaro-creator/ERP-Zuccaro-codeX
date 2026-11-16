import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import { PostgresEmpresaRepository } from '../repositories/postgresEmpresaRepository.js';
import { isValidCnpj } from '../db/documentoValidators.js';
import { reserveEntityCodigo } from '../repositories/reserveEntityCodigo.js';

type Kind = 'GrupoEmpresarial' | 'Empresa';
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(180).refine(v => !/[<>\u0000-\u001f]/.test(v));
const nullableText = z.string().trim().max(1000).refine(v => !/[<>\u0000-\u0008]/.test(v)).nullable();
const document = z.string().regex(/^\d{14}$/).refine(isValidCnpj);
const fields = {
  GrupoEmpresarial: { nome_do_grupo: text, razao_social_grupo: text.nullable(), cnpj_grupo: document.nullable(), observacoes: nullableText },
  Empresa: { razao_social: text, nome_fantasia: text.nullable(), cnpj: document },
};
const tables = { GrupoEmpresarial: 'groups', Empresa: 'empresas' } as const;
const version = (row: object) => createHash('sha256').update(JSON.stringify(row)).digest('hex');

/** Existing organizational masters only: no creation, status, tenant reassignment or fiscal configuration. */
export class OrganizacionalService {
  private readonly empresas: PostgresEmpresaRepository;
  constructor(private readonly db: DbClient, private readonly audit: AuditRepository,
    private readonly rbac: RbacGuard, private readonly tenants: TenantGuard) {
    this.empresas = new PostgresEmpresaRepository(db);
  }

  private async authorize(ctx: RequestContext, kind: Kind, action: 'visualizar' | 'editar', q: DbQueryExecutor) {
    if (!uuid.safeParse(ctx.groupId).success || !uuid.safeParse(ctx.actorId).success) {
      throw new AppError(403, 'ACTOR_SCOPE_DENIED', 'Authenticated tenant profile required');
    }
    await this.rbac.assertAllowed(ctx, 'Cadastros', 'organizacional', action, { executor: q, allowGlobalWildcard: false });
    await this.tenants.assertEmpresaInGroup(ctx.groupId, ctx.empresaId, q);
    if (kind === 'GrupoEmpresarial' && action === 'editar' && ctx.empresaId) {
      throw new AppError(403, 'GROUP_SCOPE_REQUIRED', 'Select group context to edit its master');
    }
  }

  private async read(ctx: RequestContext, kind: Kind, id: string, q: DbQueryExecutor, lock = false): Promise<Record<string, unknown>> {
    if (!uuid.safeParse(id).success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid master ID');
    let row: Record<string, unknown> | undefined;
    if (kind === 'Empresa') {
      if (ctx.empresaId && ctx.empresaId !== id) throw new AppError(403, 'COMPANY_SCOPE_DENIED', 'Company outside active context');
      row = await this.empresas.getById({ groupId: ctx.groupId }, id, q, lock) as Record<string, unknown> | undefined;
    } else {
      const result = await q.query(`SELECT id,(to_jsonb(groups)->>'codigo') AS codigo,nome_do_grupo,razao_social_grupo,cnpj_grupo,status,observacoes,created_at,updated_at
        FROM groups WHERE id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`, [ctx.groupId, id]);
      if (result.rows[0]) {
        row = { ...result.rows[0], created_at: new Date(result.rows[0].created_at).toISOString(), updated_at: new Date(result.rows[0].updated_at).toISOString() };
      }
    }
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Master not found in tenant scope');
    return row;
  }

  private async dto(kind: Kind, row: Record<string, unknown>, ctx: RequestContext, q: DbQueryExecutor) {
    const links = kind === 'GrupoEmpresarial' ? { empresas_ids: ctx.empresaId ? [ctx.empresaId]
      : (await this.empresas.list({ groupId: ctx.groupId }, q)).map(e => e.id) } : {};
    return { ...row, group_id: kind === 'GrupoEmpresarial' ? row.id : row.group_id,
      ...links, version: version(row), supported_fields: Object.keys(fields[kind]) };
  }

  async get(ctx: RequestContext, kind: Kind, id: string) {
    ctx = Object.freeze({ ...ctx });
    return this.db.withTransaction(async q => {
      await this.authorize(ctx, kind, 'visualizar', q);
      const row = await this.read(ctx, kind, id, q);
      await this.authorize(ctx, kind, 'visualizar', q);
      return this.dto(kind, row, ctx, q);
    });
  }

  async list(ctx: RequestContext, kind: Kind) {
    ctx = Object.freeze({ ...ctx });
    return this.db.withTransaction(async q => {
      await this.authorize(ctx, kind, 'visualizar', q);
      const records = kind === 'GrupoEmpresarial' ? [await this.read(ctx, kind, ctx.groupId, q)]
        : ctx.empresaId ? [await this.read(ctx, kind, ctx.empresaId, q)]
        : (await this.empresas.list({ groupId: ctx.groupId }, q)).map(r => ({ ...r }));
      const rows = [];
      for (const row of records) rows.push(await this.dto(kind, row, ctx, q));
      await this.authorize(ctx, kind, 'visualizar', q);
      return rows;
    });
  }

  /** Maintenance only, no HTTP route: gated assignment to existing masters, never renumber. */
  async assignMissingCodigo(ctx: RequestContext, kind: Kind, id: string, expectedVersion: string) {
    ctx = Object.freeze({ ...ctx });
    return this.db.withTransaction(async q => {
      await this.authorize(ctx, kind, 'editar', q);
      const before = await this.read(ctx, kind, id, q, true);
      if (before.codigo) return this.dto(kind, before, ctx, q);
      if (version(before) !== expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'Reopen master before assigning code');
      const codigo = await reserveEntityCodigo({ db: q, groupId: ctx.groupId, entityName: kind,
        table: tables[kind], width: 3 });
      const constraint = kind === 'GrupoEmpresarial' ? 'id' : 'group_id';
      const saved = await q.query(`UPDATE ${tables[kind]} SET codigo=$1,updated_at=clock_timestamp()
        WHERE id=$2 AND ${constraint}=$3 AND codigo IS NULL RETURNING id`, [codigo, id, ctx.groupId]);
      if (saved.rows.length !== 1) throw new AppError(409, 'VERSION_CONFLICT', 'Code assignment rejected');
      const after = await this.read(ctx, kind, id, q);
      await this.audit.append({ groupId: ctx.groupId, empresaId: kind === 'Empresa' ? id : null,
        actorId: ctx.actorId, entity: kind, entityId: id, action: 'update', beforeData: before,
        afterData: after, requestId: ctx.requestId }, q);
      await this.authorize(ctx, kind, 'editar', q);
      return this.dto(kind, after, ctx, q);
    });
  }

  /** Internal gated reversal: only the exact assignment postimage, never a later manual edit. */
  async reverseAssignedCodigo(ctx: RequestContext, kind: Kind, id: string, expectedVersion: string, expectedCodigo: string) {
    ctx = Object.freeze({ ...ctx });
    return this.db.withTransaction(async q => {
      await this.authorize(ctx, kind, 'editar', q);
      const before = await this.read(ctx, kind, id, q, true);
      if (!expectedCodigo || before.codigo !== expectedCodigo || version(before) !== expectedVersion) {
        throw new AppError(409, 'VERSION_CONFLICT', 'Code reversal postimage changed');
      }
      const constraint = kind === 'GrupoEmpresarial' ? 'id' : 'group_id';
      const result = await q.query(`UPDATE ${tables[kind]} SET codigo=NULL,updated_at=clock_timestamp()
        WHERE id=$1 AND ${constraint}=$2 AND codigo=$3 RETURNING id`, [id, ctx.groupId, expectedCodigo]);
      if (result.rows.length !== 1) throw new AppError(409, 'VERSION_CONFLICT', 'Code reversal rejected');
      const after = await this.read(ctx, kind, id, q);
      await this.audit.append({ groupId: ctx.groupId, empresaId: kind === 'Empresa' ? id : null,
        actorId: ctx.actorId, entity: kind, entityId: id, action: 'update', beforeData: before,
        afterData: after, requestId: ctx.requestId }, q);
      await this.authorize(ctx, kind, 'editar', q);
      return this.dto(kind, after, ctx, q);
    });
  }

  async update(ctx: RequestContext, kind: Kind, id: string, payload: unknown) {
    ctx = Object.freeze({ ...ctx });
    const schema = z.object({ expected_version: z.string().regex(/^[a-f0-9]{64}$/), ...fields[kind] }).partial()
      .required({ expected_version: true }).strict();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Unsupported or invalid organizational fields');
    const { expected_version, ...patch } = parsed.data;
    return this.db.withTransaction(async q => {
      await this.authorize(ctx, kind, 'editar', q);
      const before = await this.read(ctx, kind, id, q, true);
      if (expected_version !== version(before)) throw new AppError(409, 'VERSION_CONFLICT', 'Master changed; reopen before saving');
      const keys = Object.keys(patch).filter(k => Reflect.get(patch, k) !== before[k]);
      if (!keys.length) {
        await this.authorize(ctx, kind, 'editar', q);
        return this.dto(kind, before, ctx, q);
      }
      if (kind === 'Empresa' && keys.includes('cnpj')) {
        await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`empresa:${ctx.groupId}:${Reflect.get(patch, 'cnpj')}`]);
        const duplicate = await q.query('SELECT id FROM empresas WHERE group_id=$1 AND cnpj=$2 AND id<>$3 LIMIT 1', [ctx.groupId, Reflect.get(patch, 'cnpj'), id]);
        if (duplicate.rows.length) throw new AppError(409, 'DOCUMENT_CONFLICT', 'Company document already exists');
      }
      const params: unknown[] = keys.map(k => Reflect.get(patch, k));
      params.push(id, ctx.groupId);
      const constraint = kind === 'GrupoEmpresarial' ? 'id' : 'group_id';
      // Keys originate exclusively in the strict schema, never from arbitrary request identifiers.
      const result = await q.query(`UPDATE ${tables[kind]} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')},updated_at=clock_timestamp()
        WHERE id=$${keys.length + 1} AND ${constraint}=$${keys.length + 2} RETURNING id`, params);
      if (!result.rows.length) throw new AppError(409, 'VERSION_CONFLICT', 'Master update rejected');
      const after = await this.read(ctx, kind, id, q);
      await this.audit.append({ groupId: ctx.groupId, empresaId: kind === 'Empresa' ? id : null,
        actorId: ctx.actorId, actorEmail: ctx.actorEmail, entity: kind, entityId: id, action: 'update',
        beforeData: before, afterData: after, requestId: ctx.requestId, ipAddress: ctx.ipAddress }, q);
      await this.authorize(ctx, kind, 'editar', q);
      return this.dto(kind, after, ctx, q);
    });
  }
}
