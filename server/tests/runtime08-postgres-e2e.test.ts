import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
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
      await client.query(`INSERT INTO condicoes_pagamento(id,group_id,empresa_id,codigo,nome,ativo) VALUES($1,$2,$3,$4,$5,true)`, [id, SEED_IDS.groupA, SEED_IDS.empresaA, `E2E-${id.slice(0, 8)}`, 'R08 E2E ROLLBACK']);
      await client.query('INSERT INTO condicao_pagamento_empresas(group_id,condicao_pagamento_id,empresa_id,ativo) VALUES($1,$2,$3,true)', [SEED_IDS.groupA, id, SEED_IDS.empresaA]);
      await client.query('INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual) VALUES($1,$2,1,0,100.000000)', [SEED_IDS.groupA, id]);
      await client.query('UPDATE condicoes_pagamento SET nome=$2 WHERE id=$1', [id, 'R08 E2E UPDATED']);
      await client.query('DELETE FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id=$1', [id]);
      await client.query('INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual) VALUES($1,$2,1,30,100.000000)', [SEED_IDS.groupA, id]);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  } finally { await db.end(); }
});
