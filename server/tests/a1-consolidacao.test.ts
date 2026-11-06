import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResultRow } from 'pg';
import { z } from 'zod';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import type { AuditEntry } from '../src/audit/types.ts';
import { AppError } from '../src/api/errors.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { A1VaultEncryption } from '../src/services/a1VaultEncryption.ts';
import { A1VaultService } from '../src/services/a1VaultService.ts';
import { A1FileProtectionKeys } from '../src/services/a1FileProtectionKeys.ts';
import { runA1Native } from '../src/services/a1NativeProcess.ts';
import { PostgresA1VaultRepository } from '../src/repositories/postgresA1VaultRepository.ts';

const groupId='11111111-1111-4111-8111-111111111111',empresaId='22222222-2222-4222-8222-222222222222',
  actorId='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444',
  requestId='55555555-5555-4555-8555-555555555555';
const ctx={groupId,empresaId,actorId,requestId};
// Generated fixture identifier only; not read from a registry, backup or operational company.
function syntheticCnpj(){
  let value='000000000001';
  for(const weights of [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]]){
    const remainder=weights.reduce((sum,weight,index)=>sum+Number(value[index])*weight,0)%11;
    value+=String(remainder<2?0:11-remainder);
  }
  return value;
}

// Actual service/repository/encryption, synthetic SQL responses. Not a schema, RLS or persistence proof.
async function fixture(){
  const local=new PGlite(),rbac=new InMemoryRbacGuard(),issuerCnpj=syntheticCnpj();
  const keys=new Map([['synthetic_a',randomBytes(32)],['synthetic_b',randomBytes(32)]]);
  let active='synthetic_a',failAudit=false,revokePermission=false,corruptStorage=false,failCommit=false;
  let audits:AuditEntry[]=[];
  const key=(name:string)=>{const bytes=keys.get(name);if(!bytes)throw new Error('Synthetic key unavailable');return Buffer.from(bytes);};
  const encryption=new A1VaultEncryption({active:async()=>({id:active,bytes:key(active)}),read:async name=>key(name)});
  const material=Buffer.from('SYNTHETIC-ENCRYPTION-ONLY-NOT-A-CERTIFICATE'),password=Buffer.from('SYNTHETIC-EPHEMERAL-ONLY');
  const encrypted=await encryption.seal({groupId,empresaId,certificateId:id,issuerCnpj},material,password);
  material.fill(0);password.fill(0);
  let stored:Record<string,unknown>={id,group_id:groupId,empresa_id:empresaId,operation_id:requestId,created_by:actorId,
    issuer_cnpj:issuerCnpj,fingerprint:createHash('sha256').update('synthetic-fixture').digest('hex'),
    valid_from:'2026-10-01T00:00:00Z',valid_to:'2026-12-01T00:00:00Z',trust_version:'synthetic',state:'ACTIVE',revision:'1',encrypted_envelope:encrypted};
  const grant=(actions=['visualizar','importar','usar','revogar','rotacionar'])=>rbac.link({actorId,groupId,empresaId,
    permissions:{Fiscal:{certificado:actions}}});
  grant();
  const q:DbQueryExecutor={async query<T extends QueryResultRow = QueryResultRow>(sql:string,params:unknown[]=[]){
    let reply:Record<string,unknown>[]=[];
    if(sql.includes('current_setting'))reply=[{group_id:groupId,empresa_id:empresaId}];
    else if(sql.includes('pg_advisory_xact_lock'))assert.deepEqual(params,[groupId,empresaId]);
    else if(sql.includes('FROM empresas')){assert.deepEqual(params,[groupId,empresaId]);reply=[{cnpj:issuerCnpj,status:'Ativa'}];}
    else if(sql.includes('FROM a1_certificate_vault')){
      assert.deepEqual(params.slice(0,2),[groupId,empresaId]);
      if(params.length===3?params[2]===id:stored.state==='ACTIVE')reply=[stored];
    }else if(sql.startsWith('UPDATE a1_certificate_vault')){
      assert.deepEqual(params.slice(0,2),[groupId,empresaId]);
      if(params[2]===id&&params[3]===stored.revision&&stored.state==='ACTIVE'){
        stored={...stored,state:params[4],revision:(BigInt(z.string().parse(stored.revision))+1n).toString(),
          encrypted_envelope:params[5]===null?stored.encrypted_envelope:JSON.parse(z.string().parse(params[5]))};
        if(corruptStorage)stored={...stored,created_by:requestId};
        reply=[stored];
      }
    }else throw new Error('Unexpected A1 SQL contract');
    const names=[...new Set(reply.flatMap(row=>Object.keys(row)))];assert(names.every(name=>/^[a-z_]+$/.test(name)));
    const select=names.length?`SELECT ${names.map(name=>`value->'${name}' AS "${name}"`).join(',')} FROM jsonb_array_elements($1::jsonb) AS value`:'SELECT 1 WHERE false';
    const result=await local.query<T>(select,names.length?[JSON.stringify(reply)]:[]);
    return {rows:result.rows,fields:[],rowCount:result.rows.length,command:'SELECT',oid:0};
  }};
  const db:DbClient={query:async()=>{throw new Error('Unexpected pool access');},pool:null,
    checkConnection:async()=>true,end:()=>local.close(),withTenantContext:(scope,fn)=>{
      if(scope.groupId!==groupId||scope.empresaId!==empresaId)throw new AppError(403,'A1_CONTEXT_MISMATCH','Synthetic scope denied');
      return fn();
    },withTransaction:async fn=>{
      const before=structuredClone({stored,audits});
      try{const value=await fn(q);if(failCommit)throw new Error('SYNTHETIC_COMMIT_FAILED');return value;}
      catch(error){stored=before.stored;audits=before.audits;throw error;}
    }};
  const service=new A1VaultService(db,rbac,{listByEntity:async()=>[],append:async(entry,executor)=>{
    assert.equal(executor,q);
    const serialized=JSON.stringify(entry);
    for(const name of ['encrypted_envelope','ciphertext','nonce','password','issuer_cnpj'])assert(!serialized.includes(name));
    audits.push(entry);if(failAudit)throw new Error('SYNTHETIC_AUDIT_FAILURE');if(revokePermission)grant([]);
  }},new PostgresA1VaultRepository(),encryption,async()=>({version:'synthetic-untrusted',rootsPem:Buffer.from('NOT-A-ROOT'),
    rootFingerprints:['0'.repeat(64)],crlsPem:Buffer.from('NOT-A-CRL'),allowedPolicies:['2.16.76.1.2.1.999999'],validUntil:'2099-01-01T00:00:00Z',maxCrlAgeMs:1}));
  return {service,grant,state:()=>structuredClone(stored),audits:()=>audits.length,
    nextKey:()=>{active='synthetic_b';},failAudit:()=>{failAudit=true;},revokePermission:()=>{revokePermission=true;},
    corruptStorage:()=>{corruptStorage=true;},failCommit:()=>{failCommit=true;},
    close:async()=>{for(const bytes of keys.values())bytes.fill(0);await local.close();}};
}

test('A1 consolidation: metadata allowlist, real encryption rewrap and local revoke preserve scoped CAS and sanitized audit',async()=>{
  const f=await fixture();try{
    const metadata=await f.service.metadata(ctx);assert(metadata);assert.equal(metadata.revision,'1');
    assert.deepEqual(Object.keys(metadata).sort(),['id','fingerprint','validFrom','validTo','state','revision','trustStoreVersion'].sort());
    f.nextKey();const rotated=await f.service.rotate(ctx,{id,revision:'1'});assert.equal(rotated.revision,'2');
    await assert.rejects(f.service.revoke(ctx,{id,revision:'1'}),{code:'A1_REVISION_CONFLICT'});
    const revoked=await f.service.revoke(ctx,{id,revision:'2'});assert.equal(revoked.state,'REVOKED_LOCAL');assert.equal(revoked.revision,'3');
    assert.equal(await f.service.metadata(ctx),null);
    await assert.rejects(f.service.rotate(ctx,{id,revision:'3'}),{code:'A1_REVISION_CONFLICT'});
    assert.equal(f.audits(),3);
  }finally{await f.close();}
});

test('A1 consolidation: permissions are granular and altered group/company/actor never reach private material',async()=>{
  const f=await fixture();try{
    f.grant(['editar','cancelar']);
    for(const operation of [()=>f.service.metadata(ctx),()=>f.service.rotate(ctx,{id,revision:'1'}),()=>f.service.revoke(ctx,{id,revision:'1'})])
      await assert.rejects(operation(),{code:'PERMISSION_DENIED'});
    f.grant();
    for(const patch of [{groupId:requestId},{empresaId:requestId},{actorId:requestId},{empresaId:null}])
      await assert.rejects(f.service.metadata({...ctx,...patch}));
    assert.equal(f.audits(),0);assert.equal(f.state().state,'ACTIVE');
  }finally{await f.close();}
});

test('A1 consolidation: audit, late permission revoke, storage mismatch and commit failure roll back fixture without success',async()=>{
  for(const mode of ['audit','permission','storage','commit']){
    const f=await fixture();try{
      const before=f.state();
      if(mode==='audit')f.failAudit();if(mode==='permission')f.revokePermission();if(mode==='storage')f.corruptStorage();if(mode==='commit')f.failCommit();
      await assert.rejects(f.service.revoke(ctx,{id,revision:'1'}));
      assert.deepEqual(f.state(),before);assert.equal(f.audits(),0);
    }finally{await f.close();}
  }
});

test('A1 consolidation: invalid synthetic container never becomes a usable upload or signature',async()=>{
  const f=await fixture(),certificate=Buffer.from('SYNTHETIC-NOT-PKCS12'),password=Buffer.from('SYNTHETIC-ONLY');
  try{
    await assert.rejects(f.service.upload(ctx,{operationId:requestId,certificate,password}),error=>error instanceof AppError);
    await assert.rejects(f.service.sign(ctx,{id,revision:'1'},Buffer.from('SYNTHETIC-SIGNING-INPUT')),error=>error instanceof AppError);
    assert.equal(f.audits(),0);assert.equal(f.state().state,'ACTIVE');
  }finally{certificate.fill(0);password.fill(0);await f.close();}
});

test('A1 consolidation: unsupported native/key-file configuration fails closed and no runtime/migration activation exists',async()=>{
  await assert.rejects(runA1Native([],Buffer.alloc(0),[],{binary:'relative'}),{code:'A1_INSPECTION_UNAVAILABLE'});
  if(process.platform!=='linux')await assert.rejects(new A1FileProtectionKeys('/synthetic-unconfigured','synthetic').active(),{code:'A1_PROTECTION_KEY_UNAVAILABLE'});
  assert.equal(execFileSync('git',['diff',"e36231b3a7e546aa9fd2529abb8d5edb61d8189c",'--','server/src/api/router.ts','server/src/app.ts','server/migrations'],{encoding:'utf8'}),'');
  assert(!fs.existsSync('migrations/047_a1_certificate_vault.sql'));
  const before=JSON.parse(execFileSync('git',['show','e36231b3a7e546aa9fd2529abb8d5edb61d8189c:server/package-lock.json'],{encoding:'utf8'}));
  const after=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  for(const [name,value] of Object.entries(before.packages))if(name!=='')assert.deepEqual(after.packages[name],value);
});
