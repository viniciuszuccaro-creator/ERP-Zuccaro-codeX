import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.js';
import type { DbQueryExecutor } from '../src/db/client.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import type { OrcamentoCreate, OrcamentoScope } from '../src/repositories/orcamentoTypes.js';
import { OrcamentoService } from '../src/services/orcamentoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherEmpresa = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';
const ctx = {
  requestId: 'req-a21b',
  actorId: '55555555-5555-4555-8555-555555555555',
  groupId,
  empresaId,
};
const payload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-01-01T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Produto sintetico',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '10',
    desconto: '1',
  }],
};

class TrackingRepo extends InMemoryOrcamentoRepository {
  transactions = 0;
  createExecutors: Array<DbQueryExecutor | undefined> = [];
  getExecutors: Array<DbQueryExecutor | undefined> = [];
  updateExecutors: Array<DbQueryExecutor | undefined> = [];
  cancelExecutors: Array<DbQueryExecutor | undefined> = [];
  failUpdate = false;
  failCancel = false;

  readonly executor: DbQueryExecutor = {
    query: async () => ({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] }),
  };

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>) {
    this.transactions += 1;
    return super.withTransaction(() => fn(this.executor));
  }

  async create(scope: OrcamentoScope, data: OrcamentoCreate, executor?: DbQueryExecutor) {
    this.createExecutors.push(executor);
    return super.create(scope, data, executor);
  }

  async get(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor) {
    this.getExecutors.push(executor);
    return super.get(scope, id, executor);
  }

  async update(scope: OrcamentoScope, id: string, data: OrcamentoCreate, executor?: DbQueryExecutor) {
    this.updateExecutors.push(executor);
    const row = await super.update(scope, id, data, executor);
    if (this.failUpdate) throw new Error('UPDATE_FAILURE');
    return row;
  }

  async cancel(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor) {
    this.cancelExecutors.push(executor);
    const row = await super.cancel(scope, id, executor);
    if (this.failCancel) throw new Error('CANCEL_FAILURE');
    return row;
  }
}

function fixture(overrides: {
  tenantFails?: boolean;
  cliente?: unknown;
  produto?: unknown;
  unidade?: unknown;
  condicao?: unknown;
} = {}) {
  const repo = new TrackingRepo();
  const service = new OrcamentoService(
    repo,
    {
      assertEmpresaInGroup: async () => {
        if (overrides.tenantFails) throw new AppError(409, 'TENANT_MISMATCH', 'tenant mismatch');
      },
    },
    {
      getEmpresaLinkById: async () => overrides.cliente === undefined
        ? { id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }
        : overrides.cliente,
    } as any,
    {
      getById: async () => overrides.produto === undefined
        ? { id: produtoId, ativo: true, unidade_medida_id: unidadeId }
        : overrides.produto,
    } as any,
    {
      getById: async () => overrides.unidade === undefined
        ? { id: unidadeId, ativo: true }
        : overrides.unidade,
    } as any,
    {
      get: async () => overrides.condicao === undefined
        ? { id: condicaoId, ativo: true }
        : overrides.condicao,
    } as any,
  );
  return { repo, service };
}

async function code(promise: Promise<unknown>) {
  try {
    await promise;
    return 'NONE';
  } catch (error) {
    return (error as AppError).code;
  }
}

test('create valida referencias calcula total e usa uma transacao', async () => {
  const { repo, service } = fixture();
  const row = await service.create(ctx, payload);
  assert.equal(row.total, '19.000000');
  assert.equal(repo.transactions, 1);
  assert.equal(repo.createExecutors[0], repo.executor);
});

test('create rejeita campos extras totais status e tenant', async () => {
  const { service } = fixture();
  for (const field of ['total', 'status', 'groupId', 'empresaId']) {
    assert.equal(await code(service.create(ctx, { ...payload, [field]: 'indevido' })), 'VALIDATION_ERROR');
  }
});

test('exige group empresa actor e empresa vinculada', async () => {
  const { service } = fixture();
  assert.equal(await code(service.list({ ...ctx, groupId: '' })), 'GROUP_ID_REQUIRED');
  assert.equal(await code(service.list({ ...ctx, empresaId: null })), 'EMPRESA_ID_REQUIRED');
  assert.equal(await code(service.list({ ...ctx, actorId: null })), 'ACTOR_REQUIRED');
  assert.equal(await code(fixture({ tenantFails: true }).service.list(ctx)), 'TENANT_MISMATCH');
});

test('bloqueia ClienteEmpresa e Condicao fora do tenant', async () => {
  assert.equal(await code(fixture({ cliente: null }).service.create(ctx, payload)), 'ORCAMENTO_CLIENTE_INVALIDO');
  assert.equal(await code(fixture({ condicao: null }).service.create(ctx, payload)), 'ORCAMENTO_CONDICAO_INVALIDA');
});

test('bloqueia Produto cross-tenant e Unidade incompatível', async () => {
  assert.equal(await code(fixture({ produto: null }).service.create(ctx, payload)), 'ORCAMENTO_PRODUTO_INVALIDO');
  assert.equal(
    await code(fixture({ produto: { id: produtoId, ativo: true, unidade_medida_id: '66666666-6666-4666-8666-666666666666' } }).service.create(ctx, payload)),
    'ORCAMENTO_UNIDADE_INVALIDA',
  );
  assert.equal(await code(fixture({ unidade: null }).service.create(ctx, payload)), 'ORCAMENTO_UNIDADE_INVALIDA');
});

test('get valida id e nao revela cross-tenant', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, payload);
  assert.equal((await service.get(ctx, created.id)).id, created.id);
  assert.equal(await code(service.get(ctx, 'invalido')), 'VALIDATION_ERROR');
  assert.equal(await code(service.get({ ...ctx, empresaId: otherEmpresa }, created.id)), 'ORCAMENTO_NOT_FOUND');
});

test('list normaliza pagina e preserva tenant', async () => {
  const { service } = fixture();
  await service.create(ctx, payload);
  const page = await service.list(ctx, { limit: 999, offset: -2 });
  assert.deepEqual(page.meta, { limit: 200, offset: 0, total: 1, hasMore: false });
  assert.equal(page.data.length, 1);
  assert.equal((await service.list({ ...ctx, empresaId: otherEmpresa })).data.length, 0);
});

test('update valido preserva identidade e recalcula totais e itens', async () => {
  const { repo, service } = fixture();
  const created = await service.create(ctx, payload);
  const updatePayload = {
    ...payload,
    observacoes: 'Atualizado',
    itens: [{
      ...payload.itens[0],
      descricao: 'Snapshot atualizado',
      quantidade: '3',
      preco_unitario: '7.5',
      desconto: '0.5',
    }],
  };
  const beforeTransactions = repo.transactions;
  const updated = await service.update(ctx, created.id, updatePayload);
  assert.equal(repo.transactions - beforeTransactions, 1);
  assert.equal(updated.id, created.id);
  assert.equal(updated.group_id, created.group_id);
  assert.equal(updated.empresa_id, created.empresa_id);
  assert.equal(updated.numero, created.numero);
  assert.equal(updated.created_at, created.created_at);
  assert.equal(updated.subtotal, '22.500000');
  assert.equal(updated.desconto, '0.500000');
  assert.equal(updated.total, '22.000000');
  assert.equal(updated.itens.length, 1);
  assert.equal(updated.itens[0].descricao, 'Snapshot atualizado');
  assert.ok(repo.getExecutors.includes(repo.executor));
  assert.equal(repo.updateExecutors.at(-1), repo.executor);
});

test('update valida id existencia tenant estado e campos internos', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, payload);
  assert.equal(await code(service.update(ctx, 'invalido', payload)), 'VALIDATION_ERROR');
  assert.equal(await code(service.update(ctx, '77777777-7777-4777-8777-777777777777', payload)), 'ORCAMENTO_NOT_FOUND');
  assert.equal(await code(service.update({ ...ctx, empresaId: otherEmpresa }, created.id, payload)), 'ORCAMENTO_NOT_FOUND');
  assert.equal(await code(service.update(ctx, created.id, { ...payload, numero: '00000999' })), 'VALIDATION_ERROR');
  await service.cancel(ctx, created.id);
  assert.equal(await code(service.update(ctx, created.id, payload)), 'ORCAMENTO_STATE_CONFLICT');
});

test('update revalida todas as referencias sem persistir falha', async () => {
  const cases = [
    { overrides: { cliente: null }, expected: 'ORCAMENTO_CLIENTE_INVALIDO' },
    { overrides: { condicao: null }, expected: 'ORCAMENTO_CONDICAO_INVALIDA' },
    { overrides: { produto: null }, expected: 'ORCAMENTO_PRODUTO_INVALIDO' },
    { overrides: { unidade: null }, expected: 'ORCAMENTO_UNIDADE_INVALIDA' },
  ];
  for (const item of cases) {
    const { service } = fixture(item.overrides);
    const created = await service.create(ctx, payload).catch(() => null);
    if (!created) {
      const valid = fixture();
      const validCreated = await valid.service.create(ctx, payload);
      const invalidService = new OrcamentoService(
        valid.repo,
        { assertEmpresaInGroup: async () => undefined },
        { getEmpresaLinkById: async () => item.overrides.cliente === null ? null : { id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true } } as any,
        { getById: async () => item.overrides.produto === null ? null : { id: produtoId, ativo: true, unidade_medida_id: unidadeId } } as any,
        { getById: async () => item.overrides.unidade === null ? null : { id: unidadeId, ativo: true } } as any,
        { get: async () => item.overrides.condicao === null ? null : { id: condicaoId, ativo: true } } as any,
      );
      assert.equal(await code(invalidService.update(ctx, validCreated.id, { ...payload, itens: [{ ...payload.itens[0], quantidade: '9' }] })), item.expected);
      assert.equal((await valid.service.get(ctx, validCreated.id)).total, '19.000000');
    }
  }
  const incompatible = fixture();
  const created = await incompatible.service.create(ctx, payload);
  const invalidService = new OrcamentoService(
    incompatible.repo,
    { assertEmpresaInGroup: async () => undefined },
    { getEmpresaLinkById: async () => ({ id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as any,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: '66666666-6666-4666-8666-666666666666' }) } as any,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as any,
    { get: async () => ({ id: condicaoId, ativo: true }) } as any,
  );
  assert.equal(await code(invalidService.update(ctx, created.id, payload)), 'ORCAMENTO_UNIDADE_INVALIDA');
});

test('cancel preserva numero itens snapshots e usa uma transacao', async () => {
  const { repo, service } = fixture();
  const created = await service.create(ctx, payload);
  const beforeTransactions = repo.transactions;
  const cancelled = await service.cancel(ctx, created.id);
  assert.equal(repo.transactions - beforeTransactions, 1);
  assert.equal(cancelled.status, 'CANCELADO');
  assert.equal(cancelled.ativo, false);
  assert.equal(cancelled.numero, created.numero);
  assert.deepEqual(cancelled.itens, created.itens);
  assert.ok(repo.getExecutors.includes(repo.executor));
  assert.equal(repo.cancelExecutors.at(-1), repo.executor);
  assert.equal(await code(service.cancel(ctx, created.id)), 'ORCAMENTO_STATE_CONFLICT');
});

test('cancel valida id existencia e tenant', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, payload);
  assert.equal(await code(service.cancel(ctx, 'invalido')), 'VALIDATION_ERROR');
  assert.equal(await code(service.cancel(ctx, '77777777-7777-4777-8777-777777777777')), 'ORCAMENTO_NOT_FOUND');
  assert.equal(await code(service.cancel({ ...ctx, empresaId: otherEmpresa }, created.id)), 'ORCAMENTO_NOT_FOUND');
});

test('erro do repository faz rollback completo do update', async () => {
  const { repo, service } = fixture();
  const created = await service.create(ctx, payload);
  repo.failUpdate = true;
  await assert.rejects(
    service.update(ctx, created.id, { ...payload, itens: [{ ...payload.itens[0], quantidade: '8' }] }),
    /UPDATE_FAILURE/,
  );
  repo.failUpdate = false;
  const persisted = await service.get(ctx, created.id);
  assert.equal(persisted.total, created.total);
  assert.deepEqual(persisted.itens, created.itens);
});

test('erro do repository faz rollback completo do cancel', async () => {
  const { repo, service } = fixture();
  const created = await service.create(ctx, payload);
  repo.failCancel = true;
  await assert.rejects(service.cancel(ctx, created.id), /CANCEL_FAILURE/);
  repo.failCancel = false;
  const persisted = await service.get(ctx, created.id);
  assert.equal(persisted.status, 'EM_ABERTO');
  assert.equal(persisted.ativo, true);
  assert.deepEqual(persisted.itens, created.itens);
});