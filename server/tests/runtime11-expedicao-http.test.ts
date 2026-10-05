import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherEmpresaId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const deniedActorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const entregaPayload = {
  pedido_numero: 'PED-SYN-001',
  cliente_nome: 'Cliente Sintetico',
  cidade: 'Campinas',
  tipo_frete: 'ENTREGA',
  data_entrega_solicitada: '2027-04-01T12:00:00.000Z',
  itens: [
    { descricao: 'Barra 3/8', unidade_sigla: 'UN', quantidade_pedida: '10' },
    { descricao: 'Barra 1/2', unidade_sigla: 'UN', quantidade_pedida: '5' },
  ],
  idempotency_key: 'entrega-syn-001',
};

const checklistSep = {
  conferiu_quantidade: true,
  conferiu_qualidade: true,
  conferiu_embalagem: true,
  conferiu_etiquetas: true,
  conferiu_documentos: true,
};

const checklistRom = {
  documentos_ok: true,
  veiculo_ok: true,
  carga_conferida: true,
  combustivel_ok: true,
};

function permissionsFull() {
  return {
    Expedicao: {
      entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar'],
      romaneio: ['visualizar', 'criar', 'editar'],
      separacao: ['visualizar', 'criar', 'editar', 'conferir'],
    },
  };
}

function fixture(extra: Record<string, unknown> = {}) {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  tenant.link(otherEmpresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: permissionsFull() });
  rbac.link({ actorId: deniedActorId, groupId, permissions: { Expedicao: { entrega: [], romaneio: [], separacao: [] } } });
  return createApp({
    config,
    db: createDbClient(config),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
    ...extra,
  });
}

function headers(overrides: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'x-group-id': groupId,
    'x-empresa-id': empresaId,
    'x-actor-id': actorId,
    ...overrides,
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
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function seedPronto(runtime: ReturnType<typeof createApp>, key = 'seed-a') {
  const created = await request(runtime.app, '/api/v1/entregas', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...entregaPayload, idempotency_key: key }),
  });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  const sep = await request(runtime.app, `/api/v1/entregas/${id}/separacao`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      checklist: checklistSep,
      itens: [
        { descricao: 'Barra 3/8', unidade_sigla: 'UN', quantidade_pedida: '10', quantidade_separada: '10' },
        { descricao: 'Barra 1/2', unidade_sigla: 'UN', quantidade_pedida: '5', quantidade_separada: '5' },
      ],
      idempotency_key: `sep-${key}`,
    }),
  });
  assert.equal(sep.status, 201);
  assert.equal(sep.body.data.entrega.status, 'Pronto para Expedir');
  return { id, created: created.body.data, sep: sep.body.data };
}

// Camada: MOCK in-memory (useMemory=true) — ≠ PostgreSQL. Ver runtime11-expedicao-pglite.test.ts para PG.
test('HTTP Expedicao (mock in-memory): ciclo separacao → romaneio/despacho → parcial → total → historico + auditoria', async () => {
  const runtime = fixture();
  const { id } = await seedPronto(runtime, 'ciclo-1');

  const rom = await request(runtime.app, '/api/v1/romaneios', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      motorista_nome: 'Motorista Syn',
      veiculo: 'Truck Syn',
      placa: 'SYN1A23',
      checklist_saida: checklistRom,
      entregas_ids: [id],
      despachar: true,
      idempotency_key: 'rom-ciclo-1',
    }),
  });
  assert.equal(rom.status, 201);
  assert.equal(rom.body.data.reused, false);
  assert.equal(rom.body.data.pedidoSideEffect, 'reserved');
  assert.equal(rom.body.data.estoqueSideEffect, 'reserved');
  assert.equal(rom.body.data.entregas[0].status, 'Saiu para Entrega');

  const parcial = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      modo: 'parcial',
      quantidade_entregue: '7',
      comprovante: { nome_recebedor: 'Recebedor', documento_recebedor: '123' },
      idempotency_key: 'reg-parcial-1',
    }),
  });
  assert.equal(parcial.status, 200);
  assert.equal(parcial.body.data.entrega.status, 'Entrega Parcial');

  const total = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      modo: 'total',
      comprovante: { nome_recebedor: 'Recebedor', documento_recebedor: '123', foto_comprovante: 'data:image/png;base64,xx' },
      idempotency_key: 'reg-total-1',
    }),
  });
  assert.equal(total.status, 200);
  assert.equal(total.body.data.entrega.status, 'Entregue');

  const history = await request(runtime.app, `/api/v1/entregas/${id}/historico`, { headers: headers() });
  assert.ok(history.body.data.map((h: { status_novo: string }) => h.status_novo).includes('ENTREGUE'));
  const audits = await runtime.auditRepo.listByEntity('Entrega', id);
  assert.ok(audits.some((a) => a.action === 'create'));
  assert.ok(audits.some((a) => a.action === 'change_status'));
});

test('HTTP Expedicao (mock in-memory): idempotencia create/romaneio/retry e isolamento empresa + RBAC fail-closed', async () => {
  const runtime = fixture();
  const first = await request(runtime.app, '/api/v1/entregas', {
    method: 'POST', headers: headers(), body: JSON.stringify({ ...entregaPayload, idempotency_key: 'idem-ent-1' }),
  });
  const second = await request(runtime.app, '/api/v1/entregas', {
    method: 'POST', headers: headers(), body: JSON.stringify({ ...entregaPayload, idempotency_key: 'idem-ent-1' }),
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(first.body.data.id, second.body.data.id);

  assert.equal((await request(runtime.app, '/api/v1/entregas', { headers: headers({ 'x-actor-id': deniedActorId }) })).status, 403);
  const cross = await request(runtime.app, `/api/v1/entregas/${first.body.data.id}`, {
    headers: headers({ 'x-empresa-id': otherEmpresaId }),
  });
  assert.equal(cross.status, 404);

  const { id } = await seedPronto(runtime, 'idem-rom');
  const romPayload = {
    confirmed: true,
    motorista_nome: 'M',
    veiculo: 'V',
    placa: 'ABC1D23',
    checklist_saida: checklistRom,
    entregas_ids: [id],
    despachar: true,
    idempotency_key: 'rom-idem-1',
  };
  const r1 = await request(runtime.app, '/api/v1/romaneios', { method: 'POST', headers: headers(), body: JSON.stringify(romPayload) });
  const r2 = await request(runtime.app, '/api/v1/romaneios', { method: 'POST', headers: headers(), body: JSON.stringify(romPayload) });
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);
  assert.equal(r2.body.data.reused, true);
  assert.equal(r1.body.data.romaneio.id, r2.body.data.romaneio.id);

  const meta = await request(runtime.app, '/api/v1/meta');
  assert.equal(meta.body.expedicao.backendHttp, true);
  assert.equal(meta.body.expedicao.pedidoEstoqueSideEffects, 'reserved');
  assert.equal(meta.body.expedicao.estoqueFonteOficial, null);
  assert.match(String(meta.body.expedicao.migrationNumberingNote || ''), /sem 032/);
});

test('HTTP Expedicao: parcial e devolucao nao ultrapassam total nem duplicam item', async () => {
  const runtime = fixture();
  const { id, created } = await seedPronto(runtime, 'limites-qtd');
  const rom = await request(runtime.app, '/api/v1/romaneios', {
    method: 'POST', headers: headers(), body: JSON.stringify({
      confirmed: true, motorista_nome: 'M', veiculo: 'V', placa: 'ABC1D23',
      checklist_saida: checklistRom, entregas_ids: [id], despachar: true,
      idempotency_key: 'rom-limites-qtd',
    }),
  });
  assert.equal(rom.status, 201);
  const overPartial = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ confirmed: true, modo: 'parcial',
      quantidade_entregue: '16', comprovante: { nome_recebedor: 'R', documento_recebedor: '123' } }),
  });
  assert.equal(overPartial.status, 422);
  assert.equal(overPartial.body.error.code, 'PARCIAL_QTY_EXCEEDS_TOTAL');
  const partial = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ confirmed: true, modo: 'parcial',
      quantidade_entregue: '7', comprovante: { nome_recebedor: 'R', documento_recebedor: '123' } }),
  });
  assert.equal(partial.status, 200);
  const overReturn = await request(runtime.app, `/api/v1/entregas/${id}/devolucao`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ confirmed: true, motivo: 'Retorno', acao: 'repor',
      quantidade_devolvida: '16' }),
  });
  assert.equal(overReturn.status, 422);
  assert.equal(overReturn.body.error.code, 'DEVOLUCAO_QTY_EXCEEDS_TOTAL');
  const duplicateItem = await request(runtime.app, `/api/v1/entregas/${id}/devolucao`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ confirmed: true, motivo: 'Retorno', acao: 'repor',
      itens: [{ item_id: created.itens[0].id, quantidade_devolvida: '1' },
        { item_id: created.itens[0].id, quantidade_devolvida: '1' }] }),
  });
  assert.equal(duplicateItem.status, 422);
  assert.equal(duplicateItem.body.error.code, 'DEVOLUCAO_ITEM_QTY_INVALIDA');
});

test('HTTP Expedicao (mock in-memory): ocorrencia + devolucao + falha intermediaria estoque faz rollback', async () => {
  const runtime = fixture({
    expedicaoEstoquePort: {
      async onDespacho() { return 'failed' as const; },
      async onDevolucao() { return 'reserved' as const; },
    },
  });
  const { id } = await seedPronto(runtime, 'fail-estoque');
  const rom = await request(runtime.app, '/api/v1/romaneios', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      motorista_nome: 'M',
      veiculo: 'V',
      placa: 'XYZ9Z99',
      checklist_saida: checklistRom,
      entregas_ids: [id],
      despachar: true,
      idempotency_key: 'rom-fail-1',
    }),
  });
  assert.equal(rom.status, 502);
  assert.equal(rom.body.error.code, 'ESTOQUE_SIDE_EFFECT_FAILED');

  const after = await request(runtime.app, `/api/v1/entregas/${id}`, { headers: headers() });
  assert.equal(after.status, 200);
  assert.equal(after.body.data.status, 'Pronto para Expedir');
  assert.equal(after.body.data.romaneio_id, null);

  const listed = await request(runtime.app, '/api/v1/romaneios', { headers: headers() });
  assert.equal(listed.body.meta.total, 0);
});

test('HTTP Expedicao (mock in-memory): concorrencia de create na mesma empresa gera numeros distintos; retry parcial idempotente', async () => {
  const runtime = fixture();
  const payloads = [1, 2, 3].map((n) => ({
    ...entregaPayload,
    idempotency_key: `conc-${n}`,
    pedido_numero: `PED-C-${n}`,
  }));
  const results = await Promise.all(payloads.map((body) => request(runtime.app, '/api/v1/entregas', {
    method: 'POST', headers: headers(), body: JSON.stringify(body),
  })));
  for (const r of results) assert.equal(r.status, 201);
  const numeros = new Set(results.map((r) => r.body.data.numero));
  assert.equal(numeros.size, 3);

  const { id } = await seedPronto(runtime, 'parcial-retry');
  await request(runtime.app, '/api/v1/romaneios', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      motorista_nome: 'M',
      veiculo: 'V',
      placa: 'RET1A11',
      checklist_saida: checklistRom,
      entregas_ids: [id],
      despachar: true,
      idempotency_key: 'rom-parcial-retry',
    }),
  });
  const p1 = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      modo: 'parcial',
      quantidade_entregue: '4',
      comprovante: { nome_recebedor: 'X', documento_recebedor: '1' },
      idempotency_key: 'parcial-same',
    }),
  });
  const p2 = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      modo: 'parcial',
      quantidade_entregue: '4',
      comprovante: { nome_recebedor: 'X', documento_recebedor: '1' },
      idempotency_key: 'parcial-same',
    }),
  });
  assert.equal(p1.status, 200);
  assert.equal(p2.status, 200);
  assert.equal(p2.body.data.reused, true);

  const ocorr = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      modo: 'ocorrencia',
      motivo: 'Cliente ausente',
      idempotency_key: 'ocor-1',
    }),
  });
  assert.equal(ocorr.status, 200);
  assert.equal(ocorr.body.data.entrega.status, 'Entrega Frustrada');

  const dev = await request(runtime.app, `/api/v1/entregas/${id}/devolucao`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      confirmed: true,
      motivo: 'Recusa',
      acao: 'devolver_estoque',
      quantidade_devolvida: '4',
      idempotency_key: 'dev-1',
    }),
  });
  assert.equal(dev.status, 200);
  assert.equal(dev.body.data.entrega.status, 'Devolvido');
  assert.equal(dev.body.data.estoqueSideEffect, 'reserved');
});
