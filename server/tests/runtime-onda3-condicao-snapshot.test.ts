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
  assertPersistedCondicaoSnapshot,
  buildCondicaoPagamentoDocumentoSnapshot,
} from '../src/services/comercialCondicaoSnapshot.js';
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
  requestId: 'req-condicao-snapshot',
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
    codigo: 'COND-28',
    nome: '28 dias',
    ativo: true,
    parcelas: [
      { id: 'p1', orderm: 1, ordem: 1, dias: 28, percentual: '100.000000', ativo: true },
    ],
    ...overrides,
  };
}

function pricePort(preco = '25.500000') {
  return {
    resolveSalePrice: async () => ({ preco, tabela_preco_id: tabelaId, tabela_preco_codigo: 'TAB-01', tabela_preco_nome: 'Tabela sintetica' }),
  };
}

function orcamentoFixture(options: { condicao?: Record<string, unknown> | null } = {}) {
  const repo = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: { Comercial: { orcamento: ['visualizar', 'criar', 'aprovar', 'editar', 'cancelar'] } },
  });
  const condicao = options.condicao === null
    ? null
    : condicaoStub(options.condicao);
  const service = new OrcamentoService(
    repo,
    audit,
    { assertEmpresaInGroup: async () => undefined },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => condicao } as never,
    pricePort(),
  );
  return { service, repo, audit };
}

function pedidoFixture(options: { condicao?: Record<string, unknown> | null } = {}) {
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
  const condicao = options.condicao === null
    ? null
    : condicaoStub(options.condicao);
  const service = new PedidoService(
    repo,
    orcamentos,
    audit,
    { assertEmpresaInGroup: async (g, e) => { if (e === otherEmpresa) throw new AppError(409, 'TENANT_MISMATCH', 'tenant'); } },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => condicao } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => ({ id: tabelaId, codigo: 'TAB-01', nome: 'Tabela sintetica', ativo: true }) } as never,
    pricePort(),
  );
  return { service, repo, orcamentos, audit };
}

test('helper: buildCondicaoPagamentoDocumentoSnapshot fail-closed sem parcelas', () => {
  assert.throws(
    () => buildCondicaoPagamentoDocumentoSnapshot(condicaoStub({ parcelas: [] }) as never, 'ORCAMENTO'),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_CONDICAO_SNAPSHOT_INVALIDO',
  );
});

test('helper: assertPersistedCondicaoSnapshot exige nome+parcelas', () => {
  assert.throws(
    () => assertPersistedCondicaoSnapshot({
      condicao_pagamento_codigo_snapshot: 'X',
      condicao_pagamento_nome_snapshot: null,
      condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
    }, 'PEDIDO'),
    (error: AppError) => error.code === 'PEDIDO_CONDICAO_SNAPSHOT_AUSENTE',
  );
});

test('Onda3: Orçamento create persiste snapshot condição + tabela_preco_id e audita', async () => {
  const { service, audit } = orcamentoFixture();
  const row = await service.create(ctx, quotePayload);
  assert.equal(row.condicao_pagamento_id, condicaoId);
  assert.equal(row.condicao_pagamento_codigo_snapshot, 'COND-28');
  assert.equal(row.condicao_pagamento_nome_snapshot, '28 dias');
  assert.deepEqual(row.condicao_pagamento_parcelas_snapshot, [
    { ordem: 1, dias: 28, percentual: '100.000000' },
  ]);
  assert.equal(row.tabela_preco_id, tabelaId);
  const reloaded = await service.get(ctx, row.id);
  assert.equal(reloaded.condicao_pagamento_nome_snapshot, '28 dias');
  assert.equal(reloaded.condicao_pagamento_parcelas_snapshot?.[0]?.dias, 28);
  const created = (await audit.listByEntity('Orcamento', row.id)).find((e) => e.action === 'create');
  assert.equal((created?.afterData as { condicao_pagamento_nome_snapshot?: string })?.condicao_pagamento_nome_snapshot, '28 dias');
});

test('Onda3: Orçamento create fail-closed sem parcelas na condição', async () => {
  const { service } = orcamentoFixture({ condicao: { parcelas: [] } });
  await assert.rejects(
    service.create(ctx, quotePayload),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_CONDICAO_SNAPSHOT_INVALIDO',
  );
});

test('Onda3: Pedido create persiste e recarrega snapshot', async () => {
  const { service } = pedidoFixture();
  const row = await service.create(ctx, pedidoPayload);
  assert.equal(row.condicao_pagamento_nome_snapshot, '28 dias');
  assert.deepEqual(row.condicao_pagamento_parcelas_snapshot, [
    { ordem: 1, dias: 28, percentual: '100.000000' },
  ]);
  const reloaded = await service.get(ctx, row.id);
  assert.equal(reloaded.condicao_pagamento_codigo_snapshot, 'COND-28');
});

test('Onda3: conversão copia snapshot do Orçamento (não-retroatividade)', async () => {
  const { service, orcamentos } = pedidoFixture({
    condicao: {
      codigo: 'LIVE-99',
      nome: 'Condição atual alterada',
      parcelas: [{ id: 'p2', ordem: 1, dias: 99, percentual: '100.000000', ativo: true }],
    },
  });
  const quote = await orcamentos.create({ groupId, empresaId }, {
    ...quotePayload,
    itens: [{ ...quotePayload.itens[0], preco_unitario: '12.340000' }],
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: 'Snapshot original',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: tabelaId,
    tabela_preco_codigo_snapshot: 'SNAP-TAB',
    tabela_preco_nome_snapshot: 'Tabela snapshot original',
    promocao_aplicada: false,
    promocao_bps: null,
    promocao_cupom: null,
  } as never);
  const order = await service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(order.condicao_pagamento_codigo_snapshot, 'SNAP-28');
  assert.equal(order.condicao_pagamento_nome_snapshot, 'Snapshot original');
  assert.equal(order.condicao_pagamento_parcelas_snapshot?.[0]?.dias, 28);
  assert.equal(order.tabela_preco_codigo_snapshot, 'SNAP-TAB');
  assert.notEqual(order.condicao_pagamento_nome_snapshot, 'Condição atual alterada');
});

test('Onda3: Pedido update regrava snapshot da condição atual', async () => {
  let live = condicaoStub();
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
    { get: async () => live } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => ({ id: tabelaId, codigo: 'TAB-01', nome: 'Tabela sintetica', ativo: true }) } as never,
    pricePort('10.000000'),
  );
  const created = await service.create(ctx, pedidoPayload);
  assert.equal(created.condicao_pagamento_nome_snapshot, '28 dias');
  live = condicaoStub({
    codigo: 'AVISTA',
    nome: 'À vista',
    parcelas: [{ id: 'p3', ordem: 1, dias: 0, percentual: '100.000000', ativo: true }],
  });
  const updated = await service.update(ctx, created.id, pedidoPayload);
  assert.equal(updated.condicao_pagamento_codigo_snapshot, 'AVISTA');
  assert.equal(updated.condicao_pagamento_nome_snapshot, 'À vista');
  assert.equal(updated.condicao_pagamento_parcelas_snapshot?.[0]?.dias, 0);
});
