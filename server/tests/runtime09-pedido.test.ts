import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import { calculatePedido, pedidoCreateSchema, type PedidoCreate } from '../src/repositories/pedidoTypes.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const scopeA = { groupId, empresaId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const scopeB = { groupId, empresaId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const input: PedidoCreate = {
  cliente_empresa_id: '11111111-1111-4111-8111-111111111111',
  condicao_pagamento_id: '22222222-2222-4222-8222-222222222222',
  tipo_operacao: 'ENTREGA', data_entrega_solicitada: '2027-02-10T00:00:00.000Z',
  observacoes: 'Pedido sintetico',
  itens: [{ produto_id: '33333333-3333-4333-8333-333333333333', unidade_id: '44444444-4444-4444-8444-444444444444', descricao: 'Produto sintetico', unidade_sigla: 'UN', quantidade: '2', preco_unitario: '12.5', desconto: '1', requer_producao: true }],
};

test('dominio Pedido e estrito e calcula valores sem float', () => {
  assert.equal(pedidoCreateSchema.safeParse({ ...input, total: '999' }).success, false);
  const totals = calculatePedido(input.itens);
  assert.equal(totals.subtotal, '25.000000');
  assert.equal(totals.total, '24.000000');
  assert.equal(totals.itens[0].requer_producao, true);
});

test('repositorio Pedido cria sequencia por empresa e isola tenant', async () => {
  const repo = new InMemoryPedidoRepository();
  const first = await repo.create(scopeA, input, actorId);
  const second = await repo.create(scopeA, input, actorId);
  const other = await repo.create(scopeB, input, actorId);
  assert.equal(first.numero, '00000001');
  assert.equal(second.numero, '00000002');
  assert.equal(other.numero, '00000001');
  assert.equal(await repo.get(scopeB, first.id), null);
  assert.deepEqual((await repo.list(scopeA)).rows.map((row) => row.numero), ['00000002', '00000001']);
});

test('repositorio Pedido preserva numero, snapshots e historico', async () => {
  const repo = new InMemoryPedidoRepository();
  const created = await repo.create(scopeA, input, actorId);
  const updated = await repo.update(scopeA, created.id, { ...input, itens: [{ ...input.itens[0], quantidade: '3' }] }, actorId);
  assert.equal(updated?.numero, created.numero);
  assert.equal(updated?.total, '36.500000');
  const producing = await repo.changeStatus(scopeA, created.id, 'EM_PRODUCAO', actorId, 'Item armado');
  assert.equal(producing?.itens[0].descricao, 'Produto sintetico');
  assert.deepEqual((await repo.history(scopeA, created.id)).map((event) => event.status_novo), ['EM_ABERTO', 'EM_PRODUCAO']);
});

test('repositorio Pedido bloqueia conversao duplicada e rollbacka sequencia/historico', async () => {
  const repo = new InMemoryPedidoRepository();
  const conversion = { ...input, orcamento_id: '55555555-5555-4555-8555-555555555555' };
  await repo.create(scopeA, conversion, actorId);
  await assert.rejects(repo.create(scopeA, conversion, actorId), /ALREADY_CONVERTED/);
  await assert.rejects(repo.withTransaction(async () => { const row = await repo.create(scopeA, input, actorId); await repo.changeStatus(scopeA, row.id, 'CANCELADO', actorId); throw new Error('ROLLBACK'); }), /ROLLBACK/);
  const next = await repo.create(scopeA, input, actorId);
  assert.equal(next.numero, '00000002');
  assert.deepEqual((await repo.history(scopeA, next.id)).map((event) => event.status_novo), ['EM_ABERTO']);
});
