import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectCrmPreflight} from '../src/db/crmPreflight.ts';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {spawnSync} from 'node:child_process';

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
