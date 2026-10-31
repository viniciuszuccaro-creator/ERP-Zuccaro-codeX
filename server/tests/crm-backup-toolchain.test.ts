import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCrmBackupToolchain, proveCrmFixtureBackup } from './helpers/crmPostgresFixture.ts';

const tools=(dump='16.15',restore=dump)=>({
  pg_dump:{status:0,stdout:`pg_dump (PostgreSQL) ${dump} (Ubuntu package)\n`},
  pg_restore:{status:0,stdout:`pg_restore (PostgreSQL) ${restore}\n`},
});
test('backup toolchain accepts matching major independently of patch/package suffix',()=>{
  assertCrmBackupToolchain(160015,tools('16.10','16.15'));
});
test('backup toolchain refuses newer SQL dialect and inconsistent restore binary before destructive phase',()=>{
  for(const version of ['17.1','18.0','15.9']) {
    assert.throws(()=>assertCrmBackupToolchain(160015,tools(version)),/CRM_BACKUP_TOOLCHAIN_VERSION_MISMATCH:pg_dump/);
    assert.throws(()=>assertCrmBackupToolchain(160015,tools('16.15',version)),/CRM_BACKUP_TOOLCHAIN_VERSION_MISMATCH:pg_restore/);
  }
});
test('missing, failed and unparseable tools are not approval and never expose stderr or credentials',()=>{
  for(const invalid of [{status:null,stdout:'',error:new Error('PRIVATE')},{status:1,stdout:'PRIVATE'},{status:0,stdout:'unknown'}]) {
    for(const name of ['pg_dump','pg_restore'] as const) {
      const probes={...tools(),[name]:invalid};
      assert.throws(()=>assertCrmBackupToolchain(160015,probes),e=>e instanceof Error&&e.message===`CRM_BACKUP_TOOLCHAIN_UNAVAILABLE:${name}`&&!e.message.includes('PRIVATE'));
    }
  }
  for(const version of [NaN,Infinity,0,160015.5])assert.throws(()=>assertCrmBackupToolchain(version,tools()),/CRM_BACKUP_SERVER_VERSION_INVALID/);
});
test('real backup helper refuses incompatible tools before snapshot, DROP, replay or temporary archive',async()=>{
  let queries=0,writes=0,replays=0;
  const fixture={schema:'crm_test_aaaaaaaaaaaaaaaaaa',admin:{query:async()=>{
    queries++;assert.equal(queries,1,'No snapshot query may run before the toolchain gate');
    return {rows:[{database:'erp_test',schema:'crm_test_aaaaaaaaaaaaaaaaaa',user:'synthetic',version:9990000}]};
  }},exec:async()=>{writes++;throw new Error('MUST_NOT_DROP');}};
  await assert.rejects(proveCrmFixtureBackup('postgresql://synthetic:synthetic@127.0.0.1/erp_test',
    fixture as unknown as Parameters<typeof proveCrmFixtureBackup>[1],async()=>{replays++;}),
    /CRM_BACKUP_TOOLCHAIN_(UNAVAILABLE|VERSION_MISMATCH):pg_dump/);
  assert.deepEqual({queries,writes,replays},{queries:1,writes:0,replays:0});
});
