import { readFile, readdir } from 'node:fs/promises';
import type { DbClient, DbQueryExecutor } from '../../src/db/client.ts';
import { SEED_IDS as ID } from '../../scripts/seedDevIds.ts';
import { OWNER_ERP_PERMISSION_TREE } from '../../src/security/ownerPermissionTree.ts';

export const ROLE='erp_crm_test_role';
/** Reference policies here are isolated fixtures, never operational grants. */
export async function setupCrmFixture(exec:(sql:string)=>Promise<unknown>,role=ROLE) {
  if(!/^[a-z][a-z0-9_]{1,60}$/.test(role))throw new Error('CRM_TEST_ROLE_INVALID');
  const dir=new URL('../../migrations/',import.meta.url);
  const names=(await readdir(dir)).filter(n=>/^\d+.*\.sql$/.test(n)).sort();
  for(const name of names){const sql=await readFile(new URL(name,dir),'utf8');await exec(sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));}
  await exec(await readFile(new URL('../../scripts/seed-dev-synthetic.sql',import.meta.url),'utf8'));
  await exec(`UPDATE profiles SET empresa_id=NULL,permissoes='${JSON.stringify(OWNER_ERP_PERMISSION_TREE)}'::jsonb WHERE id IN ('${ID.runtimeActorA}','${ID.runtimeActorB}')`);
  await exec(`CREATE ROLE ${role} NOSUPERUSER NOBYPASSRLS NOLOGIN;
    GRANT SELECT,INSERT,UPDATE ON oportunidades,entity_code_sequences TO ${role};
    GRANT SELECT,INSERT ON audit_logs TO ${role};
    GRANT SELECT ON cliente_empresas,orcamentos,orcamento_itens TO ${role};
    GRANT SELECT ON profiles TO ${role};
    GRANT UPDATE(updated_at) ON orcamentos TO ${role};
    GRANT EXECUTE ON FUNCTION reserve_entity_codigo(uuid,text,integer) TO ${role};`);
  for(const table of ['cliente_empresas','orcamentos','orcamento_itens','audit_logs'])await exec(`
    CREATE POLICY crm_fixture_scope ON ${table} FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  await exec(`CREATE POLICY crm_fixture_sequence ON entity_code_sequences FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  await exec(`CREATE POLICY crm_fixture_profile ON profiles FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
      AND (empresa_id IS NULL OR empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid))`);
}

/** Adapts the existing PGlite test engine to the shared DB executor. */
export async function localCrmFixture() {
  const {PGlite}=await import('@electric-sql/pglite');const pg=new PGlite();
  try {await setupCrmFixture(sql=>pg.exec(sql));}catch(error){await pg.close();throw error;}
  const query=(engine:any):DbQueryExecutor['query']=>async(sql,params)=>{
    const r=await engine.query(sql,params);return {rows:r.rows,rowCount:r.rows.length,command:'SELECT',oid:0,fields:[]};
  };
  const make=(restricted:boolean):DbClient=>({pool:null,query:restricted
    ? (sql,params)=>pg.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${ROLE}`);return query(tx)(sql,params);})
    : query(pg),checkConnection:async()=>true,end:async()=>{},
    withTransaction:fn=>pg.transaction(async tx=>{
      if(restricted)await tx.exec(`SET LOCAL ROLE ${ROLE}`);
      return fn({query:query(tx)});
    })});
  return {admin:make(false),data:make(true),exec:(sql:string)=>pg.exec(sql),close:()=>pg.close()};
}
