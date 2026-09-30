import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.js';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import type { OrcamentoCreate } from '../src/repositories/orcamentoTypes.js';
import {
  assertOrcamentoValidadeVigente,
  isOrcamentoValidadeExpirada,
  ORCAMENTO_VALIDADE_EXPIRADA,
  ORCAMENTO_VALIDADE_INVALIDA,
} from '../src/services/comercialOrcamentoValidadePolicy.js';
import { OrcamentoService } from '../src/services/orcamentoService.js';
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
  requestId: 'req-orc-validade',
  actorId,
  actorEmail: 'synth@example.invalid',
  groupId,
  empresaId,
};

const nowFixed = new Date('2026-09-29T15:00:00.000Z');

function quotePayload(validadeEm: string): OrcamentoCreate {
  return {
    cliente_empresa_id: clienteEmpresaId,
    condicao_pagamento_id: condicaoId,
    validade_em: validadeEm,
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
}

function condicaoStub() {
  return {
    id: condicaoId,
    codigo: 'COND-28',
    nome: '28 dias',
    ativo: true,
    parcelas: [{ id: 'p1', ordem: 1, dias: 28, percentual: '100.000000', ativo: true }],
  };
}

function pricePort() {
  return {
    resolveSalePrice: async () => ({
      preco: '25.500000',
      tabela_preco_id: tabelaId,
      tabela_preco_codigo: 'TAB-01',
      tabela_preco_nome: 'Tabela sintetica',
    }),
  };
}

function orcamentoFixture() {
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
    null,
    null,
    { get: async () => ({ id: tabelaId, codigo: 'TAB-01', nome: 'Tabela sintetica', ativo: true }) } as never,
    new InMemoryPedidoRepository(),
  );
  return { service, repo, audit };
}

function pedidoFixture(orcamentos: InMemoryOrcamentoRepository) {
  const repo = new InMemoryPedidoRepository();
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
    { get: async () => condicaoStub() } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => ({ id: tabelaId, codigo: 'TAB-01', nome: 'Tabela sintetica', ativo: true }) } as never,
    pricePort(),
  );
  return { service, audit };
}

test('policy: assertOrcamentoValidadeVigente fail-closed quando expirada', () => {
  assert.throws(
    () => assertOrcamentoValidadeVigente('2026-01-01T00:00:00.000Z', nowFixed),
    (error: AppError) => error.statusCode === 422 && error.code === ORCAMENTO_VALIDADE_EXPIRADA,
  );
  assert.equal(isOrcamentoValidadeExpirada('2026-01-01T00:00:00.000Z', nowFixed), true);
  assert.equal(isOrcamentoValidadeExpirada('2027-01-01T00:00:00.000Z', nowFixed), false);
});

test('policy: validade inválida/ausente é fail-closed', () => {
  assert.throws(
    () => assertOrcamentoValidadeVigente('', nowFixed),
    (error: AppError) => error.code === ORCAMENTO_VALIDADE_INVALIDA,
  );
  assert.throws(
    () => assertOrcamentoValidadeVigente('not-a-date', nowFixed),
    (error: AppError) => error.code === ORCAMENTO_VALIDADE_INVALIDA,
  );
});

test('Onda3: Orçamento create rejeita validade_em expirada (422 ORCAMENTO_VALIDADE_EXPIRADA)', async () => {
  const { service } = orcamentoFixture();
  await assert.rejects(
    service.create(ctx, quotePayload('2020-01-01T12:00:00.000Z')),
    (error: AppError) => error.statusCode === 422 && error.code === ORCAMENTO_VALIDADE_EXPIRADA,
  );
});

test('Onda3: Orçamento create aceita validade futura e persiste', async () => {
  const { service, audit } = orcamentoFixture();
  const row = await service.create(ctx, quotePayload('2027-06-15T12:00:00.000Z'));
  assert.equal(row.validade_em, '2027-06-15T12:00:00.000Z');
  const logs = await audit.listByEntity('Orcamento', row.id);
  assert.equal(logs.some((entry) => entry.action === 'create'), true);
});

test('Onda3: Orçamento update rejeita validade_em expirada', async () => {
  const { service } = orcamentoFixture();
  const created = await service.create(ctx, quotePayload('2027-06-15T12:00:00.000Z'));
  await assert.rejects(
    service.update(ctx, created.id, quotePayload('2021-05-01T12:00:00.000Z')),
    (error: AppError) => error.statusCode === 422 && error.code === ORCAMENTO_VALIDADE_EXPIRADA,
  );
  const reloaded = await service.get(ctx, created.id);
  assert.equal(reloaded.validade_em, '2027-06-15T12:00:00.000Z');
});

test('Onda3: Orçamento update pode prorrogar validade ainda vigente', async () => {
  const { service } = orcamentoFixture();
  const created = await service.create(ctx, quotePayload('2027-06-15T12:00:00.000Z'));
  const updated = await service.update(ctx, created.id, quotePayload('2028-01-10T12:00:00.000Z'));
  assert.equal(updated.validade_em, '2028-01-10T12:00:00.000Z');
});

test('Onda3: conversão Orçamento→Pedido rejeita validade expirada (fail-closed)', async () => {
  const { repo: orcamentos } = orcamentoFixture();
  const { service } = pedidoFixture(orcamentos);
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quotePayload('2020-06-01T12:00:00.000Z'),
    itens: [{ ...quotePayload('2020-06-01T12:00:00.000Z').itens[0], preco_unitario: '12.340000' }],
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: 'Snapshot original',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: tabelaId,
    tabela_preco_codigo_snapshot: 'SNAP-TAB',
    tabela_preco_nome_snapshot: 'Tabela snapshot',
    promocao_aplicada: false,
    promocao_bps: null,
    promocao_cupom: null,
  } as never);
  await assert.rejects(
    service.convert(ctx, quote.id, {
      tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    }),
    (error: AppError) => error.statusCode === 422 && error.code === ORCAMENTO_VALIDADE_EXPIRADA,
  );
});

test('Onda3: conversão com validade vigente copia snapshots e cria Pedido', async () => {
  const { repo: orcamentos } = orcamentoFixture();
  const { service } = pedidoFixture(orcamentos);
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quotePayload('2027-12-01T12:00:00.000Z'),
    itens: [{ ...quotePayload('2027-12-01T12:00:00.000Z').itens[0], preco_unitario: '12.340000' }],
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: 'Snapshot original',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: tabelaId,
    tabela_preco_codigo_snapshot: 'SNAP-TAB',
    tabela_preco_nome_snapshot: 'Tabela snapshot',
    promocao_aplicada: false,
    promocao_bps: null,
    promocao_cupom: null,
  } as never);
  const order = await service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(order.orcamento_id, quote.id);
  assert.equal(order.condicao_pagamento_codigo_snapshot, 'SNAP-28');
  assert.equal(order.tabela_preco_codigo_snapshot, 'SNAP-TAB');
});
