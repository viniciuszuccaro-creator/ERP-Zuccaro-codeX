import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { PostgresCondicaoPagamentoRepository } from '../src/repositories/postgresCondicaoPagamentoRepository.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);

async function request(app: ReturnType<typeof createApp>['app'], path: string, headers: Record<string, string>) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, { headers });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('R08 PostgreSQL real: RBAC, tenant e invariantes de CondicaoPagamento', { skip: !enabled && 'DATABASE_URL not available in this environment' }, async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL });
  const db = createDbClient(config);
  const { app } = createApp({ config, db, useMemory: false });
  const authorized = { 'x-group-id': SEED_IDS.groupA, 'x-empresa-id': SEED_IDS.empresaA, 'x-actor-id': SEED_IDS.runtimeActorA };
  try {
    assert.equal((await request(app, '/api/v1/condicoes-pagamento', authorized)).status, 200);
    assert.equal((await request(app, `/api/v1/condicoes-pagamento/${SEED_IDS.condicaoPagamentoA}`, authorized)).status, 200);
    assert.equal((await request(app, '/api/v1/condicoes-pagamento', { 'x-group-id': SEED_IDS.groupA, 'x-empresa-id': SEED_IDS.empresaA })).status, 403);
    assert.equal((await request(app, '/api/v1/condicoes-pagamento', { ...authorized, 'x-actor-id': SEED_IDS.runtimeActorB })).status, 403);
    assert.equal((await request(app, '/api/v1/condicoes-pagamento', { ...authorized, 'x-empresa-id': SEED_IDS.empresaB })).status, 409);

    const client = await db.pool!.connect();
    const id = randomUUID();
    try {
      await client.query('BEGIN');
      const candidate = await client.query<{ codigo: string }>(`
        SELECT lpad(candidate::text, 6, '0') AS codigo
        FROM generate_series(999999, 900000, -1) AS candidate
        WHERE NOT EXISTS (
          SELECT 1 FROM condicoes_pagamento c
          WHERE c.group_id = $1 AND c.codigo = lpad(candidate::text, 6, '0')
        )
        LIMIT 1
      `, [SEED_IDS.groupA]);
      const codigo = candidate.rows[0]?.codigo;
      assert.ok(codigo && /^\d{6}$/.test(codigo), 'E2E must reserve a free six-digit codigo');
      await client.query(`INSERT INTO condicoes_pagamento(id,group_id,empresa_id,codigo,nome,ativo) VALUES($1,$2,$3,$4,$5,true)`, [id, SEED_IDS.groupA, SEED_IDS.empresaA, codigo, 'R08 E2E ROLLBACK']);
      await client.query('INSERT INTO condicao_pagamento_empresas(group_id,condicao_pagamento_id,empresa_id,ativo) VALUES($1,$2,$3,true)', [SEED_IDS.groupA, id, SEED_IDS.empresaA]);
      await client.query('INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual) VALUES($1,$2,1,0,100.000000)', [SEED_IDS.groupA, id]);
      await client.query('UPDATE condicoes_pagamento SET nome=$2 WHERE id=$1', [id, 'R08 E2E UPDATED']);
      await client.query('DELETE FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id=$1', [id]);
      await client.query('INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual) VALUES($1,$2,1,30,100.000000)', [SEED_IDS.groupA, id]);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  } finally { await db.end(); }
});

test('R08 PostgreSQL real: CondicaoPagamento reserves code above existing and soft-deleted rows', { skip: !enabled && 'DATABASE_URL not available in this environment' }, async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL });
  const db = createDbClient(config);
  const repo = new PostgresCondicaoPagamentoRepository(db);
  const scopeA = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA };
  const scopeB = { groupId: SEED_IDS.groupB, empresaId: SEED_IDS.empresaB };
  const created: string[] = [];
  const sequenceState = new Map<string, number | null>();
  const payload = (nome: string) => ({ nome, parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }] });
  const maxCode = async (groupId: string) => {
    const result = await db.query<{ value: number }>(`SELECT COALESCE(MAX(codigo::int),0)::int AS value FROM condicoes_pagamento WHERE group_id=$1 AND codigo ~ '^[0-9]{6}$'`, [groupId]);
    return result.rows[0]?.value ?? 0;
  };
  const setSequence = async (groupId: string, nextValue: number) => {
    await db.query(`INSERT INTO entity_code_sequences(group_id,entity_name,next_value) VALUES($1,'CondicaoPagamento',$2) ON CONFLICT(group_id,entity_name) DO UPDATE SET next_value=EXCLUDED.next_value,updated_at=timezone('utc',now())`, [groupId, nextValue]);
  };
  const create = async (scope: typeof scopeA, nome: string, actorId: string) => {
    const row = await db.withTransaction((tx) => repo.create(scope, payload(nome), actorId, tx));
    created.push(row.id);
    return row;
  };
  try {
    for (const groupId of [SEED_IDS.groupA, SEED_IDS.groupB]) {
      const result = await db.query<{ next_value: number }>(`SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name='CondicaoPagamento'`, [groupId]);
      sequenceState.set(groupId, result.rows[0]?.next_value ?? null);
      await setSequence(groupId, 1);
    }

    const initialA = await maxCode(SEED_IDS.groupA);
    const first = await create(scopeA, ['R08 codigo', randomUUID()].join(' '), SEED_IDS.runtimeActorA);
    assert.equal(first.codigo, String(initialA + 1).padStart(6, '0'));
    await db.withTransaction((tx) => repo.softDelete(scopeA, first.id, SEED_IDS.runtimeActorA, tx));
    const second = await create(scopeA, ['R08 soft delete', randomUUID()].join(' '), SEED_IDS.runtimeActorA);
    assert.equal(second.codigo, String(initialA + 2).padStart(6, '0'), 'soft-deleted code remains reserved');

    await setSequence(SEED_IDS.groupA, 1);
    const concurrent = await Promise.all([
      create(scopeA, ['R08 concurrent A', randomUUID()].join(' '), SEED_IDS.runtimeActorA),
      create(scopeA, ['R08 concurrent B', randomUUID()].join(' '), SEED_IDS.runtimeActorA),
    ]);
    assert.deepEqual(concurrent.map((row) => row.codigo).sort(), [initialA + 3, initialA + 4].map((value) => String(value).padStart(6, '0')));

    const initialB = await maxCode(SEED_IDS.groupB);
    const groupB = await create(scopeB, ['R08 group B', randomUUID()].join(' '), SEED_IDS.runtimeActorB);
    assert.equal(groupB.codigo, String(initialB + 1).padStart(6, '0'), 'each group has an independent sequence');

    await assert.rejects(
      () => db.query(`INSERT INTO condicoes_pagamento(group_id,empresa_id,codigo,nome,ativo) VALUES($1,$2,$3,$4,false)`, [SEED_IDS.groupA, SEED_IDS.empresaA, second.codigo, ['R08 duplicate', randomUUID()].join(' ')]),
      /condicoes_pagamento_group_id_codigo_key/,
    );
  } finally {
    if (created.length) {
      await db.query(`DELETE FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id = ANY($1::uuid[])`, [created]);
      await db.query(`DELETE FROM condicao_pagamento_empresas WHERE condicao_pagamento_id = ANY($1::uuid[])`, [created]);
      await db.query(`DELETE FROM condicoes_pagamento WHERE id = ANY($1::uuid[])`, [created]);
    }
    for (const [groupId, nextValue] of sequenceState) {
      if (nextValue === null) await db.query(`DELETE FROM entity_code_sequences WHERE group_id=$1 AND entity_name='CondicaoPagamento'`, [groupId]);
      else await setSequence(groupId, nextValue);
    }
    await db.end();
  }
});
