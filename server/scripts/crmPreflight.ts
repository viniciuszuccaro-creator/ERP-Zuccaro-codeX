import {loadConfig} from '../src/config/env.js';
import {createDbClient} from '../src/db/client.js';
import {inspectCrmPreflight} from '../src/db/crmPreflight.js';

// Use the configured private connection. Never print URL, names, IDs or raw errors.
async function main() {
  const database=process.env.CRM_EXPECTED_DATABASE,schema=process.env.CRM_EXPECTED_SCHEMA;
  if(!database?.trim()||!schema?.trim()) {
    console.log(JSON.stringify({ready:false,blocked:['destinationRequired']}));process.exitCode=2;return;
  }
  let db:ReturnType<typeof createDbClient>|undefined;
  const stage=process.env.CRM_PREFLIGHT_STAGE??'after_migration';
  if(stage!=='before_migration'&&stage!=='after_migration') {
    console.log(JSON.stringify({ready:false,blocked:['invalidStage'],activationAuthorized:false}));process.exitCode=2;return;
  }
  try {
    db=createDbClient(loadConfig());
    const report=await db.withTransaction(async tx=>{
      await tx.query('SET TRANSACTION READ ONLY');
      return inspectCrmPreflight(tx,{database,schema,stage});
    });
    console.log(JSON.stringify({...report,scope:'schema_only',stage,activationAuthorized:false}));
    process.exitCode=report.ready?0:1;
  }catch {
    console.log(JSON.stringify({ready:false,blocked:['queryFailed'],activationAuthorized:false}));process.exitCode=2;
  }finally{if(db)await db.end().catch(()=>{process.exitCode=2;});}
}
void main();
