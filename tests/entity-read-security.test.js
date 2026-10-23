import assert from 'node:assert/strict';
import test from 'node:test';

import { fixture } from './helpers/entityReadFixture.js';
const business = { Cadastros: { Pessoas: ['visualizar'] }, Comercial: { pedido: ['visualizar'], Representantes: ['visualizar','exportar'] },
  Relatorios: { Personalizado: ['visualizar','exportar','dados-pessoais'] } };
const context = { groupId:'group-a', empresaId:'company-a', scopeType:'empresa' };

for (const name of ['entityListSorted','getEntityRecord','countEntities']) {
  test(`348 ${name}: missing permission denies before business service-role reads`, async () => {
    const f = fixture(); const result = await f.handler(name)({ entityName:'Representante', id:'rep-a', filter:{} });
    assert.equal(result.status,403); assert.equal(f.state.reads.length,0); assert.equal(f.state.audits.length,0);
  });
  test(`348 ${name}: forged company is denied before business reads`, async () => {
    const f = fixture(business); const result = await f.handler(name)({ entityName:'Representante', id:'rep-a', filter:{ empresa_id:'company-b' } });
    assert.equal(result.status,403); assert.equal(f.state.reads.length,0);
  });
}

test('348 bulk preauthorizes every query before returning or reading any business data', async () => {
  const f = fixture(business);
  const result = await f.handler('entityListSorted')({ queries:[{ entityName:'Representante', filter:{ empresa_id:'company-a' } },{ entityName:'ContaPagar', filter:{ empresa_id:'company-a' } }] });
  assert.equal(result.status,403); assert.equal(f.state.reads.length,0);
});

test('348 legitimate catalog retains array and by-ID contracts; sensitive columns require their own grant', async () => {
  const f = fixture(business);
  const list = await f.handler('entityListSorted')({ entityName:'Representante', filter:{ empresa_id:'company-a' } });
  assert.equal(list.status,200); assert.equal(list.body.length,1); assert.equal(list.body[0].id,'rep-a');
  assert.equal(list.body[0].percentual_comissao,undefined); assert.equal(list.body[0].nome,undefined);
  const one = await f.handler('getEntityRecord')({ entityName:'Representante', id:'rep-a', context });
  assert.equal(one.body.record.id,'rep-a');
});

test('348 report pages have server coverage; denied selected credit field does not query', async () => {
  const f = fixture(business), call = f.handler('entityListSorted');
  f.state.rows.Cliente.push({ id:'client-c', nome:'Sintético C', group_id:'group-a', empresa_id:'company-a' });
  const result = await call({ entityName:'Cliente', context, limit:1, report:{ kind:'personalizado', fields:['nome'] } });
  assert.equal(result.status,200); assert.equal(result.body.contract,'secure-report-v1'); assert.equal(result.body.data.length,1);
  assert.equal(result.body.meta.hasMore,true); assert.equal(result.body.meta.coverage,'page'); assert.equal(result.body.meta.total,null);
  assert.ok(result.body.data.every(row => row.empresa_id === 'company-a'));
  f.state.reads.length = 0;
  const denied = await call({ entityName:'Cliente', context, report:{ kind:'personalizado', fields:['limite_credito'] } });
  assert.equal(denied.status,403); assert.equal(f.state.reads.length,0);
});

test('348 server export neutralizes formulas and fails closed on audit error without disclosing data in audit', async () => {
  const f = fixture(business), call = f.handler('entityListSorted');
  const payload = { entityName:'Cliente', context, report:{ kind:'personalizado', action:'exportar', fields:['nome'] }, limit:10 };
  const result = await call(payload);
  assert.equal(result.status,200); assert.ok(result.body.csv.includes("'=SUM(1)")); assert.equal(f.state.audits.length,1);
  assert.ok(!JSON.stringify(f.state.audits).includes('=SUM(1)'));
  f.state.auditFailure = true;
  const failed = await call(payload); assert.equal(failed.status,503); assert.equal(failed.body.csv,undefined);
});

test('348 representatives aggregate is complete or explicitly blocked; never treats first500 as a total', async () => {
  const f = fixture(business), call = f.handler('entityListSorted');
  const request = { entityName:'Representante', context, report:{ kind:'representantes', periodo:'todos' } };
  const result = await call(request);
  assert.equal(result.status,200); assert.equal(result.body.meta.coverage,'complete');
  assert.equal(result.body.data[0].vendas,100); assert.equal(result.body.data[0].comissao,undefined);
  f.state.rows.Pedido = Array.from({ length:500 }, (_,i) => ({ ...f.state.rows.Pedido[0], id:`order-${i}` }));
  const blocked = await call(request);
  assert.equal(blocked.status,409); assert.equal(blocked.body.data,undefined);
});

test('348 count bulk also preauthorizes every member; legitimate exact count preserves contract',async()=>{
  const f=fixture(business),call=f.handler('countEntities');
  const denied=await call({entities:[{entityName:'Cliente',context},{entityName:'ContaPagar',context}]});
  assert.equal(denied.status,403);assert.equal(f.state.reads.length,0);
  const result=await call({entityName:'Cliente',context});assert.equal(result.status,200);assert.equal(result.body.count,1);
});
test('348 group consolidation respects company links and never includes unowned legacy nulls',async()=>{
  const f=fixture(business),call=f.handler('entityListSorted');
  f.state.rows.Cliente.push({id:'legacy',group_id:'group-a',empresa_id:null},{id:'shared',group_id:'group-a',empresa_id:null,compartilhado_grupo:true});
  const result=await call({entityName:'Cliente',context:{groupId:'group-a',scopeType:'grupo'}});
  assert.equal(result.status,200);assert.deepEqual(result.body.map(row=>row.id),['client-a','shared']);
});
test('348 direct ID, group forgery, invalid operators and pagination never expose foreign rows',async()=>{
  const f=fixture(business);
  const record=await f.handler('getEntityRecord')({entityName:'Cliente',id:'client-b',context});assert.equal(record.status,404);
  for (const payload of [
    {context:{groupId:'group-b',empresaId:'company-a',scopeType:'empresa'}},
    {filter:{$where:'false'}},{limit:1.5},{skip:-1},
  ]) {
    f.state.reads.length=0;const result=await f.handler('entityListSorted')({entityName:'Cliente',context,...payload});
    assert.ok(result.status>=400);assert.equal(f.state.reads.length,0);
  }
});
test('348 export rechecks actor, secondary source grants and sensitive grants after reads',async()=>{
  for (const revoke of ['actor','source','sensitive']) {
    const permissions=structuredClone(business);permissions.Comercial.Representantes.push('comissao');
    const f=fixture(permissions);f.state.onAuth=number=>{
      if (number>1) {
        if (revoke==='actor') return {...f.state.user,id:'actor-b'};
        if (revoke==='source') f.state.permissions.Comercial.pedido=[];
        if (revoke==='sensitive') f.state.permissions.Comercial.Representantes=['visualizar','exportar'];
      }
      return f.state.user;
    };
    const result=await f.handler('entityListSorted')({entityName:'Representante',context,report:{kind:'representantes',periodo:'todos',action:'exportar'}});
    assert.ok(result.status>=400);assert.equal(result.body.csv,undefined);assert.equal(f.state.audits.length,0);
  }
});
test('348 explicit commission grant returns rounded estimate; no cancelled sales included',async()=>{
  const permissions=structuredClone(business);permissions.Comercial.Representantes.push('comissao');
  const f=fixture(permissions);f.state.rows.Pedido.push({...f.state.rows.Pedido[0],id:'cancelled',status:'Cancelado'});
  const result=await f.handler('entityListSorted')({entityName:'Representante',context,report:{kind:'representantes',periodo:'todos'}});
  assert.equal(result.status,200);assert.equal(result.body.data[0].vendas,100);assert.equal(result.body.data[0].comissao,10);
});
test('348 full export over the bound fails before audit and releases no partial CSV',async()=>{
  const f=fixture(business);f.state.rows.Cliente=Array.from({length:5001},(_,i)=>({...f.state.rows.Cliente[0],id:`client-${i}`}));
  const result=await f.handler('entityListSorted')({entityName:'Cliente',context,report:{kind:'personalizado',action:'exportar',fields:['nome']}});
  assert.equal(result.status,409);assert.equal(result.body.csv,undefined);assert.equal(f.state.audits.length,0);
});
test('348 filtering/counting cannot infer denied sensitive fields; sorting uses only authorized columns',async()=>{
  const f=fixture(business);
  for(const name of ['entityListSorted','countEntities','getEntityRecord']) {
    const result=await f.handler(name)({entityName:'Cliente',context,filter:{limite_credito:{$gte:100}},id:'client-a'});
    assert.equal(result.status,403);assert.equal(f.state.reads.length,0);
  }
  const allowed=await f.handler('entityListSorted')({entityName:'Cliente',context,sortField:'limite_credito'});
  assert.equal(allowed.status,200);assert.equal(allowed.body[0].limite_credito,undefined);
});
test('348 trusted membership aliases retain authorized group consolidation without global fallback',async()=>{
  const f=fixture(business);f.state.user.empresas_vinculadas=['company-a',{company_id:'company-b',ativo:true}];
  const result=await f.handler('entityListSorted')({entityName:'Cliente',context:{groupId:'group-a',scopeType:'grupo'},report:{kind:'personalizado',fields:['nome']}});
  assert.equal(result.status,200);assert.deepEqual(result.body.data.map(row=>row.id),['client-a','client-b']);
});
