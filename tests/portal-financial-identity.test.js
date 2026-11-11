import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../src/components/lib/portalClientePolicy.js';
import {applyLocalEntityUpdateTransitions} from '../src/api/localEntityUpdateTransitions.js';
import {consolidation83Hunks,consolidation83Remainder} from './helpers/consolidation83Remainder.js';
const file='src/components/lib/portalClientePolicy.js',clientId='synthetic-client',title={id:'synthetic-title',cliente_id:clientId,status:'Pendente',valor:1},note={id:'synthetic-note',cliente_id:clientId};
test('entire stage82 policy is retained outside exact identity hunks',()=>{
 const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');consolidation83Remainder(file,source);assert.throws(()=>consolidation83Remainder(file,source+'\n// unrelated'));
 for(const [after] of consolidation83Hunks[file].hunks){assert.throws(()=>consolidation83Remainder(file,source.replace(after,'')));assert.throws(()=>consolidation83Remainder(file,source+after));}
});
test('counterproof: old portal accepted erased ownership, coerced arrays and orphan title reads',()=>{
 const exports={};new Function('exports',ts.transpileModule(consolidation83Remainder(file,fs.readFileSync(file,'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(exports);
 assert.equal(exports.assertPortalTituloWrite({before:title,patch:{cliente_id:null},portalClienteId:clientId}),true);
 assert.equal(exports.assertPortalTituloDoCliente({titulo:{...title,cliente_id:[clientId]},clienteId:clientId}),true);
 assert.equal(exports.filtrarTitulosPortal([{id:'synthetic-orphan',status:'Pendente'}],undefined).length,1);
 assert.throws(()=>policy.assertPortalTituloWrite({before:title,patch:{cliente_id:null},portalClienteId:clientId}));
 assert.throws(()=>policy.assertPortalTituloDoCliente({titulo:{...title,cliente_id:[clientId]},clienteId:clientId}));
 assert.deepEqual(policy.filtrarTitulosPortal([{id:'synthetic-orphan',status:'Pendente'}],undefined),[]);
});
test('explicit empty or opaque ownership patch is denied; omission and same canonical ID remain valid',()=>{
 for(const value of [null,undefined,'',' ',false,0,[],[clientId],{},'synthetic-other'])assert.throws(()=>policy.assertPortalTituloWrite({before:title,patch:{cliente_id:value},portalClienteId:clientId}));
 for(const patch of [{},{cliente_id:clientId},{status:'Pendente'}])assert.equal(policy.assertPortalTituloWrite({before:title,patch,portalClienteId:clientId}),true);
 assert.equal(policy.assertPortalTituloWrite({before:{id:12,cliente_id:23},patch:{cliente_id:23},portalClienteId:23}),true);
});
test('opaque identities cannot coerce into ownership, title identity, scope or fiscal alias',()=>{
 let coerced=false;const opaque={toString(){coerced=true;throw new Error('coercion forbidden');}};
 for(const value of [[clientId],opaque,{},true,NaN,Infinity]){
  assert.throws(()=>policy.assertPortalTituloDoCliente({titulo:title,clienteId:value}));
  assert.throws(()=>policy.assertPortalTituloDoCliente({titulo:{...title,id:value},clienteId:clientId}));
  assert.throws(()=>policy.assertPortalTituloDoCliente({titulo:{...title,cliente_id:value},clienteId:clientId}));
  assert.throws(()=>policy.assertPortalNfeDoCliente({nfe:{...note,id:value},clienteId:clientId}));
  assert.throws(()=>policy.buildPortalDocumentoLinks({nfe:{...note,cliente_id:value},clienteId:clientId}));
  assert.deepEqual(policy.filtrarTitulosPortal([title],value),[]);
 }
 assert.equal(coerced,false);
});
test('scoped list excludes malformed and foreign owners while internal absent scope remains unchanged',()=>{
 const rows=[title,{...title,id:'other',cliente_id:'synthetic-other'},{...title,id:'malformed',cliente_id:[clientId]}];
 assert.deepEqual(policy.applyPortalReadScope({entityName:'ContaReceber',records:rows,portalClienteId:clientId}),[title]);
 assert.equal(policy.applyPortalReadScope({entityName:'ContaReceber',records:rows,portalClienteId:null}),rows);
 assert.throws(()=>policy.applyPortalReadScope({entityName:'ContaReceber',records:rows,portalClienteId:[clientId]}));
 assert.deepEqual(policy.filtrarTitulosPortal(rows,clientId),[title]);
 assert.equal(policy.calcularSaldoPortal([{status:'Pendente',valor:99}],undefined).aberto,0);
});
test('fiscal aliases preserve existing precedence and real artifacts; malformed primary cannot fall through',()=>{
 for(const field of ['cliente_id','cliente_fornecedor_id','destinatario_id']){
  const row={id:note.id,[field]:clientId,xml_url:'https://synthetic.invalid/note.xml'};assert.equal(policy.clienteIdFromNfe(row),clientId);assert.equal(policy.buildPortalDocumentoLinks({nfe:row,clienteId:clientId}).xml,row.xml_url);
 }
 assert.throws(()=>policy.clienteIdFromNfe({...note,cliente_id:[clientId],destinatario_id:clientId}));
 assert.equal(policy.clienteIdFromNfe({cliente_id:null,cliente_fornecedor_id:23}),'23');
 assert.throws(()=>policy.assertPortalNfeDoCliente({nfe:note,clienteId:'synthetic-other'}));
});
test('actual financial transition blocks ownership erasure before domain decision or persistence',()=>{
 let decisions=0;const deps={isTituloFinanceiro:()=>true,getStore:()=>[{id:clientId,portal_usuario_id:'synthetic-user'}],readUser:()=>({id:'synthetic-user'}),resolvePortalClienteId:policy.resolvePortalClienteId,assertPortalTituloWrite:policy.assertPortalTituloWrite,assertTituloOnUpdate:()=>{decisions++;throw Error('unexpected domain decision');}};
 for(const value of [null,undefined,'',[],[clientId]])assert.throws(()=>applyLocalEntityUpdateTransitions({db:{},entityName:'ContaReceber',id:title.id,before:title,payload:{cliente_id:value},initialRecord:title,dependencies:deps}),/nao pode ser alterado/);
 assert.equal(decisions,0);
});
