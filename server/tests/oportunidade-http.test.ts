import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';

test('CRM HTTP: desligado por padrão; CRUD/escopo/RBAC quando habilitado explicitamente',async()=>{
  for(const enabled of [false,true]) {
    const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:enabled?'true':'false'});
    const tenant=new InMemoryTenantGuard(),rbac=new InMemoryRbacGuard();tenant.link(ID.empresaA,ID.groupA);tenant.link(ID.empresaA2,ID.groupA);
    rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{CRM:{oportunidades:['visualizar','criar','editar','inativar','restaurar','aprovar']},Comercial:{pedido:['visualizar']}}});
    const built=createApp({config,db:createDbClient(config),useMemory:true,tenantGuard:tenant,rbacGuard:rbac});
    const server=await new Promise<import('node:http').Server>(resolve=>{const s=built.app.listen(0,'127.0.0.1',()=>resolve(s));});
    try {
      const address=server.address() as import('node:net').AddressInfo;
      const base=`http://127.0.0.1:${address.port}/api/v1/oportunidades`;
      const headers={'content-type':'application/json','x-group-id':ID.groupA,'x-empresa-id':ID.empresaA,'x-actor-id':ID.runtimeActorA};
      const call=(method:string,path='',body?:unknown,h=headers)=>fetch(base+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
      if(!enabled){assert.equal((await call('GET')).status,503);continue;}
      const response=await call('POST','',{titulo:'HTTP sintético',cliente_nome:'Contato',idempotency_key:'http-create-1'});
      assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'no-store');const row=(await response.json()).data;
      assert.equal((await call('GET',`/${row.id}`)).status,200);
      assert.equal((await call('GET',`/${row.id}`,undefined,{...headers,'x-empresa-id':ID.empresaA2})).status,404);
      assert.equal((await call('POST','',{titulo:'X',cliente_nome:'Y',idempotency_key:'spoof-test',actorId:ID.runtimeActorB})).status,422);
      assert.equal((await call('GET','?groupId='+ID.groupB)).status,422);
      const updated=await call('PATCH',`/${row.id}`,{expected_version:1,titulo:'Novo título'});assert.equal(updated.status,200);
      assert.equal((await call('PATCH',`/${row.id}`,{expected_version:1,titulo:'Concorrente'})).status,409);
      assert.equal((await call('DELETE',`/${row.id}`,{expected_version:2})).status,200);
      assert.equal((await call('POST',`/${row.id}/restaurar`,{expected_version:3})).status,200);
      assert.equal((await call('POST',`/${row.id}/vincular-pedido`,{expected_version:4,pedido_id:ID.obraA,legacy_pedido_id:'forged'})).status,422);
      assert.equal((await call('POST',`/${row.id}/vincular-pedido`,{expected_version:4,pedido_id:ID.obraA})).status,404);
      assert.equal((await call('POST',`/${row.id}/vincular-pedido`,{expected_version:4,pedido_id:ID.obraA},{...headers,'x-empresa-id':ID.empresaA2})).status,404);
      rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{}});
      assert.equal((await call('GET',`/${row.id}`)).status,403);
    }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
  }
});
