import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { DbClient, DbQueryExecutor } from '../src/db/client.js';
import { mapHistoricalPedidoTypes } from '../src/db/mapHistoricalPedidoTypes.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;
const migration = readFileSync(new URL('../migrations/026_pedidos_tipo_comercial.sql', import.meta.url), 'utf8');

for (const engine of ['PGlite', 'PostgreSQL real']) {
  test(`${engine}: private explicit item mapping completes 026 atomically and audits mixed orders`,
    { skip: engine === 'PostgreSQL real' && !url }, async () => {
      const pg = engine === 'PGlite' ? new PGlite() : await isolatedPostgres(url!);
      const group = randomUUID(), empresa = randomUUID(), reviewer = randomUUID();
      const orderA = randomUUID(), orderB = randomUUID();
      const itemA = randomUUID(), itemB = randomUUID(), itemC = randomUUID();
      const db: DbClient = {
        pool: {} as never, query: (sql, params) => pg.query(sql, params as never) as never,
        withTransaction: fn => pg.transaction(tx => fn({ query: (sql, params) =>
          (sql === migration ? tx.exec(sql) : tx.query(sql, params as never)) as never } as DbQueryExecutor)),
        checkConnection: async () => true, end: async () => pg.close(),
      };
      try {
        await pg.exec(`CREATE TABLE profiles(id uuid PRIMARY KEY,group_id uuid,empresa_id uuid,role text,ativo boolean);
          CREATE TABLE pedidos(id uuid PRIMARY KEY,group_id uuid,empresa_id uuid,numero bigint);
          CREATE TABLE pedido_itens(id uuid PRIMARY KEY,pedido_id uuid,group_id uuid,empresa_id uuid);
          CREATE TABLE schema_migrations(id text PRIMARY KEY);
          CREATE TABLE audit_logs(group_id uuid,empresa_id uuid,actor_id uuid,entity text,entity_id text,
            action text,after_data jsonb,request_id text);`);
        await pg.query('INSERT INTO profiles VALUES($1,$2,NULL,$3,true)', [reviewer, group, 'admin']);
        await pg.query('INSERT INTO pedidos VALUES($1,$2,$3,1),($4,$2,$3,2)', [orderA, group, empresa, orderB]);
        await pg.query('INSERT INTO pedido_itens VALUES($1,$2,$4,$5),($3,$2,$4,$5),($6,$7,$4,$5)',
          [itemA, orderA, itemB, group, empresa, itemC, orderB]);
        await pg.query("INSERT INTO schema_migrations VALUES('025_pedidos_origem_canal_idempotency.sql')");
        const name = (await pg.query<{ name: string }>('SELECT current_database() AS name')).rows[0].name;
        const plan = { expectedDatabase: name, groupId: group, reviewerProfileId: reviewer, decisions: [
          { itemId: itemA, type: 'REVENDA', evidence: 'Decisão sintética revisada A' },
          { itemId: itemB, type: 'SERVICO', evidence: 'Decisão sintética revisada B' },
          { itemId: itemC, type: 'SERVICO', evidence: 'Decisão sintética revisada C' },
        ] };
        await assert.rejects(() => mapHistoricalPedidoTypes(db,
          { ...plan, decisions: plan.decisions.slice(0, 2) }, migration), /HISTORICAL_TYPE_COVERAGE_INVALID/);
        assert.equal((await pg.query('SELECT count(*) AS count FROM audit_logs')).rows[0].count, 0);
        assert.equal((await pg.query("SELECT id FROM schema_migrations WHERE id LIKE '026%'")).rows.length, 0);
        assert.equal((await pg.query(`SELECT attname FROM pg_attribute WHERE attrelid='pedidos'::regclass
          AND attname='tipo_comercial' AND NOT attisdropped`)).rows.length, 0);
        await assert.rejects(() => mapHistoricalPedidoTypes(db,
          { ...plan, expectedDatabase: 'wrong_db' }, migration), /HISTORICAL_TYPE_DATABASE_MISMATCH/);
        await assert.rejects(() => mapHistoricalPedidoTypes(db,
          { ...plan, reviewerProfileId: randomUUID() }, migration), /HISTORICAL_TYPE_REVIEWER_INVALID/);
        await assert.rejects(() => mapHistoricalPedidoTypes(db,
          { ...plan, decisions: [{ ...plan.decisions[0], type: 'OTHER' }, ...plan.decisions.slice(1)] }, migration),
        /HISTORICAL_TYPE_PLAN_INVALID/);
        await pg.exec("ALTER TABLE audit_logs ADD CONSTRAINT reject_item_audit CHECK (entity <> 'PedidoItem')");
        await assert.rejects(() => mapHistoricalPedidoTypes(db, plan, migration));
        assert.equal((await pg.query("SELECT id FROM schema_migrations WHERE id LIKE '026%'")).rows.length, 0);
        assert.equal((await pg.query(`SELECT attname FROM pg_attribute WHERE attrelid='pedidos'::regclass
          AND attname='tipo_comercial' AND NOT attisdropped`)).rows.length, 0);
        await pg.exec('ALTER TABLE audit_logs DROP CONSTRAINT reject_item_audit');
        const result = await mapHistoricalPedidoTypes(db, plan, migration);
        assert.equal(result.mappedOrders, 2); assert.equal(result.mappedItems, 3);
        assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
        assert.deepEqual((await pg.query('SELECT tipo_comercial FROM pedidos ORDER BY id')).rows
          .map(row => row.tipo_comercial).sort(), ['MISTO', 'SERVICO']);
        assert.equal(Number((await pg.query('SELECT count(*) AS count FROM audit_logs')).rows[0].count), 5);
        assert.equal((await pg.query("SELECT id FROM schema_migrations WHERE id LIKE '026%'")).rows.length, 1);
        await assert.rejects(() => pg.query('UPDATE pedido_itens SET tipo_comercial_snapshot=NULL'),
          (e: unknown) => (e as { code: string }).code === '23502');
        await assert.rejects(() => mapHistoricalPedidoTypes(db, plan, migration), /HISTORICAL_TYPE_MIGRATION_ORDER_INVALID/);
      } finally { await pg.close(); }
    });
}
