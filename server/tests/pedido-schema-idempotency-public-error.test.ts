/**
 * #353/#397 — contrato público PEDIDO_SCHEMA_IDEMPOTENCY_MISSING.
 * Produção não deve depender de 42703/SQL no envelope para a UI explicar 044.
 * Middleware: só AppError classificado recebe o código; INTERNAL_ERROR genérico ≠ 044.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { AppError } from '../src/api/errors.js';
import type { AppConfig } from '../src/config/env.js';
import { createErrorHandler } from '../src/middleware/errorHandler.js';
import { PEDIDO_SCHEMA_IDEMPOTENCY_MISSING, PostgresPedidoRepository } from '../src/repositories/postgresPedidoRepository.js';

function captureHandler(isProduction: boolean) {
  const handler = createErrorHandler({ isProduction } as AppConfig);
  let status = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  const req = { requestId: 'req-044-test' } as Request;
  return {
    run(error: unknown) {
      handler(error, req, res, (() => {}) as never);
      return { status, body };
    },
  };
}

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

test('middleware produção: AppError PEDIDO_SCHEMA_IDEMPOTENCY_MISSING publica código estável sem SQL', () => {
  const { run } = captureHandler(true);
  const out = run(new AppError(
    503,
    PEDIDO_SCHEMA_IDEMPOTENCY_MISSING,
    'Pedido schema missing idempotency support',
  ));
  assert.equal(out.status, 503);
  const err = (out.body as { error: { code: string; message: string } }).error;
  assert.equal(err.code, PEDIDO_SCHEMA_IDEMPOTENCY_MISSING);
  assert.doesNotMatch(err.message, /42703|does not exist|idempotency_key/i);
  assert.equal(err.code !== 'INTERNAL_ERROR', true);
});

test('middleware produção: Error genérico/SQL NÃO vira PEDIDO_SCHEMA_IDEMPOTENCY_MISSING', () => {
  const { run } = captureHandler(true);
  const sql = Object.assign(new Error('column "idempotency_key" of relation "pedidos" does not exist'), {
    code: '42703',
  });
  const out = run(sql);
  assert.equal(out.status, 500);
  const err = (out.body as { error: { code: string; message: string } }).error;
  assert.equal(err.code, 'INTERNAL_ERROR');
  assert.equal(err.message, 'Internal server error');
  assert.notEqual(err.code, PEDIDO_SCHEMA_IDEMPOTENCY_MISSING);
  assert.doesNotMatch(err.message, /42703|idempotency_key|does not exist/i);
});
