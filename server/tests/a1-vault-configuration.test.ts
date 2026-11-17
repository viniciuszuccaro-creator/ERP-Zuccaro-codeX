import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, chmod, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { DbClient } from '../src/db/client.ts';
import { createConfiguredA1Vault } from '../src/services/a1VaultConfiguration.ts';

test('A1 runtime opt-in absent performs no DB, key or filesystem discovery', async () => {
 const db={query:async()=>{throw Error('MUST_NOT_ACCESS_DATABASE');}} as unknown as DbClient;
 assert.equal(await createConfiguredA1Vault(db),undefined);
 for(const value of ['', 'relative-config', '/missing-config-secret-fixture']) {
  await assert.rejects(createConfiguredA1Vault(db,value),{code:'A1_CONFIGURATION_UNAVAILABLE',message:'Certificate vault configuration unavailable'});
 }
});

test('Linux A1 configuration pins trust artifacts, validates key permissions and rejects BYPASSRLS', {skip:process.platform!=='linux'}, async () => {
 const dir=await mkdtemp(path.join(process.cwd(),'.a1-config-test-'));
 const keys=path.join(dir,'keys');
 await mkdir(keys,{mode:0o700});
 const key=path.join(keys,'fixture.key');await writeFile(key,Buffer.alloc(32,7),{mode:0o400});
 const root=path.join(dir,'roots.pem'),crl=path.join(dir,'crls.pem'),file=path.join(dir,'config.json');
 const roots=Buffer.from('PUBLIC SYNTHETIC ROOT BOUNDARY'),crls=Buffer.from('PUBLIC SYNTHETIC CRL BOUNDARY');
 await writeFile(root,roots,{mode:0o600});await writeFile(crl,crls,{mode:0o600});
 const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 const config={version:1,keyDirectory:keys,activeKeyId:'fixture',trust:{version:'synthetic',
  roots:{file:root,sha256:sha(roots)},crls:{file:crl,sha256:sha(crls)},rootFingerprints:['a'.repeat(64)],
  allowedPolicies:['2.16.76.1.2.1.1'],validUntil:new Date(Date.now()+3600000).toISOString(),maxCrlAgeMs:3600000}};
 let allowed=true,probes=0;
 const db={query:async(sql:string)=>{probes++;return {rows:sql.includes('pg_roles')?[{allowed}]:[]};}} as unknown as DbClient;
 const save=()=>writeFile(file,JSON.stringify(config),{mode:0o600});
 try {
  await save();assert.ok(await createConfiguredA1Vault(db,file));assert.equal(probes,2);
  // Construction is not PKCS12 acceptance; real trust/signatures/CRLs are checked by the existing service on upload.
  allowed=false;await assert.rejects(createConfiguredA1Vault(db,file),{code:'A1_CONFIGURATION_UNAVAILABLE'});allowed=true;
  await writeFile(crl,'changed');await assert.rejects(createConfiguredA1Vault(db,file),{code:'A1_CONFIGURATION_UNAVAILABLE'});await writeFile(crl,crls);
  config.trust.validUntil='2000-01-01T00:00:00.000Z';await save();await assert.rejects(createConfiguredA1Vault(db,file),{code:'A1_CONFIGURATION_UNAVAILABLE'});
  config.trust.validUntil=new Date(Date.now()+3600000).toISOString();await save();
  await chmod(key,0o600);await assert.rejects(createConfiguredA1Vault(db,file),{code:'A1_CONFIGURATION_UNAVAILABLE'});
 } finally {await rm(dir,{recursive:true,force:true});}
});
