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
import {
  applyPromocaoOnPersist,
  assertDescontoCompativelComPromocao,
  assertPersistedPromocaoSnapshot,
  buildPromocaoDocumentoSnapshot,
  type ComercialPromocaoConfigPort,
} from '../src/services/comercialPromocaoPolicy.js';
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
  requestId: 'req-promocao-snapshot',
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

function condicaoStub(overrides: Record<string, unknown> = {}) {
  return {
    id: condicaoId,
    codigo: 'AVISTA',
    nome: 'À vista',
    ativo: true,
    parcelas: [
      { id: 'p1', ordem: 1, dias: 0, percentual: '100.000000', ativo: true },
    ],
    ...overrides,
  };
}

function pricePort(preco = '100.000000') {
  return {
    resolveSalePrice: async () => ({ preco, tabela_preco_id: tabelaId, tabela_preco_codigo: 'TAB-01', tabela_preco_nome: 'Tabela sintetica' }),
  };
}

function activePromoPort(): ComercialPromocaoConfigPort {
  return {
    getPromocaoConfig: async () => ({
      ativa: true,
      maxBps: 1000,
      cuponsPermitidos: ['CPA10', 'VIP5'],
    }),
  };
}

const avistaAlcada = {
  getConfig: async () => ({ avistaLiberaDescontoSemAprovar: true }),
};

function orcamentoFixture(options: {
  promocaoConfig?: ComercialPromocaoConfigPort | null;
} = {}) {
  const repo = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: { Comercial: { orcamento: ['visualizar', 'criar', 'aprovar', 'editar', 'cancelar'] } },
  });
  const service = new OrcamentoService(
    repo,
    audit,
    { assertEmpresaInGroup: async () => undefined },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => condicaoStub() } as never,
    pricePort(),
    null,
    avistaAlcada,
    options.promocaoConfig === undefined ? activePromoPort() : options.promocaoConfig,
  );
  return { service, repo, audit };
}

function pedidoFixture(options: {
  promocaoConfig?: ComercialPromocaoConfigPort | null;
} = {}) {
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
    { assertEmpresaInGroup: async (g, e) => { if (e === otherEmpresa) throw new AppError(409, 'TENANT_MISMATCH', 'tenant'); } },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => condicaoStub() } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => ({ id: tabelaId, codigo: 'TAB-01', nome: 'Tabela sintetica', ativo: true }) } as never,
    pricePort(),
    null,
    avistaAlcada,
    options.promocaoConfig === undefined ? activePromoPort() : options.promocaoConfig,
  );
  return { service, repo, orcamentos, audit };
}

test('helper: buildPromocaoDocumentoSnapshot vazio sem payload', () => {
  const snap = buildPromocaoDocumentoSnapshot({
    promocao: undefined,
    config: null,
    items: quotePayload.itens,
  });
  assert.deepEqual(snap, { promocao_aplicada: false, promocao_bps: null, promocao_cupom: null });
});

test('helper: buildPromocaoDocumentoSnapshot fail-closed sem config ativa', () => {
  assert.throws(
    () => buildPromocaoDocumentoSnapshot({
      promocao: { bps: 500 },
      config: { ativa: false, maxBps: 1000 },
      items: [{ ...quotePayload.itens[0], desconto: '10.000000' }],
    }),
    (error: AppError) => error.code === 'PROMOCAO_INATIVA',
  );
});

test('helper: assertDescontoCompativelComPromocao exige cobertura do bps', () => {
  // 2 * 100 = 200; 5% = 10. Desconto 5 < 10 → inconsistente.
  assert.throws(
    () => assertDescontoCompativelComPromocao([{
      quantidade: '2',
      preco_unitario: '100.000000',
      desconto: '5.000000',
    }], 500),
    (error: AppError) => error.code === 'PROMOCAO_DESCONTO_INCONSISTENTE',
  );
  assert.doesNotThrow(() => assertDescontoCompativelComPromocao([{
    quantidade: '2',
    preco_unitario: '100.000000',
    desconto: '10.000000',
  }], 500));
});

test('helper: assertPersistedPromocaoSnapshot fail-closed bps inválido', () => {
  assert.throws(
    () => assertPersistedPromocaoSnapshot({ promocao_aplicada: true, promocao_bps: 0, promocao_cupom: null }),
    (error: AppError) => error.code === 'PROMOCAO_SNAPSHOT_AUSENTE',
  );
});

test('helper: applyPromocaoOnPersist aplica desconto no servidor (desconto 0)', () => {
  const result = applyPromocaoOnPersist({
    promocao: { bps: 500 },
    config: { ativa: true, maxBps: 1000 },
    items: [{
      quantidade: '2',
      preco_unitario: '100.000000',
      desconto: '0.000000',
    }],
  });
  assert.equal(result.snapshot.promocao_aplicada, true);
  assert.equal(result.snapshot.promocao_bps, 500);
  assert.equal(result.items[0].desconto, '10.000000');
});

test('helper: applyPromocaoOnPersist é idempotente com UI pós-simular', () => {
  const once = applyPromocaoOnPersist({
    promocao: { bps: 500, cupom: 'CPA10' },
    config: { ativa: true, maxBps: 1000, cuponsPermitidos: ['CPA10'] },
    items: [{
      quantidade: '2',
      preco_unitario: '100.000000',
      desconto: '10.000000',
    }],
  });
  const twice = applyPromocaoOnPersist({
    promocao: { bps: 500, cupom: 'CPA10' },
    config: { ativa: true, maxBps: 1000, cuponsPermitidos: ['CPA10'] },
    items: once.items,
  });
  assert.equal(once.items[0].desconto, '10.000000');
  assert.equal(twice.items[0].desconto, '10.000000');
  assert.equal(twice.snapshot.promocao_cupom, 'CPA10');
});

test('Onda3: Orçamento create sem promoção persiste refs vazias', async () => {
  const { service } = orcamentoFixture();
  const row = await service.create(ctx, quotePayload);
  assert.equal(row.promocao_aplicada, false);
  assert.equal(row.promocao_bps, null);
  assert.equal(row.promocao_cupom, null);
  const reloaded = await service.get(ctx, row.id);
  assert.equal(reloaded.promocao_aplicada, false);
});

test('Onda3: Orçamento create com promoção valida, persiste e audita', async () => {
  const { service, audit } = orcamentoFixture();
  // Preço servidor 100; qty 2; promo 5% = 10.000000
  const row = await service.create(ctx, {
    ...quotePayload,
    promocao: { bps: 500, cupom: 'CPA10' },
    itens: [{ ...quotePayload.itens[0], desconto: '10.000000' }],
  });
  assert.equal(row.promocao_aplicada, true);
  assert.equal(row.promocao_bps, 500);
  assert.equal(row.promocao_cupom, 'CPA10');
  assert.equal(row.desconto, '10.000000');
  const reloaded = await service.get(ctx, row.id);
  assert.equal(reloaded.promocao_cupom, 'CPA10');
  const created = (await audit.listByEntity('Orcamento', row.id)).find((e) => e.action === 'create');
  assert.equal((created?.afterData as { promocao_bps?: number })?.promocao_bps, 500);
});

test('Onda3: Orçamento create promoção fail-closed sem config', async () => {
  const { service } = orcamentoFixture({ promocaoConfig: null });
  await assert.rejects(
    service.create(ctx, {
      ...quotePayload,
      promocao: { bps: 100 },
      itens: [{ ...quotePayload.itens[0], desconto: '2.000000' }],
    }),
    (error: AppError) => error.statusCode === 422 && error.code === 'PROMOCAO_INATIVA',
  );
});

test('Onda3: Orçamento create promoção fail-closed cupom negado', async () => {
  const { service } = orcamentoFixture();
  await assert.rejects(
    service.create(ctx, {
      ...quotePayload,
      promocao: { bps: 500, cupom: 'HACK' },
      itens: [{ ...quotePayload.itens[0], desconto: '10.000000' }],
    }),
    (error: AppError) => error.code === 'PROMOCAO_CUPOM_NEGADO',
  );
});

test('Onda3: Orçamento create com promoção aplica desconto no servidor (UI sem inventar)', async () => {
  const { service } = orcamentoFixture();
  // Desconto 0 no payload — servidor aplica 5% sobre 2*100 = 10.
  const row = await service.create(ctx, {
    ...quotePayload,
    promocao: { bps: 500 },
    itens: [{ ...quotePayload.itens[0], desconto: '0.000000' }],
  });
  assert.equal(row.promocao_aplicada, true);
  assert.equal(row.promocao_bps, 500);
  assert.equal(row.desconto, '10.000000');
  assert.equal(row.total, '190.000000');
  assert.equal(row.itens[0].desconto, '10.000000');
});

test('Onda3: Orçamento create promoção idempotente se UI já aplicou simulação', async () => {
  const { service } = orcamentoFixture();
  const row = await service.create(ctx, {
    ...quotePayload,
    promocao: { bps: 500 },
    itens: [{ ...quotePayload.itens[0], desconto: '10.000000' }],
  });
  assert.equal(row.desconto, '10.000000');
  assert.equal(row.total, '190.000000');
});

test('Onda3: Pedido create persiste e recarrega promoção', async () => {
  const { service } = pedidoFixture();
  const row = await service.create(ctx, {
    ...pedidoPayload,
    promocao: { bps: 500, cupom: 'vip5' },
    itens: [{ ...pedidoPayload.itens[0], desconto: '0.000000' }],
  });
  assert.equal(row.promocao_aplicada, true);
  assert.equal(row.promocao_bps, 500);
  assert.equal(row.promocao_cupom, 'VIP5');
  assert.equal(row.desconto, '10.000000');
  const reloaded = await service.get(ctx, row.id);
  assert.equal(reloaded.promocao_aplicada, true);
  assert.equal(reloaded.promocao_bps, 500);
});

test('Onda3: conversão copia snapshot de promoção do Orçamento', async () => {
  const { service, orcamentos } = pedidoFixture();
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quotePayload,
    itens: [{ ...quotePayload.itens[0], preco_unitario: '100.000000', desconto: '10.000000' }],
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: 'Snapshot original',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: tabelaId,
    tabela_preco_codigo_snapshot: 'SNAP-TAB',
    tabela_preco_nome_snapshot: 'Tabela snapshot original',
    promocao_aplicada: true,
    promocao_bps: 500,
    promocao_cupom: 'CPA10',
  } as never);
  const order = await service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(order.promocao_aplicada, true);
  assert.equal(order.promocao_bps, 500);
  assert.equal(order.promocao_cupom, 'CPA10');
  assert.equal(order.tabela_preco_codigo_snapshot, 'SNAP-TAB');
});

test('Onda3: Pedido update regrava promoção (fail-closed ou limpa)', async () => {
  const { service } = pedidoFixture();
  const created = await service.create(ctx, {
    ...pedidoPayload,
    promocao: { bps: 500 },
    itens: [{ ...pedidoPayload.itens[0], desconto: '10.000000' }],
  });
  assert.equal(created.promocao_aplicada, true);
  const cleared = await service.update(ctx, created.id, pedidoPayload);
  assert.equal(cleared.promocao_aplicada, false);
  assert.equal(cleared.promocao_bps, null);
});
