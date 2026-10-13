import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as submission from '../src/components/crm/crmFormSubmission.js';
import * as pagination from '../src/components/comercial/centralCliente360Pagination.js';
import * as legacy from '../src/components/comercial/centralCliente360CrmLegado.js';
import * as centralMoney from '../src/components/comercial/centralCliente360Money.js';
import * as http from '../src/api/httpApiClient.js';
const require=createRequire(import.meta.url);
const groupId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',empresaId='11111111-1111-4111-8111-111111111111',actorId='33333333-3333-4333-8333-333333333333';
const row={id:'77777777-7777-4777-8777-777777777777',codigo:'000001',titulo:'Synthetic opportunity',status:'Ganho',convertido_em:'orcamento',version:2,orcamento_id:'66666666-6666-4666-8666-666666666666'};
const orderId='88888888-8888-4888-8888-888888888888';
const result=()=>({pedido:{id:orderId,numero:'00000001',orcamento_id:row.orcamento_id,group_id:groupId,empresa_id:empresaId},
  oportunidade:{...row,pedido_id:orderId,convertido_em:'pedido',group_id:groupId,empresa_id:empresaId},replayed:false});

test('comando preserva Orçamento/versão, não aceita legado e exige local na Entrega',()=>{
  const input={tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T10:00',orcamento_id:'forged',expected_version:99,preco:999};
  const command=submission.buildCrmQuoteOrderCommand(row,input);
  assert.equal(command.orcamento_id,row.orcamento_id);assert.equal(command.expected_version,2);
  assert.deepEqual(Object.keys(command.pedido).sort(),['data_entrega_solicitada','tipo_operacao']);
  assert.throws(()=>submission.buildCrmQuoteOrderCommand({...row,orcamento_id:'legacy-text'},input),/canônica/);
  assert.throws(()=>submission.buildCrmQuoteOrderCommand(row,{...input,data_entrega_solicitada:''}),/data e hora/);
  assert.throws(()=>submission.buildCrmQuoteOrderCommand(row,{...input,tipo_operacao:'ENTREGA'}),/local/);
  const localId='99999999-9999-4999-8999-999999999999';
  assert.equal(submission.buildCrmQuoteOrderCommand(row,{...input,tipo_operacao:'ENTREGA',cliente_local_id:localId}).pedido.cliente_local_id,localId);
});

test('confirmação incompleta/divergente ou outro tenant nunca vira sucesso',()=>{
  assert.equal(submission.validateCrmQuoteOrderResult(row,result(),{groupId,empresaId}).pedido.id,orderId);
  for(const invalid of [{},{...result(),replayed:undefined},{...result(),pedido:{...result().pedido,orcamento_id:'other'}},
    {...result(),oportunidade:{...result().oportunidade,pedido_id:'other'}}])
    assert.throws(()=>submission.validateCrmQuoteOrderResult(row,invalid,{groupId,empresaId}),/não confirmada/);
  assert.throws(()=>submission.validateCrmQuoteOrderResult(row,result(),{groupId:'other',empresaId}),/não confirmada/);
});

test('Grupo mantém empresa de destino explícita; filial e sessão trocada não herdam esse contexto',()=>{
  const target={groupId,empresaId,actorId,token:'synthetic-token'};
  const groupSession={...target,empresaId:null,scopeType:'grupo',profileEmpresaId:null};
  assert.equal(submission.isCrmConversionScopeCurrent(target,{groupId,empresaId:null},groupSession),true);
  assert.equal(submission.isCrmConversionScopeCurrent(target,{groupId,empresaId:null},{...groupSession,profileEmpresaId:empresaId}),false);
  assert.equal(submission.isCrmConversionScopeCurrent(target,{groupId,empresaId:null},{...groupSession,token:'other'}),false);
  assert.equal(submission.isCrmConversionScopeCurrent({...target,empresaId:null},{groupId,empresaId:null},groupSession),false);
});

async function compiled(file,resolve) {
  const source=await readFile(new URL(`../src/components/${file}`,import.meta.url),'utf8');
  const module={exports:{}};runInNewContext(transformSync(source,{loader:'jsx',format:'cjs'}).code,
    {module,exports:module.exports,require:path=>path==='react'?require(path):resolve(path)});
  return module.exports.default;
}
const contexts=()=>({grupoAtual:{id:groupId},empresaAtual:{id:empresaId}});

test('modal real aguarda um comando canônico e bloqueia repetição em contexto alterado',async()=>{
  let current=true,calls=0,finish;const buttons=[];
  const ui=new Proxy({}, {get:(_target,key)=>props=>{if(key==='Button')buttons.push(props);return React.createElement('div',null,props.children);}});
  const Modal=await compiled('crm/ConverterOportunidade.jsx',path=>{
    if(path==='./crmFormSubmission')return submission;
    if(path.includes('useContextoVisual'))return {__esModule:true,default:contexts};
    if(path.includes('useCadastroFormScopeGuard'))return {__esModule:true,default:()=>({isCurrent:()=>current,assertCurrent:()=>{if(!current)throw new Error('changed context');}})};
    return ui;
  });
  const props={oportunidade:row,canonical:true,windowMode:true,initialConversion:{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T10:00'},
    onConverter:async(...args)=>{calls++;assert.equal(args.length,1);assert.equal(args[0].orcamento_id,row.orcamento_id);return new Promise(resolve=>{finish=resolve;});}};
  renderToString(React.createElement(Modal,props));const convert=buttons.find(button=>Array.isArray(button.children)&&button.children.includes('Converter Agora'));
  assert.ok(convert);const first=convert.onClick(),second=convert.onClick();await Promise.resolve();assert.equal(calls,1);
  finish(result());await Promise.all([first,second]);current=false;await convert.onClick();assert.equal(calls,1);
  assert.doesNotMatch(renderToString(React.createElement(Modal,props)),/Synthetic opportunity/);
});

async function panelFixture({deny=false,late=false,mismatch=false,groupView=false}={}) {
  const buttons=[],windows=[],invalidated=[];let calls=0,release;
  const active={groupId,empresaId,actorId,token:'synthetic-token'};if(mismatch)active.empresaId='different';
  if(groupView){active.empresaId=null;active.scopeType='grupo';active.profileEmpresaId=null;}
  const deferred=new Promise(resolve=>{release=resolve;});
  const block=data=>({status:'ok',data,meta:{hasMore:false,total:data.length}});
  const data={identity:{codigo:'000001',nome:'Synthetic client'},blocks:{empresas:block([]),locais:{status:'forbidden',data:[{id:'must-not-forward',ativo:true}]},obras:block([]),orcamentos:block([{id:row.orcamento_id,numero:'00000001'}]),pedidos:block([]),crm:block([row])},meta:{}};
  const ui=new Proxy({}, {get:(_target,key)=>props=>{if(key==='Button')buttons.push(props);return React.createElement('div',null,props.children);}});
  const api={clientes:{},entityGuard:async()=>{if(late)await deferred;return {data:{allowed:!deny}};},oportunidades:{convertOrcamentoToPedido:async(id,command)=>{calls++;assert.equal(id,row.id);assert.equal(command.orcamento_id,row.orcamento_id);return result();}}};
  const Panel=await compiled('comercial/CentralCliente360Panel.jsx',path=>{
    if(path==='@tanstack/react-query')return {useQuery:()=>({data:{data},isLoading:false,isFetching:false}),useQueryClient:()=>({invalidateQueries:async value=>{invalidated.push(value);}})};
    if(path.includes('httpApiClient'))return {...http,createHttpApiClient:()=>api};
    if(path.includes('erpHttpSession'))return {readErpHttpSession:()=>active};
    if(path.includes('base44Client'))return {isHttpCliente360Enabled:true};
    if(path.includes('crmFormSubmission'))return submission;
    if(path.includes('centralCliente360Pagination'))return pagination;
    if(path.includes('centralCliente360CrmLegado'))return legacy;
    if(path.includes('centralCliente360Money'))return centralMoney;
    if(path.includes('useContextoVisual'))return {__esModule:true,default:()=>({grupoAtual:{id:groupId},empresaAtual:groupView?null:{id:empresaId}})};
    if(path.includes('usePermissions'))return {__esModule:true,default:()=>({hasPermission:()=>true,isLoading:false})};
    if(path.includes('useWindow'))return {useWindow:()=>({openWindow:(_component,props)=>{windows.push(props);return 'window';},closeWindow:()=>{}})};
    if(path.includes('ConverterOportunidade'))return {__esModule:true,default:()=>null};
    return ui;
  });
  const html=renderToString(React.createElement(Panel,{clienteId:'55555555-5555-4555-8555-555555555555',groupId,empresaId,actorId,token:'synthetic-token'}));
  return {html,active,release,windows,invalidated,calls:()=>calls,button:buttons.find(button=>button['data-action']==='central360-crm-converter-pedido')};
}

test('Central real abre modal canônico e envia uma escrita, sem dados de bloco proibido',async()=>{
  const f=await panelFixture();assert.ok(f.button);await f.button.onClick();assert.equal(f.windows.length,1);
  assert.equal(f.windows[0].canonical,true);assert.equal(Array.isArray(f.windows[0].locais),true);assert.equal(f.windows[0].locais.length,0);
  const command=submission.buildCrmQuoteOrderCommand(row,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T10:00'});
  await f.windows[0].onConverter(command);assert.equal(f.calls(),1);assert.equal(f.invalidated.length,1);
  f.active.actorId='different';await assert.rejects(f.windows[0].onConverter(command),/Contexto alterado/);assert.equal(f.calls(),1);
});

test('Central real não abre após negação ou resposta tardia em sessão trocada',async()=>{
  const denied=await panelFixture({deny:true});await denied.button.onClick();assert.equal(denied.windows.length,0);assert.equal(denied.calls(),0);
  const delayed=await panelFixture({late:true});const opening=delayed.button.onClick();delayed.active.token='different';delayed.release();await opening;
  assert.equal(delayed.windows.length,0);assert.equal(delayed.calls(),0);
  const stale=await panelFixture({mismatch:true});assert.equal(stale.button,undefined);assert.doesNotMatch(stale.html,/Synthetic client|Synthetic opportunity/);
});

test('Central em Grupo envia empresa de destino comprovada, sem trocar para outra fonte',async()=>{
  const f=await panelFixture({groupView:true});assert.ok(f.button);await f.button.onClick();assert.equal(f.windows.length,1);
  const command=submission.buildCrmQuoteOrderCommand(row,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T10:00'});
  await f.windows[0].onConverter(command);assert.equal(f.calls(),1);
  assert.equal(f.invalidated[0].queryKey[2],empresaId);
});
