import assert from 'node:assert/strict';
import test from 'node:test';
import {localCrmFixture} from './helpers/crmFixture.ts';
import {batchDependencies,nestedPgliteClient,syntheticBatch,sha} from './helpers/legadoBatchFixture.ts';
import {persistirLoteClientesLegado,reverterLoteClientesLegado,prepararPersistenciaClientesLegado}
  from '../../scripts/legado/staging-persistence.mjs';

test('canonical migration receipt: failures, replay, source derivation and bounded reversal (PGlite)',async()=>{
  const f=await localCrmFixture();
  try {
    const deps=batchDependencies(nestedPgliteClient(f.admin));
    const input=await syntheticBatch(deps,3);
    const count=async()=>Number((await f.admin.query('SELECT count(*)::int AS n FROM clientes')).rows[0].n);
    const before=await count();
    const fail=()=>{throw Error('SYNTHETIC_INTERRUPT');};
    await assert.rejects(persistirLoteClientesLegado(input,{...deps,hooks:{beforeTransaction:fail}}),/SYNTHETIC_INTERRUPT/);
    assert.equal(await count(),before);
    await assert.rejects(persistirLoteClientesLegado(input,{...deps,hooks:{afterWrite:fail}}),/SYNTHETIC_INTERRUPT/);
    assert.equal(await count(),before);
    const badAudit={append:async()=>{throw Error('SYNTHETIC_AUDIT_FAILURE');},listByEntity:deps.audit.listByEntity.bind(deps.audit)};
    await assert.rejects(persistirLoteClientesLegado(input,{...deps,audit:badAudit}),/SYNTHETIC_AUDIT_FAILURE/);
    assert.equal(await count(),before);
    await assert.rejects(persistirLoteClientesLegado(input,{...deps,hooks:{afterCommit:fail}}),/SYNTHETIC_INTERRUPT/);
    assert.equal(await count(),before+3);
    await assert.rejects(persistirLoteClientesLegado(input,{...deps,hooks:{checkpoint:fail}}),/SYNTHETIC_INTERRUPT/);
    assert.equal(await count(),before+3);
    const applied=await persistirLoteClientesLegado(input,deps);
    assert.equal(applied.replayed,true);assert.equal(applied.items.length,3);
    assert(applied.items.every(item=>item.pending.some(x=>x.field==='COMENTARIO')));
    const altered=JSON.parse(input.sourceBytes.toString());altered.rows.cliente[0].nome='Changed';
    const bytes=Buffer.from(JSON.stringify(altered));
    assert.throws(()=>prepararPersistenciaClientesLegado({...input,sourceBytes:bytes,sourceSha256:sha(bytes)},deps.schemas),/SOURCE_DERIVATION/);
    assert.throws(()=>prepararPersistenciaClientesLegado({...input,sourceBytes:bytes},deps.schemas),/SOURCE_BYTES/);
    await assert.rejects(persistirLoteClientesLegado({...input,manifestSha256:'0'.repeat(64)},deps),/MANIFEST_CHANGED/);
    const changedRun={...input,batchSize:1,batchIndex:1};
    const changedPlan=prepararPersistenciaClientesLegado(changedRun,deps.schemas);
    await assert.rejects(persistirLoteClientesLegado({...changedRun,manifestSha256:changedPlan.manifestSha256},deps),/MANIFEST_CHANGED/);
    const wrongTarget={...input,target:{...input.target,schemaOid:input.target.schemaOid+1}};
    const wrongPlan=prepararPersistenciaClientesLegado(wrongTarget,deps.schemas);
    await assert.rejects(persistirLoteClientesLegado({...wrongTarget,manifestSha256:wrongPlan.manifestSha256},deps),/PHYSICAL_TARGET/);
    const id=applied.items[0].id;
    assert.equal((await f.admin.query('SELECT telefone FROM clientes WHERE id=$1',[id])).rows[0].telefone,'001100000000');
    await deps.db.withTenantContext!(input.ctx,()=>deps.service.update(input.ctx,id,{telefone:'AUTHORIZED_MANUAL_CHANGE'}));
    await assert.rejects(persistirLoteClientesLegado(input,deps),/POSTIMAGE_CHANGED/);
    await assert.rejects(reverterLoteClientesLegado(input,deps),/POSTIMAGE_CHANGED/);
    assert.equal(await count(),before+3);
    const reverseInput=await syntheticBatch(deps,2,100);
    const second=await persistirLoteClientesLegado(reverseInput,deps);
    const reversed=await reverterLoteClientesLegado(reverseInput,deps);
    assert.equal(reversed.items.length,2);assert.equal(reversed.replayed,false);
    assert.equal((await reverterLoteClientesLegado(reverseInput,deps)).replayed,true);
    await assert.rejects(persistirLoteClientesLegado(reverseInput,deps),/BATCH_REVERSED/);
    for(const item of second.items)assert.equal((await f.admin.query('SELECT ativo FROM clientes WHERE id=$1',[item.id])).rows[0].ativo,false);
    assert.equal((await f.admin.query('SELECT telefone FROM clientes WHERE id=$1',[id])).rows[0].telefone,'AUTHORIZED_MANUAL_CHANGE');
    const overlap=await syntheticBatch(deps,3);
    const preserved=await persistirLoteClientesLegado(overlap,deps);
    assert.equal(preserved.items.filter(x=>x.outcome==='PREEXISTING_COMPATIBLE').length,2);
    assert.equal(preserved.items.filter(x=>x.outcome==='TARGET_CONFLICT').length,1);
    assert.equal(preserved.items.filter(x=>x.outcome==='INSERTED').length,0);
    assert.equal((await reverterLoteClientesLegado(overlap,deps)).items.length,0);
    const revocation=await syntheticBatch(deps,1,300);
    let revoked=false;
    const revokeGuard={assertAllowed:async(...args:Parameters<typeof deps.rbac.assertAllowed>)=>{
      if(revoked)throw Error('SYNTHETIC_REVOKED');return deps.rbac.assertAllowed(...args);
    }};
    const beforeRevocation=await count();
    await assert.rejects(persistirLoteClientesLegado(revocation,{...deps,rbac:revokeGuard,
      hooks:{afterWrite:()=>{revoked=true;}}}),/REVOKED/);
    assert.equal(await count(),beforeRevocation);
    const denied={...deps,rbac:{assertAllowed:async()=>{throw Error('SYNTHETIC_PERMISSION_DENIED');}}};
    await assert.rejects(persistirLoteClientesLegado(input,denied),/PERMISSION_DENIED/);
    await assert.rejects(persistirLoteClientesLegado({...input,ctx:{...input.ctx,empresaId:'00000000-0000-4000-8000-000000000001'}},deps),/GROUP_CONTEXT/);
  } finally {await f.close();}
});
