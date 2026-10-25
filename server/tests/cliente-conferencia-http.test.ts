import { AppError } from '../src/api/errors.js';
import { createHttpApiClient } from '../../src/api/httpApiClient.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ClienteService } from '../src/services/clienteService.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
const G='11111111-1111-4111-8111-111111111111', A='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const doc='11222333000181';
function fixture(){
 let allowed=true, reads=0, afterRead:()=>void=()=>{};
 const row={id:'synthetic',codigo:'001',ativo:false,group_id:G,empresa_id:null,nome:'PRIVATE',documento:doc};
 const repo={findByDocumento:async(group:string,d:string)=>{assert.equal(group,G);assert.equal(d,doc);reads++;afterRead();return row;},findByLegacyIdentity:async(group:string,s:string,c:string)=>{assert.equal(group,G);assert.equal(s,'synthetic');assert.equal(c,'001');reads++;afterRead();return row;}};
 const rbac={assertAllowed:async(ctx:any,m:string,s:string,a:string,o:any)=>{assert.equal(ctx.groupId,G);assert.equal(ctx.actorId,A);assert.equal(o.allowGlobalWildcard,false);if(!allowed)throw new AppError(403,'PERMISSION_DENIED','denied');}};
 const service=new ClienteService(repo as any,{append:async()=>{throw new Error('WRITE_FORBIDDEN');}} as any,{} as any,rbac as any);
 return {service,ctx:{groupId:G,empresaId:undefined,actorId:A},reads:()=>reads,revoke:()=>{allowed=false;},onRead:(f:()=>void)=>{afterRead=f;}};
}
const input={identidades:[{documento:doc,sourceSystem:'synthetic',codigoLegado:'001'}]};
test('conferencia rejects invalid/broad/oversized input before any read',async()=>{
 for(const body of [{},{identidades:[]},{identidades:[{}]},{identidades:[{documento:'garbage'}]},{identidades:[{sourceSystem:'synthetic'}]},{identidades:[{documento:doc,actorId:A}]},{identidades:Array(101).fill({documento:doc})}]){
  const f=fixture();await assert.rejects((f.service as any).conferirLegado(f.ctx,body));assert.equal(f.reads(),0);
 }
});
test('conferencia exact document+legacy, bounded minimal inactive response, no writes',async()=>{
 const f=fixture();const result=await(f.service as any).conferirLegado(f.ctx,input);
 assert.equal(f.reads(),2);assert.deepEqual(result,[{indice:0,documento:{id:'synthetic',codigo:'001',ativo:false},legado:{id:'synthetic',codigo:'001',ativo:false}}]);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(result).includes(doc),false);
});
test('conferencia denies permission/company, revocation and changed context',async()=>{
 const f=fixture();f.revoke();await assert.rejects((f.service as any).conferirLegado(f.ctx,input));assert.equal(f.reads(),0);
 const company=fixture();await assert.rejects((company.service as any).conferirLegado({...company.ctx,empresaId:A},input));assert.equal(company.reads(),0);
 const revoked=fixture();revoked.onRead(revoked.revoke);await assert.rejects((revoked.service as any).conferirLegado(revoked.ctx,input));assert.equal(revoked.reads(),1);
 const changed=fixture();changed.onRead(()=>{changed.ctx.groupId=A;});await assert.rejects((changed.service as any).conferirLegado(changed.ctx,input));assert.equal(changed.reads(),1);
});
test('HTTP requires verified Supabase/profile/Group; synthetic transport calls existing service',async()=>{
 const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ERP_AUTH_MODE:'supabase_user',SUPABASE_URL:'https://auth.synthetic.test',SUPABASE_ANON_KEY:'synthetic'});
 const db={query:async(sql:string,values:any[])=>{assert.ok(sql.includes('profiles'));return{rows:values[1]===G?[{id:A}]:[]};}};
 const f=fixture();const {app,clienteService}=createApp({config,db:db as any,useMemory:true,authFetchImpl:(async(_url:any,init:any)=>new Response(JSON.stringify({id:A}),{status:init.headers.Authorization==='Bearer synthetic-valid'?200:401})) as typeof fetch});
 (clienteService as any).conferirLegado=(ctx:any,body:any)=>(f.service as any).conferirLegado(ctx,body);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const call=(token:string,group=G)=>fetch('http://127.0.0.1:'+address.port+'/api/v1/clientes/conferencia-legado',{method:'POST',headers:{'Content-Type':'application/json','X-Group-Id':group,Authorization:'Bearer '+token},body:JSON.stringify(input)});
 try{assert.equal((await call('expired')).status,401);assert.equal((await call('synthetic-valid',A)).status,403);assert.equal(f.reads(),0);const ok=await call('synthetic-valid');assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'no-store');assert.equal(f.reads(),2);const api=createHttpApiClient({baseUrl:'http://127.0.0.1:'+address.port,getScope:()=>({groupId:G,actorId:A,token:'synthetic-valid'})});const data=await api.clientes.conferirLegado(input);assert.equal(data.length,1);assert.equal(f.reads(),4);f.revoke();assert.equal((await call('synthetic-valid')).status,403);assert.equal(f.reads(),4);}finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});

test('conferencia maximum 100 identities means exactly 200 point reads; 101 rejected',async()=>{
 const f=fixture();const result=await(f.service as any).conferirLegado(f.ctx,{identidades:Array.from({length:100},()=>input.identidades[0])});assert.equal(result.length,100);assert.equal(f.reads(),200);
});
