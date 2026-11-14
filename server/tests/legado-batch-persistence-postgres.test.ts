import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {SEED_IDS as ID} from '../scripts/seedDevIds.ts';
import {legacyContactsFingerprint} from '../src/services/clienteLegacyNameCorrection.ts';
import {createPoolDbClient} from '../src/db/client.ts';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {batchDependencies,syntheticBatch} from './helpers/legadoBatchFixture.ts';
import {persistirLoteClientesLegado,reverterLoteClientesLegado,prepararPersistenciaClientesLegado} from '../../scripts/legado/staging-persistence.mjs';

const url=process.env.DATABASE_URL;

test('PostgreSQL Cliente-only identity candidate refuses unknown index and duplicates without changing rows',
  {skip:!url},async()=>{
    const f=await realCrmFixture(url!);
    try {
      const candidate=await readFile(new URL('../schema-candidates/cliente_legacy_identity.sql',import.meta.url),'utf8');
      const full=(await readFile(new URL('../migrations/043_legado_identidade_compartilhada.sql',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
      const definition=candidate.slice(candidate.indexOf('CREATE UNIQUE INDEX')).replace(/\r\n/g,'\n');
      assert.ok(full.includes(definition.replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ')));
      assert.doesNotMatch(candidate,/\b(?:produtos|profiles|GRANT|DROP|schema_migrations)\b/i);
      await assert.rejects(f.exec(candidate),/LEGACY_CLIENT_INDEX_DEFINITION_REVIEW_REQUIRED/);
      // Only this newly-created synthetic fixture owns the index being removed.
      await f.exec('DROP INDEX clientes_legacy_identity_uidx');
      await f.admin.query("UPDATE clientes SET source_system='SYNTHETIC_IDENTITY',codigo_legado='00007' WHERE id=ANY($1::uuid[])",[[ID.clientePfA,ID.clientePjA]]);
      const snapshot=async()=>(await f.admin.query('SELECT to_jsonb(c) AS row FROM clientes c ORDER BY id')).rows;
      const duplicate=await snapshot();
      await assert.rejects(f.exec(candidate),/LEGACY_CLIENT_IDENTITY_RECONCILIATION_REQUIRED/);
      assert.deepEqual(await snapshot(),duplicate);
      await f.admin.query("UPDATE clientes SET codigo_legado='00008' WHERE id=$1",[ID.clientePjA]);
      const before=await snapshot();await f.exec(candidate);assert.deepEqual(await snapshot(),before);
      await assert.rejects(f.admin.query("UPDATE clientes SET codigo_legado='00007' WHERE id=$1",[ID.clientePjA]),{code:'23505'});
      assert.deepEqual(await snapshot(),before);
      await f.admin.query("UPDATE clientes SET source_system='SYNTHETIC_IDENTITY',codigo_legado='00007' WHERE id=$1",[ID.clientePjB]);
      await assert.rejects(f.exec(candidate),/LEGACY_CLIENT_INDEX_DEFINITION_REVIEW_REQUIRED/);
    }finally{await f.close();}
  });
test('PostgreSQL master extensions: restricted login, concurrent CAS, replay, rollback and inactive reversal',
  {skip:!url},async()=>{
    const f=await realCrmFixture(url!,{restrictedLogin:true});
    try {
      // The canonical fixture already applies 045; verify it instead of applying the candidate twice.
      const contactsColumn=await f.admin.query("SELECT data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='clientes' AND column_name='contatos'");
      assert.equal(contactsColumn.rows.length,1);
      assert.equal(contactsColumn.rows[0].data_type,'jsonb');
      await f.exec(await readFile(new URL('../schema-candidates/cliente_master_extras.sql',import.meta.url),'utf8'));
      await f.exec(`GRANT SELECT,UPDATE ON clientes TO "${f.role}";
        GRANT SELECT,INSERT ON audit_logs TO "${f.role}";
        CREATE POLICY master_extra_cliente ON clientes FOR ALL TO "${f.role}"
          USING(group_id='${ID.groupA}' AND empresa_id IS NULL)
          WITH CHECK(group_id='${ID.groupA}' AND empresa_id IS NULL);
        CREATE POLICY master_extra_audit ON audit_logs FOR ALL TO "${f.role}"
          USING(group_id='${ID.groupA}' AND empresa_id IS NULL)
          WITH CHECK(group_id='${ID.groupA}' AND empresa_id IS NULL)`);
      const role=(await f.data.query('SELECT r.rolsuper,r.rolbypassrls,current_user=session_user AS same_login FROM pg_roles r WHERE r.rolname=current_user')).rows[0];
      assert.deepEqual(role,{rolsuper:false,rolbypassrls:false,same_login:true});
      const batch=randomUUID();
      await f.admin.query(`UPDATE clientes SET empresa_id=NULL,ativo=false,origem='MIGRACAO',source_system='SYNTHETIC_MASTER',
        codigo_legado='7',migration_batch=$1 WHERE id=$2`,[batch,ID.clientePfA]);
      const deps=batchDependencies(f.data),ctx={groupId:ID.groupA,actorId:ID.runtimeActorA,scopeType:'grupo' as const};
      const snapshot=()=>deps.repo.withTransaction(async q=>{assert.ok(q);return deps.repo.getBulkSnapshot(ctx,ID.clientePfA,q);});
      const before=await snapshot();assert.ok(before);
      const command={mode:'apply',id:ID.clientePfA,operationId:randomUUID(),expectedFingerprint:legacyContactsFingerprint(before),
        sourceSystem:'SYNTHETIC_MASTER',legacyCode:'7',batch,masterFields:{rg:'00123-X',numero_caixa_postal:'00017'},
        sourceProof:{fileSha256:'a'.repeat(64),rowSha256:'b'.repeat(64),parser:'ndjson-v1'}};
      const alternative={...command,operationId:randomUUID(),masterFields:{rg:'00456-X',numero_caixa_postal:'00018'}};
      const commands=[command,alternative];
      const results=await Promise.allSettled(commands.map(c=>deps.service.enrichLegacyContacts(ctx,c)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='LEGACY_ENRICHMENT_CONFLICT').length,1);
      const index=results.findIndex(r=>r.status==='fulfilled'),winner=commands[index];
      const after=await snapshot();assert.ok(after);
      assert.deepEqual(after,{...before,...winner.masterFields,updated_at:after.updated_at});
      const count=async()=>(await deps.audit.listByEntity('Cliente',ID.clientePfA)).length;
      const auditCount=await count();
      const replay=await deps.service.enrichLegacyContacts(ctx,winner);
      assert.equal(replay.reused,true);assert.equal(await count(),auditCount);
      await assert.rejects(deps.service.enrichLegacyContacts({...ctx,groupId:ID.groupB},winner));
      const reverse={mode:'reverse',id:winner.id,operationId:randomUUID(),originalOperationId:winner.operationId,
        expectedFingerprint:replay.fingerprint,sourceSystem:winner.sourceSystem,legacyCode:winner.legacyCode,batch};
      await deps.service.enrichLegacyContacts(ctx,reverse);
      const restored=await snapshot();assert.ok(restored);
      assert.deepEqual(restored,{...before,updated_at:restored.updated_at});
      assert.equal((await deps.service.enrichLegacyContacts(ctx,reverse)).reused,true);
      await assert.rejects(f.admin.query("UPDATE clientes SET rg='<unsafe>' WHERE id=$1",[ID.clientePfA]));
      assert.deepEqual(await snapshot(),restored);
      const again={...winner,operationId:randomUUID(),expectedFingerprint:legacyContactsFingerprint(restored)};
      const applied=await deps.service.enrichLegacyContacts(ctx,again);
      await f.admin.query("UPDATE clientes SET rg='MANUAL' WHERE id=$1",[ID.clientePfA]);
      const manual=await snapshot();assert.ok(manual);
      await assert.rejects(deps.service.enrichLegacyContacts(ctx,{...reverse,operationId:randomUUID(),
        originalOperationId:again.operationId,expectedFingerprint:applied.fingerprint}),{code:'LEGACY_ENRICHMENT_CONFLICT'});
      assert.deepEqual(await snapshot(),manual);assert.equal(manual.ativo,false);
    }finally{await f.close();}
  });
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
      const source=await syntheticBatch(deps,1001,4000),raw={...source,batchSize:500};
      const plan=prepararPersistenciaClientesLegado(raw,deps.schemas);
      assert.deepEqual(plan.batches.map(batch=>batch.items.length),[500,500,1]);
      const input={...raw,manifestSha256:plan.manifestSha256};
      const applied=[];
      for(const batch of plan.batches) {
        const request={...input,batchIndex:batch.index};
        const receipt=await persistirLoteClientesLegado(request,deps);
        assert.equal(receipt.items.length,batch.items.length);applied.push(receipt);
        assert.equal((await persistirLoteClientesLegado(request,deps)).replayed,true);
      }
      assert.equal(new Set(applied.flatMap(receipt=>receipt.items.map(item=>item.id))).size,1001);
      for(const batch of [...plan.batches].reverse())await reverterLoteClientesLegado({...input,batchIndex:batch.index},deps);
      assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM clientes WHERE migration_batch=ANY($1::text[]) AND ativo',
        [plan.batches.map(batch=>batch.id)])).rows[0].n,0);
      console.log(JSON.stringify({engine:'PostgreSQL',data:'SYNTHETIC',runRecords:1001,batchSizes:[500,500,1],replayed:true,reversed:true}));
    }finally{await pool.end();await f.close();}
  });
