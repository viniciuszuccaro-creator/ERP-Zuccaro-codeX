import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { DbClient, DbQueryExecutor } from '../../src/db/client.ts';
import { setupCrmFixture } from './crmFixture.ts';

export function assertCrmIsolatedUrl(value:string|undefined) {
  let parsed:URL;try{parsed=new URL(value ?? '');}catch{throw new Error('CRM_ISOLATED_POSTGRES_REQUIRED');}
  if(!['postgres:','postgresql:'].includes(parsed.protocol)
    || !['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)
    || !/^\/erp_(test|crm_test(?:_[a-z0-9]+)?)$/.test(parsed.pathname))throw new Error('CRM_ISOLATED_POSTGRES_REQUIRED');
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
      await dataPool.end();
      dataPool=new pg.Pool({connectionString:loginUrl.toString(),max:3,connectionTimeoutMillis:5000});
    }
  }catch(error){await cleanup();throw error;}
  return {admin,data:make(dataPool,!options.restrictedLogin),schema,role,restrictedLogin:options.restrictedLogin===true,
    exec:(sql:string)=>admin.query(sql),close:cleanup};
}
