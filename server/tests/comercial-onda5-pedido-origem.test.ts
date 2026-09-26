import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const ctx: RequestContext = {
  groupId, empresaId, actorId, requestId: 'req-onda5', actorEmail: 'synthetic@example.invalid',
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
  return { service, repo, orcamentos, audit };
}

const basePayload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'RETIRADA' as const,
  data_entrega_solicitada: '2027-03-01T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Item sintetico',
    unidade_sigla: 'UN',
    quantidade: '1',
    preco_unitario: '10',
    desconto: '0',
  }],
};

test('migration 025 adiciona origem/canal/idempotency únicos', async () => {
  const source = await readFile(new URL('../migrations/025_pedidos_origem_canal_idempotency.sql', import.meta.url), 'utf8');
  for (const required of [
    'ADD COLUMN IF NOT EXISTS origem',
    'idempotency_key',
    'external_id',
    'uq_pedidos_idempotency',
    'uq_pedidos_external_id',
    "'MARKETPLACE'",
  ]) assert.ok(source.includes(required), required);
});

test('create MANUAL default e SITE com idempotency', async () => {
  const { service } = fixture();
  const manual = await service.create(ctx, basePayload);
  assert.equal(manual.origem, 'MANUAL');
  assert.equal(manual.idempotency_key, null);

  const site = await service.create(ctx, {
    ...basePayload,
    origem: 'SITE',
    canal: 'site-cpa',
    external_id: 'EXT-1',
    idempotency_key: 'idem-1',
  });
  assert.equal(site.origem, 'SITE');
  assert.equal(site.canal, 'site-cpa');
  assert.equal(site.external_id, 'EXT-1');
  assert.equal(site.idempotency_key, 'idem-1');
});

test('idempotency e external_id conflitam com 409', async () => {
  const { service } = fixture();
  await service.create(ctx, {
    ...basePayload,
    origem: 'MARKETPLACE',
    external_id: 'MP-9',
    idempotency_key: 'k-9',
  });
  await assert.rejects(
    () => service.create(ctx, {
      ...basePayload,
      origem: 'MARKETPLACE',
      idempotency_key: 'k-9',
    }),
    (err: any) => err?.statusCode === 409 && err?.code === 'PEDIDO_IDEMPOTENCY_CONFLICT',
  );
  await assert.rejects(
    () => service.create(ctx, {
      ...basePayload,
      origem: 'MARKETPLACE',
      external_id: 'MP-9',
      idempotency_key: 'k-other',
    }),
    (err: any) => err?.statusCode === 409 && err?.code === 'PEDIDO_EXTERNAL_ID_CONFLICT',
  );
});

test('mesma chave em outra origem é permitida', async () => {
  const { service } = fixture();
  await service.create(ctx, {
    ...basePayload,
    origem: 'SITE',
    idempotency_key: 'shared-key',
  });
  const second = await service.create(ctx, {
    ...basePayload,
    origem: 'APP',
    idempotency_key: 'shared-key',
  });
  assert.equal(second.origem, 'APP');
});

test('list filtra por origem', async () => {
  const { service } = fixture();
  await service.create(ctx, { ...basePayload, origem: 'CHATBOT' });
  await service.create(ctx, { ...basePayload, origem: 'PORTAL_B2B' });
  const page = await service.list(ctx, { origem: 'CHATBOT' });
  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0].origem, 'CHATBOT');
});

test('origem/canal/external/idempotency imutáveis no update', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, {
    ...basePayload,
    origem: 'SITE',
    canal: 'web',
    external_id: 'E-1',
    idempotency_key: 'I-1',
  });
  await assert.rejects(
    () => service.update(ctx, created.id, {
      ...basePayload,
      origem: 'APP',
    }),
    (err: any) => err?.statusCode === 422,
  );
});

test('conversão força origem ORCAMENTO', async () => {
  const { service, orcamentos } = fixture();
  const quote = await orcamentos.create({ groupId, empresaId }, {
    cliente_empresa_id: clienteId,
    condicao_pagamento_id: condicaoId,
    validade_em: '2027-02-10T00:00:00.000Z',
    itens: basePayload.itens,
  });
  const order = await service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(order.origem, 'ORCAMENTO');
  assert.equal(order.orcamento_id, quote.id);
});
