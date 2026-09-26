import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { OrcamentoService } from '../src/services/orcamentoService.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const ctx: RequestContext = {
  groupId, empresaId, actorId, requestId: 'req-onda4-origem', actorEmail: 'synthetic@example.invalid',
};

function fixture() {
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: { Comercial: { orcamento: ['visualizar', 'criar', 'editar', 'cancelar', 'versionar'] } },
  });
  const repo = new InMemoryOrcamentoRepository();
  const audit = new InMemoryAuditRepository();
  const service = new OrcamentoService(
    repo, audit, tenant, rbac,
    { getEmpresaLinkById: async () => ({ id: clienteId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true } as never) },
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId, tipo_item: 'Revenda' } as never) },
    { getById: async () => ({ id: unidadeId, ativo: true } as never) },
    { get: async () => ({ id: condicaoId, ativo: true } as never) },
    { resolveSalePrice: async () => ({ preco: '10.000000' }) },
  );
  return { service, audit };
}

const base = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-07-01T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Item sintetico origem',
    unidade_sigla: 'UN',
    quantidade: '1',
    preco_unitario: '10',
    desconto: '0',
  }],
};

test('migration 028 origem/canal/idempotency no Orçamento', async () => {
  const source = await readFile(new URL('../migrations/028_orcamentos_origem_canal_idempotency.sql', import.meta.url), 'utf8');
  for (const required of [
    'origem',
    'idempotency_key',
    'external_id',
    'campanha',
    'uq_orcamentos_idempotency',
    "'CRM'",
  ]) assert.ok(source.includes(required), required);
});

test('create default MANUAL; SITE com idempotency', async () => {
  const { service } = fixture();
  const manual = await service.create(ctx, base);
  assert.equal(manual.origem, 'MANUAL');
  assert.equal(manual.idempotency_key, null);

  const site = await service.create(ctx, {
    ...base,
    origem: 'SITE',
    canal: 'site-cpa',
    campanha: 'inverno',
    idempotency_key: 'orc-idem-1',
    external_id: 'EXT-ORC-1',
  });
  assert.equal(site.origem, 'SITE');
  assert.equal(site.canal, 'site-cpa');
  assert.equal(site.campanha, 'inverno');
});

test('idempotency conflict → 409; filtro por origem', async () => {
  const { service } = fixture();
  const payload = { ...base, origem: 'PORTAL_B2B' as const, idempotency_key: 'dup-1', external_id: 'E1' };
  await service.create(ctx, payload);
  await assert.rejects(
    () => service.create(ctx, payload),
    (error: { code?: string }) => error.code === 'ORCAMENTO_IDEMPOTENCY_CONFLICT',
  );
  const listed = await service.list(ctx, { origem: 'PORTAL_B2B' });
  assert.equal(listed.meta.total, 1);
});

test('origem/canal imutáveis no update; versão herda canal e zera idempotency', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, {
    ...base,
    origem: 'APP',
    canal: 'app-ios',
    idempotency_key: 'app-1',
  });
  await assert.rejects(
    () => service.update(ctx, created.id, { ...base, origem: 'SITE' }),
    (error: { details?: { origem?: string } }) => error.details?.origem === 'immutable',
  );
  const v2 = await service.createVersion(ctx, created.id, base);
  assert.equal(v2.origem, 'APP');
  assert.equal(v2.canal, 'app-ios');
  assert.equal(v2.idempotency_key, null);
  assert.equal(v2.versao, 2);
});
