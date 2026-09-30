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
  assertPersistedTabelaSnapshot,
  buildTabelaPrecoDocumentoSnapshot,
} from '../src/services/comercialTabelaSnapshot.js';
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
  requestId: 'req-tabela-snapshot',
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

function condicaoStub() {
  return {
    id: condicaoId,
    codigo: 'COND-28',
    nome: '28 dias',
    ativo: true,
    parcelas: [{ id: 'p1', ordem: 1, dias: 28, percentual: '100.000000', ativo: true }],
  };
}

function tabelaStub(overrides: Record<string, unknown> = {}) {
  return {
    id: tabelaId,
    codigo: 'TAB-01',
    nome: 'Tabela sintetica',
    ativo: true,
    ...overrides,
  };
}

function pricePort(overrides: Record<string, unknown> = {}) {
  return {
    resolveSalePrice: async () => ({
      preco: '25.500000',
      tabela_preco_id: tabelaId,
      tabela_preco_codigo: 'TAB-01',
      tabela_preco_nome: 'Tabela sintetica',
      ...overrides,
    }),
  };
}

function orcamentoFixture(options: {
  price?: Record<string, unknown>;
  tabela?: Record<string, unknown> | null;
} = {}) {
  const repo = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: { Comercial: { orcamento: ['visualizar', 'criar', 'aprovar', 'editar', 'cancelar'] } },
  });
  const tabela = options.tabela === null ? null : tabelaStub(options.tabela);
  const service = new OrcamentoService(
    repo,
    audit,
    { assertEmpresaInGroup: async () => undefined },
    rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => condicaoStub() } as never,
    pricePort(options.price),
    null,
    null,
    null,
    { get: async () => tabela } as never,
  );
  return { service, repo, audit };
}

function pedidoFixture(options: {
  price?: Record<string, unknown>;
  tabela?: Record<string, unknown> | null;
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
        orcamento: ['visualizar', 'criar', 'versionar', 'aprovar'],
      },
    },
  });
  const tabela = options.tabela === null ? null : tabelaStub(options.tabela);
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
    { get: async () => tabela } as never,
    pricePort(options.price),
  );
  const orcamentoService = new OrcamentoService(
    orcamentos, audit,
    { assertEmpresaInGroup: async () => undefined }, rbac,
    { getEmpresaLinkById: async () => ({ id: clienteEmpresaId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) } as never,
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) } as never,
    { getById: async () => ({ id: unidadeId, ativo: true }) } as never,
    { get: async () => condicaoStub() } as never,
    pricePort(options.price), null, null, null,
    { get: async () => tabela } as never,
    repo,
  );
  return { service, orcamentoService, repo, orcamentos, audit };
}

test('helper: buildTabelaPrecoDocumentoSnapshot fail-closed sem codigo/nome', () => {
  assert.throws(
    () => buildTabelaPrecoDocumentoSnapshot(tabelaStub({ codigo: '', nome: '' }) as never, 'ORCAMENTO'),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_TABELA_SNAPSHOT_INVALIDO',
  );
});

test('helper: assertPersistedTabelaSnapshot exige nome', () => {
  assert.throws(
    () => assertPersistedTabelaSnapshot({
      tabela_preco_codigo_snapshot: 'X',
      tabela_preco_nome_snapshot: null,
    }, 'PEDIDO'),
    (error: AppError) => error.code === 'PEDIDO_TABELA_SNAPSHOT_AUSENTE',
  );
});

test('Onda3: Orçamento create persiste snapshot tabela + audita e recarrega', async () => {
  const { service, audit } = orcamentoFixture();
  const row = await service.create(ctx, quotePayload);
  assert.equal(row.tabela_preco_id, tabelaId);
  assert.equal(row.tabela_preco_codigo_snapshot, 'TAB-01');
  assert.equal(row.tabela_preco_nome_snapshot, 'Tabela sintetica');
  const reloaded = await service.get(ctx, row.id);
  assert.equal(reloaded.tabela_preco_codigo_snapshot, 'TAB-01');
  assert.equal(reloaded.tabela_preco_nome_snapshot, 'Tabela sintetica');
  const created = (await audit.listByEntity('Orcamento', row.id)).find((e) => e.action === 'create');
  assert.equal((created?.afterData as { tabela_preco_nome_snapshot?: string })?.tabela_preco_nome_snapshot, 'Tabela sintetica');
});

test('Onda3: Orçamento create fail-closed quando price port omite codigo/nome e tabela inválida', async () => {
  const { service } = orcamentoFixture({
    price: { tabela_preco_codigo: undefined, tabela_preco_nome: undefined },
    tabela: { codigo: '', nome: '' },
  });
  await assert.rejects(
    service.create(ctx, quotePayload),
    (error: AppError) => error.statusCode === 422 && error.code === 'ORCAMENTO_TABELA_SNAPSHOT_INVALIDO',
  );
});

test('Onda3: Pedido create persiste e recarrega snapshot tabela', async () => {
  const { service } = pedidoFixture();
  const row = await service.create(ctx, pedidoPayload);
  assert.equal(row.tabela_preco_codigo_snapshot, 'TAB-01');
  assert.equal(row.tabela_preco_nome_snapshot, 'Tabela sintetica');
  const reloaded = await service.get(ctx, row.id);
  assert.equal(reloaded.tabela_preco_nome_snapshot, 'Tabela sintetica');
});

test('Onda3: conversão copia snapshot da tabela do Orçamento (não-retroatividade)', async () => {
  const { service, orcamentos } = pedidoFixture({
    tabela: { codigo: 'LIVE-99', nome: 'Tabela atual alterada' },
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
  await assert.rejects(
    () => service.convert(ctx, quote.id, {
      tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
      tipo_comercial: 'ARMADO', requer_producao: true,
    }),
    (error: AppError) => error.statusCode === 422,
  );
  await assert.rejects(
    () => service.convert(ctx, quote.id, {
      tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
      tabela_preco_id: otherEmpresa,
    }),
    (error: AppError) => error.statusCode === 422,
  );
  const order = await service.convert(ctx, quote.id, {
    tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  assert.equal(order.tabela_preco_id, tabelaId);
  assert.equal(order.tabela_preco_codigo_snapshot, 'SNAP-TAB');
  assert.equal(order.tabela_preco_nome_snapshot, 'Tabela snapshot original');
  assert.notEqual(order.tabela_preco_nome_snapshot, 'Tabela atual alterada');

  // A tabela mestre pode mudar/sumir depois da conversão: edição não a reconsulta.
  (service as any).tabelas = { get: async () => { throw new Error('LIVE_TABELA_SHOULD_NOT_BE_READ'); } };

  const updatePayload = {
    ...pedidoPayload,
    orcamento_id: quote.id,
    itens: [{ ...pedidoPayload.itens[0], preco_unitario: '12.340000' }],
  };
  await assert.rejects(
    () => service.update(ctx, order.id, { ...updatePayload, itens: [{ ...updatePayload.itens[0], preco_unitario: '1' }] }),
    (error: AppError) => error.statusCode === 422,
  );
  const updated = await service.update(ctx, order.id, updatePayload);
  assert.equal(updated.itens[0]?.preco_unitario, '12.340000');
  assert.equal(updated.tabela_preco_id, tabelaId);
  assert.equal(updated.tabela_preco_codigo_snapshot, 'SNAP-TAB');
  assert.equal(updated.tabela_preco_nome_snapshot, 'Tabela snapshot original');
  const reopened = await service.get(ctx, order.id);
  assert.equal(reopened.tabela_preco_nome_snapshot, 'Tabela snapshot original');
});

test('converter v1 bloqueia versionar e impede segundo Pedido da cadeia', async () => {
  const { service, orcamentoService, repo } = pedidoFixture();
  const v1 = await orcamentoService.create(ctx, quotePayload);
  const p1 = await service.convert(ctx, v1.id, {
    tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
  });
  await assert.rejects(
    () => orcamentoService.createVersion(ctx, v1.id, quotePayload),
    (error: AppError) => error.code === 'ORCAMENTO_ALREADY_CONVERTED',
  );
  assert.equal((await orcamentoService.get(ctx, v1.id)).status, 'EM_ABERTO');
  assert.equal((await repo.list({ groupId, empresaId }, 10, 0)).total, 1);
  assert.equal((await service.get(ctx, p1.id)).orcamento_id, v1.id);
});

test('Onda3: Pedido update regrava snapshot da tabela atual', async () => {
  let live = tabelaStub();
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
    { get: async () => condicaoStub() } as never,
    { get: async () => ({ id: 'local', ativo: true }) } as never,
    { get: async () => ({ id: 'obra', ativo: true }) } as never,
    { get: async () => live } as never,
    {
      resolveSalePrice: async () => ({
        preco: '10.000000',
        tabela_preco_id: tabelaId,
        tabela_preco_codigo: live.codigo,
        tabela_preco_nome: live.nome,
      }),
    },
  );
  const created = await service.create(ctx, pedidoPayload);
  assert.equal(created.tabela_preco_nome_snapshot, 'Tabela sintetica');
  live = tabelaStub({ codigo: 'TAB-VIP', nome: 'Tabela VIP' });
  const updated = await service.update(ctx, created.id, pedidoPayload);
  assert.equal(updated.tabela_preco_codigo_snapshot, 'TAB-VIP');
  assert.equal(updated.tabela_preco_nome_snapshot, 'Tabela VIP');
});
