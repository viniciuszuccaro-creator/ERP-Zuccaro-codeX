import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import type { ComercialAlcadaConfigPort } from '../src/services/comercialCondicaoAvistaPolicy.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const creatorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const itemComDesconto = {
  produto_id: produtoId,
  unidade_id: unidadeId,
  descricao: 'Produto sintetico avista',
  unidade_sigla: 'UN',
  quantidade: '1',
  preco_unitario: '100',
  desconto: '10',
};

const payloadOrc = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-01-01T00:00:00.000Z',
  observacoes: 'Avista HTTP',
  itens: [itemComDesconto],
};

function fixture(options: {
  parcelas?: Array<{ dias: number; ativo?: boolean }>;
  alcadaConfig?: ComercialAlcadaConfigPort | null;
} = {}) {
  const parcelas = options.parcelas ?? [{ dias: 0, ativo: true }];
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: creatorId,
    groupId,
    permissions: {
      Comercial: {
        orcamento: ['visualizar', 'criar', 'editar'],
        pedido: ['visualizar', 'criar', 'editar'],
      },
    },
  });
  const runtime = createApp({
    config,
    db: createDbClient(config),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
    alcadaConfig: options.alcadaConfig === undefined ? null : options.alcadaConfig,
  });
  const stubRefs = (service: any) => {
    service.clientes = { getEmpresaLinkById: async () => ({ id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) };
    service.produtos = { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) };
    service.unidades = { getById: async () => ({ id: unidadeId, ativo: true }) };
    service.condicoes = {
      get: async () => ({
        id: condicaoId,
        ativo: true,
        parcelas: parcelas.map((p, i) => ({
          id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i}`,
          dias: p.dias,
          ativo: p.ativo !== false,
          ordem: i + 1,
          percentual: '100.000000',
        })),
      }),
    };
    service.prices = { resolveSalePrice: async () => ({ preco: '100.000000' }) };
  };
  stubRefs(runtime.orcamentoService);
  stubRefs(runtime.pedidoService);
  return runtime;
}

function headers() {
  return {
    'content-type': 'application/json',
    'x-group-id': groupId,
    'x-empresa-id': empresaId,
    'x-actor-id': creatorId,
  };
}

async function request(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    return { status: response.status, body: await response.json() as any };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('HTTP: à vista sem config → 403 (fail-closed)', async () => {
  const { app } = fixture({ parcelas: [{ dias: 0 }], alcadaConfig: null });
  const denied = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payloadOrc),
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'DESCONTO_ALCADA_DENIED');
});

test('HTTP: à vista + regra explícita → 201 sem aprovar', async () => {
  const { app } = fixture({
    parcelas: [{ dias: 0 }],
    alcadaConfig: {
      getConfig: async () => ({ avistaLiberaDescontoSemAprovar: true }),
    },
  });
  const ok = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payloadOrc),
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.total, '90.000000');
});

test('HTTP: a prazo + regra explícita → 403 (não liberta)', async () => {
  const { app } = fixture({
    parcelas: [{ dias: 30 }],
    alcadaConfig: {
      getConfig: async () => ({ avistaLiberaDescontoSemAprovar: true }),
    },
  });
  const denied = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payloadOrc),
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'DESCONTO_ALCADA_DENIED');
});

test('HTTP: à vista + regra + desconto > subtotal → 422 (não 500)', async () => {
  const { app } = fixture({
    parcelas: [{ dias: 0 }],
    alcadaConfig: {
      getConfig: async () => ({ avistaLiberaDescontoSemAprovar: true }),
    },
  });
  const invalid = {
    ...payloadOrc,
    itens: [{ ...itemComDesconto, desconto: '101' }],
  };
  const denied = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(invalid),
  });
  assert.equal(denied.status, 422);
  assert.equal(denied.body.error.code, 'ORCAMENTO_DESCONTO_INVALIDO');
  const listed = await request(app, '/api/v1/orcamentos?limit=10&offset=0', {
    headers: headers(),
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.meta.total, 0);
});
