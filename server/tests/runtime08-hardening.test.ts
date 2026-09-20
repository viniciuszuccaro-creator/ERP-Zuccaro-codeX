import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = dirname(fileURLToPath(import.meta.url));
const group = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresa = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function boot() {
  const db = new PGlite();
  const migrations = readdirSync(join(root, '../migrations'))
    .filter((file) => /^\d{3}_.*\.sql$/.test(file))
    .sort();
  for (const file of migrations) {
    const sql = readFileSync(join(root, '../migrations', file), 'utf8')
      .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, '');
    await db.exec(sql);
  }
  await db.exec(readFileSync(join(root, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
  return db;
}

function condition(id: string, codigo: string, ativo = true) {
  return `INSERT INTO condicoes_pagamento(id,group_id,empresa_id,codigo,nome,ativo)
    VALUES ('${id}','${group}','${empresa}','${codigo}','${codigo}',${ativo});`;
}

function parcela(id: string, percentual: string) {
  return `INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual)
    VALUES ('${group}','${id}',1,0,${percentual});`;
}

async function count(db: PGlite, codigo: string) {
  const result = await db.query<{ n: number }>(
    `SELECT count(*)::int n FROM condicoes_pagamento WHERE codigo='${codigo}'`,
  );
  return result.rows[0]?.n;
}

test('R08 barrier rejects active condition without parcelas at commit and rolls it back', async () => {
  const db = await boot();
  try {
    await assert.rejects(
      () => db.exec(`BEGIN; ${condition('a8a8a8a8-1111-4111-8111-a8a8a8a8a801', '000801')} COMMIT;`),
      /CONDICAO_PAGAMENTO_INVALID_PARCELAS/,
    );
    assert.equal(await count(db, '000801'), 0);
  } finally { await db.close(); }
});

test('R08 barrier rejects an active condition totaling 99 percent and rolls it back', async () => {
  const db = await boot();
  const id = 'a8a8a8a8-1111-4111-8111-a8a8a8a8a803';
  try {
    await assert.rejects(
      () => db.exec(`BEGIN; ${condition(id, '000803')} ${parcela(id, '99.000000')} COMMIT;`),
      /CONDICAO_PAGAMENTO_INVALID_PARCELAS/,
    );
    assert.equal(await count(db, '000803'), 0);
  } finally { await db.close(); }
});

test('R08 barrier rejects deleting the only active parcela and preserves it', async () => {
  const db = await boot();
  const id = 'a8a8a8a8-1111-4111-8111-a8a8a8a8a804';
  try {
    await db.exec(`BEGIN; ${condition(id, '000804')} ${parcela(id, '100.000000')} COMMIT;`);
    await assert.rejects(
      () => db.exec(`BEGIN; DELETE FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id='${id}'; COMMIT;`),
      /CONDICAO_PAGAMENTO_INVALID_PARCELAS/,
    );
    const result = await db.query<{ n: number }>(`SELECT count(*)::int n FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id='${id}'`);
    assert.equal(result.rows[0]?.n, 1);
  } finally { await db.close(); }
});

test('R08 barrier rejects activating a condition with no parcelas and preserves inactivity', async () => {
  const db = await boot();
  const id = 'a8a8a8a8-1111-4111-8111-a8a8a8a8a805';
  try {
    await db.exec(condition(id, '000805', false));
    await assert.rejects(
      () => db.exec(`BEGIN; UPDATE condicoes_pagamento SET ativo=true WHERE id='${id}'; COMMIT;`),
      /CONDICAO_PAGAMENTO_INVALID_PARCELAS/,
    );
    const result = await db.query<{ ativo: boolean }>(`SELECT ativo FROM condicoes_pagamento WHERE id='${id}'`);
    assert.equal(result.rows[0]?.ativo, false);
  } finally { await db.close(); }
});

test('R08 barrier permits active condition and 100 percent parcelas in one transaction', async () => {
  const db = await boot();
  const id = 'a8a8a8a8-1111-4111-8111-a8a8a8a8a802';
  try {
    await db.exec(`BEGIN; ${condition(id, '000802')} ${parcela(id, '100.000000')} COMMIT;`);
    assert.equal(await count(db, '000802'), 1);
  } finally { await db.close(); }
});

test('R08 E2E PostgreSQL payload uses the six-digit codigo contract and valid related rows', async () => {
  const db = await boot();
  const id = 'a8a8a8a8-1111-4111-8111-a8a8a8a8a806';
  try {
    await db.exec(`BEGIN;
      ${condition(id, '999999')}
      INSERT INTO condicao_pagamento_empresas(group_id,condicao_pagamento_id,empresa_id,ativo)
        VALUES ('${group}','${id}','${empresa}',true);
      ${parcela(id, '100.000000')}
      UPDATE condicoes_pagamento SET nome='R08 E2E UPDATED' WHERE id='${id}';
      DELETE FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id='${id}';
      ${parcela(id, '100.000000')}
      ROLLBACK;`);
    assert.equal(await count(db, '999999'), 0);
  } finally { await db.close(); }
});
