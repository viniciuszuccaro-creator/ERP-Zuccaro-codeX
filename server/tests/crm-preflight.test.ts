import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectCrmPreflight} from '../src/db/crmPreflight.ts';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {spawnSync} from 'node:child_process';

test('CRM preflight covers sequence isolation and PUBLIC table/column privileges',async()=>{
 const f=await localCrmFixture();try {
  const expected=(await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
  const inspect=()=>f.data.withTransaction(tx=>inspectCrmPreflight(tx,expected));
  assert.equal((await inspect()).ready,true);
  await f.exec('ALTER TABLE entity_code_sequences NO FORCE ROW LEVEL SECURITY');
  assert.ok((await inspect()).blocked.includes('sequenceRls'));
  await f.exec('ALTER TABLE entity_code_sequences FORCE ROW LEVEL SECURITY');
  await f.exec('GRANT SELECT ON entity_code_sequences TO PUBLIC');
  assert.ok((await inspect()).blocked.includes('noPublicDml'));
  await f.exec('REVOKE SELECT ON entity_code_sequences FROM PUBLIC');
  await f.exec('GRANT UPDATE(next_value) ON entity_code_sequences TO PUBLIC');
  assert.ok((await inspect()).blocked.includes('noPublicDml'));
  await f.exec('REVOKE UPDATE(next_value) ON entity_code_sequences FROM PUBLIC');
  assert.equal((await inspect()).ready,true);
 }finally{await f.close();}
});

test('CRM preflight never accepts absent or ambiguous effective-role flags',async()=>{
 for(const flags of [{},{rolsuper:null,rolbypassrls:null},{rolsuper:false},{rolsuper:0,rolbypassrls:0}]) {
  const db:any={query:async(sql:string)=>({rows:sql.includes('current_database()')
   ?[{database:'synthetic',schema:'public',...flags}]:[]})};
  const result=await inspectCrmPreflight(db,{database:'synthetic',schema:'public'});
  assert.equal(result.ready,false);assert.ok(result.blocked.includes('restrictedRole'));
 }
});

test('CRM operational preflight refuses privileged session hidden behind SET ROLE',async()=>{
 const f=await localCrmFixture();try {
  const expected=(await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
  const structural=await f.data.withTransaction(tx=>inspectCrmPreflight(tx,expected));assert.equal(structural.ready,true);
  const operational=await f.data.withTransaction(tx=>inspectCrmPreflight(tx,{...expected,requireRestrictedLogin:true} as any));
  assert.equal(operational.ready,false);assert.ok(operational.blocked.includes('restrictedLogin'));
  const onlyIdentity:any={query:async()=>({rows:[{database:expected.database,schema:expected.schema,rolsuper:false,rolbypassrls:false,
    session_super:false,session_bypass:false,same_login:false}]})};
  const mismatch=await inspectCrmPreflight(onlyIdentity,{...expected,requireRestrictedLogin:true} as any);
  assert.equal(mismatch.ready,false);assert.ok(mismatch.blocked.includes('restrictedLogin'));
 }finally{await f.close();}
});


test('CRM preflight CLI: destino obrigatório antes da conexão, saída sem identidade/segredos',()=>{
  const result=spawnSync(process.execPath,['--import','tsx','scripts/crmPreflight.ts'],{encoding:'utf8',
    cwd:new URL('../',import.meta.url),env:{...process.env,CRM_EXPECTED_DATABASE:'',CRM_EXPECTED_SCHEMA:'',DATABASE_URL:'postgresql://must-not-connect:private@example.invalid/forbidden'}});
  assert.equal(result.status,2);assert.equal(result.stderr,'');
  assert.deepEqual(JSON.parse(result.stdout),{ready:false,blocked:['destinationRequired']});
});

test('CRM preflight antes040: baseline039/ausência de tabela e ledger, inclusive colisão com view',async()=>{
  const f=await localCrmFixture();try {
    const identity=await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema');
    const expected={...identity.rows[0],stage:'before_migration' as const};
    const inspect=()=>f.data.withTransaction(tx=>inspectCrmPreflight({query:async(sql,params)=>{
      assert.match(sql.trim(),/^SELECT\b/i);return tx.query(sql,params);
    }},expected));
    await f.exec("INSERT INTO schema_migrations(id) VALUES('039_orcamentos_tabela_preco.sql')");
    assert.ok((await inspect()).blocked.includes('crmAbsent'));
    await f.exec('DROP TABLE oportunidades CASCADE');
    assert.ok((await inspect()).blocked.includes('crmAbsent')); // Ledger040 still present.
    await f.exec("DELETE FROM schema_migrations WHERE id='040_crm_oportunidades.sql'");
    assert.equal((await inspect()).ready,true);
    await f.exec("INSERT INTO schema_migrations(id) VALUES('041_unexpected.sql')");
    assert.ok((await inspect()).blocked.includes('baseline039'));
    await f.exec("DELETE FROM schema_migrations WHERE id='041_unexpected.sql'");
    await f.exec('CREATE VIEW oportunidades AS SELECT 1 AS placeholder');
    assert.ok((await inspect()).blocked.includes('crmAbsent'));
    await f.exec('DROP VIEW oportunidades');
    await f.exec("DELETE FROM schema_migrations WHERE id='039_orcamentos_tabela_preco.sql'");
    assert.ok((await inspect()).blocked.includes('baseline039'));
  }finally{await f.close();}
});

test('CRM preflight CLI: stage inválido recusado antes de conectar',()=>{
  const result=spawnSync(process.execPath,['--import','tsx','scripts/crmPreflight.ts'],{encoding:'utf8',cwd:new URL('../',import.meta.url),
    env:{...process.env,CRM_EXPECTED_DATABASE:'synthetic',CRM_EXPECTED_SCHEMA:'public',CRM_PREFLIGHT_STAGE:'unknown',DATABASE_URL:'postgresql://must-not-connect:private@example.invalid/forbidden'}});
  assert.equal(result.status,2);assert.equal(result.stderr,'');
  assert.deepEqual(JSON.parse(result.stdout),{ready:false,blocked:['invalidStage'],activationAuthorized:false});
});

test('CRM preflight: somente leitura, destino/papel/RLS/ledger/trigger/índice fail-closed',async()=>{
  const f=await localCrmFixture();try{
    const identity=await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema');
    const expected=identity.rows[0];
    const inspect=()=>f.data.withTransaction(tx=>inspectCrmPreflight({query:async(sql,params)=>{
      assert.match(sql.trim(),/^SELECT\b/i);return tx.query(sql,params);
    }},expected));
    const ok=await inspect();assert.equal(ok.ready,true);assert.deepEqual(ok.blocked,[]);
    await f.exec(`DROP TRIGGER trg_oportunidades_codigo ON oportunidades;
      CREATE TRIGGER trg_oportunidades_codigo AFTER UPDATE ON oportunidades
      FOR EACH ROW EXECUTE PROCEDURE sync_oportunidade_codigo();`);
    assert.ok((await inspect()).blocked.includes('codeTrigger'));
    await f.exec(`DROP TRIGGER trg_oportunidades_codigo ON oportunidades;
      CREATE TRIGGER trg_oportunidades_codigo BEFORE INSERT OR UPDATE OF codigo,group_id ON oportunidades
      FOR EACH ROW EXECUTE PROCEDURE sync_oportunidade_codigo();`);
    assert.deepEqual(Object.keys(ok).sort(),['blocked','checks','ready']);
    assert.equal((await inspectCrmPreflight(f.admin,expected)).checks.restrictedRole,false);
    assert.equal((await inspectCrmPreflight(f.admin,{...expected,database:'wrong-destination'})).checks.destination,false);
    await f.exec('ALTER TABLE oportunidades DISABLE TRIGGER trg_oportunidades_codigo');
    assert.ok((await inspect()).blocked.includes('codeTrigger'));
    await f.exec('ALTER TABLE oportunidades ENABLE TRIGGER trg_oportunidades_codigo');
    await f.exec("CREATE POLICY crm_bad_policy ON oportunidades FOR SELECT USING(true)");
    assert.ok((await inspect()).blocked.includes('policy'));await f.exec('DROP POLICY crm_bad_policy ON oportunidades');
    await f.exec("ALTER POLICY oportunidades_tenant_scope ON oportunidades USING(group_id=NULLIF(current_setting('app.group_id ',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)");
    assert.ok((await inspect()).blocked.includes('policy'));
    await f.exec("ALTER POLICY oportunidades_tenant_scope ON oportunidades USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)");
    await f.exec(`REVOKE UPDATE ON oportunidades FROM ${ROLE}`);assert.ok((await inspect()).blocked.includes('grants'));
    await f.exec(`GRANT UPDATE ON oportunidades TO ${ROLE}`);
    await f.exec('GRANT SELECT ON oportunidades TO PUBLIC');assert.ok((await inspect()).blocked.includes('noPublicDml'));
    await f.exec('REVOKE SELECT ON oportunidades FROM PUBLIC');
    await f.exec("DELETE FROM schema_migrations WHERE id='040_crm_oportunidades.sql'");assert.ok((await inspect()).blocked.includes('migration'));
    await f.exec('DROP INDEX uq_oportunidades_pedido_canonico');assert.ok((await inspect()).blocked.includes('exclusivePedido'));
    await assert.rejects(inspectCrmPreflight(f.admin,{database:'',schema:'public'}),/DESTINATION_REQUIRED/);
  }finally{await f.close();}
});

test('CRM preflight: policy restrictive-only e PUBLIC column ACL não homologam schema',async()=>{
  const f=await localCrmFixture();try {
    const expected=(await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
    const inspect=()=>f.data.withTransaction(tx=>inspectCrmPreflight(tx,expected));
    await f.exec(`GRANT SELECT(codigo),UPDATE(status) ON oportunidades TO PUBLIC`);
    assert.ok((await inspect()).blocked.includes('noPublicDml'));
    await f.exec('REVOKE SELECT(codigo),UPDATE(status) ON oportunidades FROM PUBLIC');
    assert.equal((await inspect()).ready,true);
    await f.exec(`DROP POLICY oportunidades_tenant_scope ON oportunidades;
      CREATE POLICY oportunidades_tenant_scope ON oportunidades AS RESTRICTIVE FOR ALL
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
    assert.ok((await inspect()).blocked.includes('policy'));
  }finally{await f.close();}
});
