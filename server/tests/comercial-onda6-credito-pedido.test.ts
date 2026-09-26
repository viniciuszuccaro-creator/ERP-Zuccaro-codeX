import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import {
  assertCreditoSuficienteOuAprovar,
  computePedidoTotalMicros,
  evaluatePedidoCreditoSnapshot,
  type ComercialCreditPort,
} from '../src/services/comercialCreditoPolicy.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const ctx: RequestContext = {
  groupId, empresaId, actorId, requestId: 'req-onda6-credito', actorEmail: 'synthetic@example.invalid',
};

const items = [{
  produto_id: produtoId,
  unidade_id: unidadeId,
  descricao: 'Item sintetico',
  unidade_sigla: 'UN',
  quantidade: '2',
  preco_unitario: '50.000000',
  desconto: '0',
}];

test('politica pura: total em micros e avaliacao fail-closed', () => {
  assert.equal(computePedidoTotalMicros(items).toString(), String(100_000000n));
  const ok = evaluatePedidoCreditoSnapshot({
    items,
    limite_credito: '200.000000',
    limite_utilizado: '50.000000',
  });
  assert.equal(ok.aprovado, true);
  assert.equal(ok.limite_disponivel, '150.000000');

  const short = evaluatePedidoCreditoSnapshot({
    items,
    limite_credito: '80.000000',
    limite_utilizado: '0',
  });
  assert.equal(short.aprovado, false);
  assert.equal(short.motivo, 'Limite insuficiente');

  const none = evaluatePedidoCreditoSnapshot({
    items,
    limite_credito: '0',
    limite_utilizado: '0',
  });
  assert.equal(none.aprovado, false);
  assert.match(none.motivo, /sem limite/i);
});

test('assertCredito: sem porta nao inventa; porta nega sem alçada', async () => {
  const skipped = await assertCreditoSuficienteOuAprovar({
    groupId, empresaId, clienteEmpresaId: clienteId, items, credit: null, canAprovarCredito: false,
  });
  assert.equal(skipped, null);

  const port: ComercialCreditPort = {
    async getClienteEmpresaCredit() {
      return { limite_credito: '10.000000', limite_utilizado: '0' };
    },
  };
  await assert.rejects(
    () => assertCreditoSuficienteOuAprovar({
      groupId, empresaId, clienteEmpresaId: clienteId, items, credit: port, canAprovarCredito: false,
    }),
    (error: { statusCode?: number; code?: string }) => error.statusCode === 403 && error.code === 'CREDITO_ALCADA_DENIED',
  );
  const overridden = await assertCreditoSuficienteOuAprovar({
    groupId, empresaId, clienteEmpresaId: clienteId, items, credit: port, canAprovarCredito: true,
  });
  assert.equal(overridden?.aprovado, true);
  assert.match(String(overridden?.motivo), /aprovar-credito/);
});

function fixture(options: { credit?: ComercialCreditPort | null; permissions?: string[] } = {}) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: {
      Comercial: {
        pedido: options.permissions ?? ['visualizar', 'criar', 'editar', 'converter-pedido', 'cancelar', 'alterar-status'],
      },
    },
  });
  const service = new PedidoService(
    new InMemoryPedidoRepository(),
    new InMemoryOrcamentoRepository(),
    new InMemoryAuditRepository(),
    tenant,
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true } as never) },
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId, tipo_item: 'Revenda' } as never) },
    { getById: async () => ({ id: unidadeId, ativo: true } as never) },
    { get: async () => ({ id: condicaoId, ativo: true } as never) },
    { get: async () => null as never },
    { get: async () => null as never },
    { get: async () => null as never },
    { resolveSalePrice: async () => ({ preco: '50.000000' }) },
    options.credit === undefined ? null : options.credit,
  );
  return { service };
}

const basePayload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'RETIRADA' as const,
  data_entrega_solicitada: '2027-04-01T00:00:00.000Z',
  itens: items,
};

test('PedidoService sem porta de credito preserva create (nao inventa)', async () => {
  const { service } = fixture({ credit: null });
  const created = await service.create(ctx, basePayload);
  assert.equal(created.total, '100.000000');
});

test('PedidoService com porta insuficiente bloqueia sem aprovar-credito', async () => {
  const credit: ComercialCreditPort = {
    async getClienteEmpresaCredit() {
      return { limite_credito: '20.000000', limite_utilizado: '0' };
    },
  };
  const { service } = fixture({ credit });
  await assert.rejects(
    () => service.create(ctx, basePayload),
    (error: { statusCode?: number; code?: string }) => error.statusCode === 403 && error.code === 'CREDITO_ALCADA_DENIED',
  );
});

test('PedidoService com porta insuficiente libera com aprovar-credito', async () => {
  const credit: ComercialCreditPort = {
    async getClienteEmpresaCredit() {
      return { limite_credito: '20.000000', limite_utilizado: '0' };
    },
  };
  const { service } = fixture({
    credit,
    permissions: ['visualizar', 'criar', 'editar', 'aprovar-credito'],
  });
  const created = await service.create(ctx, basePayload);
  assert.equal(created.total, '100.000000');
});

test('PedidoService com credito suficiente cria normalmente', async () => {
  const credit: ComercialCreditPort = {
    async getClienteEmpresaCredit() {
      return { limite_credito: '500.000000', limite_utilizado: '10.000000' };
    },
  };
  const { service } = fixture({ credit });
  const created = await service.create(ctx, basePayload);
  assert.equal(created.total, '100.000000');
});
