import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inventoryBackup, compareBackupManifests, writeInventoryReport } from '../scripts/legado/inventario-backup-erp-antigo.mjs';

async function fixture(fn) {
  const tmp=await mkdtemp(path.join(os.tmpdir(),'legacy-equivalence-'));
  try { const source=path.join(tmp,'source'),copy=path.join(tmp,'copy');
    await mkdir(source);await mkdir(copy);await fn({tmp,source,copy});
  } finally { await rm(tmp,{recursive:true,force:true}); }
}

test('inventory compares bytes and relative paths, not counts or basenames',()=>fixture(async({source,copy})=>{
  for (const root of [source,copy]) { await mkdir(path.join(root,'nested'));await writeFile(path.join(root,'nested','sample.sql'),'synthetic'); }
  const original=await inventoryBackup(source), equivalent=await inventoryBackup(copy);
  assert.equal(compareBackupManifests(original,equivalent).equivalent,true);
  await writeFile(path.join(copy,'nested','sample.sql'),'different');
  const changed=compareBackupManifests(original,await inventoryBackup(copy));
  assert.equal(changed.changed,1);assert.equal(changed.equivalent,false);
  await rm(path.join(copy,'nested','sample.sql'));await writeFile(path.join(copy,'sample.sql'),'synthetic');
  const moved=compareBackupManifests(original,await inventoryBackup(copy));
  assert.equal(moved.missing,1);assert.equal(moved.extra,1);assert.equal(moved.equivalent,false);
  assert.equal(await readFile(path.join(source,'nested','sample.sql'),'utf8'),'synthetic');
}));

test('secret candidates are never opened or hashed and cannot prove full equivalence',()=>fixture(async({source,copy})=>{
  for(const root of [source,copy]) await writeFile(path.join(root,'USUSENHA.TPS'),'synthetic secret placeholder');
  const neverRead=async()=>{throw new Error('content must never be opened');};
  const left=await inventoryBackup(source,{hashFile:neverRead}), right=await inventoryBackup(copy,{hashFile:neverRead});
  assert.equal(left.files[0].sha256,null);assert.equal(left.files[0].name,'BLOCKED_SECRET_FILENAME');
  assert.equal(compareBackupManifests(left,right).blocked,1);assert.equal(compareBackupManifests(left,right).equivalent,false);
}));

test('incomplete, duplicate and inconsistent manifests fail closed',()=>fixture(async({source})=>{
  await writeFile(path.join(source,'sample.csv'),'synthetic');const valid=await inventoryBackup(source);
  for(const invalid of [{...valid,complete:false},{...valid,file_count:0},
    {...valid,bytes_total:0},{...valid,files:[...valid.files,...valid.files],file_count:2,bytes_total:valid.bytes_total*2},
    {...valid,files:[{...valid.files[0],sha256:null}]}]) {
    assert.throws(()=>compareBackupManifests(valid,invalid),/LEGACY_MANIFEST_INVALID/);
  }
}));

test('missing source and hashing access failures invalidate inventory',()=>fixture(async({source})=>{
  await assert.rejects(()=>inventoryBackup(path.join(source,'missing')),e=>e.code==='ENOENT');
  await writeFile(path.join(source,'sample.sql'),'synthetic');
  await assert.rejects(()=>inventoryBackup(source,{hashFile:async()=>{throw Object.assign(new Error('denied'),{code:'EACCES'});}}),e=>e.code==='EACCES');
}));

test('source changing during hash fails closed',()=>fixture(async({source})=>{
  const file=path.join(source,'sample.sql');await writeFile(file,'first');
  await assert.rejects(()=>inventoryBackup(source,{hashFile:async()=>{await writeFile(file,'different length');return 'a'.repeat(64);}}),/LEGACY_SOURCE_CHANGED_DURING_INVENTORY/);
}));

test('reports stay outside original and never overwrite an existing file',()=>fixture(async({tmp,source})=>{
  await writeFile(path.join(source,'sample.sql'),'synthetic');const result=await inventoryBackup(source);
  await assert.rejects(()=>writeInventoryReport(source,path.join(source,'report.json'),result),/LEGACY_REPORT_MUST_BE_OUTSIDE_SOURCE/);
  const report=path.join(tmp,'report.json');await writeInventoryReport(source,report,result);
  assert.equal(JSON.parse(await readFile(report,'utf8')).complete,true);
  await assert.rejects(()=>writeInventoryReport(source,report,result),e=>e.code==='EEXIST');
}));
