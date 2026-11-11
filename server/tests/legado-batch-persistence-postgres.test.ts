import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {createPoolDbClient} from '../src/db/client.ts';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {batchDependencies,syntheticBatch} from './helpers/legadoBatchFixture.ts';
import {persistirLoteClientesLegado,reverterLoteClientesLegado} from '../../scripts/legado/staging-persistence.mjs';

const url=process.env.DATABASE_URL;
test('PostgreSQL canonical 500 then 1000: commit-gap replay, full postimages, reversal and concurrent attempts',
  {skip:!url},async()=>{
    const f=await realCrmFixture(url!);
    const pool=new pg.Pool({connectionString:url,options:`-c search_path=${f.schema},pg_catalog`,max:3});
    try {
      const deps=batchDependencies(createPoolDbClient(pool));
      const initial=(await f.admin.query('SELECT to_jsonb(c) AS row FROM clientes c ORDER BY id')).rows;
      for(const [size,offset] of [[500,1000],[1000,2000]]) {
        const input=await syntheticBatch(deps,size,offset),start=performance.now();
        let release=()=>{},held=()=>{},failed=(e:unknown)=>{};
        const gate=new Promise<void>(resolve=>{release=resolve;});
        const ready=new Promise<void>((resolve,reject)=>{held=resolve;failed=reject;});
        const first=persistirLoteClientesLegado(input,{...deps,hooks:{
          afterWrite:async n=>{if(n===1){held();await gate;}},
          afterCommit:()=>{throw Error('SYNTHETIC_COMMIT_GAP');}}});
        first.catch(failed);
        await ready;
        const peer=persistirLoteClientesLegado(input,deps);
        let waiting=false;
        try {
          for(let i=0;i<120;i++) {
            await f.admin.query('SELECT pg_stat_clear_snapshot()');
            const locks=await f.admin.query(`SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT pg_advisory_xact_lock%'`);
            if(locks.rows[0].n>0){waiting=true;break;}
            await new Promise(resolve=>setTimeout(resolve,25));
          }
        }finally{release();}
        const outcomes=await Promise.allSettled([first,peer]);
        assert.equal(waiting,true,'independent connection must contend on the absent receipt key');
        assert.equal(outcomes[0].status,'rejected');
        if(outcomes[0].status==='rejected')assert.match(outcomes[0].reason.message,/COMMIT_GAP/);
        assert.equal(outcomes[1].status,'fulfilled');
        const a=await persistirLoteClientesLegado(input,deps);
        assert.equal(a.replayed,true);assert.equal(a.items.length,size);
        const loaded=(await f.admin.query('SELECT count(*)::int AS n,count(DISTINCT codigo_legado)::int AS distinct_n FROM clientes WHERE migration_batch=$1',[a.batchId])).rows[0];
        assert.equal(loaded.n,size);assert.equal(loaded.distinct_n,size);
        const reverseStart=performance.now();await reverterLoteClientesLegado(input,deps);
        assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM clientes WHERE migration_batch=$1 AND ativo',[a.batchId])).rows[0].n,0);
        assert.equal((await reverterLoteClientesLegado(input,deps)).replayed,true);
        const remaining=(await f.admin.query('SELECT to_jsonb(c) AS row FROM clientes c WHERE migration_batch IS DISTINCT FROM $1 AND source_system IS DISTINCT FROM $2 ORDER BY id',[a.batchId,input.sourceSystem])).rows;
        assert.deepEqual(remaining,initial);
        console.log(JSON.stringify({engine:'PostgreSQL',data:'SYNTHETIC',size,elapsedMs:performance.now()-start,
          reversalMs:performance.now()-reverseStart,peakRssBytes:process.resourceUsage().maxRSS*1024}));
      }
    }finally{await pool.end();await f.close();}
  });
