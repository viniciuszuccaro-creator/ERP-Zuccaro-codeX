/**
 * R11 Expedição — suíte PostgreSQL via PGlite (isolada; ≠ SPA_LOCAL_BASE44 ≠ mocks in-memory).
 * Cobre: tenant, RBAC, concorrência de número, rollback estoque, despacho repetido,
 * entrega parcial idempotente e devolução + auditoria transacional.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig } from '../src/config/env.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function dbClient(db: PGlite): DbClient {
  return {
    pool: null as never,
    query: (text, params) => db.query(text, params as never) as never,
    withTransaction: (fn) => db.transaction((tx) => fn({
      query: (text, params) => tx.query(text, params as never) as never,
    } as DbQueryExecutor)),
    checkConnection: async () => true,
    end: async () => db.close(),
  };
}

async function bootPglite() {
  const pg = new PGlite();
  const migrations = join(__dirname, '../migrations');
  const files = readdirSync(migrations).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort();
  assert.ok(files.includes('036_expedicao_entregas_romaneios.sql'), 'migration 036 required');
  assert.ok(!files.some((f) => f.startsWith('025_expedicao')), '025_expedicao must not exist (comercial owns 025-035)');
  for (const file of files) {
    await pg.exec(
      readFileSync(join(migrations, file), 'utf8')
        .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
    );
  }
  await pg.exec(readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
  return pg;
}

function permissionsFull() {
  return {
    Expedicao: {
      entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar'],
      romaneio: ['visualizar', 'criar', 'editar'],
      separacao: ['visualizar', 'criar', 'editar', 'conferir'],
    },
  };
}

function fixture(pg: PGlite, extra: Record<string, unknown> = {}) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaA2, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaB, SEED_IDS.groupB);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: SEED_IDS.runtimeActorA,
    groupId: SEED_IDS.groupA,
    permissions: permissionsFull(),
  });
  rbac.link({
    actorId: SEED_IDS.runtimeActorB,
    groupId: SEED_IDS.groupA,
    permissions: { Expedicao: { entrega: [], romaneio: [], separacao: [] } },
  });
  const config = loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    REQUIRE_DATABASE: 'false',
    DATABASE_URL: 'postgres://synthetic@localhost:5432/erp_expedicao_pglite',
  });
  return createApp({
    config,
    db: dbClient(pg),
    useMemory: false,
    tenantGuard: tenant,
    rbacGuard: rbac,
    ...extra,
  });
}

function headers(overrides: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'x-group-id': SEED_IDS.groupA,
    'x-empresa-id': SEED_IDS.empresaA,
    'x-actor-id': SEED_IDS.runtimeActorA,
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

async function seedPronto(runtime: ReturnType<typeof createApp>, key: string) {
  const created = await request(runtime.app, '/api/v1/entregas', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      cliente_nome: 'Cliente PGlite',
      cidade: 'Campinas',
      itens: [
        { descricao: 'Barra 3/8', unidade_sigla: 'UN', quantidade_pedida: '10' },
        { descricao: 'Barra 1/2', unidade_sigla: 'UN', quantidade_pedida: '5' },
      ],
      idempotency_key: `ent-${key}`,
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.id as string;
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
  assert.equal(sep.status, 201, JSON.stringify(sep.body));
  assert.equal(sep.body.data.entrega.status, 'Pronto para Expedir');
  return { id, numero: created.body.data.numero as string };
}

test('R11 PGlite: migration 036 + tenant/RBAC fail-closed', async () => {
  const pg = await bootPglite();
  try {
    const tables = await pg.query<{ relname: string }>(`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('entregas','romaneios','separacoes','entrega_historico')
      ORDER BY 1
    `);
    assert.deepEqual(tables.rows.map((r) => r.relname), [
      'entrega_historico', 'entregas', 'romaneios', 'separacoes',
    ]);

    const runtime = fixture(pg);
    const { id } = await seedPronto(runtime, 'tenant-rbac');

    const denied = await request(runtime.app, '/api/v1/entregas', {
      headers: headers({ 'x-actor-id': SEED_IDS.runtimeActorB }),
    });
    assert.equal(denied.status, 403);

    const crossEmpresa = await request(runtime.app, `/api/v1/entregas/${id}`, {
      headers: headers({ 'x-empresa-id': SEED_IDS.empresaA2 }),
    });
    assert.equal(crossEmpresa.status, 404);

    const crossGroup = await request(runtime.app, `/api/v1/entregas/${id}`, {
      headers: headers({
        'x-group-id': SEED_IDS.groupB,
        'x-empresa-id': SEED_IDS.empresaB,
        'x-actor-id': SEED_IDS.runtimeActorA,
      }),
    });
    assert.equal(crossGroup.status, 403);
  } finally {
    await pg.close();
  }
});

test('R11 PGlite: concorrencia de numero + auditoria transacional create', async () => {
  const pg = await bootPglite();
  try {
    const runtime = fixture(pg);
    const payloads = [1, 2, 3].map((n) => ({
      cliente_nome: `Conc ${n}`,
      cidade: 'Campinas',
      itens: [{ descricao: 'Item', unidade_sigla: 'UN', quantidade_pedida: '1' }],
      idempotency_key: `conc-pg-${n}`,
    }));
    const results = await Promise.all(payloads.map((body) => request(runtime.app, '/api/v1/entregas', {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    })));
    for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));
    const numeros = new Set(results.map((r) => r.body.data.numero));
    assert.equal(numeros.size, 3);
    for (const n of numeros) assert.match(String(n), /^\d{8}$/);

    const id = results[0].body.data.id as string;
    const audit = new PostgresAuditRepository(dbClient(pg));
    const logs = await audit.listByEntity('Entrega', id);
    assert.ok(logs.some((a) => a.action === 'create'));
    assert.equal(logs[0]?.groupId, SEED_IDS.groupA);
    assert.equal(logs[0]?.empresaId, SEED_IDS.empresaA);
  } finally {
    await pg.close();
  }
});

test('R11 PGlite: falha estoque no despacho faz rollback (sem romaneio orfao)', async () => {
  const pg = await bootPglite();
  try {
    await pg.exec('CREATE TABLE side_effect_probe (kind TEXT NOT NULL)');
    const runtime = fixture(pg, {
      expedicaoPedidoPort: {
        async onSeparacaoConcluida() { return 'reserved' as const; },
        async onDespacho(_input: unknown, executor?: DbQueryExecutor) {
          assert.ok(executor, 'Pedido must receive the active transaction executor');
          await executor.query("INSERT INTO side_effect_probe(kind) VALUES ('pedido')");
          return 'applied' as const;
        },
      },
      expedicaoEstoquePort: {
        async onDespacho(_input: unknown, executor?: DbQueryExecutor) {
          assert.ok(executor, 'Estoque must receive the same transaction executor');
          const seen = await executor.query<{ kind: string }>('SELECT kind FROM side_effect_probe');
          assert.deepEqual(seen.rows.map((row) => row.kind), ['pedido']);
          await executor.query("INSERT INTO side_effect_probe(kind) VALUES ('estoque')");
          return 'failed' as const;
        },
        async onDevolucao() { return 'reserved' as const; },
      },
    });
    const { id } = await seedPronto(runtime, 'rollback-estoque');
    const rom = await request(runtime.app, '/api/v1/romaneios', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        confirmed: true,
        motorista_nome: 'Mot Fail',
        veiculo: 'Truck',
        placa: 'PGF1A11',
        checklist_saida: checklistRom,
        entregas_ids: [id],
        despachar: true,
        idempotency_key: 'rom-fail-pg',
      }),
    });
    assert.equal(rom.status, 502);
    assert.equal(rom.body.error.code, 'ESTOQUE_SIDE_EFFECT_FAILED');

    const after = await request(runtime.app, `/api/v1/entregas/${id}`, { headers: headers() });
    assert.equal(after.body.data.status, 'Pronto para Expedir');
    assert.equal(after.body.data.romaneio_id, null);

    const listed = await request(runtime.app, '/api/v1/romaneios', { headers: headers() });
    assert.equal(listed.body.meta.total, 0);

    const count = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM romaneios');
    assert.equal(count.rows[0]?.total, 0);
    const effects = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM side_effect_probe');
    assert.equal(effects.rows[0]?.total, 0, 'both port writes must rollback with the Romaneio');
  } finally {
    await pg.close();
  }
});

test('R11 PGlite: despacho repetido idempotente + parcial + devolucao', async () => {
  const pg = await bootPglite();
  try {
    const runtime = fixture(pg);
    const { id } = await seedPronto(runtime, 'ciclo-pg');

    const romPayload = {
      confirmed: true,
      motorista_nome: 'Mot Ok',
      veiculo: 'Truck',
      placa: 'PGO1A11',
      checklist_saida: checklistRom,
      entregas_ids: [id],
      despachar: true,
      idempotency_key: 'rom-ok-pg',
    };
    const r1 = await request(runtime.app, '/api/v1/romaneios', {
      method: 'POST', headers: headers(), body: JSON.stringify(romPayload),
    });
    const r2 = await request(runtime.app, '/api/v1/romaneios', {
      method: 'POST', headers: headers(), body: JSON.stringify(romPayload),
    });
    assert.equal(r1.status, 201, JSON.stringify(r1.body));
    assert.equal(r2.status, 201);
    assert.equal(r2.body.data.reused, true);
    assert.equal(r1.body.data.romaneio.id, r2.body.data.romaneio.id);
    assert.equal(r1.body.data.pedidoSideEffect, 'reserved');
    assert.equal(r1.body.data.estoqueSideEffect, 'reserved');
    assert.equal(r1.body.data.entregas[0].status, 'Saiu para Entrega');

    const p1 = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        confirmed: true,
        modo: 'parcial',
        quantidade_entregue: '7',
        comprovante: { nome_recebedor: 'Rec', documento_recebedor: '1' },
        idempotency_key: 'parcial-pg',
      }),
    });
    const p2 = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        confirmed: true,
        modo: 'parcial',
        quantidade_entregue: '7',
        comprovante: { nome_recebedor: 'Rec', documento_recebedor: '1' },
        idempotency_key: 'parcial-pg',
      }),
    });
    assert.equal(p1.status, 200);
    assert.equal(p2.status, 200);
    assert.equal(p2.body.data.reused, true);
    assert.equal(p1.body.data.entrega.status, 'Entrega Parcial');

    const ocorr = await request(runtime.app, `/api/v1/entregas/${id}/registrar`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        confirmed: true,
        modo: 'ocorrencia',
        motivo: 'Cliente ausente',
        idempotency_key: 'ocor-pg',
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
        quantidade_devolvida: '7',
        idempotency_key: 'dev-pg',
      }),
    });
    assert.equal(dev.status, 200, JSON.stringify(dev.body));
    assert.equal(dev.body.data.entrega.status, 'Devolvido');
    assert.equal(dev.body.data.estoqueSideEffect, 'reserved');

    const hist = await request(runtime.app, `/api/v1/entregas/${id}/historico`, { headers: headers() });
    const statuses = hist.body.data.map((h: { status_novo: string }) => h.status_novo);
    assert.ok(statuses.includes('SAIU_ENTREGA'));
    assert.ok(statuses.includes('ENTREGUE_PARCIAL'));
    assert.ok(statuses.includes('FRUSTRADA'));
    assert.ok(statuses.includes('DEVOLVIDA'));

    const audit = new PostgresAuditRepository(dbClient(pg));
    const logs = await audit.listByEntity('Entrega', id);
    assert.ok(logs.some((a) => a.action === 'change_status'));
  } finally {
    await pg.close();
  }
});
