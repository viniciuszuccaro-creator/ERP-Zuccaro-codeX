import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import * as policy from '../src/components/lib/marketplacePedidoPolicy.js';

const file='src/components/integracoes/SincronizacaoMarketplacesAtiva.jsx';
const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const declaration=source.match(/\/\*\*\n \* Caller contract only;[\s\S]*? \*\/\n\n/)?.[0];
const annotation='/** @type {MarketplaceImportCommand} */ ';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,removeComments:true};
const emit=text=>ts.transpileModule(text,{compilerOptions:options}).outputText;

test('complete prior marketplace source and emitted runtime retained, not just the mutation body',()=>{
 assert.ok(declaration);assert.equal(source.split(declaration).length,2);assert.equal(source.split(annotation).length,2);
 const previous=source.replace(declaration,'').replace(annotation,'');
 assert.equal(digest(previous),'fab3c7bcfdeeb24902cf8a7d9c5428e36d48a9c3886037fa0431d54f8bf2b2ab');
 assert.equal(digest(emit(source)),'fd8c7fa02b6f1679be471f1fb37e5207316cee78cd0c7edfceb4bc327247584c');
 assert.equal(emit(source),emit(previous));
});

test('actual TypeScript caller contract rejects wrong identity types and does not authenticate opaque metadata',()=>{
 const producer=path.resolve('src/components/integracoes/synthetic-marketplace-contract.js');
 const consumer=path.resolve('src/components/integracoes/synthetic-marketplace-consumer.ts');
 const fixture=`import {accept} from './synthetic-marketplace-contract.js';
const command=accept({id:'synthetic',group_id:'synthetic-g',empresa_id:'synthetic-e',id_externo:'synthetic-provider',status_importacao:'A Validar',cliente_nome:'opaque'});
const id:string=command.id;const company:string=command.empresa_id;
// Negative fixtures: no suppression directives.
accept({id:123,group_id:'synthetic-g',empresa_id:'synthetic-e',id_externo:'synthetic-provider',status_importacao:'A Validar'});
const notAuthenticated:string=command.cliente_nome;
accept({id:'synthetic',empresa_id:'synthetic-e',id_externo:'synthetic-provider',status_importacao:'A Validar'});`;
 const virtual=new Map([[producer,declaration+'export const accept=(/** @type {MarketplaceImportCommand} */ command)=>command;'],[consumer,fixture]]);
 const config={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(config),read=host.readFile,exists=host.fileExists;
 host.readFile=file=>virtual.get(path.resolve(file))??read(file);host.fileExists=file=>virtual.has(path.resolve(file))||exists(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([consumer],config,host));
 assert.ok(errors.every(error=>error.file&&path.resolve(error.file.fileName)===consumer));
 assert.deepEqual(errors.map(error=>error.code),[2322,2322,2345]);
 const negative=fixture.split('\n').findIndex(line=>line.startsWith('// Negative'));
 assert.ok(errors.every(error=>error.file.getLineAndCharacterOfPosition(error.start).line>negative));
});

function harness({context=true,permission=true,query=async()=>[],auditFailure=false}={}){
 const mutations=[],writes=[],reads=[];
 const ui=new Proxy({}, {get:(_,name)=>name==='__esModule'?true:()=>null});
 const dependencies={
  react:{default:React,useState:initial=>[initial,()=>{}]},'@tanstack/react-query':{useMutation:options=>{mutations.push(options);return {};},useQuery:options=>({data:options.queryKey[0]==='produtos-sku-marketplace'?[{id:'synthetic-product',codigo:'synthetic-sku'}]:[]}),useQueryClient:()=>({invalidateQueries(){}})},
  'lucide-react':ui,'@/components/ui/card':ui,'@/components/ui/button':ui,
  '@/components/ui/use-toast':{useToast:()=>({toast(){}})},
  '@/components/lib/UserContext':{useUser:()=>({user:{id:'synthetic-actor'}})},
  '@/components/lib/usePermissions':{default:()=>({isAdmin:()=>false,hasPermission:()=>permission})},
  '@/components/lib/useContextoVisual':{useContextoVisual:()=>({
   empresaAtual:context?{id:'synthetic-company',group_id:'synthetic-group'}:null,grupoAtual:null,
   filterInContext:async(...args)=>{reads.push(args);return query(...args);},
   createInContext:async(entity,data)=>{writes.push({entity,data});if(auditFailure&&entity==='AuditLog')throw Error('synthetic audit failure');assert.equal(entity,'AuditLog','no operational record creation in this fixture');return {id:'synthetic-audit'};},
   updateInContext:async(entity,id,data)=>{writes.push({entity,id,data});return {id,...data};},
  })},
  './marketplaceSimulationData':{createMarketplaceSimulationOrders:()=>assert.fail('no synchronization execution')},
  './MarketplacePendingOrders':()=>null,'@/components/lib/marketplacePedidoPolicy':policy,
 };
 const exports={};new Function('require','exports',emit(source))(name=>{assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name];},exports);
 exports.default();assert.equal(mutations.length,1);
 return {run:mutations[0].mutationFn,writes,reads};
}
const command=overrides=>({id:'synthetic-external',group_id:'synthetic-group',empresa_id:'synthetic-company',status_importacao:'A Validar',id_externo:'synthetic-provider-id',cliente_cpf_cnpj:'00000000000',itens:[{sku_externo:'synthetic-unresolved',quantidade:1,preco_unitario:1}],...overrides});
const noBusinessWrites=h=>assert.ok(h.writes.every(write=>write.entity==='AuditLog'));

for(const [label,options,pattern] of [['context',{context:false},/grupo e empresa/],['permission',{permission:false},/perfil/]])test(`actual command retains ${label} block before business queries/writes`,async()=>{
 const h=harness(options);await assert.rejects(()=>h.run(command()),pattern);assert.equal(h.reads.length,0);assert.equal(h.writes.length,1);noBusinessWrites(h);
});
test('simulation marker cannot become an eligible import through the caller type',async()=>{
 for(const marker of [{simulacao:true},{origem_simulacao:'marketplace_local'}]){
  const h=harness();await assert.rejects(()=>h.run(command(marker)),/simulado/);assert.deepEqual(h.writes,[]);assert.deepEqual(h.reads,[]);
 }
});
test('literal foreign company/group and invalid state retain rejection and audit',async()=>{
 for(const patch of [{group_id:'synthetic-other'},{empresa_id:'synthetic-other'},{status_importacao:'Cancelado'}]){
  const h=harness();await assert.rejects(()=>h.run(command(patch)),/invalido/);assert.equal(h.reads.length,0);assert.equal(h.writes.length,1);noBusinessWrites(h);
 }
});
test('missing document and empty items remain blocked before reads or business writes',async()=>{
 for(const patch of [{cliente_cpf_cnpj:''},{itens:[]}]){
  const h=harness();await assert.rejects(()=>h.run(command(patch)),/obrigatorios/);assert.equal(h.reads.length,0);noBusinessWrites(h);
 }
});
test('unresolved SKU remains blocked; the typed command does not resolve product identity',async()=>{
 const h=harness();await assert.rejects(()=>h.run(command()),/SKU nao resolvido/);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});
test('audit failure still propagates instead of authorizing a blocked command',async()=>{
 const h=harness({context:false,auditFailure:true});
 const warn=console.error;console.error=()=>{};
 try{await assert.rejects(()=>h.run(command()),/synthetic audit failure/);}finally{console.error=warn;}
 assert.equal(h.reads.length,0);noBusinessWrites(h);
});
test('duplicate lookup failure propagates without creating a customer or order',async()=>{
 const h=harness({query:async()=>{throw Error('synthetic query failure');}});
 await assert.rejects(()=>h.run(command({itens:[{sku_externo:'synthetic-sku',quantidade:1,preco_unitario:1}]})),/synthetic query failure/);
 assert.equal(h.reads.length,1);assert.deepEqual(h.writes,[]);
});
test('existing external identity follows the same reuse branch, not a new customer or order',async()=>{
 const existing={id:'synthetic-order',cliente_id:'synthetic-customer'};
 const h=harness({query:async(entity,filter)=>{assert.equal(entity,'Pedido');assert.deepEqual(filter,{origem_externa_id:'synthetic-provider-id'});return [existing];}});
 const result=await h.run(command({itens:[{sku_externo:'synthetic-sku',quantidade:1,preco_unitario:1}]}));
 assert.equal(result.pedidoERP,existing);assert.equal(result.clienteId,existing.cliente_id);
 assert.deepEqual(h.writes.map(write=>write.entity),['PedidoExterno','AuditLog']);
 assert.equal(h.writes[0].data.group_id,'synthetic-group');assert.equal(h.writes[0].data.empresa_id,'synthetic-company');
 assert.equal(h.writes[0].data.pedido_erp_id,existing.id);
});
