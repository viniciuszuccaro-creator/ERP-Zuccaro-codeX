import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {consolidation81Hunks,consolidation81Remainder} from './helpers/consolidation81Remainder.js';
import {createLocalEntityProxy,observeEntityApiAccess} from '../src/api/localEntityReadApi.js';

for(const file of Object.keys(consolidation81Hunks))test(file+': complete stage80 source outside exact lazy-instrumentation hunks',()=>{
 const source=fs.readFileSync(file,'utf8');consolidation81Remainder(file,source);
 assert.throws(()=>consolidation81Remainder(file,source+'\n// unrelated'));
 const [after]=consolidation81Hunks[file].hunks[0];
 assert.throws(()=>consolidation81Remainder(file,source.replace(/\r\n/g,'\n').replace(after,'')));
 assert.throws(()=>consolidation81Remainder(file,source.replace(/\r\n/g,'\n')+after));
});
test('observer metadata never becomes an entity and observers are isolated by root identity',()=>{
 const created=[],one=createLocalEntityProxy(name=>{created.push(name);return {};}),two=createLocalEntityProxy(()=>({}));
 let reads=0;const release=observeEntityApiAccess(one,()=>{reads++;});
 assert.deepEqual(Object.keys(one),[]);two.Cliente;assert.equal(reads,0);one.Cliente;
 assert.deepEqual(created,['Cliente']);assert.deepEqual(Object.keys(one),['Cliente']);assert.equal(reads,1);
 release();one.Pedido;assert.equal(reads,1);
});
