import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { processStagingBatches } from '../scripts/legado/staging-checkpoint.mjs';
import { consumirLotesStagingRetomavel } from '../scripts/legado/consumir-lote-staging.mjs';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'erp-staging-test-'));
  fs.chmodSync(directory,0o700);
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  return {directory, repo:process.cwd(), nativeKey:'cod_cliente', sourceSha256:'a'.repeat(64),
    runId:'synthetic', batchSize:2, rows:[{cod_cliente:'003'},{cod_cliente:'001'},{cod_cliente:'002'}]};
}
test('bounded staging resumes after durable checkpoint without repeating completed work',t=>{
  const args=fixture(t), seen=[];
  const consume=rows=>{seen.push(rows.map(row=>row.cod_cliente));return {comprovados:[],totais:{rows:rows.length}};};
  assert.throws(()=>processStagingBatches({...args,consume,afterCheckpoint:()=>{throw Error('interrupt');}}),/interrupt/);
  assert.equal(fs.existsSync(path.join(args.directory,'writer.lock')),false);
  const resumed=processStagingBatches({...args,consume});
  assert.deepEqual(seen,[['001','002'],['003']]);
  assert.equal(resumed.reused,1);assert.equal(resumed.processed,1);assert.equal(resumed.businessWrites,0);
  assert.equal(processStagingBatches({...args,consume}).reused,2);
  for(const changes of [{sourceSha256:'b'.repeat(64)},{options:{groupId:'other'}},{batchSize:1},
    {rows:[{cod_cliente:'001',nome:'changed'}]}])
    assert.throws(()=>processStagingBatches({...args,...changes,consume}),/MANIFEST_CHANGED/);
  const file=path.join(args.directory,'batch-00000000.private.json');
  const receipt=JSON.parse(fs.readFileSync(file));receipt.result.totais.rows=99;
  fs.writeFileSync(file,JSON.stringify(receipt));
  assert.throws(()=>processStagingBatches({...args,consume}),/CHECKPOINT_INVALID/);
});
test('staging rejects duplicate identities, invalid size and concurrent writer',t=>{
  const args=fixture(t), consume=()=>assert.fail('must not consume');
  for(const batchSize of [0,1001,1.5]) assert.throws(()=>processStagingBatches({...args,batchSize,consume}),/CONTRACT/);
  assert.throws(()=>processStagingBatches({...args,rows:[{cod_cliente:'001'},{cod_cliente:'001'}],consume}),/DUPLICATE/);
  fs.writeFileSync(path.join(args.directory,'writer.lock'),'other');
  assert.throws(()=>processStagingBatches({...args,consume}),/EEXIST/);
  assert.equal(fs.readFileSync(path.join(args.directory,'writer.lock'),'utf8'),'other');
});
test('existing mapper remains owner of staging classification, no business persistence',t=>{
  const args=fixture(t);
  args.rows=args.rows.map(row=>({...row,nome:'Synthetic',group_id:'synthetic'}));
  const options={entidade:'cliente',groupId:'synthetic',contratoEntrada:{coorte:'synthetic',crosswalkEmpresas:{1:'synthetic-company'}}};
  const result=consumirLotesStagingRetomavel({...args,options});
  assert.equal(result.records,3);assert.equal(result.businessWrites,0);
  const receipt=JSON.parse(fs.readFileSync(path.join(args.directory,'batch-00000000.private.json')));
  assert.equal(receipt.result.comprovados.length,2);
  assert.equal(Object.hasOwn(receipt.result.comprovados[0],'empresa_id'),false);
  assert.equal(consumirLotesStagingRetomavel({...args,options}).reused,2);
});
test('500 and 1000 are bounded staging parameters, not operational authorization',t=>{
  for (const batchSize of [500,1000]) {
    const args=fixture(t), sizes=[];
    const rows=Array.from({length:1001},(_,i)=>({cod_cliente:String(i).padStart(5,'0')}));
    const result=processStagingBatches({...args,rows,batchSize,consume:batch=>{
      sizes.push(batch.length);return {comprovados:[],totais:{rows:batch.length}};
    }});
    assert.deepEqual(sizes,batchSize===500?[500,500,1]:[1000,1]);
    assert.equal(result.records,1001);assert.equal(result.businessWrites,0);
  }
});
test('failure before a receipt leaves previous batches resumable and no false completion',t=>{
  const args=fixture(t);let calls=0;
  const consume=rows=>{if(++calls===2)throw Error('mapper failure');return {comprovados:[],totais:{rows:rows.length}};};
  assert.throws(()=>processStagingBatches({...args,consume}),/mapper failure/);
  assert.equal(fs.existsSync(path.join(args.directory,'batch-00000001.private.json')),false);
  const result=processStagingBatches({...args,consume});
  assert.equal(result.reused,1);assert.equal(result.processed,1);
});
