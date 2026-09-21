import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditEntry, AuditRepository, RequestContext } from '../src/audit/types.js';
import type { DbQueryExecutor } from '../src/db/client.js';
import { InMemoryRbacGuard, type RbacAction } from '../src/db/rbacGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import type { OrcamentoCreate, OrcamentoScope } from '../src/repositories/orcamentoTypes.js';
import { OrcamentoService } from '../src/services/orcamentoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';
const ctx: RequestContext = {
  requestId: 'req-a22',
  actorId,
  actorEmail: 'usuario.sintetico@example.invalid',
  groupId,
  empresaId,
  ipAddress: '127.0.0.1',
};
const payload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-01-01T00:00:00.000Z',
  observacoes: 'texto livre que nao pode ir para auditoria',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'descricao livre que nao pode ir para auditoria',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '10',
    desconto: '1',
  }],
};

class TrackingRepo extends InMemoryOrcamentoRepository {
  readonly executor: DbQueryExecutor = {
    query: async () => ({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] }),
  };
  createCalls = 0;
  getCalls = 0;
  listCalls = 0;
  updateCalls = 0;
  cancelCalls = 0;

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>) {
    return super.withTransaction(() => fn(this.executor));
  }

  async create(scope: OrcamentoScope, data: OrcamentoCreate, executor?: DbQueryExecutor) {
    this.createCalls += 1;
    return super.create(scope, data, executor);
  }

  async get(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor) {
    this.getCalls += 1;
    return super.get(scope, id, executor);
  }

  async list(scope: OrcamentoScope, limit?: number, offset?: number, executor?: DbQueryExecutor) {
    this.listCalls += 1;
    return super.list(scope, limit, offset, executor);
  }

  async update(scope: OrcamentoScope, id: string, data: OrcamentoCreate, executor?: DbQueryExecutor) {
    this.updateCalls += 1;
    return super.update(scope, id, data, executor);
  }

  async cancel(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor) {
    this.cancelCalls += 1;
    return super.cancel(scope, id, executor);
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
      Comercial: { orcamento: options.actions ?? ['visualizar', 'criar', 'editar', 'cancelar'] },
    },
  });
  const service = new OrcamentoService(
    repo,
    audit,
    {
      assertEmpresaInGroup: async () => {
        if (options.tenantFails) throw new Error('TENANT_MISMATCH');
      },
    },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as any,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as any,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as any,
    { get: async () => ({ id: condicaoId, ativo: true }) } as any,
  );
  return { repo, audit, service };
}

test('RBAC granular permite visualizar criar editar e cancelar sem eventos de leitura', async () => {
  const { repo, audit, service } = serviceFor();
  const created = await service.create(ctx, payload);
  await service.get(ctx, created.id);
  await service.list(ctx);
  const updated = await service.update(ctx, created.id, {
    ...payload,
    itens: [{ ...payload.itens[0], quantidade: '3' }],
  });
  await service.cancel(ctx, created.id);

  assert.equal(updated.total, '29.000000');
  assert.deepEqual(audit.entries.map((entry) => entry.action), ['create', 'update', 'change_status']);
  assert.ok(audit.executors.every((executor) => executor === repo.executor));
  const encoded = JSON.stringify(audit.entries.map((entry) => ({ beforeData: entry.beforeData, afterData: entry.afterData })));
  for (const forbidden of ['observacoes', 'descricao', 'texto livre', 'usuario.sintetico']) {
    assert.equal(encoded.includes(forbidden), false);
  }
  const createdSnapshot = audit.entries[0].afterData as Record<string, unknown>;
  assert.equal(createdSnapshot.quantidade_itens, 1);
  assert.equal(audit.entries[0].requestId, ctx.requestId);
  assert.equal(audit.entries[0].actorId, actorId);
  assert.equal(audit.entries[0].actorEmail, ctx.actorEmail);
  assert.equal(audit.entries[0].ipAddress, ctx.ipAddress);
  assert.ok(audit.entries[1].beforeData);
  assert.ok(audit.entries[1].afterData);
  assert.ok(audit.entries[2].beforeData);
  assert.ok(audit.entries[2].afterData);
});

test('RBAC nega visualizar e criar antes de qualquer operacao', async () => {
  const deniedView = serviceFor({ actions: [] });
  await assert.rejects(deniedView.service.list(ctx), /Permission denied/);
  assert.equal(deniedView.repo.listCalls, 0);

  const deniedCreate = serviceFor({ actions: ['visualizar'] });
  await assert.rejects(deniedCreate.service.create(ctx, payload), /Permission denied/);
  assert.equal(deniedCreate.repo.createCalls, 0);
  assert.equal(deniedCreate.audit.entries.length, 0);
});

test('RBAC separa editar e cancelar e nao aceita wildcard global', async () => {
  const repo = new TrackingRepo();
  const created = await repo.create({ groupId, empresaId }, payload);

  const editOnly = serviceFor({ repo, actions: ['editar'] });
  await editOnly.service.update(ctx, created.id, payload);
  await assert.rejects(editOnly.service.cancel(ctx, created.id), /Permission denied/);
  assert.equal(repo.cancelCalls, 0);

  const wildcard = serviceFor({ actions: [], wildcardActions: ['criar', 'editar', 'cancelar'] });
  await assert.rejects(wildcard.service.create(ctx, payload), /Permission denied/);
  assert.equal(wildcard.repo.createCalls, 0);
});

test('RBAC fail-closed nega actor ausente perfil ausente e tenant divergente', async () => {
  const configured = serviceFor();
  await assert.rejects(configured.service.list({ ...ctx, actorId: null }), /actorId is required/);

  const noProfileRepo = new TrackingRepo();
  const noProfile = new OrcamentoService(
    noProfileRepo,
    new TrackingAudit(),
    { assertEmpresaInGroup: async () => undefined },
    new InMemoryRbacGuard(),
    {} as any, {} as any, {} as any, {} as any,
  );
  await assert.rejects(noProfile.list(ctx), /Permission denied/);
  assert.equal(noProfileRepo.listCalls, 0);

  const tenant = serviceFor({ tenantFails: true });
  await assert.rejects(tenant.service.list(ctx), /TENANT_MISMATCH/);
  assert.equal(tenant.repo.listCalls, 0);
});

test('falha de auditoria rollbacka create e restaura sequencia', async () => {
  const repo = new TrackingRepo();
  const audit = new TrackingAudit();
  const { service } = serviceFor({ repo, audit });
  audit.fail = true;
  await assert.rejects(service.create(ctx, payload), /AUDIT_FAILURE/);
  assert.equal((await repo.list({ groupId, empresaId })).total, 0);

  audit.fail = false;
  const created = await service.create(ctx, payload);
  assert.equal(created.numero, '00000001');
});

test('falha de auditoria rollbacka update e cancel', async () => {
  const repo = new TrackingRepo();
  const audit = new TrackingAudit();
  const { service } = serviceFor({ repo, audit });
  const created = await service.create(ctx, payload);

  audit.fail = true;
  await assert.rejects(
    service.update(ctx, created.id, { ...payload, itens: [{ ...payload.itens[0], quantidade: '8' }] }),
    /AUDIT_FAILURE/,
  );
  let persisted = await repo.get({ groupId, empresaId }, created.id);
  assert.equal(persisted?.total, created.total);
  assert.deepEqual(persisted?.itens, created.itens);

  await assert.rejects(service.cancel(ctx, created.id), /AUDIT_FAILURE/);
  persisted = await repo.get({ groupId, empresaId }, created.id);
  assert.equal(persisted?.status, 'EM_ABERTO');
  assert.equal(persisted?.ativo, true);
});
