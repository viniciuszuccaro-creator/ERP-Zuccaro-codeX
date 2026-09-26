import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import { PRODUTO_TIPOS_CANONICOS } from '../src/repositories/produtoTypes.js';
import {
  aggregatePedidoTipoComercial,
  mapProdutoTipoToComercialItem,
  resolveItemTipoComercial,
} from '../src/services/comercialTipoComercialPolicy.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoRevenda = '33333333-3333-4333-8333-333333333333';
const produtoServico = '66666666-6666-4666-8666-666666666666';
const produtoFabricado = '77777777-7777-4777-8777-777777777777';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const ctx: RequestContext = {
  groupId, empresaId, actorId, requestId: 'req-onda5-tipo', actorEmail: 'synthetic@example.invalid',
};

const produtos = new Map([
  [produtoRevenda, { id: produtoRevenda, ativo: true, unidade_medida_id: unidadeId, tipo_item: PRODUTO_TIPOS_CANONICOS.REVENDA }],
  [produtoServico, { id: produtoServico, ativo: true, unidade_medida_id: unidadeId, tipo_item: PRODUTO_TIPOS_CANONICOS.SERVICO }],
  [produtoFabricado, { id: produtoFabricado, ativo: true, unidade_medida_id: unidadeId, tipo_item: PRODUTO_TIPOS_CANONICOS.FABRICADO }],
]);

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
    { getById: async (_scope, id) => (produtos.get(id) as never) ?? null },
    { getById: async () => ({ id: unidadeId, ativo: true } as never) },
    { get: async () => ({ id: condicaoId, ativo: true } as never) },
    { get: async () => null as never },
    { get: async () => null as never },
    { get: async () => null as never },
    { resolveSalePrice: async () => ({ preco: '10.000000' }) },
  );
  return { service, repo, audit };
}

function item(produtoId: string, extra: Record<string, unknown> = {}) {
  return {
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Item sintetico',
    unidade_sigla: 'UN',
    quantidade: '1',
    preco_unitario: '10',
    desconto: '0',
    ...extra,
  };
}

test('migration 026 adiciona tipo_comercial e snapshot de item', async () => {
  const source = await readFile(new URL('../migrations/026_pedidos_tipo_comercial.sql', import.meta.url), 'utf8');
  for (const required of [
    'tipo_comercial',
    'tipo_comercial_snapshot',
    "'ARMADO'",
    "'CORTE_DOBRA'",
    "'MISTO'",
    'idx_pedidos_tipo_comercial',
  ]) assert.ok(source.includes(required), required);
});

test('policy mapeia Produto → tipo comercial e agrega MISTO', () => {
  assert.equal(mapProdutoTipoToComercialItem(PRODUTO_TIPOS_CANONICOS.REVENDA), 'REVENDA');
  assert.equal(mapProdutoTipoToComercialItem(PRODUTO_TIPOS_CANONICOS.SERVICO), 'SERVICO');
  assert.equal(mapProdutoTipoToComercialItem(PRODUTO_TIPOS_CANONICOS.KIT), 'KIT');
  assert.equal(mapProdutoTipoToComercialItem(PRODUTO_TIPOS_CANONICOS.FABRICADO), 'FABRICADO');
  assert.equal(aggregatePedidoTipoComercial(['REVENDA']), 'REVENDA');
  assert.equal(aggregatePedidoTipoComercial(['REVENDA', 'SERVICO']), 'MISTO');
});

test('policy: ARMADO exige requer_producao; hint divergente bloqueado', () => {
  assert.equal(resolveItemTipoComercial({
    produtoTipoItem: PRODUTO_TIPOS_CANONICOS.REVENDA,
    requerProducao: true,
    hint: 'ARMADO',
  }).ok && (resolveItemTipoComercial({
    produtoTipoItem: PRODUTO_TIPOS_CANONICOS.REVENDA,
    requerProducao: true,
    hint: 'ARMADO',
  }) as { ok: true; tipo: string }).tipo, 'ARMADO');

  assert.equal(resolveItemTipoComercial({
    produtoTipoItem: PRODUTO_TIPOS_CANONICOS.REVENDA,
    requerProducao: false,
    hint: 'ARMADO',
  }).ok, false);

  assert.equal(resolveItemTipoComercial({
    produtoTipoItem: PRODUTO_TIPOS_CANONICOS.REVENDA,
    hint: 'SERVICO',
  }).ok, false);
});

test('create deriva REVENDA do Produto e grava snapshot', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, {
    cliente_empresa_id: clienteId,
    condicao_pagamento_id: condicaoId,
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-04-01T00:00:00.000Z',
    itens: [item(produtoRevenda)],
  });
  assert.equal(created.tipo_comercial, 'REVENDA');
  assert.equal(created.itens[0]?.tipo_comercial_snapshot, 'REVENDA');
});

test('create MISTO quando itens divergem; filtro por tipo_comercial', async () => {
  const { service } = fixture();
  const mixed = await service.create(ctx, {
    cliente_empresa_id: clienteId,
    condicao_pagamento_id: condicaoId,
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-04-02T00:00:00.000Z',
    itens: [item(produtoRevenda), item(produtoServico)],
  });
  assert.equal(mixed.tipo_comercial, 'MISTO');
  assert.deepEqual(
    mixed.itens.map((row) => row.tipo_comercial_snapshot).sort(),
    ['REVENDA', 'SERVICO'],
  );

  const onlyMixed = await service.list(ctx, { tipoComercial: 'MISTO' });
  assert.equal(onlyMixed.meta.total, 1);
  assert.equal(onlyMixed.data[0]?.id, mixed.id);
});

test('hint ARMADO com producao; hint SERVICO em revenda → 422', async () => {
  const { service } = fixture();
  const armado = await service.create(ctx, {
    cliente_empresa_id: clienteId,
    condicao_pagamento_id: condicaoId,
    tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-04-03T00:00:00.000Z',
    itens: [item(produtoFabricado, { requer_producao: true, tipo_comercial: 'ARMADO' })],
  });
  assert.equal(armado.tipo_comercial, 'ARMADO');
  assert.equal(armado.itens[0]?.tipo_comercial_snapshot, 'ARMADO');

  await assert.rejects(
    () => service.create(ctx, {
      cliente_empresa_id: clienteId,
      condicao_pagamento_id: condicaoId,
      tipo_operacao: 'RETIRADA',
      data_entrega_solicitada: '2027-04-04T00:00:00.000Z',
      itens: [item(produtoRevenda, { tipo_comercial: 'SERVICO' })],
    }),
    (error: { code?: string }) => error.code === 'PEDIDO_TIPO_COMERCIAL_INVALIDO',
  );
});

test('auditoria inclui tipo_comercial', async () => {
  const { service, audit } = fixture();
  const created = await service.create(ctx, {
    cliente_empresa_id: clienteId,
    condicao_pagamento_id: condicaoId,
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-04-05T00:00:00.000Z',
    itens: [item(produtoServico)],
  });
  const events = await audit.listByEntity('Pedido', created.id);
  assert.ok(events.length >= 1);
  assert.equal((events[0]?.afterData as { tipo_comercial?: string })?.tipo_comercial, 'SERVICO');
});
