import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.js';
import type { RequestContext } from '../src/audit/types.js';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.js';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.js';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import { InMemoryPedidoRepository } from '../src/repositories/inMemoryPedidoRepository.js';
import { PedidoService } from '../src/services/pedidoService.js';
import { SupabaseStorageAdapter } from '../src/services/supabaseStorageAdapter.js';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';
const fileId = '99999999-9999-4999-8999-999999999999';

const ctx: RequestContext = {
  groupId, empresaId, actorId, requestId: 'req-onda5-anexo', actorEmail: 'synthetic@example.invalid',
};

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
    { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId, tipo_item: 'Revenda' } as never) },
    { getById: async () => ({ id: unidadeId, ativo: true } as never) },
    { get: async () => ({ id: condicaoId, ativo: true } as never) },
    { get: async () => null as never },
    { get: async () => null as never },
    { get: async () => null as never },
    { resolveSalePrice: async () => ({ preco: '10.000000' }) },
  );
  return { service, audit };
}

const pedidoPayload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'ENTREGA' as const,
  data_entrega_solicitada: '2027-08-01T00:00:00.000Z',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Item anexo pedido',
    unidade_sigla: 'UN',
    quantidade: '1',
    preco_unitario: '10',
    desconto: '0',
  }],
};

test('migration 030 cria pedido_anexos no agregado', async () => {
  const source = await readFile(new URL('../migrations/030_pedidos_anexos.sql', import.meta.url), 'utf8');
  for (const required of ['pedido_anexos', 'storage_key', 'QUARENTENA', 'idx_pedido_anexos_scope']) {
    assert.ok(source.includes(required), required);
  }
});

test('StoragePort aceita entity Pedido em path /pedidos/', async () => {
  const adapter = new SupabaseStorageAdapter({
    internalUrl: 'http://127.0.0.1:54321',
    publicUrl: 'http://127.0.0.1:54321',
    serviceRoleKey: 'synthetic-service-role',
    privateBucket: 'private',
    maxBytes: 1_000_000,
    fetchImpl: (async () => new Response(JSON.stringify({}), { status: 200 })) as typeof fetch,
  });
  const pedidoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const storageKey = `groups/${groupId}/companies/${empresaId}/pedidos/${pedidoId}/documents/${fileId}-nf-ref.pdf`;
  await assert.rejects(
    () => adapter.createSignedUploadUrl({
      groupId, empresaId, actorId, entity: 'Pedido', entityId: pedidoId,
      storageKey, fileName: 'nf-ref.pdf', mimeType: 'application/pdf',
      sizeBytes: 12, sha256: 'a'.repeat(64),
    }),
    (error: Error) => !/STORAGE_SCOPE_INVALID/.test(String(error.message)),
  );
  await assert.rejects(
    () => adapter.createSignedUploadUrl({
      groupId, empresaId, actorId, entity: 'Pedido', entityId: pedidoId,
      storageKey: storageKey.replace('/pedidos/', '/products/'), fileName: 'nf-ref.pdf',
      mimeType: 'application/pdf', sizeBytes: 12, sha256: 'a'.repeat(64),
    }),
    /STORAGE_SCOPE_INVALID/,
  );
});

test('registerAnexo path fail-closed; lista e inativa no Pedido', async () => {
  const { service, audit } = fixture();
  const pedido = await service.create(ctx, pedidoPayload);
  const storageKey = `groups/${groupId}/companies/${empresaId}/pedidos/${pedido.id}/documents/${fileId}-desenho.pdf`;

  await assert.rejects(
    () => service.registerAnexo(ctx, pedido.id, {
      storage_key: `groups/${groupId}/companies/${empresaId}/orcamentos/${pedido.id}/documents/${fileId}-x.pdf`,
      nome_arquivo: 'x.pdf',
      mime_type: 'application/pdf',
      tamanho_bytes: 10,
      sha256: 'b'.repeat(64),
    }),
    (error: { code?: string }) => error.code === 'PEDIDO_ANEXO_PATH_INVALID',
  );

  const created = await service.registerAnexo(ctx, pedido.id, {
    storage_key: storageKey,
    nome_arquivo: 'desenho.pdf',
    mime_type: 'application/pdf',
    tamanho_bytes: 2048,
    sha256: 'c'.repeat(64),
  });
  assert.equal(created.status, 'QUARENTENA');
  assert.equal(created.pedido_id, pedido.id);

  const listed = await service.listAnexos(ctx, pedido.id);
  assert.equal(listed.length, 1);

  const inactive = await service.deactivateAnexo(ctx, pedido.id, created.id);
  assert.equal(inactive.ativo, false);
  assert.equal(inactive.status, 'INATIVO');
  assert.equal((await service.listAnexos(ctx, pedido.id)).length, 0);

  const events = await audit.listByEntity('PedidoAnexo', created.id);
  assert.ok(events.length >= 2);
});
