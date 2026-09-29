import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.js';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import type { PedidoCreate } from '../src/repositories/pedidoTypes.js';
import {
  assertPedidoDataEntregaCliente,
  isPedidoDataEntregaPassada,
  PEDIDO_DATA_ENTREGA_PASSADA,
  PEDIDO_DATA_ENTREGA_OBRIGATORIA,
  todayPedidoEntregaCalendarDay,
} from '../src/services/comercialPedidoDataEntregaPolicy.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const clienteEmpresaId = '11111111-1111-4111-8111-111111111111';
const clienteId = '12111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';
const tabelaId = '55555555-5555-4555-8555-555555555555';

const ctx: RequestContext = {
  requestId: 'req-data-entrega',
  actorId,
  actorEmail: 'synth@example.invalid',
  groupId,
  empresaId,
};

const nowFixed = new Date('2026-09-29T15:00:00.000Z');

function directPayload(overrides: Partial<PedidoCreate> = {}): PedidoCreate {
  return {
    cliente_empresa_id: clienteEmpresaId,
    condicao_pagamento_id: condicaoId,
    tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-03-10T12:00:00.000Z',
    itens: [{
      produto_id: produtoId,
      unidade_id: unidadeId,
      descricao: 'Produto sintetico',
      unidade_sigla: 'UN',
      quantidade: '2',
      preco_unitario: '10',
      desconto: '0',
      requer_producao: false,
    }],
    ...overrides,
  };
}

function fixture() {
  const repo = new InMemoryPedidoRepository();
  const orcamentos = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: {
      Comercial: {
        pedido: ['visualizar', 'criar', 'aprovar', 'editar', 'cancelar', 'converter-pedido', 'alterar-status'],
      },
    },
  });
  const service = new PedidoService(
    repo,
    orcamentos,
    audit,
    { assertEmpresaInGroup: async () => undefined },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    {
      get: async () => ({
        id: condicaoId,
        codigo: 'COND',
        nome: 'Condicao',
        ativo: true,
        parcelas: [{ id: 'p1', ordem: 1, dias: 0, percentual: '100.000000', ativo: true }],
      }),
    } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => ({ id: tabelaId, codigo: 'TAB', nome: 'Tabela', ativo: true }) } as never,
    {
      resolveSalePrice: async () => ({
        preco: '10.000000',
        tabela_preco_id: tabelaId,
        tabela_preco_codigo: 'TAB',
        tabela_preco_nome: 'Tabela',
      }),
    },
  );
  return { service, audit };
}

test('policy: ENTREGA rejeita data passada e aceita hoje+', () => {
  assert.equal(todayPedidoEntregaCalendarDay(nowFixed), '2026-09-29');
  assert.equal(isPedidoDataEntregaPassada('2026-09-28T12:00:00.000Z', nowFixed), true);
  assert.equal(isPedidoDataEntregaPassada('2026-09-29T12:00:00.000Z', nowFixed), false);
  assert.equal(isPedidoDataEntregaPassada('2026-09-30', nowFixed), false);
  assert.throws(
    () => assertPedidoDataEntregaCliente('ENTREGA', '2026-09-28T12:00:00.000Z', nowFixed),
    (error: AppError) => error.statusCode === 422 && error.code === PEDIDO_DATA_ENTREGA_PASSADA,
  );
  assert.equal(assertPedidoDataEntregaCliente('ENTREGA', '2026-09-29T12:00:00.000Z', nowFixed), '2026-09-29');
  assert.equal(assertPedidoDataEntregaCliente('RETIRADA', '2020-01-01T12:00:00.000Z', nowFixed), null);
});

test('policy: ENTREGA sem data é obrigatória fail-closed', () => {
  assert.throws(
    () => assertPedidoDataEntregaCliente('ENTREGA', '', nowFixed),
    (error: AppError) => error.code === PEDIDO_DATA_ENTREGA_OBRIGATORIA,
  );
});

test('Pedido create ENTREGA rejeita data_entrega_solicitada no passado', async () => {
  const { service } = fixture();
  await assert.rejects(
    service.create(ctx, directPayload({ data_entrega_solicitada: '2020-01-15T12:00:00.000Z' })),
    (error: AppError) => error.statusCode === 422 && error.code === PEDIDO_DATA_ENTREGA_PASSADA,
  );
});

test('Pedido create ENTREGA aceita data futura e persiste', async () => {
  const { service, audit } = fixture();
  const row = await service.create(ctx, directPayload({ data_entrega_solicitada: '2027-06-01T12:00:00.000Z' }));
  assert.equal(row.data_entrega_solicitada, '2027-06-01T12:00:00.000Z');
  assert.equal(row.tipo_operacao, 'ENTREGA');
  const logs = await audit.listByEntity('Pedido', row.id);
  assert.equal(logs.some((entry) => entry.action === 'create'), true);
});

test('Pedido update ENTREGA rejeita data passada', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, directPayload());
  await assert.rejects(
    service.update(ctx, created.id, directPayload({ data_entrega_solicitada: '2021-05-01T12:00:00.000Z' })),
    (error: AppError) => error.statusCode === 422 && error.code === PEDIDO_DATA_ENTREGA_PASSADA,
  );
  const reloaded = await service.get(ctx, created.id);
  assert.equal(reloaded.data_entrega_solicitada, '2027-03-10T12:00:00.000Z');
});

test('Pedido create RETIRADA aceita data passada (gate só ENTREGA)', async () => {
  const { service } = fixture();
  const row = await service.create(ctx, directPayload({
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2020-01-15T12:00:00.000Z',
  }));
  assert.equal(row.tipo_operacao, 'RETIRADA');
  assert.equal(row.data_entrega_solicitada, '2020-01-15T12:00:00.000Z');
});
