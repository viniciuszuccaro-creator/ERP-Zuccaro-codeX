import { AppError } from '../api/errors.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { CondicaoPagamentoRepository, CondicaoPagamentoScope } from '../repositories/inMemoryCondicaoPagamentoRepository.js';
import {
  condicaoPagamentoAuditSnapshot,
  condicaoPagamentoCreateSchema,
  condicaoPagamentoEmpresaAuditSnapshot,
  condicaoPagamentoParcelasSchema,
  condicaoPagamentoUpdateSchema,
  publicCondicaoPagamento,
  type CondicaoPagamento,
} from '../repositories/condicaoPagamentoTypes.js';
import {
  escolherCondicaoResolvida,
  snapshotCondicaoParaDocumento,
  type CondicaoResolucaoRow,
} from './comercialCondicaoResolucaoPolicy.js';

export class CondicaoPagamentoService {
  constructor(
    private readonly repo: CondicaoPagamentoRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbac: RbacGuard,
    /** Opcional: sem ClienteRepo a resolução ClienteEmpresa→padrão não roda (fail-closed). */
    private readonly clientes: Pick<ClienteRepository, 'getEmpresaLinkById'> | null = null,
  ) {}

  async list(ctx: RequestContext, options: { ativo?: boolean; ehPadrao?: boolean; search?: string; limit?: number; offset?: number } = {}) {
    await this.prepare(ctx, 'visualizar');
    const limit = Math.min(200, Math.max(1, Math.trunc(options.limit ?? 50)));
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const page = await this.repo.listPage({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ativo: options.ativo ?? true,
      ehPadrao: options.ehPadrao,
      search: options.search,
      limit,
      offset,
    });
    return {
      data: page.rows.map((r) => publicCondicaoPagamento(r, ctx.empresaId)),
      meta: { limit, offset, total: page.total, hasMore: offset + page.rows.length < page.total },
    };
  }

  async get(ctx: RequestContext, id: string) {
    await this.prepare(ctx, 'visualizar', id);
    const row = await this.active(ctx, id);
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  /**
   * Resolução fail-closed para venda/simulação (sem RBAC Cadastros — caller already asserted Comercial).
   * específica ClienteEmpresa → padrão Empresa → null.
   */
  async resolveForClienteEmpresa(ctx: RequestContext, clienteEmpresaId: string) {
    await this.assertTenant(ctx);
    if (!/^[0-9a-f]{8}-/i.test(clienteEmpresaId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid clienteEmpresaId');
    }
    if (!this.clientes) {
      return { fonte: 'nenhuma' as const, condicao: null, snapshot: null };
    }

    const link = await this.clientes.getEmpresaLinkById(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      clienteEmpresaId,
    );
    if (!link || !link.ativo) {
      throw new AppError(404, 'CLIENTE_EMPRESA_NOT_FOUND', 'ClienteEmpresa not found');
    }
    if (link.bloqueado || !link.habilitado_operacao) {
      throw new AppError(422, 'CLIENTE_EMPRESA_INDISPONIVEL', 'ClienteEmpresa unavailable');
    }

    let preferida: CondicaoResolucaoRow | null = null;
    if (link.condicao_pagamento_id) {
      preferida = await this.toResolucaoRow(ctx, link.condicao_pagamento_id);
    }
    const padraoEmpresa = await this.findPadraoEmpresa(ctx);
    const resolved = escolherCondicaoResolvida({ preferida, padraoEmpresa });
    return {
      ...resolved,
      snapshot: snapshotCondicaoParaDocumento(resolved.condicao),
    };
  }

  /** HTTP wrapper: exige Cadastros.visualizar e devolve resolução pública. */
  async resolveForClienteEmpresaHttp(ctx: RequestContext, clienteEmpresaId: string) {
    await this.prepare(ctx, 'visualizar');
    return this.resolveForClienteEmpresa(ctx, clienteEmpresaId);
  }

  /**
   * Leitura autorizada no escopo tenant para venda/simulação (sem Cadastros RBAC).
   * Cross-tenant / inativa → 404 genérico.
   */
  async getAuthorizedInScope(ctx: RequestContext, id: string) {
    await this.assertTenant(ctx);
    if (!/^[0-9a-f]{8}-/i.test(id)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid condicaoPagamentoId');
    }
    const row = await this.repo.get(this.scope(ctx), id);
    if (!row || !row.ativo) this.notFound();
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  async create(ctx: RequestContext, payload: unknown) {
    await this.prepare(ctx, 'criar');
    const parsed = condicaoPagamentoCreateSchema.safeParse(payload);
    if (!parsed.success) this.invalid(parsed.error.flatten());
    const row = await this.repo.withTransaction(async (tx) => {
      const created = await this.repo.create(
        { groupId: ctx.groupId, empresaId: ctx.empresaId! },
        parsed.data,
        ctx.actorId,
        tx,
      );
      await this.auditRow(ctx, 'create', null, created, tx);
      return created;
    });
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    await this.prepare(ctx, 'editar', id);
    const parsed = condicaoPagamentoUpdateSchema.safeParse(payload);
    if (!parsed.success) this.invalid(parsed.error.flatten());
    const row = await this.repo.withTransaction(async (tx) => {
      const before = await this.active(ctx, id, tx);
      const after = await this.repo.update(this.scope(ctx), id, parsed.data, ctx.actorId, tx);
      if (!after) this.notFound();
      await this.auditRow(ctx, 'update', before, after, tx);
      return after;
    });
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  async replaceParcelas(ctx: RequestContext, id: string, payload: unknown) {
    await this.prepare(ctx, 'gerenciar-parcelas', id);
    const parsed = condicaoPagamentoParcelasSchema.safeParse(payload);
    if (!parsed.success) this.invalid(parsed.error.flatten());
    const row = await this.repo.withTransaction(async (tx) => {
      const before = await this.active(ctx, id, tx);
      const after = await this.repo.replaceParcelas(this.scope(ctx), id, parsed.data, ctx.actorId, tx);
      if (!after) this.notFound();
      await this.auditRow(ctx, 'update', before, after, tx);
      return after;
    });
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  async softDelete(ctx: RequestContext, id: string) {
    await this.prepare(ctx, 'inativar', id);
    const row = await this.repo.withTransaction(async (tx) => {
      const before = await this.active(ctx, id, tx);
      if (await this.repo.hasActivePadrao(ctx.groupId, id, tx) || await this.repo.countActiveClienteEmpresaRefs(ctx.groupId, id, tx)) {
        throw new AppError(409, 'CONDICAO_PAGAMENTO_IN_USE', 'Condition is in use');
      }
      const after = await this.repo.softDelete(this.scope(ctx), id, ctx.actorId, tx);
      if (!after) this.notFound();
      await this.auditRow(ctx, 'inactivate', before, after, tx);
      return after;
    });
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  async restore(ctx: RequestContext, id: string) {
    await this.prepare(ctx, 'restaurar', id);
    const row = await this.repo.withTransaction(async (tx) => {
      const before = await this.repo.get({ groupId: ctx.groupId }, id, tx);
      if (!before || before.ativo) this.notFound();
      const after = await this.repo.restore({ groupId: ctx.groupId }, id, ctx.actorId, tx);
      if (!after) this.notFound();
      await this.auditRow(ctx, 'restore', before, after, tx);
      return after;
    });
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  async linkEmpresa(ctx: RequestContext, id: string, empresaId: string) {
    await this.prepare(ctx, 'vincular-empresa', id);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    return this.companyMutation(ctx, id, empresaId, 'link', (tx) => this.repo.linkEmpresa(this.scope(ctx), id, empresaId, ctx.actorId, tx));
  }

  async unlinkEmpresa(ctx: RequestContext, id: string, empresaId: string) {
    await this.prepare(ctx, 'vincular-empresa', id);
    return this.companyMutation(ctx, id, empresaId, 'inactivate', (tx) => this.repo.unlinkEmpresa(this.scope(ctx), id, empresaId, ctx.actorId, tx));
  }

  async restoreEmpresa(ctx: RequestContext, id: string, empresaId: string) {
    await this.prepare(ctx, 'vincular-empresa', id);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    return this.companyMutation(ctx, id, empresaId, 'restore', (tx) => this.repo.restoreEmpresa(this.scope(ctx), id, empresaId, ctx.actorId, tx));
  }

  async setPadrao(ctx: RequestContext, id: string) {
    await this.prepare(ctx, 'definir-padrao', id);
    const row = await this.repo.withTransaction(async (tx) => {
      const before = await this.active(ctx, id, tx);
      const after = await this.repo.setPadrao({ groupId: ctx.groupId, empresaId: ctx.empresaId! }, id, ctx.actorId, tx);
      if (!after) this.notFound();
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'CondicaoPagamentoEmpresa',
        entityId: id,
        action: 'update',
        beforeData: sanitizeAuditSnapshot(condicaoPagamentoAuditSnapshot(before)),
        afterData: sanitizeAuditSnapshot(condicaoPagamentoAuditSnapshot(after)),
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      }, tx);
      return after;
    });
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  private async findPadraoEmpresa(ctx: RequestContext): Promise<CondicaoResolucaoRow | null> {
    const page = await this.repo.listPage({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ativo: true,
      ehPadrao: true,
      limit: 1,
      offset: 0,
    });
    const row = page.rows[0];
    if (!row?.ativo) return null;
    return this.asResolucaoRow(row);
  }

  private async toResolucaoRow(ctx: RequestContext, id: string): Promise<CondicaoResolucaoRow | null> {
    const row = await this.repo.get(this.scope(ctx), id);
    if (!row?.ativo) return null;
    return this.asResolucaoRow(row);
  }

  private asResolucaoRow(row: CondicaoPagamento): CondicaoResolucaoRow {
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      ativo: row.ativo,
      parcelas: row.parcelas.map((p) => ({
        ordem: p.ordem,
        dias: p.dias,
        percentual: String(p.percentual),
        ativo: p.ativo,
      })),
    };
  }

  private async companyMutation(
    ctx: RequestContext,
    id: string,
    empresaId: string,
    action: AuditAction,
    mutate: (tx?: DbQueryExecutor) => Promise<CondicaoPagamento | null>,
  ) {
    const row = await this.repo.withTransaction(async (tx) => {
      const before = await this.active(ctx, id, tx);
      const after = await mutate(tx);
      if (!after) this.notFound();
      const old = before.empresas.find((e) => e.empresa_id === empresaId);
      const link = after.empresas.find((e) => e.empresa_id === empresaId);
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'CondicaoPagamentoEmpresa',
        entityId: id,
        action,
        beforeData: old ? sanitizeAuditSnapshot(condicaoPagamentoEmpresaAuditSnapshot(old)) : undefined,
        afterData: link ? sanitizeAuditSnapshot(condicaoPagamentoEmpresaAuditSnapshot(link)) : undefined,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      }, tx);
      return after;
    });
    return publicCondicaoPagamento(row, ctx.empresaId);
  }

  private async prepare(ctx: RequestContext, action: string, id?: string) {
    await this.assertTenant(ctx);
    await this.rbac.assertAllowed(ctx, 'Cadastros', 'condicao_pagamento', action as any);
    if (id && !/^[0-9a-f]{8}-/i.test(id)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid condicaoPagamentoId');
    }
  }

  private async assertTenant(ctx: RequestContext) {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
  }

  private scope(ctx: RequestContext): CondicaoPagamentoScope {
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }

  private async active(ctx: RequestContext, id: string, tx?: DbQueryExecutor) {
    const row = await this.repo.get(this.scope(ctx), id, tx);
    if (!row || !row.ativo) this.notFound();
    return row;
  }

  private async auditRow(
    ctx: RequestContext,
    action: AuditAction,
    before: CondicaoPagamento | null,
    after: CondicaoPagamento,
    tx?: DbQueryExecutor,
  ) {
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'CondicaoPagamento',
      entityId: after.id,
      action,
      beforeData: before ? sanitizeAuditSnapshot(condicaoPagamentoAuditSnapshot(before)) : undefined,
      afterData: sanitizeAuditSnapshot(condicaoPagamentoAuditSnapshot(after)),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, tx);
  }

  private invalid(details: unknown): never {
    throw new AppError(422, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  private notFound(): never {
    throw new AppError(404, 'CONDICAO_PAGAMENTO_NOT_FOUND', 'CondicaoPagamento not found');
  }
}
