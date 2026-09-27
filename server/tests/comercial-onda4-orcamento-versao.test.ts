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
  groupId, empresaId, actorId, requestId: 'req-onda4', actorEmail: 'synthetic@example.invalid',
};

function fixture(permissions: string[] = ['visualizar', 'criar', 'editar', 'cancelar', 'versionar']) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: { Comercial: { orcamento: permissions } },
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
  return { service, repo, audit };
}

const payload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-05-01T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Item sintetico v1',
    unidade_sigla: 'UN',
    quantidade: '1',
    preco_unitario: '10',
    desconto: '0',
  }],
};

test('migration 027 versiona Orçamento sem módulo paralelo', async () => {
  const source = await readFile(new URL('../migrations/027_orcamentos_versao.sql', import.meta.url), 'utf8');
  for (const required of [
    'versao',
    'orcamento_raiz_id',
    'supersedido_por_id',
    "'SUPERSEDIDO'",
    'uq_orcamentos_open_numero',
    'orcamentos_empresa_numero_versao_key',
  ]) assert.ok(source.includes(required), required);
});

test('create inicia versao 1 com raiz=self', async () => {
  const { service } = fixture();
  const created = await service.create(ctx, payload);
  assert.equal(created.versao, 1);
  assert.equal(created.orcamento_raiz_id, created.id);
  assert.equal(created.supersedido_por_id, null);
  assert.equal(created.status, 'EM_ABERTO');
});

test('versionar supersede anterior, preserva numero e incrementa versao', async () => {
  const { service } = fixture();
  const v1 = await service.create(ctx, payload);
  const v2 = await service.createVersion(ctx, v1.id, {
    ...payload,
    validade_em: '2027-06-01T00:00:00.000Z',
    itens: [{ ...payload.itens[0]!, quantidade: '2', descricao: 'Item sintetico v2' }],
  });
  assert.equal(v2.numero, v1.numero);
  assert.equal(v2.versao, 2);
  assert.equal(v2.orcamento_raiz_id, v1.id);
  assert.equal(v2.status, 'EM_ABERTO');
  assert.equal(v2.itens[0]?.quantidade, '2.000000');

  const previous = await service.get(ctx, v1.id);
  assert.equal(previous.status, 'SUPERSEDIDO');
  assert.equal(previous.supersedido_por_id, v2.id);

  const versions = await service.listVersions(ctx, v1.id);
  assert.equal(versions.length, 2);
  assert.deepEqual(versions.map((row) => row.versao), [2, 1]);

  await assert.rejects(
    () => service.update(ctx, v1.id, payload),
    (error: { code?: string }) => error.code === 'ORCAMENTO_STATE_CONFLICT',
  );
});

test('versionar exige permissão versionar (fail-closed)', async () => {
  const { service } = fixture(['visualizar', 'criar', 'editar']);
  const v1 = await service.create(ctx, payload);
  await assert.rejects(
    () => service.createVersion(ctx, v1.id, payload),
    (error: { code?: string }) => error.code === 'PERMISSION_DENIED',
  );
});

test('auditoria registra supersessao e nova versao', async () => {
  const { service, audit } = fixture();
  const v1 = await service.create(ctx, payload);
  const v2 = await service.createVersion(ctx, v1.id, payload);
  const eventsV1 = await audit.listByEntity('Orcamento', v1.id);
  const eventsV2 = await audit.listByEntity('Orcamento', v2.id);
  assert.ok(eventsV1.some((event) => (event.afterData as { status?: string })?.status === 'SUPERSEDIDO'));
  assert.ok(eventsV2.some((event) => (event.afterData as { versao?: number })?.versao === 2));
});
