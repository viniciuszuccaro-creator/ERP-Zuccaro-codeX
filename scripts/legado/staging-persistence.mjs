import { createHash } from 'node:crypto';
import { selectFunctionalRows, projectionDifferences } from './pilot-functional-policy.mjs';
import { persistirClienteGrupoLegado } from './consumir-lote-staging.mjs';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Array.isArray(value) ? '[' + value.map(json).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + json(value[key])).join(',') + '}' : JSON.stringify(value);
const fingerprint = value => hash(json(value));
const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const need = (condition, code) => { if (!condition) throw Object.assign(new Error(code), {code}); };
const entity = 'LegacyClientImportBatch';
const kind = 'canonical_client_import_v1';
function batchId(runId, index) {
  // RFC 4122 UUIDv5: run UUID is the namespace, batch index is the name.
  const bytes = createHash('sha1').update(Buffer.from(runId.replaceAll('-',''),'hex')).update(String(index)).digest().subarray(0,16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** Verify exported CSV bytes -> staging rows; never trust a caller's digest alone. */
export function conferirDerivacaoClientesLegado(source,original,parseCsv) {
  need(original && Buffer.isBuffer(original.bytes) && original.bytes.length<=64*1024*1024
    && hash(original.bytes)===original.sha256 && [',',';','\t','|'].includes(original.delimiter)
    && typeof parseCsv==='function','LEGACY_ORIGINAL_SOURCE_REQUIRED');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(original.bytes);
  const rows=parseCsv(text,{columns:true,bom:true,delimiter:original.delimiter,skip_empty_lines:true,
    relax_column_count:false,quote:'"',escape:'"'});
  need(fingerprint(rows)===fingerprint(source.rows.cliente),'LEGACY_SOURCE_DERIVATION_MISMATCH');
  return original.sha256;
}

/** Derivation uses the EXISTING selector/mapper; original backup -> CSV remains a separate proof. */
export function prepararPersistenciaClientesLegado(input, schemas) {
  const {sourceBytes,sourceSha256,runId,sourceSystem,ctx,target,batchSize=500,limit=500,excludeLegacyCodes=[]} = input;
  need(Buffer.isBuffer(sourceBytes) && sourceBytes.length <= 64*1024*1024
    && hash(sourceBytes) === sourceSha256, 'LEGACY_SOURCE_BYTES_MISMATCH');
  need(uuid(runId) && uuid(ctx?.groupId) && uuid(ctx?.actorId) && !ctx.empresaId
    && ctx.scopeType === 'grupo' && typeof ctx.requestId === 'string' && ctx.requestId.length>0,
  'LEGACY_GROUP_CONTEXT_REQUIRED');
  need(typeof sourceSystem === 'string' && sourceSystem.length>0 && sourceSystem.length<=80
    && Number.isSafeInteger(batchSize) && batchSize>=1 && batchSize<=1000
    && Number.isSafeInteger(limit) && limit>=1
    && Array.isArray(excludeLegacyCodes) && excludeLegacyCodes.every(x=>typeof x==='string'), 'LEGACY_SELECTION_INVALID');
  need(target && ['database','schema','principal'].every(k=>typeof target[k]==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(target[k]))
    && ['databaseOid','schemaOid'].every(k=>Number.isSafeInteger(target[k])&&target[k]>0)
    && /^\d{1,30}$/.test(target.clusterIdentifier||''), 'LEGACY_TARGET_REQUIRED');
  const source = JSON.parse(sourceBytes.toString('utf8'));
  need(Array.isArray(source?.rows?.cliente) && Array.isArray(source?.rows?.fornecedor), 'LEGACY_SOURCE_FORMAT_INVALID');
  need(limit<=source.rows.cliente.length,'LEGACY_SELECTION_EXCEEDS_SOURCE');
  const originalSha256=conferirDerivacaoClientesLegado(source,input.originalSource,schemas.parseCsv);
  const selection = selectFunctionalRows({rows:{cliente:source.rows.cliente,fornecedor:[]}},
    {groupId:ctx.groupId,batch:runId,sourceSystem,...schemas});
  const consumed=new Set(['codigo_legado','codigo','tipo','cpf','cnpj','nome','razao_social','nome_fantasia',
    'status','quarantine_reasons','nome_social','inscricao_estadual','inscricao_municipal','telefone','celular','observacoes','contato_email']);
  const auxiliary=new Map();
  for(const row of selection.auxiliary.filter(row=>row.entity==='cliente')) {
    const group=auxiliary.get(row.index)||[];group.push(row);auxiliary.set(row.index,group);
  }
  const excluded = new Set(excludeLegacyCodes);
  const items = selection.selected.cliente.filter(item=>!excluded.has(item.payload.codigo_legado))
    .sort((a,b)=>a.payload.codigo_legado<b.payload.codigo_legado?-1:a.payload.codigo_legado>b.payload.codigo_legado?1:0)
    .slice(0,limit).map(item=>({ ...item, sourceRowSha256:fingerprint(source.rows.cliente[item.index]),
      pending:[...(auxiliary.get(item.index)||[]),
        ...Object.keys(source.rows.cliente[item.index]).filter(key=>!consumed.has(key))
          .map(field=>({reason:'SOURCE_FIELD_WITHOUT_APPROVED_MAPPING',field,sourcePreserved:true}))] }));
  need(items.length>0,'LEGACY_NO_ELIGIBLE_SELECTION');
  const context = {groupId:ctx.groupId,empresaId:null,actorId:ctx.actorId,requestId:ctx.requestId,scopeType:'grupo'};
  const manifest = {kind,runId,sourceSha256,originalSha256,sourceSystem,target:copy(target),context,batchSize,
    excluded: [...excluded].sort(), selection:items.map(({index,payload,sourceRowSha256,pending})=>({index,
      nativeKey:payload.codigo_legado,sourceRowSha256,payloadSha256:fingerprint(payload),pending}))};
  const manifestSha256 = fingerprint(manifest);
  const batches = [];
  for(let offset=0,index=0;offset<items.length;offset+=batchSize,index++) {
    const id=batchId(runId,index);
    batches.push({id,index,items:items.slice(offset,offset+batchSize).map(item=>({...item,
      payload:{...item.payload,migration_batch:id}}))});
  }
  return freeze({manifest,manifestSha256,batches,sourceCounts:selection.counts.cliente,
    rejected:selection.quarantine.filter(row=>row.entity==='cliente')});
}

async function physicalTarget(q,target) {
  const row=(await q.query(`SELECT current_database() AS database,current_schema() AS schema,current_user AS principal,
    (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS "databaseOid",
    (SELECT oid::int FROM pg_namespace WHERE nspname=current_schema()) AS "schemaOid",
    (SELECT system_identifier::text FROM pg_control_system()) AS "clusterIdentifier"`)).rows[0];
  need(fingerprint(row)===fingerprint(target),'LEGACY_PHYSICAL_TARGET_MISMATCH');
}
async function receiptFor(audit,ctx,id,q,ledgerEntity=entity) {
  const history=(await audit.listByEntity(ledgerEntity,id,q)).filter(e=>e.groupId===ctx.groupId&&e.empresaId==null);
  const receipts=history.filter(e=>e.afterData?.kind===kind);
  need(receipts.every(e=>e.actorId===ctx.actorId),'LEGACY_RECEIPT_ACTOR_MISMATCH');
  need(receipts.filter(e=>e.action==='create').length<=1 && receipts.filter(e=>e.action==='inactivate').length<=1,
    'LEGACY_RECEIPT_AMBIGUOUS');
  return {applied:receipts.find(e=>e.action==='create')?.afterData,
    reversed:receipts.find(e=>e.action==='inactivate')?.afterData};
}
async function bindRun(audit,ctx,plan,q,mustExist=false) {
  const runEntity='LegacyClientImportRun';
  await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${kind}:${ctx.groupId}:run:${plan.manifest.runId}`]);
  const stored=await receiptFor(audit,ctx,plan.manifest.runId,q,runEntity);
  if(stored.applied) need(stored.applied.manifestSha256===plan.manifestSha256,'LEGACY_MANIFEST_CHANGED');
  else {
    need(!mustExist,'LEGACY_RUN_NOT_FOUND');
    await audit.append({...ctx,entity:runEntity,entityId:plan.manifest.runId,action:'create',
      afterData:{kind,runId:plan.manifest.runId,manifestSha256:plan.manifestSha256,
        sourceSha256:plan.manifest.sourceSha256,originalSha256:plan.manifest.originalSha256}},q);
  }
}
const snapshot = async (repo,ctx,id,q) => {
  const row=await repo.getBulkSnapshot({groupId:ctx.groupId,empresaId:null},id,q);
  need(row && row.group_id===ctx.groupId && row.empresa_id==null,'LEGACY_RECORD_SCOPE_MISMATCH');
  return row;
};

/** Existing canonical services own ALL business writes; audit_logs is the atomic receipt.
 * Trusted CLI composition only: no route, new importer, migration, principal or grants.
 */
export async function persistirLoteClientesLegado(input,deps) {
  const {db,rbac,audit,service,repo,schemas,hooks={}}=deps;
  const plan=prepararPersistenciaClientesLegado(input,schemas);
  need(input.manifestSha256===plan.manifestSha256,'LEGACY_MANIFEST_CHANGED');
  need(Number.isSafeInteger(input.batchIndex)&&plan.batches[input.batchIndex], 'LEGACY_BATCH_REQUIRED');
  need(db.withTenantContext&&repo.getBulkSnapshot,'LEGACY_CANONICAL_SQL_REQUIRED');
  const batch=plan.batches[input.batchIndex],ctx=plan.manifest.context;
  const authorize=async q=>{
    for(const action of ['visualizar','criar','importar']) await rbac.assertAllowed(ctx,'Cadastros','cliente',action,{executor:q,allowGlobalWildcard:false});
  };
  await hooks.beforeTransaction?.();
  const result=await db.withTenantContext(ctx,()=>db.withTransaction(async q=>{
    await physicalTarget(q,plan.manifest.target);await authorize(q);
    await bindRun(audit,ctx,plan,q);
    await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${kind}:${ctx.groupId}:${batch.id}`]);
    const stored=await receiptFor(audit,ctx,batch.id,q);
    need(!stored.reversed,'LEGACY_BATCH_REVERSED');
    if(stored.applied) {
      need(stored.applied.manifestSha256===plan.manifestSha256,'LEGACY_MANIFEST_CHANGED');
      for(const item of stored.applied.items.filter(x=>['INSERTED','PREEXISTING_COMPATIBLE'].includes(x.outcome))) {
        need(fingerprint(await snapshot(repo,ctx,item.id,q))===item.fingerprint,'LEGACY_POSTIMAGE_CHANGED');
      }
      await authorize(q);return {...stored.applied,replayed:true};
    }
    const items=[];
    for(const item of batch.items) {
      const payload=item.payload;
      const existing=await service.findByLegacyIdentity(ctx,plan.manifest.sourceSystem,payload.codigo_legado);
      const document=await repo.findByDocumento(ctx.groupId,payload.documento,q);
      if(existing || document) {
        const compatible=existing&&existing.empresa_id==null&&projectionDifferences(payload,existing).length===0;
        const baseline=compatible?await snapshot(repo,ctx,existing.id,q):null;
        items.push({sourceIndex:item.index,sourceRowSha256:item.sourceRowSha256,
          ...(baseline?{id:baseline.id,fingerprint:fingerprint(baseline)}:{}),
          outcome:compatible?'PREEXISTING_COMPATIBLE':'TARGET_CONFLICT',
          nativeKey:payload.codigo_legado,pending:item.pending});
        continue; // Preserve prior/inactive/manual data; never merge, overwrite or restore.
      }
      const adapter={findByLegacyIdentity:service.findByLegacyIdentity.bind(service),
        sugerirVinculo:service.sugerirVinculo.bind(service),create:scope=>service.create(scope,payload)};
      const applied=await persistirClienteGrupoLegado(ctx,item.mapped,{service:adapter,rbacGuard:rbac,
        tipo:payload.tipo,sourceSystem:plan.manifest.sourceSystem,batch:batch.id});
      need(applied.reutilizado===false,'LEGACY_CONCURRENT_IDENTITY_CHANGED');
      const row=await snapshot(repo,ctx,applied.registro.id,q);
      need(projectionDifferences(payload,row).length===0 && row.migration_batch===batch.id,'LEGACY_CONTENT_MISMATCH');
      items.push({id:row.id,nativeKey:payload.codigo_legado,sourceIndex:item.index,sourceRowSha256:item.sourceRowSha256,
        payloadSha256:fingerprint(payload),fingerprint:fingerprint(row),outcome:'INSERTED',pending:item.pending});
      await hooks.afterWrite?.(items.length);
    }
    const receipt={kind,runId:plan.manifest.runId,batchId:batch.id,manifestSha256:plan.manifestSha256,
      sourceSha256:plan.manifest.sourceSha256,target:plan.manifest.target,items};
    await audit.append({...ctx,entity,entityId:batch.id,action:'create',afterData:receipt},q);
    await authorize(q);return {...receipt,replayed:false};
  }));
  // External receipt is never authoritative: failures here are resumed from the committed DB receipt.
  if(!result.replayed) await hooks.afterCommit?.();
  await hooks.checkpoint?.(result);
  return result;
}

export async function reverterLoteClientesLegado(input,deps) {
  const {db,rbac,audit,service,repo,schemas}=deps;
  const plan=prepararPersistenciaClientesLegado(input,schemas);
  need(input.manifestSha256===plan.manifestSha256,'LEGACY_MANIFEST_CHANGED');
  need(Number.isSafeInteger(input.batchIndex)&&plan.batches[input.batchIndex], 'LEGACY_BATCH_REQUIRED');
  const batch=plan.batches[input.batchIndex],ctx=plan.manifest.context;
  need(batch&&db.withTenantContext,'LEGACY_BATCH_REQUIRED');
  return db.withTenantContext(ctx,()=>db.withTransaction(async q=>{
    await physicalTarget(q,plan.manifest.target);
    const authorize=async()=>{for(const action of ['visualizar','importar','inativar'])
      await rbac.assertAllowed(ctx,'Cadastros','cliente',action,{executor:q,allowGlobalWildcard:false});};
    await authorize();
    await bindRun(audit,ctx,plan,q,true);
    await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${kind}:${ctx.groupId}:${batch.id}`]);
    const stored=await receiptFor(audit,ctx,batch.id,q);
    need(stored.applied?.manifestSha256===plan.manifestSha256,'LEGACY_BATCH_NOT_FOUND');
    const evidence=stored.reversed||stored.applied;
    const own=evidence.items.filter(x=>x.outcome==='INSERTED').sort((a,b)=>a.id<b.id?-1:1);
    for(const item of own) need(fingerprint(await snapshot(repo,ctx,item.id,q))===item.fingerprint,'LEGACY_POSTIMAGE_CHANGED');
    if(stored.reversed) return {...evidence,replayed:true};
    const after=[];
    for(const item of own) {
      const before=await snapshot(repo,ctx,item.id,q);
      need(before.migration_batch===batch.id&&before.source_system===plan.manifest.sourceSystem
        &&before.codigo_legado===item.nativeKey,'LEGACY_REVERSAL_OWNERSHIP_MISMATCH');
      await service.softDelete(ctx,item.id);
      const row=await snapshot(repo,ctx,item.id,q);
      const preserved=Object.keys(before).filter(k=>!['ativo','status','updated_at','updated_by','revision'].includes(k));
      need(row.ativo===false&&preserved.every(k=>fingerprint(row[k])===fingerprint(before[k])),'LEGACY_REVERSAL_CONTENT_MISMATCH');
      after.push({...item,fingerprint:fingerprint(row)});
    }
    const reversed={...stored.applied,items:after};
    await audit.append({...ctx,entity,entityId:batch.id,action:'inactivate',afterData:reversed},q);
    await authorize();return {...reversed,replayed:false};
  }));
}
