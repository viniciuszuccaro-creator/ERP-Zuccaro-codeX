import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, link } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inventoryBackup, compareBackupManifests, writeInventoryReport,verifyPrivateExtractionFiles,verifyPrivateUnitReviewReferences } from '../scripts/legado/inventario-backup-erp-antigo.mjs';
import {createHash} from 'node:crypto';

const extraction=files=>({privateOnly:true,operationalImportAuthorized:false,operationalDatabaseTouched:false,originalBackupModified:false,files});
const reference=(name,content)=>({fileName:name,bytes:Buffer.byteLength(content),fileSha256:createHash('sha256').update(content).digest('hex')});

async function unitReview(source){
 const manifest={operationalImportAuthorized:false,exactSiglaIsIdentityProof:false,approvedTargetIds:999};
 await mkdir(path.join(source,'nested'));
 for(const [index,key]of ['sourceFile','apiSnapshotFile','reviewFile'].entries()){
  const name=`private-${index}.csv`,content=`private content ${index}`;
  manifest[key]=name;manifest[key.replace('File','Sha256')]=reference(name,content).fileSha256;
  await writeFile(path.join(source,index===0?'nested':'',name),content);
 }
 return manifest;
}

test('unit review resolves nested references by hash without approving target mapping',()=>fixture(async({source})=>{
 const manifest=await unitReview(source),before=JSON.stringify(manifest);
 const out=await verifyPrivateUnitReviewReferences(source,manifest);
 assert.equal(out.declaredReferencesVerified,true);assert.equal(out.scanComplete,true);
 for(const key of ['semanticEquivalenceVerified','targetMappingApproved','sourceLineageVerified','originalBackupEquivalent','importAuthorized','imported'])assert.equal(out[key],false);
 assert(out.results.every(row=>row.status==='verified'));
 assert.equal(JSON.stringify(manifest),before);
 assert(!JSON.stringify(out).includes('private-'));assert(!JSON.stringify(out).includes('private content'));
 await writeFile(path.join(source,'nested',manifest.sourceFile),'changed');
 assert.equal((await verifyPrivateUnitReviewReferences(source,manifest)).results[0].status,'divergent');
}));

test('unit review refuses duplicate basenames even with equal bytes and does not choose first',()=>fixture(async({source})=>{
 const manifest=await unitReview(source);
 await writeFile(path.join(source,manifest.sourceFile),'private content 0');
 const out=await verifyPrivateUnitReviewReferences(source,manifest);
 assert.equal(out.results[0].status,'ambiguous');assert.equal(out.declaredReferencesVerified,false);
 await rm(path.join(source,manifest.sourceFile));await rm(path.join(source,'nested',manifest.sourceFile));
 assert.equal((await verifyPrivateUnitReviewReferences(source,manifest)).results[0].status,'missing');
}));

test('unit review rejects invalid declarations and incomplete bounded scans',()=>fixture(async({source})=>{
 const manifest=await unitReview(source);
 for(const mutation of [{sourceFile:'../outside'}, {sourceSha256:'invalid'}, {reviewFile:manifest.sourceFile},
   {operationalImportAuthorized:true},{exactSiglaIsIdentityProof:true}])
  await assert.rejects(verifyPrivateUnitReviewReferences(source,{...manifest,...mutation}),/MANIFEST_INVALID/);
 for(const options of [{maxDepth:0},{maxEntries:1}]){
  const out=await verifyPrivateUnitReviewReferences(source,manifest,options);
  assert.equal(out.scanComplete,false);assert.equal(out.declaredReferencesVerified,false);
  assert(out.results.every(row=>row.status==='scan_incomplete'));
 }
}));

test('unit review preserves extraction secret and mid-read change guards',()=>fixture(async({source})=>{
 const manifest=await unitReview(source);
 await rm(path.join(source,manifest.reviewFile));manifest.reviewFile='.env';
 const out=await verifyPrivateUnitReviewReferences(source,manifest,{hashFile:async p=>{
  assert.notEqual(path.basename(p),'.env');return reference('',await readFile(p)).fileSha256;
 }});
 assert.equal(out.results[2].status,'missing');
 await writeFile(path.join(source,'.env'),'private');
 assert.equal((await verifyPrivateUnitReviewReferences(source,manifest)).results[2].status,'blocked_secret');
 const raced=await verifyPrivateUnitReviewReferences(source,manifest,{hashFile:async p=>{
  const digest=reference('',await readFile(p)).fileSha256;await writeFile(p,'different longer value');return digest;
 }});
 assert.equal(raced.results[0].status,'source_changed');assert.equal(raced.declaredReferencesVerified,false);
}));

test('extraction references verify bytes without proving source lineage or exposing private names/values',()=>fixture(async({source})=>{
 const content='synthetic private value',name='private-customer.csv';await writeFile(path.join(source,name),content);
 const manifest=extraction([reference(name,content)]),before=JSON.stringify(manifest);
 const report=await verifyPrivateExtractionFiles(source,manifest);assert.equal(report.declaredFilesVerified,true);
 assert.equal(report.originalBackupEquivalent,false);assert.equal(report.sourceLineageVerified,false);assert.equal(report.importAuthorized,false);
 assert.ok(!JSON.stringify(report).includes(name));assert.ok(!JSON.stringify(report).includes(content));assert.equal(JSON.stringify(manifest),before);
 await writeFile(path.join(source,name),'changed private value!');assert.equal((await verifyPrivateExtractionFiles(source,manifest)).results[0].status,'divergent');
}));

test('extraction rejects unsafe references before reads and blocks secrets, missing or racing files',()=>fixture(async({source})=>{
 const item=reference('sample.csv','old');await writeFile(path.join(source,item.fileName),'old');
 for(const manifest of [extraction([{...item,fileName:'../outside'}]),extraction([item,item]),{...extraction([item]),originalBackupModified:true}])
  await assert.rejects(verifyPrivateExtractionFiles(source,manifest),/MANIFEST_INVALID/);
 const secretItem=reference('.env','secret');const blocked=await verifyPrivateExtractionFiles(source,extraction([secretItem]),{hashFile:async()=>{throw Error('must not read')}});
 assert.equal(blocked.results[0].status,'blocked_secret');
 const raced=await verifyPrivateExtractionFiles(source,extraction([item]),{hashFile:async p=>{await writeFile(p,'new longer');return item.fileSha256;}});
 assert.equal(raced.results[0].status,'source_changed');assert.equal(raced.declaredFilesVerified,false);
 assert.equal((await verifyPrivateExtractionFiles(source,extraction([reference('absent.csv','')]))).results[0].status,'missing');
}));

test('extraction hardlink guard refuses to open an aliased file',()=>fixture(async({source,copy})=>{
 const item=reference('sample.csv','old');await writeFile(path.join(source,item.fileName),'old');
 await link(path.join(source,item.fileName),path.join(copy,'alias'));
 const report=await verifyPrivateExtractionFiles(source,extraction([item]),{hashFile:async()=>{throw Error('must not read')}});
 assert.equal(report.results[0].status,'blocked_link_or_type');
}));

async function fixture(fn, base=os.tmpdir()) {
  const tmp=await mkdtemp(path.join(base,'legacy-equivalence-'));
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

test('hard-link alias cannot bypass secret classification or open content',()=>fixture(async({source})=>{
  const secret=path.join(source,'USUSENHA.TPS');await writeFile(secret,'synthetic');
  await link(secret,path.join(source,'notes.sql'));
  let reads=0;
  await assert.rejects(()=>inventoryBackup(source,{hashFile:async()=>{reads++;throw new Error('must not read');}}),/LEGACY_HARDLINK_REQUIRES_REVIEW/);
  assert.equal(reads,0);
},process.cwd()));

test('secret size divergence is blocked and reported as changed; trailing dot has no extension',()=>fixture(async({source,copy})=>{
  await writeFile(path.join(source,'USUSENHA.TPS'),'aa');await writeFile(path.join(copy,'USUSENHA.TPS'),'aaaa');
  const result=compareBackupManifests(await inventoryBackup(source),await inventoryBackup(copy));
  assert.equal(result.changed,1);assert.equal(result.blocked,1);assert.equal(result.equivalent,false);
  await writeFile(path.join(source,'file.'),'synthetic');
  const inventory=await inventoryBackup(source);
  assert.equal(inventory.files.find(file=>file.name==='file.' || file.name==='file').extension,'sem_extensao');
}));
