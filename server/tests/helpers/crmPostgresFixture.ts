import { randomUUID,createHash } from 'node:crypto';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,dirname,basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import type { DbClient, DbQueryExecutor } from '../../src/db/client.ts';
import { setupCrmFixture } from './crmFixture.ts';

export function assertCrmIsolatedUrl(value:string|undefined) {
  let parsed:URL;try{parsed=new URL(value ?? '');}catch{throw new Error('CRM_ISOLATED_POSTGRES_REQUIRED');}
  if(!['postgres:','postgresql:'].includes(parsed.protocol)
    || !['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)
    || !/^\/erp_(test|crm_test(?:_[a-z0-9]+)?)$/.test(parsed.pathname))throw new Error('CRM_ISOLATED_POSTGRES_REQUIRED');
}

/** Round-trip only a newly-created synthetic fixture schema; never a DEV database or original backup. */
export async function proveCrmFixtureBackup(value:string,f:Awaited<ReturnType<typeof realCrmFixture>>,verify:()=>Promise<void>,afterReconciliation?:()=>Promise<void>) {
  assertCrmIsolatedUrl(value);
  if(!/^crm_test_[a-f0-9]{18}$/.test(f.schema))throw new Error('CRM_BACKUP_SCHEMA_INVALID');
  const url=new URL(value),database=url.pathname.slice(1);
  const identity=(await f.admin.query<{database:string;schema:string;user:string}>(
    'SELECT current_database() AS database,current_schema() AS schema,current_user AS user')).rows[0];
  if(identity.database!==database||identity.schema!==f.schema||identity.user!==decodeURIComponent(url.username))throw new Error('CRM_BACKUP_DESTINATION_MISMATCH');
  const env={...process.env,PGHOST:url.hostname.replace(/^\[|\]$/g,''),PGPORT:url.port||'5432',PGDATABASE:database,
    PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGOPTIONS:''};
  const run=(program:string,args:string[])=>{
    const result=spawnSync(program,args,{env,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    if(result.status!==0||result.error)throw new Error(`CRM_BACKUP_TOOL_FAILED:${program}:${result.status??'unavailable'}`); // No private stderr/connection/rows.
  };
  const snapshot=async()=>{
    const data:Record<string,unknown>={};
    for(const table of ['oportunidades','pedidos','pedido_itens','pedido_historico','orcamentos','orcamento_itens','audit_logs',
      'profiles','entity_code_sequences','cliente_empresas','produtos','produto_empresas','unidades_medida','cliente_locais','obras','obra_empresas'])
      data[table]=(await f.admin.query(`SELECT to_jsonb(t)::text AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows;
    data.historySequence=(await f.admin.query('SELECT last_value,is_called FROM pedido_historico_ordem_seq')).rows;
    data.rls=(await f.admin.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relkind='r' ORDER BY c.relname`,[f.schema])).rows;
    data.policies=(await f.admin.query(`SELECT c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles::text,
      pg_get_expr(p.polqual,p.polrelid) AS "using",pg_get_expr(p.polwithcheck,p.polrelid) AS "check"
      FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 ORDER BY c.relname,p.polname`,[f.schema])).rows;
    data.acl=(await f.admin.query(`SELECT c.relname,a.grantee::text,a.privilege_type,a.is_grantable
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
      LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
      WHERE n.nspname=$1 AND c.relkind='r' ORDER BY c.relname,a.grantee,a.privilege_type`,[f.schema])).rows;
    data.columnAcl=(await f.admin.query(`SELECT c.relname,att.attname,a.grantee::text,a.privilege_type,a.is_grantable
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute att ON att.attrelid=c.oid,
      LATERAL aclexplode(att.attacl) a WHERE n.nspname=$1 AND att.attnum>0 AND NOT att.attisdropped
      ORDER BY c.relname,att.attname,a.grantee,a.privilege_type`,[f.schema])).rows;
    data.constraints=(await f.admin.query(`SELECT c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid) AS definition
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 ORDER BY c.relname,k.conname`,[f.schema])).rows;
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  };
  const root=await mkdtemp(join(tmpdir(),'erp-crm-backup-'));
  try {
    const archive=join(root,'fixture.dump'),damaged=join(root,'damaged.dump'),before=await snapshot();
    run('pg_dump',['--format=custom',`--schema=${f.schema}`,`--file=${archive}`]);
    const bytes=await readFile(archive),hash=createHash('sha256').update(bytes).digest('hex');
    if(bytes.length<1)throw new Error('CRM_BACKUP_EMPTY');
    const restore=async(file:string)=>{
      if(createHash('sha256').update(await readFile(file)).digest('hex')!==hash)throw new Error('CRM_BACKUP_HASH_MISMATCH');
      run('pg_restore',['--list',file]);
      await f.exec(`DROP SCHEMA "${f.schema}" CASCADE`);
      run('pg_restore',['--exit-on-error','--single-transaction',`--dbname=${database}`,file]);
    };
    await writeFile(damaged,bytes.subarray(0,Math.max(1,Math.floor(bytes.length/2))));
    let rejected=false;try{await restore(damaged);}catch(error){rejected=(error as Error).message==='CRM_BACKUP_HASH_MISMATCH';}
    if(!rejected||await snapshot()!==before)throw new Error('CRM_BACKUP_CORRUPTION_GATE_FAILED');
    await restore(archive);
    if(await snapshot()!==before)throw new Error('CRM_BACKUP_RECONCILIATION_FAILED');
    await verify();
    if(await snapshot()!==before)throw new Error('CRM_BACKUP_REPLAY_CHANGED_STATE');
    if(afterReconciliation)await afterReconciliation();
  }finally {
    if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('erp-crm-backup-'))throw new Error('CRM_BACKUP_TEMP_INVALID');
    await rm(root,{recursive:true,force:true});
  }
}
export async function realCrmFixture(value:string,options:{restrictedLogin?:boolean}={}) {
  assertCrmIsolatedUrl(value);
  const tag=randomUUID().replace(/-/g,'').slice(0,18),schema=`crm_test_${tag}`,role=`crm_test_role_${tag}`;
  const adminPool=new pg.Pool({connectionString:value,max:2,connectionTimeoutMillis:5000});
  let dataPool=new pg.Pool({connectionString:value,max:3,connectionTimeoutMillis:5000});
  let schemaCreated=false,roleCreated=false;
  const make=(pool:pg.Pool,restricted:boolean):DbClient=>{
    const run=async<T>(fn:(tx:DbQueryExecutor)=>Promise<T>)=>{
      const client=await pool.connect();try{
        await client.query('BEGIN');await client.query(`SET LOCAL search_path TO "${schema}",pg_catalog`);
        if(restricted)await client.query(`SET LOCAL ROLE "${role}"`);
        const result=await fn(client);await client.query('COMMIT');return result;
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    };
    return {pool,query:(sql,params)=>run(tx=>tx.query(sql,params)),withTransaction:run,
      checkConnection:async()=>true,end:async()=>{}};
  };
  const admin=make(adminPool,false);
  const cleanup=async()=>{
    await dataPool.end();
    try{if(schemaCreated)await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
      if(roleCreated)await adminPool.query(`DROP ROLE "${role}"`);
    }finally{await adminPool.end();}
  };
  try{
    await adminPool.query(`CREATE SCHEMA "${schema}"`);schemaCreated=true;
    await setupCrmFixture(async sql=>{
      await admin.query(sql);if(sql.includes(`CREATE ROLE ${role} `))roleCreated=true;
    },role);
    await adminPool.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`);
    if(options.restrictedLogin) {
      // Ephemeral synthetic credential only. Never returned, logged or stored outside this fixture.
      const password=randomUUID();
      await adminPool.query(`ALTER ROLE "${role}" LOGIN PASSWORD '${password}'`);
      const loginUrl=new URL(value);loginUrl.username=role;loginUrl.password=password;
      loginUrl.searchParams.set('options',`-c search_path=${schema},pg_catalog`);
      await dataPool.end();
      dataPool=new pg.Pool({connectionString:loginUrl.toString(),max:3,connectionTimeoutMillis:5000});
    }
  }catch(error){await cleanup();throw error;}
  return {admin,data:make(dataPool,!options.restrictedLogin),schema,role,restrictedLogin:options.restrictedLogin===true,
    exec:(sql:string)=>admin.query(sql),close:cleanup};
}
