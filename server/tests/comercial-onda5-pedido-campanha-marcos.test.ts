import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import {
  assertPedidoComercialmenteEditavel,
  isPedidoComercialmenteEditavel,
  isPedidoEmMarcoCritico,
} from '../src/services/comercialPedidoMarcoPolicy.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const ctx: RequestContext = {
  groupId, empresaId, actorId, requestId: 'req-onda5-campanha', actorEmail: 'synthetic@example.invalid',
};

function fixture() {
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: {
      Comercial: {
        pedido: ['visualizar', 'criar', 'editar', 'converter-pedido', 'cancelar', 'alterar-status'],
        orcamento: ['visualizar', 'criar', 'editar'],
      },
    },
  });
  const repo = new InMemoryPedidoRepository();
  const orcamentos = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const service = new PedidoService(
    repo, orcamentos, audit, tenant, rbac,
    { getEmpresaLinkById: async () => ({ id: clienteId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true } as never) },
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId, tipo_item: 'Revenda' } as never) },
    { getById: async () => ({ id: unidadeId, ativo: true } as never) },
    { get: async () => ({ id: condicaoId, ativo: true } as never) },
    { get: async () => null as never },
    { get: async () => null as never },
    { get: async () => null as never },
    { resolveSalePrice: async () => ({ preco: '10.000000' }) },
  );
  return { service, repo };
}

const basePayload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'RETIRADA' as const,
  data_entrega_solicitada: '2027-08-01T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Item campanha',
    unidade_sigla: 'UN',
    quantidade: '1',
    preco_unitario: '10',
    desconto: '0',
  }],
};

test('migration 031 adiciona campanha no Pedido', async () => {
  const source = await readFile(new URL('../migrations/031_pedidos_campanha.sql', import.meta.url), 'utf8');
  for (const required of ['campanha', 'pedidos_campanha_len_check', 'idx_pedidos_campanha']) {
    assert.ok(source.includes(required), required);
  }
});

test('politica de marcos: editavel so EM_ABERTO', () => {
  assert.equal(isPedidoComercialmenteEditavel('EM_ABERTO'), true);
  assert.equal(isPedidoComercialmenteEditavel('EM_PRODUCAO'), false);
  assert.equal(isPedidoEmMarcoCritico('PRONTO_RETIRADA'), true);
  assert.equal(assertPedidoComercialmenteEditavel('EM_ABERTO').ok, true);
  assert.equal(assertPedidoComercialmenteEditavel('FINALIZADO').ok, false);
  assert.equal(assertPedidoComercialmenteEditavel('CANCELADO').ok, false);
});

test('create persiste campanha; update nao altera campanha; marco bloqueia edicao', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, {
    ...basePayload,
    campanha: 'Black Friday Sintetica',
    canal: 'LOJA',
  });
  assert.equal(created.campanha, 'Black Friday Sintetica');

  await assert.rejects(
    () => service.update(ctx, created.id, {
      ...basePayload,
      campanha: 'Outra Campanha',
      canal: 'LOJA',
    }),
    (error: { details?: { campanha?: string } }) => error.details?.campanha === 'immutable',
  );

  const ready = await service.transition(ctx, created.id, 'PRONTO_RETIRADA');
  assert.equal(ready.status, 'PRONTO_RETIRADA');

  await assert.rejects(
    () => service.update(ctx, created.id, { ...basePayload, canal: 'LOJA' }),
    (error: { code?: string }) => error.code === 'PEDIDO_STATE_CONFLICT',
  );
  await assert.rejects(
    () => service.cancel(ctx, created.id, 'tentativa apos marco'),
    (error: { code?: string }) => error.code === 'PEDIDO_STATE_CONFLICT',
  );
});
