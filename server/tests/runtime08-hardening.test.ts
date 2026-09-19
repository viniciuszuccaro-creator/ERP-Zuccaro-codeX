import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
const root = dirname(fileURLToPath(import.meta.url));
const group = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresa = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function boot() { const db = new PGlite(); for (const file of readdirSync(join(root,'../migrations')).filter((x)=>/^\d{3}_.*\.sql$/.test(x)).sort()) await db.exec(readFileSync(join(root,'../migrations',file),'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i,'')); await db.exec(readFileSync(join(root,'../scripts/seed-dev-synthetic.sql'),'utf8')); return db; }
test('R08 barrier rejects active condition without parcelas at commit', async () => { const db=await boot(); try { await assert.rejects(()=>db.exec(`BEGIN; INSERT INTO condicoes_pagamento(id,group_id,empresa_id,codigo,nome,ativo) VALUES ('a8a8a8a8-1111-4111-8111-a8a8a8a8a801','${group}','${empresa}','000801','INVALID',true); COMMIT;`),/CONDICAO_PAGAMENTO_INVALID_PARCELAS/); const q=await db.query<{n:number}>(`SELECT count(*)::int n FROM condicoes_pagamento WHERE codigo='000801'`); assert.equal(q.rows[0]?.n,0); } finally { await db.close(); } });
test('R08 barrier permits active condition and 100 percent parcelas in same transaction', async () => { const db=await boot(); try { await db.exec(`BEGIN; INSERT INTO condicoes_pagamento(id,group_id,empresa_id,codigo,nome,ativo) VALUES ('a8a8a8a8-1111-4111-8111-a8a8a8a8a802','${group}','${empresa}','000802','VALID',true); INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual) VALUES ('${group}','a8a8a8a8-1111-4111-8111-a8a8a8a8a802',1,0,100.000000); COMMIT;`); } finally { await db.close(); } });
