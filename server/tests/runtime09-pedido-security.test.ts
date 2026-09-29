import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditEntry, AuditRepository, RequestContext } from '../src/audit/types.js';
import type { DbQueryExecutor } from '../src/db/client.js';
import { InMemoryRbacGuard, type RbacAction } from '../src/db/rbacGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import type { PedidoCreate, PedidoScope } from '../src/repositories/pedidoTypes.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const clienteEmpresaId = '11111111-1111-4111-8111-111111111111';
const clienteId = '12111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';
const ctx: RequestContext = {
  requestId: 'req-pedido-cancel',
  actorId,
  actorEmail: 'usuario.sintetico@example.invalid',
  groupId,
  empresaId,
  ipAddress: '127.0.0.1',
};
const payload: PedidoCreate = {
  cliente_empresa_id: clienteEmpresaId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'ENTREGA',
  data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  observacoes: 'texto livre que nao pode ir para auditoria',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'descricao livre que nao pode ir para auditoria',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '10',
    desconto: '0',
    requer_producao: true,
  }],
};

class TrackingRepo extends InMemoryPedidoRepository {
  readonly executor: DbQueryExecutor = {
    query: async () => ({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] }),
  };
  createCalls = 0;
  getCalls = 0;
  listCalls = 0;
  updateCalls = 0;
  changeStatusCalls = 0;

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>) {
    return super.withTransaction(() => fn(this.executor));
  }

  async create(scope: PedidoScope, data: Parameters<InMemoryPedidoRepository['create']>[1], actorIdArg: string, executor?: DbQueryExecutor) {
    this.createCalls += 1;
    return super.create(scope, data, actorIdArg, executor);
  }

  async get(scope: PedidoScope, id: string, executor?: DbQueryExecutor) {
    this.getCalls += 1;
    return super.get(scope, id, executor);
  }

  async list(scope: PedidoScope, limit?: number, offset?: number, executor?: DbQueryExecutor) {
    this.listCalls += 1;
    return super.list(scope, limit, offset, executor);
  }

  async update(scope: PedidoScope, id: string, data: Parameters<InMemoryPedidoRepository['update']>[2], actorIdArg: string, executor?: DbQueryExecutor) {
    this.updateCalls += 1;
    return super.update(scope, id, data, actorIdArg, executor);
  }

  async changeStatus(
    scope: PedidoScope,
    id: string,
    status: Parameters<InMemoryPedidoRepository['changeStatus']>[2],
    actorIdArg: string,
    motivo?: string,
    executor?: DbQueryExecutor,
  ) {
    this.changeStatusCalls += 1;
    return super.changeStatus(scope, id, status, actorIdArg, motivo, executor);
  }
}

class TrackingAudit implements AuditRepository {
  entries: AuditEntry[] = [];
  executors: Array<DbQueryExecutor | undefined> = [];
  fail = false;

  async append(entry: AuditEntry, executor?: DbQueryExecutor) {
    this.executors.push(executor);
    if (this.fail) throw new Error('AUDIT_FAILURE');
    this.entries.push(structuredClone(entry));
  }

  async listByEntity(entity: string, entityId: string) {
    return this.entries.filter((entry) => entry.entity === entity && entry.entityId === entityId);
  }
}

function serviceFor(options: {
  repo?: TrackingRepo;
  audit?: TrackingAudit;
  actions?: RbacAction[];
  wildcardActions?: RbacAction[];
  tenantFails?: boolean;
} = {}) {
  const repo = options.repo ?? new TrackingRepo();
  const audit = options.audit ?? new TrackingAudit();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: {
      ...(options.wildcardActions ? { '*': options.wildcardActions } : {}),
      Comercial: {
        pedido: options.actions ?? ['visualizar', 'criar', 'editar', 'cancelar', 'alterar-status', 'converter-pedido', 'aprovar'],
      },
    },
  });
  const service = new PedidoService(
    repo,
    new InMemoryOrcamentoRepository(),
    audit,
    {
      assertEmpresaInGroup: async () => {
        if (options.tenantFails) throw new Error('TENANT_MISMATCH');
      },
    },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as any,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as any,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as any,
    { get: async () => ({ id: condicaoId, codigo: 'COND-28', nome: '28 dias', ativo: true, parcelas: [{ id: 'p1', ordem: 1, dias: 28, percentual: '100.000000', ativo: true }] }) } as any,
    { get: async () => ({ id: 'local', ativo: true }) } as any,
    { get: async () => ({ id: 'obra', ativo: true }) } as any,
    { get: async () => ({ id: 'tabela', codigo: 'TAB', nome: 'Tabela', ativo: true }) } as any,
    { resolveSalePrice: async () => ({ preco: '10.000000', tabela_preco_id: 'tabela', tabela_preco_codigo: 'TAB', tabela_preco_nome: 'Tabela' }) },
  );
  return { repo, audit, service };
}

test('Pedido cancel audita before/after e nao vaza texto livre', async () => {
  const { repo, audit, service } = serviceFor();
  const created = await service.create(ctx, payload);
  const cancelled = await service.cancel(ctx, created.id, 'Motivo operacional sintetico');
  assert.equal(cancelled.status, 'CANCELADO');
  assert.equal(cancelled.itens.length, 1);
  assert.deepEqual(audit.entries.map((entry) => entry.action), ['create', 'change_status']);
  assert.ok(audit.executors.every((executor) => executor === repo.executor));
  const cancelEntry = audit.entries[1];
  assert.equal((cancelEntry.beforeData as { status: string }).status, 'EM_ABERTO');
  assert.equal((cancelEntry.afterData as { status: string }).status, 'CANCELADO');
  assert.equal(cancelEntry.requestId, ctx.requestId);
  assert.equal(cancelEntry.actorId, actorId);
  assert.equal(cancelEntry.actorEmail, ctx.actorEmail);
  assert.equal(cancelEntry.ipAddress, ctx.ipAddress);
  const encoded = JSON.stringify({ beforeData: cancelEntry.beforeData, afterData: cancelEntry.afterData });
  for (const forbidden of ['observacoes', 'descricao', 'texto livre', 'Motivo operacional', 'usuario.sintetico']) {
    assert.equal(encoded.includes(forbidden), false);
  }
});

test('Pedido cancel bloqueia ja cancelado e repeticao nao muda estado', async () => {
  const { service } = serviceFor();
  const created = await service.create(ctx, payload);
  await service.cancel(ctx, created.id, 'Primeiro cancelamento ok');
  await assert.rejects(service.cancel(ctx, created.id, 'Segundo cancelamento'), (error: any) =>
    error.statusCode === 409 && error.code === 'PEDIDO_STATE_CONFLICT');
  assert.equal((await service.get(ctx, created.id)).status, 'CANCELADO');
});

test('RBAC separa editar e cancelar Pedido e nao aceita wildcard global', async () => {
  const repo = new TrackingRepo();
  const created = await repo.create({ groupId, empresaId }, {
    ...payload,
    tabela_preco_codigo_snapshot: null,
    tabela_preco_nome_snapshot: null,
    condicao_pagamento_codigo_snapshot: 'COND-28',
    condicao_pagamento_nome_snapshot: '28 dias',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    promocao_aplicada: false,
    promocao_bps: null,
    promocao_cupom: null,
  } as any, actorId);

  const editOnly = serviceFor({ repo, actions: ['editar'] });
  await editOnly.service.update(ctx, created.id, payload);
  await assert.rejects(editOnly.service.cancel(ctx, created.id, 'sem permissao'), /Permission denied/);
  assert.equal(repo.changeStatusCalls, 0);

  const wildcard = serviceFor({ actions: [], wildcardActions: ['criar', 'editar', 'cancelar'] });
  await assert.rejects(wildcard.service.create(ctx, payload), /Permission denied/);
  assert.equal(wildcard.repo.createCalls, 0);
});

test('Pedido cancel fail-closed em actor ausente perfil ausente e tenant divergente', async () => {
  const configured = serviceFor();
  await assert.rejects(configured.service.cancel({ ...ctx, actorId: null }, '00000000-0000-4000-8000-000000000001', 'x'), /actorId is required/);

  const noProfileRepo = new TrackingRepo();
  const noProfile = new PedidoService(
    noProfileRepo,
    new InMemoryOrcamentoRepository(),
    new TrackingAudit(),
    { assertEmpresaInGroup: async () => undefined },
    new InMemoryRbacGuard(),
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    { resolveSalePrice: async () => ({ preco: '10.000000' }) },
  );
  await assert.rejects(noProfile.list(ctx), /Permission denied/);
  assert.equal(noProfileRepo.listCalls, 0);

  const tenant = serviceFor({ tenantFails: true });
  await assert.rejects(tenant.service.list(ctx), /TENANT_MISMATCH/);
  assert.equal(tenant.repo.listCalls, 0);
});

test('falha de auditoria rollbacka Pedido cancel e preserva EM_ABERTO', async () => {
  const repo = new TrackingRepo();
  const audit = new TrackingAudit();
  const { service } = serviceFor({ repo, audit });
  const created = await service.create(ctx, payload);

  audit.fail = true;
  await assert.rejects(service.cancel(ctx, created.id, 'Cancelamento com falha de auditoria'), /AUDIT_FAILURE/);
  const persisted = await repo.get({ groupId, empresaId }, created.id);
  assert.equal(persisted?.status, 'EM_ABERTO');
  assert.equal(persisted?.ativo, true);
});
