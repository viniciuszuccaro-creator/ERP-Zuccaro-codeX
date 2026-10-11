import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { HTTP_PILOT_ENTITIES } from '../src/api/runtimeBackend.js';

test('fachada CRM usa nove rotas existentes, contexto/Bearer/sinal e contratos de versão/replay',async()=>{
  const calls=[];const controller=new AbortController();
  const api=createHttpApiClient({baseUrl:'https://synthetic.test',getScope:()=>({token:'synthetic-token',groupId:'group',empresaId:'company'}),
    fetchImpl:async(url,init)=>{calls.push({url:new URL(url),init});return new Response(JSON.stringify({data:[],meta:{total:9,hasMore:true}}),{status:200});}});
  assert.equal(HTTP_PILOT_ENTITIES.includes('Oportunidade'),false);assert.equal(api.entities.Oportunidade,undefined);
  const signal=controller.signal, options={signal};const payload={expected_version:7,titulo:'Keep',idempotency_key:'explicit-key'};
  const page=await api.oportunidades.list({limit:2,offset:4,ativo:false,clienteEmpresaId:'link',signal});
  assert.equal(page.meta.total,9);assert.equal(page.meta.hasMore,true);
  await api.oportunidades.get('id/one',options);await api.oportunidades.getByLegacy('legacy/one',options);
  await api.oportunidades.create(payload,options);await api.oportunidades.update('id/one',payload,options);
  await api.oportunidades.deactivate('id/one',{expected_version:7},options);await api.oportunidades.restore('id/one',{expected_version:8},options);
  await api.oportunidades.linkOrcamento('id/one',{expected_version:9,orcamento_id:'document'},options);
  await api.oportunidades.linkPedido('id/one',{expected_version:10,pedido_id:'document'},options);
  assert.deepEqual(calls.map(c=>c.init.method),['GET','GET','GET','POST','PATCH','DELETE','POST','POST','POST']);
  assert.equal(calls[0].url.searchParams.get('ativo'),'false');assert.equal(calls[0].url.searchParams.get('offset'),'4');
  assert.equal(calls[1].url.pathname,'/api/v1/oportunidades/id%2Fone');
  assert.equal(calls[2].url.pathname,'/api/v1/oportunidades/legado/legacy%2Fone');
  assert.equal(calls[7].url.pathname.endsWith('/vincular-orcamento'),true);assert.equal(calls[8].url.pathname.endsWith('/vincular-pedido'),true);
  assert.deepEqual(JSON.parse(calls[3].init.body),payload);assert.deepEqual(JSON.parse(calls[4].init.body),payload);
  for(const call of calls){assert.equal(call.init.headers.Authorization,'Bearer synthetic-token');assert.equal(call.init.headers['X-Empresa-Id'],'company');assert.equal(call.init.signal,signal);assert.equal(call.url.search.includes('synthetic-token'),false);}
});

test('fachada CRM propaga 403/409/503 sem retry ou fallback, e troca empresa na chamada seguinte',async()=>{
  for(const status of [403,409,503]){
    let calls=0;let empresaId='company-a';const scopes=[];
    const api=createHttpApiClient({baseUrl:'https://synthetic.test',getScope:()=>({token:'synthetic-token',groupId:'group',empresaId}),
      fetchImpl:async(_url,init)=>{calls++;scopes.push(init.headers['X-Empresa-Id']);return new Response(JSON.stringify({error:{code:'SYNTHETIC_DENIED'}}),{status});}});
    await assert.rejects(api.oportunidades.update('id',{expected_version:1,titulo:'Keep'}),error=>error.status===status);
    assert.equal(calls,1);empresaId='company-b';await assert.rejects(api.oportunidades.get('id'),error=>error.status===status);
    assert.deepEqual(scopes,['company-a','company-b']);assert.equal(calls,2);
  }
});

test('conversão CRM envia comando único ao backend, orçamento original e versão intactos',async()=>{
  let calls=0;const payload={expected_version:2,orcamento_id:'original-quote',pedido:{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z'}};
  const api=createHttpApiClient({baseUrl:'https://synthetic.test',getScope:()=>({token:'synthetic-token',groupId:'group',empresaId:'company'}),
    fetchImpl:async(url,init)=>{calls++;assert.equal(new URL(url).pathname,'/api/v1/oportunidades/id%2Fone/converter-orcamento-pedido');assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),payload);return new Response(JSON.stringify({data:{pedido:{id:'single'},replayed:true}}),{status:200});}});
  assert.equal((await api.oportunidades.convertOrcamentoToPedido('id/one',payload)).pedido.id,'single');assert.equal(calls,1);
});
