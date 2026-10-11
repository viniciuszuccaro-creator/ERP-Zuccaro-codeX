import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_A2 = '33333333-3333-4333-8333-333333333334';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const ACTOR_FULL = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_NO_PII = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ACTOR_GROUP_B = 'cccccccc-3333-4333-8333-cccccccccccc';
const ACTOR_EMPRESA_A2 = 'dddddddd-4444-4444-8444-dddddddddddd';
const CONDICAO_ID = '55555555-5555-4555-8555-555555555555';
const PRODUTO_ID = '66666666-6666-4666-8666-666666666666';
const UNIDADE_ID = '77777777-7777-4777-8777-777777777777';
const CNPJ_A = '11.222.333/0001-81';
const CNPJ_B = '34.028.316/0001-03';
const EMAIL_A = 'contato.cliente@exemplo.dev';
const FONE_A = '11987654321';

const CADASTROS_OPS = {
  cliente: ['visualizar', 'criar', 'editar', 'dados-sensiveis.visualizar'],
  cliente_empresa: ['visualizar', 'criar', 'editar'],
  cliente_local: ['visualizar', 'criar', 'editar', 'principal'],
  obra: ['visualizar', 'criar', 'editar', 'principal', 'vincular-local', 'vincular-empresa'],
};

const CADASTROS_NO_PII = {
  cliente: ['visualizar', 'criar', 'editar'],
  cliente_empresa: ['visualizar', 'criar', 'editar'],
  cliente_local: ['visualizar', 'criar', 'editar', 'principal'],
  obra: ['visualizar', 'criar', 'editar', 'principal', 'vincular-local', 'vincular-empresa'],
};

function config(crm = false) {
  return loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    REQUIRE_DATABASE: 'false',
    ENABLE_CRM_HTTP: String(crm),
  });
}

function fixture(crm = false) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(EMPRESA_A, GROUP_A);
  tenant.link(EMPRESA_A2, GROUP_A);
  tenant.link(EMPRESA_B, GROUP_B);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: ACTOR_FULL,
    groupId: GROUP_A,
    permissions: {
      Cadastros: CADASTROS_OPS,
      CRM: { oportunidades: ['visualizar','criar','editar','inativar','restaurar'] },
      Comercial: { orcamento: ['visualizar', 'criar', 'aprovar'], pedido: ['visualizar', 'criar', 'aprovar'] },
    },
  });
  rbac.link({
    actorId: ACTOR_NO_PII,
    groupId: GROUP_A,
    permissions: {
      Cadastros: CADASTROS_NO_PII,
      Comercial: { orcamento: ['visualizar', 'criar', 'aprovar'], pedido: ['visualizar', 'criar', 'aprovar'] },
    },
  });
  rbac.link({
    actorId: ACTOR_EMPRESA_A2,
    groupId: GROUP_A,
    permissions: {
      Cadastros: CADASTROS_NO_PII,
      Comercial: { orcamento: ['visualizar', 'criar', 'aprovar'], pedido: ['visualizar', 'criar', 'aprovar'] },
    },
  });
  rbac.link({
    actorId: ACTOR_GROUP_B,
    groupId: GROUP_B,
    permissions: {
      Cadastros: {
        cliente: ['visualizar', 'criar', 'dados-sensiveis.visualizar'],
        cliente_empresa: ['visualizar', 'criar'],
        cliente_local: ['visualizar', 'criar', 'principal'],
        obra: ['visualizar', 'criar', 'principal', 'vincular-local', 'vincular-empresa'],
      },
      Comercial: { orcamento: ['visualizar', 'criar', 'aprovar'], pedido: ['visualizar', 'criar', 'aprovar'] },
    },
  });
  const runtime = createApp({
    config: config(crm),
    db: createDbClient(config(crm)),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });
  const refs = runtime.orcamentoService as unknown as {
    clientes: { getEmpresaLinkById: (scope: unknown, id: string) => Promise<unknown> };
    produtos: { getById: () => Promise<unknown> };
    unidades: { getById: () => Promise<unknown> };
    condicoes: { get: () => Promise<unknown> };
    prices: { resolveSalePrice: () => Promise<{ preco: string; tabela_preco_id?: string } | null> };
  };
  const pedidoRefs = runtime.pedidoService as unknown as Record<string, unknown>;
  const resolveCliente = async (_scope: unknown, id: string) => ({
    id,
    ativo: true,
    bloqueado: false,
    habilitado_operacao: true,
  });
  const produtos = { getById: async () => ({ id: PRODUTO_ID, ativo: true, unidade_medida_id: UNIDADE_ID }) };
  const unidades = { getById: async () => ({ id: UNIDADE_ID, ativo: true }) };
  const condicoes = { get: async () => ({ id: CONDICAO_ID, ativo: true }) };
  const clientes = { getEmpresaLinkById: resolveCliente };
  // Onda 2 na main: create Orçamento/Pedido exige resolveSalePrice (TabelaPreco vazia em memória).
  const tabelaPrecoId = '99999999-9999-4999-8999-999999999999';
  const prices = {
    resolveSalePrice: async () => ({
      preco: '10.000000',
      tabela_preco_id: tabelaPrecoId,
    }),
  };
  const tabelas = { get: async (_scope: unknown, id: string) => (id === tabelaPrecoId ? { id: tabelaPrecoId, ativo: true } : null) };
  Object.assign(refs, { clientes, produtos, unidades, condicoes, tabelas, prices });
  Object.assign(pedidoRefs, {
    clientes,
    produtos,
    unidades,
    condicoes,
    locais: { get: async () => null },
    obras: { get: async () => null },
    tabelas,
    prices,
  });
  return runtime;
}

function headers(actorId: string, groupId: string, empresaId: string) {
  return {
    'content-type': 'application/json',
    'x-group-id': groupId,
    'x-empresa-id': empresaId,
    'x-actor-id': actorId,
  };
}

async function request(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    return { status: response.status, body: await response.json() as any, cache: response.headers.get('cache-control') };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function seedClienteComercial(
  runtime: ReturnType<typeof fixture>,
  actorId: string,
  groupId: string,
  empresaId: string,
  documento: string,
) {
  const cliente = await request(runtime.app, '/api/v1/clientes', {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento,
      razao_social: `Cliente sintetico ${documento}`,
      email: EMAIL_A,
      telefone: FONE_A,
      celular: FONE_A,
    }),
  });
  assert.equal(cliente.status, 201, JSON.stringify(cliente.body));
  const clienteId = cliente.body.data.id as string;

  const link = await request(runtime.app, `/api/v1/clientes/${clienteId}/empresas/${empresaId}`, {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({}),
  });
  assert.ok(link.status === 201 || link.status === 200);
  const clienteEmpresaId = link.body.data.id as string;

  const orcamentoPayload = {
    cliente_empresa_id: clienteEmpresaId,
    condicao_pagamento_id: CONDICAO_ID,
    validade_em: '2027-01-01T00:00:00.000Z',
    observacoes: 'Central 360 sintetico',
    itens: [{
      produto_id: PRODUTO_ID,
      unidade_id: UNIDADE_ID,
      descricao: 'Item sintetico',
      unidade_sigla: 'UN',
      quantidade: '2',
      preco_unitario: '10',
      desconto: '0',
    }],
  };
  const orcamento = await request(runtime.app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify(orcamentoPayload),
  });
  assert.equal(orcamento.status, 201);

  const pedido = await request(runtime.app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      cliente_empresa_id: clienteEmpresaId,
      condicao_pagamento_id: CONDICAO_ID,
      tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-01-15T00:00:00.000Z',
      observacoes: 'Central 360 sintetico',
      itens: [{ ...orcamentoPayload.itens[0], requer_producao: false }],
    }),
  });
  assert.equal(pedido.status, 201, JSON.stringify(pedido.body));

  const local = await request(runtime.app, `/api/v1/clientes/${clienteId}/locais`, {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      nome: 'Local Central 360',
      cep: '01310100',
      logradouro: 'Av Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      uf: 'SP',
      pais: 'Brasil',
      finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    }),
  });
  assert.equal(local.status, 201, JSON.stringify(local.body));
  const localId = local.body.data.id as string;

  const obra = await request(runtime.app, `/api/v1/clientes/${clienteId}/obras`, {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      nome: 'Obra Central 360',
      locais: [{ cliente_local_id: localId, uso_na_obra: 'FISICO', principal: true }],
    }),
  });
  assert.equal(obra.status, 201, JSON.stringify(obra.body));

  return {
    clienteId,
    clienteEmpresaId,
    orcamentoId: orcamento.body.data.id as string,
    pedidoId: pedido.body.data.id as string,
    localId,
    obraId: obra.body.data.id as string,
  };
}


test('Central CRM canonical HTTP is paginated, tenant/link scoped, projected and fails closed',async()=>{
 const runtime=fixture(true),seeded=await seedClienteComercial(runtime,ACTOR_FULL,GROUP_A,EMPRESA_A,CNPJ_A);
 const create=async(key:string,title:string)=>request(runtime.app,'/api/v1/oportunidades',{method:'POST',
  headers:headers(ACTOR_FULL,GROUP_A,EMPRESA_A),body:JSON.stringify({titulo:title,cliente_empresa_id:seeded.clienteEmpresaId,
   idempotency_key:key,cliente_email:'private.crm@example.invalid',cliente_telefone:'11900001111',observacoes:'private notes',valor_estimado:'100.123456'})});
 const first=await create('central-crm-first','Canonical first');assert.equal(first.status,201,JSON.stringify(first.body));
 assert.equal((await create('central-crm-second','Canonical second')).status,201);
 const base='/api/v1/clientes/'+seeded.clienteId+'/central-360';
 const page=await request(runtime.app,base+'?crm_limit=1&crm_offset=0',{headers:headers(ACTOR_FULL,GROUP_A,EMPRESA_A)});
 assert.equal(page.status,200);assert.equal(page.cache,'no-store');
 const block=page.body.data.blocks.crm;assert.equal(block.status,'ok');assert.equal(block.meta.total,2);assert.equal(block.data.length,1);assert.equal(block.meta.hasMore,true);
 for(const field of ['cliente_email','cliente_telefone','observacoes','descricao','necessidades','idempotency_key','payload_fingerprint','created_by','updated_by'])assert.equal(Object.hasOwn(block.data[0],field),false);
 assert.match(block.data[0].codigo,/^\d+$/);assert.equal(block.data[0].valor_estimado,'100.123456');
 const next=await request(runtime.app,base+'?crm_limit=1&crm_offset=1',{headers:headers(ACTOR_FULL,GROUP_A,EMPRESA_A)});
 assert.notEqual(next.body.data.blocks.crm.data[0].id,block.data[0].id);assert.equal(next.body.data.blocks.crm.meta.hasMore,false);
 const denied=await request(runtime.app,base,{headers:headers(ACTOR_NO_PII,GROUP_A,EMPRESA_A)});
 assert.equal(denied.status,200);assert.equal(denied.body.data.blocks.crm.status,'forbidden');assert.equal(denied.body.data.blocks.crm.meta,null);assert.deepEqual(denied.body.data.blocks.crm.data,[]);
 // Reuse the master in A2 via its explicit link; A opportunities must not leak to that company.
 const linked=await request(runtime.app,'/api/v1/clientes/'+seeded.clienteId+'/empresas/'+EMPRESA_A2,{method:'POST',headers:headers(ACTOR_FULL,GROUP_A,EMPRESA_A2),body:'{}'});
 assert.ok([200,201].includes(linked.status));
 const otherCompany=await request(runtime.app,base,{headers:headers(ACTOR_FULL,GROUP_A,EMPRESA_A2)});
 assert.equal(otherCompany.status,200);assert.equal(otherCompany.body.data.blocks.crm.status,'ok');assert.equal(otherCompany.body.data.blocks.crm.meta.total,0);
 const otherGroup=await request(runtime.app,base,{headers:headers(ACTOR_GROUP_B,GROUP_B,EMPRESA_B)});assert.equal(otherGroup.status,404);
 const original=runtime.oportunidadeService!.list.bind(runtime.oportunidadeService);
 runtime.oportunidadeService!.list=async()=>{throw new Error('private backend failure');};
 const unavailable=await request(runtime.app,base,{headers:headers(ACTOR_FULL,GROUP_A,EMPRESA_A)});
 assert.equal(unavailable.body.data.blocks.crm.status,'unavailable');assert.equal(unavailable.body.data.blocks.crm.meta,null);
 assert.equal(JSON.stringify(unavailable.body).includes('private backend failure'),false);
 runtime.oportunidadeService!.list=original;
 const repeated=await request(runtime.app,base,{headers:headers(ACTOR_FULL,GROUP_A,EMPRESA_A)});
 assert.equal(repeated.body.data.blocks.crm.meta.total,2);
});
test('Central 360 compoe identidade + blocos com PII revelado quando autorizado', async () => {
  const runtime = fixture();
  const seeded = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);

  const result = await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360?orcamentos_limit=10&pedidos_limit=10`,
    { headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A) },
  );

  assert.equal(result.status, 200);
  assert.equal(result.cache, 'no-store');
  assert.equal(result.body.data.identity.id, seeded.clienteId);
  assert.equal(result.body.data.identity.documento, '**.***.***/****-81');
  assert.equal(result.body.data.identity.email, EMAIL_A);
  assert.equal(result.body.data.identity.telefone, FONE_A);
  assert.equal(result.body.data.meta.sensitiveFields, 'revealed');
  assert.equal(result.body.data.empresaLink.id, seeded.clienteEmpresaId);
  assert.equal(result.body.data.blocks.empresas.status, 'ok');
  assert.equal(result.body.data.blocks.locais.status, 'ok');
  assert.equal(result.body.data.blocks.obras.status, 'ok');
  assert.equal(result.body.data.blocks.orcamentos.status, 'ok');
  assert.equal(result.body.data.blocks.pedidos.status, 'ok');
  assert.equal(result.body.data.blocks.crm.status, 'skipped');
  assert.equal(result.body.data.blocks.locais.data[0].id, seeded.localId);
  assert.equal(result.body.data.blocks.obras.data[0].id, seeded.obraId);
  assert.ok(!JSON.stringify(result.body).includes('Item sintetico'));
});

test('Central 360 mascara PII sem dados-sensiveis.visualizar e isola tenant A/B', async () => {
  const runtime = fixture();
  const seededA = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);
  const seededB = await seedClienteComercial(runtime, ACTOR_GROUP_B, GROUP_B, EMPRESA_B, CNPJ_B);

  const masked = await request(
    runtime.app,
    `/api/v1/clientes/${seededA.clienteId}/central-360`,
    { headers: headers(ACTOR_NO_PII, GROUP_A, EMPRESA_A) },
  );
  assert.equal(masked.status, 200);
  assert.equal(masked.body.data.identity.id, seededA.clienteId);
  assert.equal(masked.body.data.meta.sensitiveFields, 'masked');
  assert.equal(masked.body.data.identity.email, 'c***@exemplo.dev');
  assert.equal(masked.body.data.identity.telefone, '****4321');
  assert.equal(masked.body.data.identity.celular, '****4321');
  assert.notEqual(masked.body.data.identity.email, EMAIL_A);
  assert.ok(!JSON.stringify(masked.body.data.identity).includes(EMAIL_A));
  assert.ok(!JSON.stringify(masked.body.data.identity).includes(FONE_A));
  assert.equal(masked.body.data.blocks.orcamentos.status, 'ok');

  const cross = await request(
    runtime.app,
    `/api/v1/clientes/${seededA.clienteId}/central-360`,
    { headers: headers(ACTOR_GROUP_B, GROUP_B, EMPRESA_B) },
  );
  assert.equal(cross.status, 404);
  assert.equal(cross.body.error.code, 'CLIENTE_NOT_FOUND');

  const ownB = await request(
    runtime.app,
    `/api/v1/clientes/${seededB.clienteId}/central-360`,
    { headers: headers(ACTOR_GROUP_B, GROUP_B, EMPRESA_B) },
  );
  assert.equal(ownB.status, 200);
  assert.equal(ownB.body.data.identity.id, seededB.clienteId);
});

test('Central 360 exige vinculo ClienteEmpresa na Empresa do contexto (mesmo Grupo)', async () => {
  const runtime = fixture();
  const seeded = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);

  // Ator da Empresa A2 (mesmo Grupo) sem vínculo → 404 seguro, sem identidade.
  const otherEmpresa = await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360`,
    { headers: headers(ACTOR_EMPRESA_A2, GROUP_A, EMPRESA_A2) },
  );
  assert.equal(otherEmpresa.status, 404);
  assert.equal(otherEmpresa.body.error.code, 'CLIENTE_NOT_FOUND');
  assert.equal(otherEmpresa.body.data, undefined);

  assert.equal((await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360`,
    { headers: { 'x-actor-id': ACTOR_FULL } },
  )).status, 400);
});

test('Central 360 pagina blocos com limit/offset sem duplicar nem inventar total', async () => {
  const runtime = fixture();
  const seeded = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);

  const localIds: string[] = [seeded.localId];
  for (let i = 1; i <= 6; i += 1) {
    const local = await request(runtime.app, `/api/v1/clientes/${seeded.clienteId}/locais`, {
      method: 'POST',
      headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A),
      body: JSON.stringify({
        nome: `Local pagina ${i}`,
        cep: '01310100',
        logradouro: 'Av Paulista',
        numero: String(1000 + i),
        bairro: 'Bela Vista',
        cidade: 'Sao Paulo',
        uf: 'SP',
        pais: 'Brasil',
        finalidades: [{ finalidade: 'ENTREGA', principal: false }],
      }),
    });
    assert.equal(local.status, 201, JSON.stringify(local.body));
    localIds.push(local.body.data.id as string);
  }
  assert.equal(localIds.length, 7);

  const page1 = await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360?locais_limit=5&locais_offset=0`,
    { headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A) },
  );
  assert.equal(page1.status, 200);
  assert.equal(page1.body.data.blocks.locais.status, 'ok');
  assert.equal(page1.body.data.blocks.locais.data.length, 5);
  assert.equal(page1.body.data.blocks.locais.meta.hasMore, true);
  assert.equal(page1.body.data.blocks.locais.meta.total, 7);
  assert.equal(page1.body.data.blocks.locais.meta.limit, 5);
  assert.equal(page1.body.data.blocks.locais.meta.offset, 0);

  const page2 = await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360?locais_limit=5&locais_offset=5`,
    { headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A) },
  );
  assert.equal(page2.status, 200);
  assert.equal(page2.body.data.blocks.locais.data.length, 2);
  assert.equal(page2.body.data.blocks.locais.meta.hasMore, false);
  assert.equal(page2.body.data.blocks.locais.meta.offset, 5);

  const ids1 = page1.body.data.blocks.locais.data.map((row: { id: string }) => row.id);
  const ids2 = page2.body.data.blocks.locais.data.map((row: { id: string }) => row.id);
  assert.equal(new Set([...ids1, ...ids2]).size, 7);
  assert.equal(ids1.some((id: string) => ids2.includes(id)), false);

  const full = await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360?locais_limit=10&locais_offset=0`,
    { headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A) },
  );
  assert.equal(full.status, 200);
  assert.equal(full.body.data.blocks.locais.data.length, 7);
  assert.equal(full.body.data.blocks.locais.meta.hasMore, false);
});

test('Central 360 falha parcial: bloco unavailable com meta null e demais ok', async () => {
  const runtime = fixture();
  const seeded = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);

  const locais = runtime.clienteLocalService as unknown as { list: (...args: unknown[]) => Promise<unknown> };
  const original = locais.list.bind(runtime.clienteLocalService);
  locais.list = async () => {
    throw new Error('SYNTHETIC_LOCAL_BLOCK_FAILURE');
  };

  try {
    const result = await request(
      runtime.app,
      `/api/v1/clientes/${seeded.clienteId}/central-360`,
      { headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A) },
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.data.identity.id, seeded.clienteId);
    assert.ok(result.body.data.meta.requestId);
    assert.equal(result.body.data.blocks.locais.status, 'unavailable');
    assert.equal(result.body.data.blocks.locais.code, 'BLOCK_UNAVAILABLE');
    assert.equal(result.body.data.blocks.locais.meta, null);
    assert.deepEqual(result.body.data.blocks.locais.data, []);
    assert.equal(result.body.data.blocks.obras.status, 'ok');
    assert.equal(result.body.data.blocks.orcamentos.status, 'ok');
    assert.equal(result.body.data.blocks.pedidos.status, 'ok');
    assert.equal(result.body.data.blocks.empresas.status, 'ok');
  } finally {
    locais.list = original;
  }
});
