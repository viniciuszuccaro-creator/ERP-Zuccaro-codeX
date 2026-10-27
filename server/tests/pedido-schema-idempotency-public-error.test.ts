/**
 * #353 P2 — contrato público PEDIDO_SCHEMA_IDEMPOTENCY_MISSING.
 * Produção não deve depender de 42703/SQL no envelope para a UI explicar 044.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.js';
import { PEDIDO_SCHEMA_IDEMPOTENCY_MISSING, PostgresPedidoRepository } from '../src/repositories/postgresPedidoRepository.js';

test('PostgresPedidoRepository mapeia 42703 de idempotency_key para código público', async () => {
  const db = {
    withTransaction: async (fn: (ex?: unknown) => Promise<unknown>) => fn({
      query: async () => {
        const err = Object.assign(new Error('column "idempotency_key" of relation "pedidos" does not exist'), {
          code: '42703',
        });
        throw err;
      },
    }),
  };
  const repo = new PostgresPedidoRepository(db as never);
  await assert.rejects(
    () => repo.create(
      { groupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', empresaId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      {
        cliente_empresa_id: '11111111-1111-4111-8111-111111111111',
        condicao_pagamento_id: '22222222-2222-4222-8222-222222222222',
        tipo_operacao: 'ENTREGA',
        data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
        itens: [{
          produto_id: '33333333-3333-4333-8333-333333333333',
          unidade_id: '44444444-4444-4444-8444-444444444444',
          descricao: 'x',
          unidade_sigla: 'UN',
          quantidade: '1',
          preco_unitario: '10',
          desconto: '0',
        }],
      },
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ),
    (error: unknown) => (
      error instanceof AppError
      && error.statusCode === 503
      && error.code === PEDIDO_SCHEMA_IDEMPOTENCY_MISSING
      && !/42703|does not exist/i.test(error.message)
    ),
  );
});

test('getByIdempotencyKey também publica o código estável', async () => {
  const db = {
    query: async () => {
      throw Object.assign(new Error('column payload_fingerprint does not exist'), { code: '42703' });
    },
    withTransaction: async (fn: (ex?: unknown) => Promise<unknown>) => fn(db),
  };
  const repo = new PostgresPedidoRepository(db as never);
  await assert.rejects(
    () => repo.getByIdempotencyKey(
      { groupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', empresaId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      'key-1',
    ),
    (error: unknown) => error instanceof AppError && error.code === PEDIDO_SCHEMA_IDEMPOTENCY_MISSING,
  );
});
