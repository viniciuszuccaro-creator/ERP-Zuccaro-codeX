import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import type { ComercialPromocaoConfigPort } from '../src/services/comercialPromocaoPolicy.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherEmpresa = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const clienteEmpresaId = '11111111-1111-4111-8111-111111111111';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

async function listen(app: any): Promise<{ base: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function headers(empresa = empresaId) {
  return {
    'content-type': 'application/json',
    'x-group-id': groupId,
    'x-empresa-id': empresa,
    'x-actor-id': actorId,
    'x-actor-email': 'synth@example.invalid',
  };
}

function fixture(options: {
  promocaoConfig?: ComercialPromocaoConfigPort | null;
  permissions?: Record<string, Record<string, string[]>>;
} = {}) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  tenant.link(otherEmpresa, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: options.permissions ?? {
      Cadastros: { condicao_pagamento: ['visualizar', 'criar', 'gerenciar-parcelas', 'definir-padrao'] },
      Comercial: { orcamento: ['visualizar', 'criar'], pedido: ['visualizar', 'criar'] },
    },
  });
  const runtime = createApp({
    config: loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' }),
    db: createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' })),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
    promocaoConfig: options.promocaoConfig === undefined ? null : options.promocaoConfig,
  });

  // Stub preço de venda (sem seed TabelaPreco completo neste lote).
  (runtime.orcamentoService as any).prices = {
    resolveSalePrice: async () => ({ preco: '100.000000', tabela_preco_id: '55555555-5555-4555-8555-555555555555', tabela_preco_codigo: 'TAB-01', tabela_preco_nome: 'Tabela sintetica' }),
  };
  (runtime.comercialSimulacaoVendaService as any).prices = {
    resolveSalePrice: async () => ({ preco: '100.000000', tabela_preco_id: '55555555-5555-4555-8555-555555555555', tabela_preco_codigo: 'TAB-01', tabela_preco_nome: 'Tabela sintetica' }),
  };
  (runtime.condicaoPagamentoService as any).clientes = {
    getEmpresaLinkById: async (_scope: unknown, id: string) => {
      if (id !== clienteEmpresaId) return null;
      return {
        id: clienteEmpresaId,
        ativo: true,
        bloqueado: false,
        habilitado_operacao: true,
        condicao_pagamento_id: null,
      };
    },
  };

  return runtime;
}

test('HTTP resolve: padrão da Empresa quando ClienteEmpresa não tem preferência', async () => {
  const runtime = fixture();
  const { base, close } = await listen(runtime.app);
  try {
    const created = await fetch(`${base}/api/v1/condicoes-pagamento`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        nome: 'À vista padrão',
        parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
      }),
    });
    assert.equal(created.status, 201);
    const body = await created.json();
    const condicaoId = body.data.id as string;

    const padrao = await fetch(`${base}/api/v1/condicoes-pagamento/${condicaoId}/padrao`, {
      method: 'POST',
      headers: headers(),
    });
    assert.equal(padrao.status, 200);

    const resolved = await fetch(
      `${base}/api/v1/condicoes-pagamento/resolve?clienteEmpresaId=${clienteEmpresaId}`,
      { headers: headers() },
    );
    assert.equal(resolved.status, 200);
    const data = (await resolved.json()).data;
    assert.equal(data.fonte, 'empresa_padrao');
    assert.equal(data.condicao.id, condicaoId);
    assert.equal(data.snapshot.parcelas[0].dias, 0);
  } finally {
    await close();
  }
});

test('HTTP resolve: RBAC fail-closed sem visualizar', async () => {
  const runtime = fixture({
    permissions: { Comercial: { orcamento: ['visualizar'] } },
  });
  const { base, close } = await listen(runtime.app);
  try {
    const resolved = await fetch(
      `${base}/api/v1/condicoes-pagamento/resolve?clienteEmpresaId=${clienteEmpresaId}`,
      { headers: headers() },
    );
    assert.equal(resolved.status, 403);
  } finally {
    await close();
  }
});

test('HTTP simular-venda: preço servidor + parcelas + promoção com cupom', async () => {
  const runtime = fixture({
    promocaoConfig: {
      getPromocaoConfig: async () => ({
        ativa: true,
        maxBps: 1000,
        cuponsPermitidos: ['CPA10'],
      }),
    },
  });
  const { base, close } = await listen(runtime.app);
  try {
    const created = await fetch(`${base}/api/v1/condicoes-pagamento`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        nome: '28/35',
        parcelas: [
          { ordem: 1, dias: 28, percentual: '50.000000' },
          { ordem: 2, dias: 35, percentual: '50.000000' },
        ],
      }),
    });
    assert.equal(created.status, 201);
    const condicaoId = (await created.json()).data.id as string;

    const sim = await fetch(`${base}/api/v1/comercial/simular-venda`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        cliente_empresa_id: clienteEmpresaId,
        condicao_pagamento_id: condicaoId,
        base_date: '2027-01-01',
        itens: [{
          produto_id: produtoId,
          unidade_id: unidadeId,
          descricao: 'Barra sintetica',
          unidade_sigla: 'UN',
          quantidade: '2',
          preco_unitario: '1',
          desconto: '0',
        }],
        promocao: { bps: 500, cupom: 'CPA10' },
      }),
    });
    const simText = await sim.text();
    assert.equal(sim.status, 200, simText);
    const data = JSON.parse(simText).data;
    // preço servidor 100 * qty 2 = 200; promo 5% = 10 → total 190
    assert.equal(data.subtotal, '200.000000');
    assert.equal(data.desconto, '10.000000');
    assert.equal(data.total, '190.000000');
    assert.equal(data.promocao.aplicada, true);
    assert.equal(data.parcelas.length, 2);
    assert.equal(data.parcelas[0].valor, '95.000000');
    assert.equal(data.parcelas[1].valor, '95.000000');
    assert.equal(data.parcelas[0].vencimento, '2027-01-29');
    assert.equal(data.itens[0].preco_unitario, '100.000000');
  } finally {
    await close();
  }
});

test('HTTP simular-venda: promoção sem config falha fechado; sem Comercial RBAC 403', async () => {
  const withPromoOff = fixture();
  const { base, close } = await listen(withPromoOff.app);
  try {
    const created = await fetch(`${base}/api/v1/condicoes-pagamento`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        nome: 'Vista',
        parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
      }),
    });
    const condicaoId = (await created.json()).data.id as string;
    const sim = await fetch(`${base}/api/v1/comercial/simular-venda`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        cliente_empresa_id: clienteEmpresaId,
        condicao_pagamento_id: condicaoId,
        itens: [{
          produto_id: produtoId,
          unidade_id: unidadeId,
          descricao: 'X',
          unidade_sigla: 'UN',
          quantidade: '1',
          desconto: '0',
        }],
        promocao: { bps: 100 },
      }),
    });
    assert.equal(sim.status, 422);
    const err = await sim.json();
    assert.equal(err.error?.code ?? err.code, 'PROMOCAO_INATIVA');
  } finally {
    await close();
  }

  const noPerm = fixture({
    permissions: { Cadastros: { condicao_pagamento: ['visualizar', 'criar'] } },
  });
  const listening = await listen(noPerm.app);
  try {
    const sim = await fetch(`${listening.base}/api/v1/comercial/simular-venda`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        cliente_empresa_id: clienteEmpresaId,
        itens: [{
          produto_id: produtoId,
          unidade_id: unidadeId,
          descricao: 'X',
          unidade_sigla: 'UN',
          quantidade: '1',
        }],
      }),
    });
    assert.equal(sim.status, 403);
  } finally {
    await listening.close();
  }
});

test('HTTP simular-venda: cross-empresa fail-closed no tenant guard', async () => {
  const runtime = fixture();
  const { base, close } = await listen(runtime.app);
  try {
    const created = await fetch(`${base}/api/v1/condicoes-pagamento`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        nome: 'Vista',
        parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
      }),
    });
    const condicaoId = (await created.json()).data.id as string;

    const sim = await fetch(`${base}/api/v1/comercial/simular-venda`, {
      method: 'POST',
      headers: headers(otherEmpresa),
      body: JSON.stringify({
        cliente_empresa_id: clienteEmpresaId,
        condicao_pagamento_id: condicaoId,
        itens: [{
          produto_id: produtoId,
          unidade_id: unidadeId,
          descricao: 'X',
          unidade_sigla: 'UN',
          quantidade: '1',
        }],
      }),
    });
    // condição criada na empresa A não é visível na B → 404 genérico
    assert.ok([404, 422].includes(sim.status));
  } finally {
    await close();
  }
});
