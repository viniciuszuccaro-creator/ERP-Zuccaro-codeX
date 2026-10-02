import { AppError } from '../api/errors.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import {
  devolucaoSchema,
  entregaCreateSchema,
  entregaStatusToLabel,
  parseEntregaStatusLabel,
  registroFinalSchema,
  reservedEstoquePort,
  reservedPedidoPort,
  romaneioCreateSchema,
  separacaoConcluirSchema,
  sortedEntregasKey,
  type DevolucaoInput,
  type Entrega,
  type EntregaCreate,
  type EntregaStatus,
  type ExpedicaoEstoquePort,
  type ExpedicaoPedidoSideEffectPort,
  type ExpedicaoRepository,
  type ExpedicaoScope,
  type RegistroFinal,
  type Romaneio,
  type RomaneioCreate,
  type Separacao,
  type SeparacaoConcluir,
} from '../repositories/expedicaoTypes.js';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_TRANSITIONS: Record<EntregaStatus, EntregaStatus[]> = {
  AGUARDANDO_SEPARACAO: ['EM_SEPARACAO', 'PRONTO_EXPEDIR', 'CANCELADA'],
  EM_SEPARACAO: ['PRONTO_EXPEDIR', 'AGUARDANDO_SEPARACAO', 'CANCELADA'],
  PRONTO_EXPEDIR: ['EM_ROMANEIO', 'SAIU_ENTREGA', 'CANCELADA'],
  EM_ROMANEIO: ['SAIU_ENTREGA', 'PRONTO_EXPEDIR', 'CANCELADA'],
  SAIU_ENTREGA: ['ENTREGUE', 'ENTREGUE_PARCIAL', 'FRUSTRADA', 'CANCELADA'],
  ENTREGUE_PARCIAL: ['ENTREGUE', 'ENTREGUE_PARCIAL', 'FRUSTRADA', 'DEVOLVIDA'],
  ENTREGUE: ['DEVOLVIDA'],
  FRUSTRADA: ['SAIU_ENTREGA', 'DEVOLVIDA', 'CANCELADA'],
  DEVOLVIDA: [],
  CANCELADA: [],
};

function rbacForStatus(status: EntregaStatus): RbacAction {
  if (status === 'CANCELADA') return 'cancelar';
  if (status === 'ENTREGUE' || status === 'ENTREGUE_PARCIAL') return 'entregar';
  if (status === 'FRUSTRADA' || status === 'DEVOLVIDA') return 'ocorrencia';
  if (status === 'SAIU_ENTREGA' || status === 'EM_ROMANEIO') return 'expedir';
  if (status === 'PRONTO_EXPEDIR' || status === 'EM_SEPARACAO') return 'conferir';
  return 'editar';
}

export function entregaAuditSnapshot(row: Entrega) {
  return sanitizeAuditSnapshot({
    id: row.id,
    group_id: row.group_id,
    empresa_id: row.empresa_id,
    numero: row.numero,
    status: row.status,
    status_label: row.status_label,
    pedido_id: row.pedido_id,
    romaneio_id: row.romaneio_id,
    tipo_frete: row.tipo_frete,
    quantidade_total: row.quantidade_total,
    quantidade_itens: row.itens.length,
    ativo: row.ativo,
  });
}

export function romaneioAuditSnapshot(row: Romaneio) {
  return sanitizeAuditSnapshot({
    id: row.id,
    group_id: row.group_id,
    empresa_id: row.empresa_id,
    numero: row.numero,
    status: row.status,
    quantidade_entregas: row.quantidade_entregas,
    entregas_key: row.entregas_key,
    ativo: row.ativo,
  });
}

function hasProva(comprovante: Record<string, unknown> = {}, tipoFrete = 'ENTREGA') {
  const nome = String(comprovante.nome_recebedor || '').trim();
  if (!nome) return false;
  if (String(tipoFrete).toUpperCase().includes('RETIR')) return true;
  return Boolean(
    String(comprovante.foto_comprovante || '').trim()
    || String(comprovante.assinatura_digital || '').trim()
    || String(comprovante.documento_recebedor || '').trim(),
  );
}

/** Shape SPA-compatible for entity facade. */
export function toSpaEntrega(row: Entrega) {
  return {
    ...row,
    status: row.status_label,
    status_code: row.status,
    numero_pedido: row.pedido_numero,
    group_id: row.group_id,
    grupo_id: row.group_id,
    empresa_id: row.empresa_id,
    itens: row.itens.map((item) => ({
      ...item,
      quantidade: item.quantidade_pedida,
      quantidade_pedida: Number(item.quantidade_pedida),
      quantidade_separada: Number(item.quantidade_separada),
      unidade: item.unidade_sigla,
      unidade_medida: item.unidade_sigla,
    })),
    itens_revenda: row.itens.map((item) => ({
      ...item,
      quantidade: Number(item.quantidade_pedida),
      quantidade_pedida: Number(item.quantidade_pedida),
      unidade: item.unidade_sigla,
    })),
  };
}

export class ExpedicaoService {
  constructor(
    private readonly repo: ExpedicaoRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbac: RbacGuard,
    private readonly pedidoPort: ExpedicaoPedidoSideEffectPort = reservedPedidoPort,
    private readonly estoquePort: ExpedicaoEstoquePort = reservedEstoquePort,
  ) {}

  async listEntregas(ctx: RequestContext, options: {
    limit?: number; offset?: number; search?: string; status?: string; pedidoId?: string; cidade?: string; clienteId?: string;
  } = {}) {
    const scope = await this.prepare(ctx, 'visualizar', 'entrega');
    const status = options.status ? (parseEntregaStatusLabel(options.status) || undefined) : undefined;
    if (options.status && !status && options.status !== 'todos') {
      throw new AppError(422, 'ENTREGA_STATUS_INVALIDO', 'Invalid entrega status filter');
    }
    const page = await this.repo.listEntregas(scope, options.limit, options.offset, undefined, {
      search: options.search,
      status,
      pedidoId: options.pedidoId,
      cidade: options.cidade,
      clienteId: options.clienteId,
    });
    return {
      data: page.rows.map(toSpaEntrega),
      meta: {
        limit: Math.min(200, Math.max(1, Math.trunc(options.limit ?? 50))),
        offset: Math.max(0, Math.trunc(options.offset ?? 0)),
        total: page.total,
        hasMore: Math.max(0, Math.trunc(options.offset ?? 0)) + page.rows.length < page.total,
      },
    };
  }

  async getEntrega(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'visualizar', 'entrega');
    this.assertId(id, 'entregaId');
    const row = await this.repo.getEntrega(scope, id);
    if (!row) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
    return toSpaEntrega(row);
  }

  async createEntrega(ctx: RequestContext, payload: unknown) {
    const scope = await this.prepare(ctx, 'criar', 'entrega');
    const data = this.parseCreate(payload);
    return this.repo.withTransaction(async (executor) => {
      if (data.pedido_id) {
        const existing = await this.repo.getEntregaByPedido(scope, data.pedido_id, executor);
        if (existing) {
          await this.auditRow(ctx, 'Entrega', 'create', null, existing, executor);
          return toSpaEntrega(existing);
        }
      }
      if (data.idempotency_key) {
        const byIdem = await this.repo.getEntregaByIdempotency(scope, data.idempotency_key, executor);
        if (byIdem) return toSpaEntrega(byIdem);
      }
      const created = await this.repo.createEntrega(scope, data, ctx.actorId!, executor);
      await this.auditRow(ctx, 'Entrega', 'create', null, created, executor);
      return toSpaEntrega(created);
    });
  }

  async concluirSeparacao(ctx: RequestContext, entregaId: string, payload: unknown) {
    const scope = await this.prepare(ctx, 'conferir', 'separacao');
    this.assertId(entregaId, 'entregaId');
    const parsed = separacaoConcluirSchema.safeParse(payload);
    if (!parsed.success) this.validation(parsed.error.flatten());
    const data = parsed.data as SeparacaoConcluir;

    return this.repo.withTransaction(async (executor) => {
      const before = await this.repo.getEntrega(scope, entregaId, executor);
      if (!before) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
      if (data.idempotency_key) {
        const existingSep = await this.repo.getSeparacaoByEntrega(scope, entregaId, 'conferencia', executor);
        if (existingSep?.idempotency_key === data.idempotency_key) {
          return { entrega: toSpaEntrega(before), separacao: existingSep, reused: true, pedidoSideEffect: 'reserved' as const };
        }
      }
      if (!['AGUARDANDO_SEPARACAO', 'EM_SEPARACAO', 'PRONTO_EXPEDIR'].includes(before.status)) {
        throw new AppError(409, 'ENTREGA_STATE_CONFLICT', 'Entrega not eligible for separacao');
      }

      for (const item of data.itens) {
        if (!(Number(item.quantidade_separada) > 0)) {
          throw new AppError(422, 'SEPARACAO_QTY_INVALID', 'Quantidade separada must be > 0');
        }
        if (item.unidade_sigla && before.itens.length) {
          // unidade check against matching item when present
        }
      }

      const divergencias = data.itens.filter((item) => Number(item.quantidade_separada) !== Number(item.quantidade_pedida));
      const temDivergencia = divergencias.length > 0;
      const statusSeparacao = temDivergencia ? 'com_divergencia' : 'concluido';
      const nextStatus: EntregaStatus | null = temDivergencia ? null : 'PRONTO_EXPEDIR';

      const updatedItens = before.itens.map((row, index) => {
        const incoming = data.itens[index] || data.itens.find((i) => i.produto_id && i.produto_id === row.produto_id);
        return {
          ...row,
          quantidade_separada: incoming?.quantidade_separada ?? row.quantidade_separada,
        };
      });

      const separacao = await this.repo.createSeparacao(scope, {
        group_id: scope.groupId,
        empresa_id: scope.empresaId,
        entrega_id: entregaId,
        pedido_id: before.pedido_id,
        tipo: 'conferencia',
        status: statusSeparacao,
        tem_divergencia: temDivergencia,
        divergencias_resumo: temDivergencia ? `${divergencias.length} item(ns) com divergencia` : null,
        checklist: data.checklist,
        itens: data.itens,
        idempotency_key: data.idempotency_key ?? null,
        ativo: true,
      }, ctx.actorId!, executor);

      let entrega = await this.repo.updateEntregaRow(scope, entregaId, { itens: updatedItens }, ctx.actorId!, executor);
      if (nextStatus && before.status !== nextStatus) {
        entrega = await this.repo.changeEntregaStatus(scope, entregaId, nextStatus, ctx.actorId!, 'Separacao concluida', data.idempotency_key, executor);
      }
      if (!entrega) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');

      await this.auditRow(ctx, 'SeparacaoConferencia', 'create', null, separacao, executor);
      await this.auditRow(ctx, 'Entrega', 'change_status', before, entrega, executor);

      const pedidoSideEffect = await this.pedidoPort.onSeparacaoConcluida({
        groupId: scope.groupId,
        empresaId: scope.empresaId,
        pedidoId: before.pedido_id,
        entregaId,
      });

      return { entrega: toSpaEntrega(entrega), separacao, reused: false, pedidoSideEffect };
    });
  }

  async criarRomaneioDespacho(ctx: RequestContext, payload: unknown) {
    const scope = await this.prepare(ctx, 'criar', 'romaneio');
    const parsed = romaneioCreateSchema.safeParse(payload);
    if (!parsed.success) this.validation(parsed.error.flatten());
    const data = parsed.data as RomaneioCreate;
    const entregasKey = sortedEntregasKey(data.entregas_ids);

    return this.repo.withTransaction(async (executor) => {
      if (data.idempotency_key) {
        const byIdem = await this.repo.getRomaneioByIdempotency(scope, data.idempotency_key, executor);
        if (byIdem) {
          return { romaneio: byIdem, entregas: [], reused: true, action: 'retry' as const, pedidoSideEffect: 'reserved' as const, estoqueSideEffect: 'reserved' as const };
        }
      }
      const existing = await this.repo.getRomaneioByEntregasKey(scope, entregasKey, executor);
      if (existing && existing.status !== 'CANCELADO') {
        return { romaneio: existing, entregas: [], reused: true, action: 'retry' as const, pedidoSideEffect: 'reserved' as const, estoqueSideEffect: 'reserved' as const };
      }

      const selecionadas: Entrega[] = [];
      for (const id of data.entregas_ids) {
        const row = await this.repo.getEntrega(scope, id, executor);
        if (!row) throw new AppError(404, 'ENTREGA_NOT_FOUND', `Entrega ${id} not found`);
        if (row.romaneio_id) throw new AppError(409, 'ENTREGA_JA_EM_ROMANEIO', 'Entrega already linked to romaneio');
        if (row.status !== 'PRONTO_EXPEDIR') {
          throw new AppError(409, 'ENTREGA_STATE_CONFLICT', 'Entrega must be PRONTO_EXPEDIR');
        }
        selecionadas.push(row);
      }

      await this.rbac.assertAllowed(ctx, 'Expedicao', 'romaneio', 'criar', { allowGlobalWildcard: false });
      if (data.despachar) {
        await this.rbac.assertAllowed(ctx, 'Expedicao', 'entrega', 'expedir', { allowGlobalWildcard: false });
      }

      const romaneio = await this.repo.createRomaneio(scope, { ...data, entregas_key: entregasKey }, ctx.actorId!, executor);
      const updated: Entrega[] = [];
      const now = new Date().toISOString();

      try {
        for (let i = 0; i < selecionadas.length; i += 1) {
          const before = selecionadas[i];
          let row = await this.repo.updateEntregaRow(scope, before.id, {
            romaneio_id: romaneio.id,
            motorista_id: data.motorista_id ?? null,
            motorista_nome: data.motorista_nome,
            veiculo: data.veiculo,
            placa: data.placa,
            sequencia_rota: i + 1,
            data_saida: data.despachar ? now : null,
          }, ctx.actorId!, executor);
          if (data.despachar) {
            row = await this.repo.changeEntregaStatus(
              scope, before.id, 'SAIU_ENTREGA', ctx.actorId!, 'Despacho via romaneio',
              data.idempotency_key ? `${data.idempotency_key}:${before.id}` : undefined, executor,
            );
          } else {
            row = await this.repo.changeEntregaStatus(
              scope, before.id, 'EM_ROMANEIO', ctx.actorId!, 'Vinculo romaneio',
              data.idempotency_key ? `${data.idempotency_key}:${before.id}` : undefined, executor,
            );
          }
          if (!row) throw new AppError(500, 'ENTREGA_UPDATE_FAILED', 'Failed to patch entrega during despacho');
          updated.push(row);
        }
      } catch (error) {
        // withTransaction rollback handles persistence; rethrow for client
        throw error;
      }

      if (data.despachar) {
        await this.repo.updateRomaneioStatus(scope, romaneio.id, 'EM_ROTA', ctx.actorId!, executor);
      }

      await this.auditRow(ctx, 'Romaneio', 'create', null, romaneio, executor);
      for (const row of updated) {
        await this.auditRow(ctx, 'Entrega', 'change_status', selecionadas.find((s) => s.id === row.id) || null, row, executor);
      }

      const pedidoIds = selecionadas.map((s) => s.pedido_id).filter(Boolean) as string[];
      const pedidoSideEffect = await this.pedidoPort.onDespacho({
        groupId: scope.groupId,
        empresaId: scope.empresaId,
        pedidoIds,
        romaneioId: romaneio.id,
      });
      const estoqueSideEffect = await this.estoquePort.onDespacho({
        groupId: scope.groupId,
        empresaId: scope.empresaId,
        entregaIds: selecionadas.map((s) => s.id),
      });
      if (estoqueSideEffect === 'failed') {
        throw new AppError(502, 'ESTOQUE_SIDE_EFFECT_FAILED', 'Estoque side-effect failed; transaction rolled back');
      }

      const finalRomaneio = (await this.repo.getRomaneio(scope, romaneio.id, executor))!;
      return {
        romaneio: finalRomaneio,
        entregas: updated.map(toSpaEntrega),
        reused: false,
        action: 'criar' as const,
        pedidoSideEffect,
        estoqueSideEffect,
      };
    });
  }

  async registrarFinal(ctx: RequestContext, entregaId: string, payload: unknown) {
    const parsed = registroFinalSchema.safeParse(payload);
    if (!parsed.success) this.validation(parsed.error.flatten());
    const data = parsed.data as RegistroFinal;
    const action: RbacAction = data.modo === 'ocorrencia' ? 'ocorrencia' : 'entregar';
    const scope = await this.prepare(ctx, action, 'entrega');
    this.assertId(entregaId, 'entregaId');

    return this.repo.withTransaction(async (executor) => {
      const before = await this.repo.getEntrega(scope, entregaId, executor);
      if (!before) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');

      if (data.idempotency_key) {
        const hist = await this.repo.historyEntrega(scope, entregaId, executor);
        if (hist.some((h) => h.idempotency_key === data.idempotency_key)) {
          return { entrega: toSpaEntrega(before), reused: true, action: 'retry' as const };
        }
      }

      if (!['SAIU_ENTREGA', 'ENTREGUE_PARCIAL', 'FRUSTRADA'].includes(before.status) && data.modo !== 'ocorrencia') {
        if (!(before.status === 'ENTREGUE' && data.modo === 'total')) {
          throw new AppError(409, 'ENTREGA_STATE_CONFLICT', 'Entrega not eligible for registro final');
        }
      }
      if (before.status === 'ENTREGUE' && data.modo === 'total') {
        return { entrega: toSpaEntrega(before), reused: true, action: 'retry' as const };
      }
      if (before.status === 'ENTREGUE' && data.modo === 'parcial') {
        throw new AppError(409, 'ENTREGA_STATE_CONFLICT', 'Entrega already finalized');
      }

      const now = new Date().toISOString();
      let nextStatus: EntregaStatus = 'ENTREGUE';
      let patch: Partial<Entrega> = {};

      if (data.modo === 'ocorrencia') {
        if (!String(data.motivo || '').trim()) throw new AppError(422, 'OCORRENCIA_MOTIVO_REQUIRED', 'Ocorrencia exige motivo');
        nextStatus = 'FRUSTRADA';
        patch = {
          entrega_frustrada: {
            ...(before.entrega_frustrada || {}),
            motivo: data.motivo,
            tentativa_numero: Number(before.entrega_frustrada?.tentativa_numero || 0) + 1,
          },
        };
      } else if (data.modo === 'parcial') {
        if (!(Number(data.quantidade_entregue) > 0)) {
          throw new AppError(422, 'PARCIAL_QTY_REQUIRED', 'Quantidade entregue obrigatoria');
        }
        const prevQty = Number(before.entrega_parcial?.quantidade_entregue || 0);
        const nextQty = Number(data.quantidade_entregue);
        if (before.status === 'ENTREGUE_PARCIAL' && prevQty > 0 && nextQty === prevQty) {
          return { entrega: toSpaEntrega(before), reused: true, action: 'retry' as const };
        }
        if (before.status === 'ENTREGUE_PARCIAL' && prevQty > 0 && nextQty < prevQty) {
          throw new AppError(422, 'PARCIAL_QTY_REDUCTION', 'Quantidade parcial nao pode ser reduzida sem estorno');
        }
        const comprovante = { ...(before.comprovante_entrega || {}), ...(data.comprovante || {}) };
        if (!hasProva(comprovante, before.tipo_frete)) {
          throw new AppError(422, 'COMPROVANTE_REQUIRED', 'Entrega parcial exige comprovante');
        }
        nextStatus = 'ENTREGUE_PARCIAL';
        const quantidadePedida = Number(before.entrega_parcial?.quantidade_pedida || before.quantidade_total || before.volumes || 0);
        patch = {
          data_entrega: now,
          comprovante_entrega: comprovante,
          entrega_parcial: {
            ativada: true,
            quantidade_entregue: nextQty,
            ...(quantidadePedida > 0 ? { quantidade_pedida: quantidadePedida } : {}),
          },
        };
      } else {
        const comprovante = { ...(before.comprovante_entrega || {}), ...(data.comprovante || {}) };
        if (!hasProva(comprovante, before.tipo_frete)) {
          throw new AppError(422, 'COMPROVANTE_REQUIRED', 'Entrega exige comprovante');
        }
        nextStatus = 'ENTREGUE';
        patch = { data_entrega: now, comprovante_entrega: comprovante };
      }

      let updated = await this.repo.updateEntregaRow(scope, entregaId, patch, ctx.actorId!, executor);
      updated = await this.repo.changeEntregaStatus(
        scope, entregaId, nextStatus, ctx.actorId!,
        data.modo === 'ocorrencia' ? data.motivo : `Registro ${data.modo}`,
        data.idempotency_key, executor,
      );
      if (!updated) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
      await this.auditRow(ctx, 'Entrega', 'change_status', before, updated, executor);
      return { entrega: toSpaEntrega(updated), reused: false, action: 'criar' as const };
    });
  }

  async devolucao(ctx: RequestContext, entregaId: string, payload: unknown) {
    const scope = await this.prepare(ctx, 'ocorrencia', 'entrega');
    this.assertId(entregaId, 'entregaId');
    const parsed = devolucaoSchema.safeParse(payload);
    if (!parsed.success) this.validation(parsed.error.flatten());
    const data = parsed.data as DevolucaoInput;

    return this.repo.withTransaction(async (executor) => {
      const before = await this.repo.getEntrega(scope, entregaId, executor);
      if (!before) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
      if (data.idempotency_key) {
        const hist = await this.repo.historyEntrega(scope, entregaId, executor);
        if (hist.some((h) => h.idempotency_key === data.idempotency_key)) {
          return { entrega: toSpaEntrega(before), reused: true, estoqueSideEffect: 'reserved' as const };
        }
      }
      const elegivel = ['ENTREGUE', 'ENTREGUE_PARCIAL', 'FRUSTRADA', 'SAIU_ENTREGA'].includes(before.status);
      if (!elegivel) throw new AppError(409, 'ENTREGA_STATE_CONFLICT', 'Entrega not eligible for devolucao');

      const qty = data.quantidade_devolvida
        || (data.itens?.reduce((acc, item) => acc + Number(item.quantidade_devolvida || 0), 0).toFixed(6))
        || '0.000000';

      const patch: Partial<Entrega> = {
        logistica_reversa: {
          ...(before.logistica_reversa || {}),
          motivo: data.motivo,
          acao: data.acao,
          quantidade_devolvida: Number(qty),
          valor_devolvido: data.valor_devolvido ? Number(data.valor_devolvido) : null,
          processado_em: new Date().toISOString(),
        },
      };

      let updated = await this.repo.updateEntregaRow(scope, entregaId, patch, ctx.actorId!, executor);
      updated = await this.repo.changeEntregaStatus(
        scope, entregaId, 'DEVOLVIDA', ctx.actorId!, data.motivo, data.idempotency_key, executor,
      );
      if (!updated) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');

      const estoqueSideEffect = await this.estoquePort.onDevolucao({
        groupId: scope.groupId,
        empresaId: scope.empresaId,
        entregaId,
        quantidade: String(qty),
      });
      if (estoqueSideEffect === 'failed') {
        throw new AppError(502, 'ESTOQUE_SIDE_EFFECT_FAILED', 'Estoque side-effect failed; transaction rolled back');
      }

      await this.auditRow(ctx, 'Entrega', 'change_status', before, updated, executor);
      return { entrega: toSpaEntrega(updated), reused: false, estoqueSideEffect };
    });
  }

  async listRomaneios(ctx: RequestContext, options: { limit?: number; offset?: number } = {}) {
    const scope = await this.prepare(ctx, 'visualizar', 'romaneio');
    const page = await this.repo.listRomaneios(scope, options.limit, options.offset);
    return {
      data: page.rows,
      meta: {
        limit: Math.min(200, Math.max(1, Math.trunc(options.limit ?? 50))),
        offset: Math.max(0, Math.trunc(options.offset ?? 0)),
        total: page.total,
        hasMore: Math.max(0, Math.trunc(options.offset ?? 0)) + page.rows.length < page.total,
      },
    };
  }

  async getRomaneio(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'visualizar', 'romaneio');
    this.assertId(id, 'romaneioId');
    const row = await this.repo.getRomaneio(scope, id);
    if (!row) throw new AppError(404, 'ROMANEIO_NOT_FOUND', 'Romaneio not found');
    return row;
  }

  async historyEntrega(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'visualizar', 'entrega');
    this.assertId(id, 'entregaId');
    if (!(await this.repo.getEntrega(scope, id))) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
    return this.repo.historyEntrega(scope, id);
  }

  /** Interpret SPA patch (status label) into canonical transition when possible. */
  async applyEntregaPatch(ctx: RequestContext, id: string, payload: unknown) {
    const body = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
    if (body.status != null) {
      const next = parseEntregaStatusLabel(body.status);
      if (!next) throw new AppError(422, 'ENTREGA_STATUS_INVALIDO', 'Invalid status');
      if (next === 'ENTREGUE' || next === 'ENTREGUE_PARCIAL' || next === 'FRUSTRADA') {
        return (await this.registrarFinal(ctx, id, {
          confirmed: true,
          modo: next === 'FRUSTRADA' ? 'ocorrencia' : next === 'ENTREGUE_PARCIAL' ? 'parcial' : 'total',
          comprovante: (body.comprovante_entrega as Record<string, unknown>) || undefined,
          quantidade_entregue: (body.entrega_parcial as { quantidade_entregue?: unknown } | undefined)?.quantidade_entregue
            ?? body.quantidade_entregue,
          motivo: (body.entrega_frustrada as { motivo?: unknown } | undefined)?.motivo ?? body.motivo,
          idempotency_key: body.idempotency_key,
        })).entrega;
      }
      if (next === 'DEVOLVIDA') {
        return (await this.devolucao(ctx, id, {
          confirmed: true,
          motivo: String((body.logistica_reversa as { motivo?: unknown } | undefined)?.motivo || body.motivo || 'devolucao'),
          acao: String((body.logistica_reversa as { acao?: unknown } | undefined)?.acao || 'devolver_estoque'),
          quantidade_devolvida: (body.logistica_reversa as { quantidade_devolvida?: unknown } | undefined)?.quantidade_devolvida,
          valor_devolvido: (body.logistica_reversa as { valor_devolvido?: unknown } | undefined)?.valor_devolvido,
          idempotency_key: body.idempotency_key,
        })).entrega;
      }
      const scope = await this.prepare(ctx, rbacForStatus(next), 'entrega');
      const before = await this.repo.getEntrega(scope, id);
      if (!before) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
      if (before.status === next) return toSpaEntrega(before);
      if (!ALLOWED_TRANSITIONS[before.status].includes(next)) {
        throw new AppError(409, 'ENTREGA_STATE_CONFLICT', `Transition ${before.status} -> ${next} not allowed`);
      }
      const updated = await this.repo.changeEntregaStatus(scope, id, next, ctx.actorId!, String(body.motivo || ''), String(body.idempotency_key || '') || undefined);
      if (!updated) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
      await this.auditRow(ctx, 'Entrega', 'change_status', before, updated);
      return toSpaEntrega(updated);
    }
    const scope = await this.prepare(ctx, 'editar', 'entrega');
    const before = await this.repo.getEntrega(scope, id);
    if (!before) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
    if (['ENTREGUE', 'DEVOLVIDA', 'CANCELADA'].includes(before.status)) {
      throw new AppError(409, 'ENTREGA_STATE_CONFLICT', 'Entrega finalizada nao pode ser editada');
    }
    const updated = await this.repo.updateEntregaRow(scope, id, {
      observacoes: body.observacoes != null ? String(body.observacoes) : undefined,
      motorista_nome: body.motorista != null ? String(body.motorista) : body.motorista_nome != null ? String(body.motorista_nome) : undefined,
      veiculo: body.veiculo != null ? String(body.veiculo) : undefined,
      placa: body.placa != null ? String(body.placa) : undefined,
    }, ctx.actorId!);
    if (!updated) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
    await this.auditRow(ctx, 'Entrega', 'update', before, updated);
    return toSpaEntrega(updated);
  }

  private parseCreate(payload: unknown): EntregaCreate {
    const parsed = entregaCreateSchema.safeParse(payload);
    if (!parsed.success) this.validation(parsed.error.flatten());
    return parsed.data;
  }

  private validation(details: unknown): never {
    throw new AppError(422, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  private assertId(id: string, label: string) {
    if (!UUID_RE.test(id)) throw new AppError(422, 'INVALID_ID', `${label} must be uuid`);
  }

  private async prepare(ctx: RequestContext, action: RbacAction, section: 'entrega' | 'romaneio' | 'separacao'): Promise<ExpedicaoScope> {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    if (!ctx.actorId) throw new AppError(403, 'ACTOR_REQUIRED', 'actorId is required');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    await this.rbac.assertAllowed(ctx, 'Expedicao', section, action, { allowGlobalWildcard: false });
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }

  private async auditRow(
    ctx: RequestContext,
    entity: string,
    action: AuditAction,
    before: unknown,
    after: Entrega | Romaneio | Separacao,
    executor?: Parameters<AuditRepository['append']>[1],
  ) {
    const snap = entity === 'Romaneio'
      ? romaneioAuditSnapshot(after as Romaneio)
      : entity === 'Entrega'
        ? entregaAuditSnapshot(after as Entrega)
        : sanitizeAuditSnapshot(after);
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity,
      entityId: (after as { id: string }).id,
      action,
      beforeData: before ? (entity === 'Entrega' ? entregaAuditSnapshot(before as Entrega) : sanitizeAuditSnapshot(before)) : null,
      afterData: snap,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
  }
}

export type { EntregaCreate };
void z;
void entregaStatusToLabel;
