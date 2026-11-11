import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResultRow } from 'pg';
import type { DbQueryExecutor } from '../src/db/client.ts';
import { PostgresClienteBulkEligibility } from '../src/services/clienteBulkEligibility.ts';

const groupId='11111111-1111-4111-8111-111111111111',company='22222222-2222-4222-8222-222222222222',
  client='33333333-3333-4333-8333-333333333333',link='44444444-4444-4444-8444-444444444444',
  other='55555555-5555-4555-8555-555555555555';
const ctx={groupId,empresaId:null,actorId:other,requestId:'synthetic-delivery-coverage'};
type Link={id:string;group_id:string;empresa_id:string;cliente_id:string};
type Delivery={group_id:string;empresa_id:string;cliente_id:string|null;cliente_empresa_id:string|null;status:string;ativo:boolean};

async function fixture(){
  const local=new PGlite();
  let links:Link[]=[],deliveries:Delivery[]=[],fail=false,collision=false;
  const relations=['cliente_empresas','cliente_locais','cliente_local_finalidades','obras','oportunidades','entregas'];
  const seen:string[]=[];
  const q:DbQueryExecutor={async query<T extends QueryResultRow = QueryResultRow>(sql:string,params:unknown[]=[]){
    seen.push(sql);
    // Execute the delivery resolution SELECT itself against typed CTE values, never product tables or DDL.
    if(sql.includes('.entregas e')||sql.includes('lower(btrim(cliente_id::text))')&&sql.includes('.cliente_empresas')){
      if(fail)throw new Error('SYNTHETIC_DELIVERY_QUERY_FAILED');
      const n=params.length;
      const cte=`WITH clientes AS (SELECT * FROM jsonb_to_recordset($${n+1}::jsonb) AS c(id uuid,group_id uuid,empresa_id uuid)),
        cliente_empresas AS (SELECT * FROM jsonb_to_recordset($${n+2}::jsonb) AS ce(id uuid,group_id uuid,empresa_id uuid,cliente_id uuid)),
        entregas AS (SELECT * FROM jsonb_to_recordset($${n+3}::jsonb) AS e(group_id uuid,empresa_id uuid,cliente_id uuid,cliente_empresa_id uuid,status text,ativo boolean)) `;
      const result=await local.query<T>(cte+sql.replaceAll('"synthetic".',''),[...params,
        JSON.stringify([{id:client,group_id:groupId,empresa_id:null},
          ...(collision?[{id:link,group_id:groupId,empresa_id:null}]:[])]),JSON.stringify(links),JSON.stringify(deliveries)]);
      return {rows:result.rows,fields:[],rowCount:result.rows.length,command:'SELECT',oid:0};
    }
    let reply:Record<string,unknown>[]=[];
    if(sql.includes('current_schema()'))reply=[{schema:'synthetic',isolation:'read committed',group_id:groupId,empresa_id:null,row_security:'on'}];
    else if(sql.includes('AS canonical_fk'))reply=relations.map(name=>({schema:'synthetic',name,column:'cliente_id',canonical_fk:!['entregas','oportunidades'].includes(name)}));
    else if(sql.includes('FROM pg_class'))reply=['clientes',...relations].map(name=>({name,kind:'r',inherited:false}));
    else if(sql.includes('FOR UPDATE'))reply=[{id:client}];
    else if(sql.includes('AS unresolved'))reply=[{unresolved:false}];
    else if(!sql.startsWith('LOCK TABLE')&&!sql.includes('set_config')&&!sql.includes('SELECT DISTINCT'))throw new Error('Unexpected coverage query');
    const keys=[...new Set(reply.flatMap(row=>Object.keys(row)))];
    assert(keys.every(key=>/^[a-z_]+$/.test(key)));
    const result=await local.query<T>(keys.length?`SELECT ${keys.map(key=>`value->'${key}' AS "${key}"`).join(',')} FROM jsonb_array_elements($1::jsonb) AS value`:'SELECT 1 WHERE false',keys.length?[JSON.stringify(reply)]:[]);
    return {rows:result.rows,fields:[],rowCount:result.rows.length,command:'SELECT',oid:0};
  }};
  const inspect=()=>new PostgresClienteBulkEligibility().inspect(ctx,[{id:client,group_id:groupId,empresa_id:null,ativo:true}],q);
  return {inspect,close:()=>local.close(),seen,
    set:(l:Link[],d:Delivery[])=>{links=l;deliveries=d;},fail:()=>{fail=true;},collide:()=>{collision=true;}};
}
const canonicalLink:Link={id:link,group_id:groupId,empresa_id:company,cliente_id:client};
const delivery:Delivery={group_id:groupId,empresa_id:company,cliente_id:link,cliente_empresa_id:link,status:'ENTREGUE',ativo:true};

test('delivery coverage resolves canonical company-link identity for every state, including cancelled history',async()=>{
  const f=await fixture();try{
    for(const status of ['AGUARDANDO_SEPARACAO','EM_SEPARACAO','PRONTO_EXPEDIR','EM_ROMANEIO','SAIU_ENTREGA','ENTREGUE_PARCIAL','ENTREGUE','FRUSTRADA','DEVOLVIDA','CANCELADA']){
      f.set([canonicalLink],[{...delivery,status,ativo:status!=='CANCELADA'}]);
      assert.deepEqual(await f.inspect(),[{id:client,allowed:false,reasons:['CLIENTE_HAS_REFERENCES']}]);
    }
    assert(f.seen.some(sql=>sql.includes('LOCK TABLE "synthetic"."entregas"')));
    f.set([canonicalLink],[{...delivery,cliente_empresa_id:null}]);
    assert.equal((await f.inspect())[0].allowed,false);
  }finally{await f.close();}
});

test('delivery coverage allows proven absence and never interprets an ambiguous master UUID as absence',async()=>{
  const f=await fixture();try{
    assert.deepEqual(await f.inspect(),[{id:client,allowed:true,reasons:[]}]);
    for(const candidate of [{...delivery,cliente_id:client,cliente_empresa_id:null},
      {...delivery,cliente_id:null,cliente_empresa_id:null},{...delivery,cliente_id:other},
      {...delivery,group_id:other,cliente_id:client,cliente_empresa_id:null}]){
      f.set([canonicalLink],[candidate]);
      await assert.rejects(f.inspect(),{code:'CLIENTE_BULK_COVERAGE_UNVERIFIED'});
    }
    f.set([canonicalLink],[{...delivery,cliente_empresa_id:null}]);f.collide();
    await assert.rejects(f.inspect(),{code:'CLIENTE_BULK_COVERAGE_UNVERIFIED'});
  }finally{await f.close();}
});

test('delivery coverage checks both group and company, with no company filter hiding another-company reference',async()=>{
  const f=await fixture();try{
    f.set([{...canonicalLink,empresa_id:other}],[{...delivery,empresa_id:other}]);
    assert.equal((await f.inspect())[0].allowed,false);
    for(const candidate of [{...delivery,empresa_id:other},{...delivery,group_id:other}]){
      f.set([canonicalLink],[candidate]);await assert.rejects(f.inspect(),{code:'CLIENTE_BULK_COVERAGE_UNVERIFIED'});
    }
  }finally{await f.close();}
});

test('delivery query failure cannot become an eligible result',async()=>{
  const f=await fixture();try{f.fail();await assert.rejects(f.inspect(),/SYNTHETIC_DELIVERY_QUERY_FAILED/);}
  finally{await f.close();}
});
