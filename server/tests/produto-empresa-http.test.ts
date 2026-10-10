import assert from 'node:assert/strict';
import test from 'node:test';
import {createApp} from '../src/app.ts';
import {loadConfig} from '../src/config/env.ts';
import {createDbClient} from '../src/db/client.ts';
import {InMemoryTenantGuard} from '../src/db/tenantGuard.ts';
import {InMemoryRbacGuard} from '../src/db/rbacGuard.ts';
import {SEED_IDS as ID} from '../scripts/seedDevIds.ts';
test('ProdutoEmpresa HTTP: default OFF, corpo/contexto/RBAC explícitos e troca de empresa',async()=>{
  for(const enabled of [false,true]) {
    const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_PRODUTO_EMPRESA:enabled?'true':'false'});
    const tenant=new InMemoryTenantGuard(),rbac=new InMemoryRbacGuard();tenant.link(ID.empresaA,ID.groupA);tenant.link(ID.empresaA2,ID.groupA);
    rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{Cadastros:{produto:['criar','visualizar','vincular-empresa']}}});
    const built=createApp({config,db:createDbClient(config),useMemory:true,tenantGuard:tenant,rbacGuard:rbac});
    const master=await built.produtoService.create({groupId:ID.groupA,actorId:ID.runtimeActorA,requestId:'http-master'},{descricao:'Mestre sintético'});
    const server=await new Promise<import('node:http').Server>(resolve=>{const s=built.app.listen(0,'127.0.0.1',()=>resolve(s));});
    try {
      const addr=server.address() as import('node:net').AddressInfo,url=`http://127.0.0.1:${addr.port}/api/v1/produtos/${master.id}/empresa-operacao`;
      const headers={'content-type':'application/json','x-group-id':ID.groupA,'x-empresa-id':ID.empresaA,'x-actor-id':ID.runtimeActorA};
      const call=(body:unknown,h=headers)=>fetch(url,{method:'PUT',headers:h,body:JSON.stringify(body)});
      const payload={ativo:true,habilitado_operacao:true,expected_version:0};
      const detailUrl=`http://127.0.0.1:${addr.port}/api/v1/produtos/${master.id}?operacao=true`;
      const listUrl=`http://127.0.0.1:${addr.port}/api/v1/produtos?operacao=true`;
      if(enabled)assert.equal((await(await fetch(listUrl,{headers})).json()).meta.total,0);
      else assert.equal((await fetch(listUrl,{headers})).status,503);
      if(!enabled){assert.equal((await call(payload)).status,503);assert.equal((await fetch(detailUrl,{headers})).status,503);continue;}
      assert.equal((await fetch(detailUrl,{headers})).status,404);
      const response=await call(payload);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const a=(await response.json()).data;assert.equal(a.empresa_id,ID.empresaA);
      assert.equal((await fetch(url,{headers})).status,200);
      const detail=await fetch(detailUrl,{headers});assert.equal(detail.status,200);assert.equal(detail.headers.get('cache-control'),'no-store');
      assert.equal((await detail.json()).data.id,master.id);
      assert.equal((await fetch(detailUrl.replace('?operacao=true',''),{headers})).status,404);
      assert.equal((await fetch(detailUrl,{headers:{...headers,'x-empresa-id':ID.empresaA2}})).status,404);
      assert.equal((await fetch(detailUrl.replace('true','bogus'),{headers})).status,422);
      const listed=await fetch(listUrl,{headers});assert.equal(listed.status,200);assert.equal(listed.headers.get('cache-control'),'no-store');
      const page=await listed.json();assert.equal(page.meta.total,1);assert.equal(page.data[0].id,master.id);
      const ordinary=await fetch(listUrl.replace('?operacao=true',''),{headers});assert.equal((await ordinary.json()).meta.total,0);
      assert.equal((await(await fetch(`${listUrl}&offset=1&limit=1`,{headers})).json()).data.length,0);
      assert.equal((await fetch(`${listUrl}&ativo=false`,{headers})).status,422);
      assert.equal((await fetch(`${listUrl}&limit=oops`,{headers})).status,422);
      assert.equal((await fetch(listUrl.replace('true','bogus'),{headers})).status,422);
      assert.equal((await(await fetch(listUrl,{headers:{...headers,'x-empresa-id':ID.empresaA2}})).json()).meta.total,0);
      assert.equal((await fetch(url,{headers:{...headers,'x-empresa-id':ID.empresaA2}})).status,404);
      assert.equal((await call({...payload,empresa_id:ID.empresaA2})).status,422);
      assert.equal((await call({...payload,ativo:false})).status,422);
      const b=(await(await call(payload,{...headers,'x-empresa-id':ID.empresaA2})).json()).data;
      assert.equal(b.empresa_id,ID.empresaA2);assert.notEqual(a.id,b.id);
      rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{'*':['vincular-empresa']}});
      assert.equal((await call({...payload,ativo:false,habilitado_operacao:false,expected_version:1})).status,403);
      assert.equal((await fetch(listUrl,{headers})).status,403);
      assert.equal((await fetch(detailUrl,{headers})).status,403);
    }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
  }
});
