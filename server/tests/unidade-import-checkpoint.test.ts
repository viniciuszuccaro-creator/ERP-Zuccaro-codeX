import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';import {bindUnidadeImport} from '../../scripts/legado/unidade-import-checkpoint.mjs';import {PostgresUnidadeRepository} from '../src/repositories/postgresCadastroRepositories.ts';import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';import {TenantCrudService} from '../src/services/tenantCrudService.ts';import {unidadeCreateSchemaWithCodigo,unidadeUpdateSchema} from '../src/repositories/cadastroTypes.ts';
test('Unit import keeps committed checkpoints and preserves later edits', async () => {
const group='11111111-1111-4111-8111-111111111111';
const m={destination:{groupId:group},source:{entity:'UnidadeMedida',count:14},
rows:Array.from({length:14},(_,i)=>({id:String(i),group_id:'fixture-group',sigla:'UT'+i,codigo:'UT'+i,
nome_completo:'Synthetic unit '+i,ativo:true,usa_em_producao:false}))};
const bytes=Buffer.from(JSON.stringify(m)),sha256=createHash('sha256').update(bytes).digest('hex');
const pg=new PGlite();
try{
for(const f of ['001_foundation.sql','003_marcas_pilot.sql','004_tenant_integrity.sql','005_cadastros_simples.sql','009_clientes_master_data.sql'])await pg.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i,''));
await pg.query('insert into groups(id,nome_do_grupo) values($1,$2)',[group,'TEST']);
await pg.exec(`ALTER TABLE unidades_medida ADD codigo text; CREATE UNIQUE INDEX unit_code ON unidades_medida(group_id,lower(codigo));
CREATE ROLE unit_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON unidades_medida,entity_code_sequences,audit_logs TO unit_test;
GRANT UPDATE(ativo) ON unidades_medida TO unit_test;
GRANT UPDATE(next_value,updated_at) ON entity_code_sequences TO unit_test;
GRANT EXECUTE ON FUNCTION reserve_entity_codigo(uuid,text,int) TO unit_test;
CREATE POLICY unit_test ON unidades_medida TO unit_test USING (group_id = current_setting('app.group_id')::uuid AND empresa_id IS NULL);
CREATE POLICY unit_test ON audit_logs TO unit_test USING (group_id = current_setting('app.group_id')::uuid AND entity='UnidadeMedida' AND empresa_id IS NULL);
CREATE POLICY unit_test ON entity_code_sequences TO unit_test USING (group_id = current_setting('app.group_id')::uuid AND entity_name='UnidadeMedida');`);
let tx;const db={query:(s,p)=>tx.query(s,p),withTenantContext:(_c,fn)=>fn(),withTransaction:fn=>pg.transaction(async t=>{tx=t;await t.query('SET LOCAL ROLE unit_test');await t.query("SELECT set_config('app.group_id',$1,true)",[group]);try{return await fn(t)}finally{tx=undefined}})};
const audit=new PostgresAuditRepository(db);const service=new TenantCrudService(new PostgresUnidadeRepository(db),audit,{assertEmpresaInGroup:async(_g,e)=>assert.equal(e,undefined)}, {entityName:'UnidadeMedida',notFoundCode:'UNIDADE_NOT_FOUND',createSchema:unidadeCreateSchemaWithCodigo,updateSchema:unidadeUpdateSchema,getEmpresaId:r=>r.empresa_id,resolveEmpresaIdFromCreate:r=>r.empresa_id,resolveEmpresaIdFromUpdate:r=>r.empresa_id});
const bind=()=>bindUnidadeImport({db,service,audit,rbacGuard:{assertAllowed:async(c,m,s,a)=>{assert.equal(c.groupId,group);assert.equal(m,'Cadastros');assert.equal(s,'unidade_medida');assert.ok(['criar','inativar'].includes(a))}},ctx:{groupId:group,actorId:'77777777-1111-4111-8111-777777777777'},bytes,sha256});
await assert.rejects(async () => {
  const first = bind();
  for (const row of m.rows.slice(0, 7)) assert.equal((await first.apply(row.id)).state, 'inserted');
  throw new Error('simulated failure after the seventh commit');
}, /failure after the seventh commit/);
const a = bind();
const ids = [];
for (const [index, row] of m.rows.entries()) {
  const result = await a.apply(row.id);
  assert.equal(result.state, index < 7 ? 'reused' : 'inserted');
  ids.push(result.id);
}
for (const row of m.rows) assert.equal((await a.apply(row.id)).state, 'reused');
await pg.query("update unidades_medida set nome_completo='edicao posterior' where id=$1",[ids[0]]);assert.equal((await a.reverse(m.rows[0].id)).state,'changed');for(const r of m.rows.slice(1)){assert.equal((await a.reverse(r.id)).state,'reversed');assert.equal((await a.reverse(r.id)).state,'reversed')}
const rows=(await pg.query("select count(*)::int n,count(*) filter(where ativo)::int active from unidades_medida")).rows[0];assert.equal(rows.n,14);assert.equal(rows.active,1);assert.equal((await pg.query("select count(*)::int n from audit_logs")).rows[0].n,41);
}finally{await pg.close()}
});
