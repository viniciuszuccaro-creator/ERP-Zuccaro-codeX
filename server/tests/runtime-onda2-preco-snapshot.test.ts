import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.js';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import type { OrcamentoCreate } from '../src/repositories/orcamentoTypes.js';
import type { PedidoCreate } from '../src/repositories/pedidoTypes.js';
import { OrcamentoService } from '../src/services/orcamentoService.js';
import { PedidoService } from '../src/services/pedidoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherEmpresa = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const clienteEmpresaId = '11111111-1111-4111-8111-111111111111';
const clienteId = '12111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';
const tabelaId = '55555555-5555-4555-8555-555555555555';

const ctx: RequestContext = {
  requestId: 'req-onda2-price',
  actorId,
  actorEmail: 'synth@example.invalid',
  groupId,
  empresaId,
};

const quotePayload: OrcamentoCreate = {
  cliente_empresa_id: clienteEmpresaId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-02-10T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Produto sintetico',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '1',
    desconto: '0',
  }],
};

const pedidoPayload: PedidoCreate = {
  cliente_empresa_id: clienteEmpresaId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'ENTREGA',
  data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Produto sintetico',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '1',
    desconto: '0',
    requer_producao: false,
  }],
};

function pricePort(preco = '25.500000', calls?: Array<unknown>) {
  return {
    resolveSalePrice: async (_ctx: RequestContext, input: unknown) => {
      calls?.push(input);
      return { preco, tabela_preco_id: tabelaId };
    },
  };
}

function orcamentoFixture(options: { preco?: string | null; calls?: Array<unknown> } = {}) {
  const repo = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: { Comercial: { orcamento: ['visualizar', 'criar', 'editar', 'cancelar'] } },
  });
  const prices = options.preco === null
    ? { resolveSalePrice: async () => null }
    : pricePort(options.preco ?? '25.500000', options.calls);
  const service = new OrcamentoService(
    repo,
    audit,
    { assertEmpresaInGroup: async () => undefined },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => ({ id: condicaoId, ativo: true }) } as never,
    prices,
  );
  return { service, repo, prices, calls: options.calls };
}

function pedidoFixture(options: { preco?: string | null; calls?: Array<unknown> } = {}) {
  const repo = new InMemoryPedidoRepository();
  const orcamentos = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: {
      Comercial: {
        pedido: ['visualizar', 'criar', 'editar', 'cancelar', 'converter-pedido', 'alterar-status'],
      },
    },
  });
  const prices = options.preco === null
    ? { resolveSalePrice: async () => null }
    : pricePort(options.preco ?? '25.500000', options.calls);
  const service = new PedidoService(
    repo,
    orcamentos,
    audit,
    { assertEmpresaInGroup: async (g, e) => { if (e === otherEmpresa) throw new AppError(409, 'TENANT_MISMATCH', 'tenant'); } },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => ({ id: condicaoId, ativo: true }) } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => ({ id: tabelaId, ativo: true }) } as never,
    prices,
  );
  return { service, repo, orcamentos, calls: options.calls };
}

test('Onda2: Orçamento create sobrescreve preco do cliente com snapshot do servidor', async () => {
  const calls: unknown[] = [];
  const { service } = orcamentoFixture({ calls });
  const row = await service.create(ctx, quotePayload);
  assert.equal(row.itens[0].preco_unitario, '25.500000');
  assert.equal(row.total, '51.000000');
  assert.deepEqual(calls[0], {
    clienteEmpresaId,
    produtoId,
    unidadeMedidaId: unidadeId,
  });
});

test('Onda2: Orçamento create falha fechado sem preco autorizado', async () => {
  const { service } = orcamentoFixture({ preco: null });
  await assert.rejects(
    service.create(ctx, quotePayload),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_PRECO_INDISPONIVEL',
  );
});

test('Onda2: Pedido create captura snapshot e ignora preco do payload', async () => {
  const { service } = pedidoFixture({ preco: '40.000000' });
  const row = await service.create(ctx, { ...pedidoPayload, itens: [{ ...pedidoPayload.itens[0], preco_unitario: '1' }] });
  assert.equal(row.itens[0].preco_unitario, '40.000000');
  assert.equal(row.total, '80.000000');
  assert.equal(row.tabela_preco_id, tabelaId);
});

test('Onda2: conversao preserva snapshot do Orçamento (nao-retroatividade)', async () => {
  const calls: unknown[] = [];
  const { service, orcamentos } = pedidoFixture({ preco: '99.000000', calls });
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quotePayload,
    itens: [{ ...quotePayload.itens[0], preco_unitario: '12.340000' }],
  });
  assert.equal(quote.itens[0].preco_unitario, '12.340000');
  const order = await service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(order.itens[0].preco_unitario, '12.340000');
  assert.equal(order.total, quote.total);
  assert.equal(calls.length, 0, 'conversao nao deve reconsultar tabela atual');
});

test('Onda2: Pedido create sem preco falha fechado', async () => {
  const { service } = pedidoFixture({ preco: null });
  await assert.rejects(
    service.create(ctx, pedidoPayload),
    (error: AppError) => error.statusCode === 422 && error.code === 'PEDIDO_PRECO_INDISPONIVEL',
  );
});
