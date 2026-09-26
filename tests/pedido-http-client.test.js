import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
function response(body,status=200){return Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','x-request-id':'pedido-test'}}));}
test('cliente HTTP Pedido envia contexto e cobre fluxo canonico',async()=>{const calls=[];const api=createHttpApiClient({baseUrl:'https://erp.invalid',getScope:()=>({groupId:'g',empresaId:'e',actorId:'a'}),fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return response({data:{id:'p'},meta:{total:1}});}}).pedidos;await api.list({search:'0001',status:'EM_ABERTO',tipoOperacao:'ENTREGA'});await api.create({itens:[]});await api.update('p',{itens:[]});await api.transition('p','EM_PRODUCAO');await api.history('p');await api.cancel('p','Motivo');await api.convertOrcamento('o',{tipo_operacao:'RETIRADA'});assert.equal(calls.length,7);assert.ok(calls.every(call=>call.init.headers['X-Group-Id']==='g'&&call.init.headers['X-Empresa-Id']==='e'));assert.match(calls[0].url,/search=0001/);assert.equal(calls[3].init.method,'POST');assert.match(calls[6].url,/orcamentos\/o\/converter-pedido/);});
test('cliente HTTP Pedido cobre listar registrar e inativar anexos',async()=>{
  const calls=[];
  const api=createHttpApiClient({baseUrl:'https://erp.invalid',getScope:()=>({groupId:'g',empresaId:'e',actorId:'a'}),fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return response({data:{id:'a1'}});}}).pedidos;
  await api.listAnexos('p1');
  await api.registerAnexo('p1',{storage_key:'groups/g/companies/e/pedidos/p1/documents/x.pdf',nome_arquivo:'x.pdf',mime_type:'application/pdf',tamanho_bytes:10,sha256:'a'.repeat(64)});
  await api.deactivateAnexo('p1','a1');
  assert.equal(calls.length,3);
  assert.match(calls[0].url,/\/api\/v1\/pedidos\/p1\/anexos$/);
  assert.equal(calls[1].init.method,'POST');
  assert.match(calls[1].url,/\/api\/v1\/pedidos\/p1\/anexos$/);
  assert.equal(calls[2].init.method,'POST');
  assert.match(calls[2].url,/\/api\/v1\/pedidos\/p1\/anexos\/a1\/inativar$/);
});
