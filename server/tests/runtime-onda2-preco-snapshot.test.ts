import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.js';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import { InMemoryTabelaPrecoRepository } from '../src/repositories/inMemoryTabelaPrecoRepository.js';
import type { OrcamentoCreate } from '../src/repositories/orcamentoTypes.js';
import type { PedidoCreate } from '../src/repositories/pedidoTypes.js';
import { OrcamentoService } from '../src/services/orcamentoService.js';
import { PedidoService } from '../src/services/pedidoService.js';
import { TabelaPrecoService } from '../src/services/tabelaPrecoService.js';

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
const outraTabelaId = '77777777-7777-4777-8777-777777777777';

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

type SalePricePort = ConstructorParameters<typeof OrcamentoService>[8];

function orcamentoFixture(options: { preco?: string | null; calls?: Array<unknown>; prices?: SalePricePort; productUnitId?: () => string } = {}) {
  const repo = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: { Comercial: { orcamento: ['visualizar', 'criar', 'aprovar', 'editar', 'cancelar'] } },
  });
  const prices = options.prices ?? (options.preco === null
    ? { resolveSalePrice: async () => null }
    : pricePort(options.preco ?? '25.500000', options.calls));
  const service = new OrcamentoService(
    repo,
    audit,
    { assertEmpresaInGroup: async () => undefined },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: options.productUnitId?.() ?? unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => ({ id: condicaoId, ativo: true }) } as never,
    prices,
    null,
    null,
    { get: async () => ({ id: tabelaId, ativo: true }) },
  );
  return { service, repo, prices, calls: options.calls };
}

function pedidoFixture(options: { preco?: string | null; calls?: Array<unknown>; prices?: SalePricePort; orcamentos?: InMemoryOrcamentoRepository; productUnitId?: () => string } = {}) {
  const repo = new InMemoryPedidoRepository();
  const orcamentos = options.orcamentos ?? new InMemoryOrcamentoRepository();
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
  const prices = options.prices ?? (options.preco === null
    ? { resolveSalePrice: async () => null }
    : pricePort(options.preco ?? '25.500000', options.calls));
  const service = new PedidoService(
    repo,
    orcamentos,
    audit,
    { assertEmpresaInGroup: async (g, e) => { if (e === otherEmpresa) throw new AppError(409, 'TENANT_MISMATCH', 'tenant'); } },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: options.productUnitId?.() ?? unidadeId }) } as never,
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

test('Onda2: Pedido convertido não troca tabela ou preço snapshotado pelo Orçamento', async () => {
  const { service, repo, orcamentos } = pedidoFixture();
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quotePayload, tabela_preco_id: tabelaId,
    itens: [{ ...quotePayload.itens[0], preco_unitario: '12.340000' }],
  });
  const conversion = {
    tipo_operacao: 'RETIRADA' as const, data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  };
  await assert.rejects(
    service.convert(ctx, quote.id, { ...conversion, tabela_preco_id: outraTabelaId }),
    { code: 'PEDIDO_TABELA_PRECO_DIVERGENTE' },
  );
  assert.equal((await repo.list({ groupId, empresaId })).total, 0);
  const order = await service.convert(ctx, quote.id, conversion);
  assert.equal(order.tabela_preco_id, tabelaId);
  assert.equal(order.itens[0].preco_unitario, '12.340000');
  const updatePayload = {
    ...pedidoPayload, orcamento_id: quote.id, tabela_preco_id: tabelaId,
    itens: [{ ...pedidoPayload.itens[0], preco_unitario: '12.340000' }],
  };
  await assert.rejects(
    service.update(ctx, order.id, { ...updatePayload, tabela_preco_id: outraTabelaId }),
    { code: 'PEDIDO_TABELA_PRECO_DIVERGENTE' },
  );
  await assert.rejects(
    service.update(ctx, order.id, {
      ...updatePayload, cliente_empresa_id: '88888888-8888-4888-8888-888888888888',
    }),
    { code: 'PEDIDO_CLIENTE_IMUTAVEL' },
  );
  await assert.rejects(
    service.update(ctx, order.id, { ...updatePayload, itens: [{ ...updatePayload.itens[0], preco_unitario: '99.000000' }] }),
    { code: 'PEDIDO_SNAPSHOT_IMUTAVEL' },
  );
  const unchanged = await service.get(ctx, order.id);
  assert.equal(unchanged.tabela_preco_id, tabelaId);
  assert.equal(unchanged.itens[0].preco_unitario, '12.340000');
  const retry = await service.update(ctx, order.id, {
    ...updatePayload, itens: [{ ...updatePayload.itens[0], quantidade: '3' }],
  });
  assert.equal(retry.tabela_preco_id, tabelaId);
  assert.equal(retry.itens[0].preco_unitario, '12.340000');
});

test('Onda2: Pedido create sem preco falha fechado', async () => {
  const { service } = pedidoFixture({ preco: null });
  await assert.rejects(
    service.create(ctx, pedidoPayload),
    (error: AppError) => error.statusCode === 422 && error.code === 'PEDIDO_PRECO_INDISPONIVEL',
  );
});

test('Onda2: payload não pode atribuir a Orçamento/Pedido tabela diferente da que resolveu o preço', async () => {
  const quotes = orcamentoFixture();
  const orders = pedidoFixture();
  await assert.rejects(
    quotes.service.create(ctx, { ...quotePayload, tabela_preco_id: outraTabelaId }),
    { code: 'ORCAMENTO_TABELA_PRECO_DIVERGENTE' },
  );
  await assert.rejects(
    orders.service.create(ctx, { ...pedidoPayload, tabela_preco_id: outraTabelaId }),
    { code: 'PEDIDO_TABELA_PRECO_DIVERGENTE' },
  );
  assert.equal((await quotes.repo.list({ groupId, empresaId })).total, 0);
  assert.equal((await orders.repo.list({ groupId, empresaId })).total, 0);
  const quote = await quotes.service.create(ctx, quotePayload);
  const order = await orders.service.create(ctx, pedidoPayload);
  assert.equal(quote.tabela_preco_id, tabelaId);
  assert.equal(order.tabela_preco_id, tabelaId);
  await assert.rejects(
    quotes.service.update(ctx, quote.id, { ...quotePayload, tabela_preco_id: outraTabelaId }),
    { code: 'ORCAMENTO_TABELA_PRECO_DIVERGENTE' },
  );
  await assert.rejects(
    orders.service.update(ctx, order.id, { ...pedidoPayload, tabela_preco_id: outraTabelaId }),
    { code: 'PEDIDO_TABELA_PRECO_DIVERGENTE' },
  );
  assert.equal((await quotes.service.get(ctx, quote.id)).tabela_preco_id, tabelaId);
  assert.equal((await orders.service.get(ctx, order.id)).tabela_preco_id, tabelaId);
});

test('Onda2: itens resolvidos por tabelas diferentes não geram snapshot com origem ambígua', async () => {
  const alternatingPrices = () => {
    let calls = 0;
    return { resolveSalePrice: async () => ({
      preco: '25.500000', tabela_preco_id: ++calls === 1 ? tabelaId : outraTabelaId,
    }) };
  };
  const quotes = orcamentoFixture({ prices: alternatingPrices() });
  const orders = pedidoFixture({ prices: alternatingPrices() });
  await assert.rejects(
    quotes.service.create(ctx, { ...quotePayload, itens: [quotePayload.itens[0], quotePayload.itens[0]] }),
    { code: 'ORCAMENTO_TABELA_PRECO_DIVERGENTE' },
  );
  await assert.rejects(
    orders.service.create(ctx, { ...pedidoPayload, itens: [pedidoPayload.itens[0], pedidoPayload.itens[0]] }),
    { code: 'PEDIDO_TABELA_PRECO_DIVERGENTE' },
  );
  assert.equal((await quotes.repo.list({ groupId, empresaId })).total, 0);
  assert.equal((await orders.repo.list({ groupId, empresaId })).total, 0);
});

test('Onda2: troca da unidade principal bloqueia novas vendas sem alterar snapshots de Orçamento e Pedido', async () => {
  const tabelas = new InMemoryTabelaPrecoRepository();
  const replacementUnitId = '66666666-6666-4666-8666-666666666666';
  tabelas.hydrateUnidade({ id: unidadeId, group_id: groupId, sigla: 'UN' });
  let currentPrincipal = unidadeId;
  const authorizeUnit = (allowed: boolean) => {
    currentPrincipal = allowed ? unidadeId : replacementUnitId;
    tabelas.hydrateProduto({
      id: produtoId, group_id: groupId, empresa_id: null,
      unidade_medida_id: currentPrincipal, unidades_secundarias: [],
    });
  };
  authorizeUnit(true);
  const table = await tabelas.create({ groupId, empresaId }, {
    nome: 'VENDA SINTETICA', vigencia_inicio: '2020-01-01',
  }, actorId);
  const item = await tabelas.createItem({ groupId, empresaId }, table.id, {
    produto_id: produtoId, unidade_medida_id: unidadeId, preco: '25.500000',
  }, actorId);
  const prices = new TabelaPrecoService(
    tabelas, new InMemoryAuditRepository(),
    { assertEmpresaInGroup: async () => undefined }, new InMemoryRbacGuard(),
    { getEmpresaLinkById: async () => ({
      id: clienteEmpresaId, ativo: true, bloqueado: false, habilitado_operacao: true,
      tabela_preco_id: table.id,
    }) } as never,
  );
  const quotes = orcamentoFixture({ prices, productUnitId: () => currentPrincipal });
  const orders = pedidoFixture({ prices, orcamentos: quotes.repo, productUnitId: () => currentPrincipal });
  const quote = await quotes.service.create(ctx, quotePayload);
  const converted = await orders.service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(quote.itens[0].preco_unitario, '25.500000');
  assert.equal(converted.itens[0].preco_unitario, quote.itens[0].preco_unitario);

  authorizeUnit(false);
  assert.equal(await prices.resolveSalePrice(ctx, {
    clienteEmpresaId, produtoId, unidadeMedidaId: unidadeId,
  }), null);
  await assert.rejects(quotes.service.create(ctx, quotePayload), { code: 'ORCAMENTO_UNIDADE_INVALIDA' });
  await assert.rejects(orders.service.create(ctx, pedidoPayload), { code: 'PEDIDO_UNIDADE_INVALIDA' });
  assert.equal((await quotes.repo.list({ groupId, empresaId })).total, 1);
  assert.equal((await orders.repo.list({ groupId, empresaId })).total, 1);
  assert.equal((await quotes.service.get(ctx, quote.id)).itens[0].preco_unitario, '25.500000');
  assert.equal((await orders.service.get(ctx, converted.id)).itens[0].preco_unitario, '25.500000');

  authorizeUnit(true);
  await tabelas.updateItem({ groupId, empresaId }, table.id, item.id, { preco: '30.000000' }, actorId);
  const retriedQuote = await quotes.service.create(ctx, quotePayload);
  const retriedOrder = await orders.service.create(ctx, pedidoPayload);
  assert.equal(retriedQuote.itens[0].preco_unitario, '30.000000');
  assert.equal(retriedOrder.itens[0].preco_unitario, '30.000000');
  assert.equal((await quotes.service.get(ctx, quote.id)).itens[0].preco_unitario, '25.500000');
  assert.equal((await orders.service.get(ctx, converted.id)).itens[0].preco_unitario, '25.500000');
});
