import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises';
test('postgres orcamento usa transacao, tenant e lock sequencial',async()=>{const s=await readFile(new URL('../src/repositories/postgresOrcamentoRepository.ts',import.meta.url),'utf8');assert.match(s,/withTransaction/);assert.match(s,/pg_advisory_xact_lock/);assert.match(s,/group_id=\$2 AND o\.empresa_id=\$3/)});
test('postgres orcamento lista por empresa com pagina??o',async()=>{const s=await readFile(new URL('../src/repositories/postgresOrcamentoRepository.ts',import.meta.url),'utf8');assert.match(s,/ORDER BY o\\.numero DESC,o\\.id DESC LIMIT/);assert.match(s,/empresa_id=\$2/)});
test('migration orcamento protege unicidade e RLS',async()=>{const s=await readFile(new URL('../migrations/016_orcamentos_comercial_360.sql',import.meta.url),'utf8');assert.match(s,/UNIQUE\(empresa_id,numero\)/);assert.match(s,/FORCE ROW LEVEL SECURITY/)});

