import test from 'node:test';
import assert from 'node:assert/strict';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {MarcaService} from '../src/services/marcaService.ts';
import {PostgresMarcaRepository} from '../src/repositories/postgresMarcaRepository.ts';
import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';
import {PostgresTenantGuard} from '../src/db/tenantGuard.ts';
import {PostgresRbacGuard} from '../src/db/rbacGuard.ts';
import {SEED_IDS as I} from '../scripts/seedDevIds.ts';
async function prove(f:any,role:string){try{
 await f.exec(`GRANT SELECT,INSERT,UPDATE ON marcas TO ${role};GRANT SELECT ON empresas TO ${role};CREATE POLICY fixture_marca ON marcas FOR ALL TO ${role} USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid) WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);CREATE POLICY fixture_empresa_marca ON empresas FOR SELECT TO ${role} USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);`);
 const s=new MarcaService(new PostgresMarcaRepository(f.data),new PostgresAuditRepository(f.data),new PostgresTenantGuard(f.data),new PostgresRbacGuard(f.data),f.data);
 const ctx={groupId:I.groupA,empresaId:I.empresaA,actorId:I.runtimeActorA,requestId:'synthetic-atomic'};
 const row=await s.create(ctx,{nome_marca:'Atomic',pais_origem:'Brasil'});
 const before=(await f.admin.query('SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name=$2',[I.groupA,'Marca'])).rows[0].next_value;
 await f.exec(`CREATE FUNCTION fixture_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='Marca' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER fixture_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fixture_fail_audit();`);
 await assert.rejects(()=>s.create(ctx,{nome_marca:'Must rollback'}),/synthetic audit failure/);
 assert.equal((await f.admin.query("SELECT count(*)::int n FROM marcas WHERE nome_marca='Must rollback'")).rows[0].n,0);
 assert.equal((await f.admin.query('SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name=$2',[I.groupA,'Marca'])).rows[0].next_value,before);
 await assert.rejects(()=>s.update(ctx,row.id,{descricao:'Must rollback'}),/synthetic audit failure/);
 assert.equal((await f.admin.query('SELECT descricao FROM marcas WHERE id=$1',[row.id])).rows[0].descricao,null);
 await f.exec('DROP TRIGGER fixture_fail ON audit_logs');await s.update(ctx,row.id,{descricao:'Preserved'});await s.softDelete(ctx,row.id);
 const persisted=(await f.admin.query('SELECT * FROM marcas WHERE id=$1',[row.id])).rows[0];assert.equal(persisted.ativo,false);assert.equal(persisted.pais_origem,'Brasil');assert.equal(persisted.descricao,'Preserved');
 }finally{await f.close();}
}
test('Marca persistent rollback restores record and code sequence',async()=>prove(await localCrmFixture(),ROLE));
if(process.env.DATABASE_URL)test('Marca PostgreSQL real isolated persistence audit rollback and sequence',async()=>{const f=await realCrmFixture(process.env.DATABASE_URL!);await prove(f,f.role);});
