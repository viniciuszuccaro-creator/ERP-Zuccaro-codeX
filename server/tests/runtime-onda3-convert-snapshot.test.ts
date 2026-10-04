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
  orcamentoConvertSnapshotGapHint,
  resolveOrcamentoConvertSnapshots,
} from '../src/services/comercialConvertSnapshotPolicy.js';
import { PedidoService } from '../src/services/pedidoService.js';
import { ORCAMENTO_VALIDADE_EXPIRADA } from '../src/services/comercialOrcamentoValidadePolicy.js';

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
  requestId: 'req-convert-snapshot',
  actorId,
  actorEmail: 'synth@example.invalid',
  groupId,
  empresaId,
};

const quoteBase: OrcamentoCreate = {
  cliente_empresa_id: clienteEmpresaId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-12-01T12:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Produto sintetico',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '10',
    desconto: '0',
  }],
};

function liveCondicao() {
  return {
    id: condicaoId,
    codigo: 'LIVE-99',
    nome: 'Condicao atual alterada',
    ativo: true,
    parcelas: [{ id: 'p1', ordem: 1, dias: 99, percentual: '100.000000', ativo: true }],
  };
}

function liveTabela() {
  return {
    id: tabelaId,
    codigo: 'LIVE-TAB',
    nome: 'Tabela atual alterada',
    ativo: true,
  };
}

function fullSnapshots(overrides: Record<string, unknown> = {}) {
  return {
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: 'Snapshot original',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: tabelaId,
    tabela_preco_codigo_snapshot: 'SNAP-TAB',
    tabela_preco_nome_snapshot: 'Tabela snapshot original',
    promocao_aplicada: false,
    promocao_bps: null,
    promocao_cupom: null,
    ...overrides,
  };
}

function pedidoFixture() {
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
  const avistaAlcada = {
    getConfig: async () => ({ avistaLiberaDescontoSemAprovar: true }),
  };
  const service = new PedidoService(
    repo,
    orcamentos,
    audit,
    { assertEmpresaInGroup: async () => undefined },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => liveCondicao() } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => liveTabela() } as never,
    {
      resolveSalePrice: async () => ({
        preco: '10.000000',
        tabela_preco_id: tabelaId,
        tabela_preco_codigo: 'LIVE-TAB',
        tabela_preco_nome: 'Tabela atual alterada',
      }),
    },
    null,
    avistaAlcada,
  );
  return { service, repo, orcamentos, audit };
}

test('helper: resolveOrcamentoConvertSnapshots copia condição+promo+tabela sem live', async () => {
  const snaps = await resolveOrcamentoConvertSnapshots(fullSnapshots({
    condicao_pagamento_id: condicaoId,
    promocao_aplicada: true,
    promocao_bps: 500,
    promocao_cupom: 'CPA10',
  }) as never, {
    resolveLegacyCondicao: async () => {
      throw new Error('nao deve resolver legado');
    },
  });
  assert.equal(snaps.condicao_pagamento_codigo_snapshot, 'SNAP-28');
  assert.equal(snaps.condicao_pagamento_nome_snapshot, 'Snapshot original');
  assert.equal(snaps.condicao_pagamento_parcelas_snapshot[0]?.dias, 28);
  assert.equal(snaps.tabela_preco_codigo_snapshot, 'SNAP-TAB');
  assert.equal(snaps.tabela_preco_nome_snapshot, 'Tabela snapshot original');
  assert.equal(snaps.promocao_aplicada, true);
  assert.equal(snaps.promocao_bps, 500);
  assert.equal(snaps.promocao_cupom, 'CPA10');
});

test('helper: tabela_preco_id sem codigo/nome fail-closed (pós-031)', async () => {
  await assert.rejects(
    () => resolveOrcamentoConvertSnapshots({
      condicao_pagamento_id: condicaoId,
      condicao_pagamento_codigo_snapshot: 'SNAP-28',
      condicao_pagamento_nome_snapshot: 'Snapshot original',
      condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
      tabela_preco_id: tabelaId,
      promocao_aplicada: false,
      promocao_bps: null,
      promocao_cupom: null,
    }, {
      resolveLegacyCondicao: async () => liveCondicao() as never,
    }),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_TABELA_SNAPSHOT_AUSENTE',
  );
});

test('helper: condição parcial (só codigo) fail-closed', async () => {
  await assert.rejects(
    () => resolveOrcamentoConvertSnapshots({
      condicao_pagamento_id: condicaoId,
      condicao_pagamento_codigo_snapshot: 'SNAP-28',
      condicao_pagamento_nome_snapshot: null,
      condicao_pagamento_parcelas_snapshot: null,
      promocao_aplicada: false,
    }, {
      resolveLegacyCondicao: async () => liveCondicao() as never,
    }),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_CONDICAO_SNAPSHOT_AUSENTE',
  );
});

test('helper: gap hint UI para tabela incompleta', () => {
  assert.match(
    String(orcamentoConvertSnapshotGapHint({
      condicao_pagamento_id: condicaoId,
      tabela_preco_id: tabelaId,
    })),
    /tabela/i,
  );
  assert.equal(orcamentoConvertSnapshotGapHint({
    condicao_pagamento_id: condicaoId,
    ...fullSnapshots(),
  }), null);
});

test('Onda3 residual: conversão copia TODOS os snapshots (não-retroatividade)', async () => {
  const { service, orcamentos } = pedidoFixture();
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quoteBase,
    itens: [{ ...quoteBase.itens[0], preco_unitario: '12.340000', desconto: '0' }],
    ...fullSnapshots({
      promocao_aplicada: true,
      promocao_bps: 500,
      promocao_cupom: 'CPA10',
    }),
  } as never);
  // Sem desconto em linha → alçada não bloqueia; snapshot de promoção ainda é copiado.
  const order = await service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(order.condicao_pagamento_codigo_snapshot, 'SNAP-28');
  assert.equal(order.condicao_pagamento_nome_snapshot, 'Snapshot original');
  assert.equal(order.condicao_pagamento_parcelas_snapshot?.[0]?.dias, 28);
  assert.equal(order.tabela_preco_id, tabelaId);
  assert.equal(order.tabela_preco_codigo_snapshot, 'SNAP-TAB');
  assert.equal(order.tabela_preco_nome_snapshot, 'Tabela snapshot original');
  assert.equal(order.promocao_aplicada, true);
  assert.equal(order.promocao_bps, 500);
  assert.equal(order.promocao_cupom, 'CPA10');
  assert.notEqual(order.condicao_pagamento_nome_snapshot, 'Condicao atual alterada');
  assert.notEqual(order.tabela_preco_nome_snapshot, 'Tabela atual alterada');
});

test('Onda3 residual: convert fail-closed se tabela_preco_id sem snapshot', async () => {
  const { service, orcamentos } = pedidoFixture();
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quoteBase,
    itens: [{ ...quoteBase.itens[0], preco_unitario: '12.340000' }],
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: 'Snapshot original',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: tabelaId,
    promocao_aplicada: false,
    promocao_bps: null,
    promocao_cupom: null,
  } as never);
  await assert.rejects(
    service.convert(ctx, quote.id, {
      tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    }),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_TABELA_SNAPSHOT_AUSENTE',
  );
});

test('Onda3 residual: convert fail-closed se condição incompleta (parcelas ausentes)', async () => {
  const { service, orcamentos } = pedidoFixture();
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quoteBase,
    itens: [{ ...quoteBase.itens[0], preco_unitario: '12.340000' }],
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: 'Snapshot original',
    // parcelas ausentes → pós-snapshot parcial; não deve cair no live
    tabela_preco_id: null,
    promocao_aplicada: false,
    promocao_bps: null,
    promocao_cupom: null,
  } as never);
  await assert.rejects(
    service.convert(ctx, quote.id, {
      tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    }),
    (error: AppError) => error.statusCode === 422 && (
      error.code === 'ORCAMENTO_CONDICAO_SNAPSHOT_AUSENTE'
      || error.code === 'ORCAMENTO_CONDICAO_SNAPSHOT_INVALIDO'
    ),
  );
});

test('Onda3 residual: validade expirada continua fail-closed (não enfraquece #133)', async () => {
  const { service, orcamentos } = pedidoFixture();
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quoteBase,
    validade_em: '2020-01-01T12:00:00.000Z',
    itens: [{ ...quoteBase.itens[0], preco_unitario: '12.340000' }],
    ...fullSnapshots({ promocao_aplicada: false, promocao_bps: null, promocao_cupom: null }),
  } as never);
  await assert.rejects(
    service.convert(ctx, quote.id, {
      tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    }),
    (error: AppError) => error.statusCode === 422 && error.code === ORCAMENTO_VALIDADE_EXPIRADA,
  );
});
