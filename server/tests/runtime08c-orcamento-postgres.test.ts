import assert from 'node:assert/strict';
import test from 'node:test';
import type { DbClient } from '../src/db/client.js';
import { PostgresOrcamentoRepository } from '../src/repositories/postgresOrcamentoRepository.js';

type Call = { sql: string; params: unknown[] | undefined };
const scope = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222' };
const otherScope = { ...scope, empresaId: '33333333-3333-4333-8333-333333333333' };
const payload = {
  cliente_empresa_id: '44444444-4444-4444-8444-444444444444',
  condicao_pagamento_id: '55555555-5555-4555-8555-555555555555',
  validade_em: '2026-09-30T00:00:00.000Z',
  itens: [{ produto_id: '66666666-6666-4666-8666-666666666666', unidade_id: '77777777-7777-4777-8777-777777777777', descricao: 'Produto de teste', unidade_sigla: 'UN', quantidade: '2', preco_unitario: '10', desconto: '0' }],
};

function row() {
  return {
    id: '88888888-8888-4888-8888-888888888888', group_id: scope.groupId, empresa_id: scope.empresaId, numero: '00000001', status: 'EM_ABERTO',
    cliente_empresa_id: payload.cliente_empresa_id, condicao_pagamento_id: payload.condicao_pagamento_id, validade_em: payload.validade_em, observacoes: null,
    subtotal: '20.000000', desconto: '0.000000', total: '20.000000', ativo: true, created_at: payload.validade_em, updated_at: payload.validade_em,
    itens: [{ ...payload.itens[0], descricao_snapshot: payload.itens[0].descricao, unidade_snapshot: 'UN', subtotal: '20.000000', total: '20.000000' }],
  };
}

function controlledDb(results: Array<{ rows: unknown[] }>) {
  const calls: Call[] = [];
  let transactions = 0;
  const query = async <T>(sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    return (results.shift() ?? { rows: [] }) as { rows: T[] };
  };
  const db = {
    query,
    withTransaction: async <T>(fn: (executor: { query: typeof query }) => Promise<T>) => { transactions += 1; return fn({ query }); },
    checkConnection: async () => false,
    end: async () => undefined,
    pool: null,
  } as unknown as DbClient;
  return { db, calls, transactionCount: () => transactions, executor: { query } };
}

test('postgres orcamento cria e recupera agregado com itens dentro da transacao', async () => {
  const fixture = row();
  const { db, calls } = controlledDb([{ rows: [] }, { rows: [{ n: '1' }] }, { rows: [{ id: fixture.id }] }, { rows: [] }, { rows: [fixture] }]);
  const created = await new PostgresOrcamentoRepository(db).create(scope, payload);
  assert.equal(created.numero, '00000001');
  assert.equal(created.itens[0].total, '20.000000');
  assert.deepEqual(calls[0].params, [scope.empresaId]);
  assert.ok(calls.some((call) => call.sql.includes('INSERT INTO orcamento_itens')));
  assert.ok(calls.every((call) => !call.params || !call.params.includes(otherScope.empresaId)));
});

test('postgres orcamento bloqueia leitura fora da empresa', async () => {
  const { db, calls } = controlledDb([{ rows: [] }]);
  const found = await new PostgresOrcamentoRepository(db).get(otherScope, '88888888-8888-4888-8888-888888888888');
  assert.equal(found, null);
  assert.deepEqual(calls[0].params, ['88888888-8888-4888-8888-888888888888', scope.groupId, otherScope.empresaId]);
});

test('postgres orcamento lista com paginacao deterministica e itens sem N+1', async () => {
  const fixture = row();
  const { db, calls } = controlledDb([{ rows: [{ total: 1 }] }, { rows: [fixture] }]);
  const page = await new PostgresOrcamentoRepository(db).list(scope, 10, 20);
  assert.equal(page.total, 1);
  assert.equal(page.rows[0].itens.length, 1);
  assert.equal(calls.length, 2);
  const pageCall = calls.find((call) => call.sql.includes('ORDER BY o.numero DESC'));
  assert.deepEqual(pageCall?.params, [scope.groupId, scope.empresaId, 10, 20]);
  assert.match(pageCall?.sql ?? '', /json_agg/);
});
test('postgres orcamento abre transacao somente sem executor', async () => {
  const fixture = row();
  const direct = controlledDb([{ rows: [] }, { rows: [{ n: '1' }] }, { rows: [{ id: fixture.id }] }, { rows: [] }, { rows: [fixture] }]);
  await new PostgresOrcamentoRepository(direct.db).create(scope, payload);
  assert.equal(direct.transactionCount(), 1);

  const supplied = controlledDb([
    { rows: [] }, { rows: [{ n: '1' }] }, { rows: [{ id: fixture.id }] }, { rows: [] }, { rows: [fixture] },
    { rows: [fixture] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [fixture] },
    { rows: [{ id: fixture.id }] }, { rows: [{ ...fixture, status: 'CANCELADO', ativo: false }] },
  ]);
  const repo = new PostgresOrcamentoRepository(supplied.db);
  await repo.create(scope, payload, supplied.executor);
  await repo.update(scope, fixture.id, payload, supplied.executor);
  await repo.cancel(scope, fixture.id, supplied.executor);
  assert.equal(supplied.transactionCount(), 0);
  assert.ok(supplied.calls.every((call) => !call.params || call.params.includes(scope.empresaId) || call.sql.includes('orcamento_itens')));
});

test('postgres orcamento get e list reutilizam executor fornecido', async () => {
  const fixture = row();
  const supplied = controlledDb([{ rows: [fixture] }, { rows: [{ total: 1 }] }, { rows: [fixture] }]);
  const repo = new PostgresOrcamentoRepository(supplied.db);
  assert.equal((await repo.get(scope, fixture.id, supplied.executor))?.id, fixture.id);
  assert.equal((await repo.list(scope, 10, 0, supplied.executor)).total, 1);
  assert.equal(supplied.transactionCount(), 0);
  assert.deepEqual(supplied.calls[0].params, [fixture.id, scope.groupId, scope.empresaId]);
  assert.deepEqual(supplied.calls[1].params, [scope.groupId, scope.empresaId]);
  assert.deepEqual(supplied.calls[2].params, [scope.groupId, scope.empresaId, 10, 0]);
});
test('postgres orcamento update e cancel diretos abrem uma transacao cada', async () => {
  const fixture = row();
  const updateDb = controlledDb([{ rows: [fixture] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [fixture] }]);
  await new PostgresOrcamentoRepository(updateDb.db).update(scope, fixture.id, payload);
  assert.equal(updateDb.transactionCount(), 1);

  const cancelDb = controlledDb([{ rows: [{ id: fixture.id }] }, { rows: [{ ...fixture, status: 'CANCELADO', ativo: false }] }]);
  await new PostgresOrcamentoRepository(cancelDb.db).cancel(scope, fixture.id);
  assert.equal(cancelDb.transactionCount(), 1);
});
