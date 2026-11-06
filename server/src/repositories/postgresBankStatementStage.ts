import { z } from 'zod';
import { AppError } from '../api/errors.js';
import { isDeepStrictEqual } from 'node:util';
import type { DbQueryExecutor } from '../db/client.js';
import type { RequestContext } from '../audit/types.js';
import { bankStatementAccountHash, bankStatementContentHash, bankStatementIdentityHash, bankStatementStageSignature } from '../services/bankStatementImport.js';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const stagePayload = z.object({ sourceId: z.string().min(1).max(500), postedRaw: z.string(), amountRaw: z.string(),
  amountMinor: z.string().regex(/^-?\d+$/), identityHash: hash, contentHash: hash, original: z.record(z.unknown()) }).strict();
const item = z.object({ identityHash: hash, contentHash: hash, disposition: z.enum(['NEW','REPLAY']), snapshot: z.record(z.unknown()) }).strict();
const account = z.object({ bankId: z.string().min(1).max(500), accountId: z.string().min(1).max(500),
  branchId: z.string().min(1).max(500).optional(), currency: z.literal('BRL') }).strict();
const batchSchema = z.object({ id: z.string().uuid(), account_hash: hash, account, source_sha256: hash,
  statement_hash: hash, parser_contract: z.literal(2), items: z.array(item).min(1).max(10000), reversed: z.boolean() });
export type StageBatch = z.infer<typeof batchSchema>;
export type StageItem = z.infer<typeof item>;

/** Uses only the supplied transaction executor; evidence never becomes a financial transaction. */
export class PostgresBankStatementStage {
  async pageHeader(ctx:RequestContext,id:string,q:DbQueryExecutor,lock=false){
    const result=await q.query(`SELECT id,account_hash,account,source_sha256,statement_hash,parser_contract,reversed,
      jsonb_array_length(items) AS total FROM bank_statement_stage_batches
      WHERE group_id=$1 AND empresa_id=$2 AND id=$3${lock?' FOR SHARE':''}`,[ctx.groupId,ctx.empresaId,id]);
    if(result.rows.length!==1)return null;
    const header=batchSchema.omit({items:true}).extend({total:z.number().int().min(1).max(10000)}).parse(result.rows[0]);
    if(bankStatementAccountHash(header.account)!==header.account_hash)
      throw new AppError(409,'BANK_STAGE_EVIDENCE_INVALID','Staging evidence invalid');
    return header;
  }
  async pageItems(ctx:RequestContext,id:string,limit:number,offset:number,q:DbQueryExecutor){
    const result=await q.query(`SELECT page.value AS evidence FROM bank_statement_stage_batches b,
      LATERAL jsonb_array_elements(b.items) WITH ORDINALITY AS page(value,position)
      WHERE b.group_id=$1 AND b.empresa_id=$2 AND b.id=$3 ORDER BY page.position LIMIT $4 OFFSET $5`,
      [ctx.groupId,ctx.empresaId,id,limit,offset]);
    return result.rows.map(row=>item.parse(row.evidence));
  }
  async lock(ctx: RequestContext, batchId: string, accountHash: string, q: DbQueryExecutor) {
    for (const key of [`bank-account:${ctx.groupId}:${ctx.empresaId}:${accountHash}`, `bank-batch:${ctx.groupId}:${ctx.empresaId}:${batchId}`]) {
      await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
    }
  }
  async batch(ctx: RequestContext, id: string, q: DbQueryExecutor, lock = false): Promise<StageBatch | null> {
    const result = await q.query(`SELECT * FROM bank_statement_stage_batches WHERE group_id=$1 AND empresa_id=$2 AND id=$3${lock ? ' FOR UPDATE' : ''}`,
      [ctx.groupId, ctx.empresaId, id]);
    if (!result.rows.length) return null;
    const saved = batchSchema.parse(result.rows[0]);
    const transactions = saved.items.map(item => {
      const payload=stagePayload.parse(item.snapshot.payload);
      if(payload.identityHash!==item.identityHash || payload.contentHash!==item.contentHash
        || bankStatementIdentityHash(saved.account,payload.sourceId)!==item.identityHash
        || bankStatementContentHash(payload)!==item.contentHash
        || (item.disposition==='NEW')!==(item.snapshot.batch_id===saved.id)) {
        throw new AppError(409,'BANK_STAGE_EVIDENCE_INVALID','Staging evidence invalid');
      }
      return payload;
    });
    if (bankStatementAccountHash(saved.account) !== saved.account_hash
      || bankStatementStageSignature({account:saved.account,sourceSha256:saved.source_sha256,transactions})!==saved.statement_hash
      || new Set(saved.items.map(item => item.identityHash)).size !== saved.items.length) throw new AppError(409,'BANK_STAGE_EVIDENCE_INVALID','Staging evidence invalid');
    return saved;
  }
  async rows(ctx: RequestContext, ids: string[], q: DbQueryExecutor) {
    const result = await q.query(`SELECT to_jsonb(r) AS snapshot FROM bank_statement_stage_rows r
      WHERE group_id=$1 AND empresa_id=$2 AND identity_hash=ANY($3::text[]) ORDER BY identity_hash FOR UPDATE`, [ctx.groupId,ctx.empresaId,ids]);
    return result.rows.map(raw => {
      const snapshot = z.record(z.unknown()).parse(raw.snapshot);
      const row = z.object({ identity_hash: hash, content_hash: hash, batch_id: z.string().uuid(), payload: stagePayload, reversed: z.boolean() }).parse(snapshot);
      if (row.payload.identityHash !== row.identity_hash || row.payload.contentHash !== row.content_hash
        || bankStatementContentHash(row.payload) !== row.content_hash) throw new AppError(409,'BANK_STAGE_EVIDENCE_INVALID','Staging evidence invalid');
      return { ...row, snapshot };
    });
  }
  async identities(ctx: RequestContext, ids: string[], q: DbQueryExecutor) {
    const result=await q.query(`SELECT identity_hash,content_hash,reversed FROM bank_statement_stage_rows
      WHERE group_id=$1 AND empresa_id=$2 AND identity_hash=ANY($3::text[]) ORDER BY identity_hash FOR UPDATE`,[ctx.groupId,ctx.empresaId,ids]);
    return z.array(z.object({identity_hash:hash,content_hash:hash,reversed:z.boolean()})).parse(result.rows);
  }
  async originals(ctx: RequestContext, owners: string[], identities: string[], q: DbQueryExecutor) {
    const result = await q.query(`SELECT b.id,b.reversed,item AS evidence FROM bank_statement_stage_batches b,
      LATERAL jsonb_array_elements(b.items) item WHERE b.group_id=$1 AND b.empresa_id=$2 AND b.id=ANY($3::uuid[])
      AND item->>'disposition'='NEW' AND item->>'identityHash'=ANY($4::text[])`,[ctx.groupId,ctx.empresaId,owners,identities]);
    const records=z.array(z.object({id:z.string().uuid(),reversed:z.boolean(),evidence:item})).parse(result.rows);
    if(new Set(records.map(row=>`${row.id}:${row.evidence.identityHash}`)).size!==records.length) {
      throw new AppError(409,'BANK_STAGE_EVIDENCE_INVALID','Staging evidence invalid');
    }
    return records;
  }
  async createdAt(q: DbQueryExecutor) {
    const result = await q.query("SELECT to_jsonb(timezone('utc',now())::timestamptz) AS value");
    return z.string().datetime({ offset: true }).parse(result.rows[0]?.value);
  }
  async insertBatch(ctx: RequestContext, batch: StageBatch, q: DbQueryExecutor) {
    await q.query(`INSERT INTO bank_statement_stage_batches(group_id,empresa_id,id,actor_id,request_id,parser_contract,account_hash,account,source_sha256,statement_hash,items)
      VALUES($1,$2,$3,$4,$5,2,$6,$7::jsonb,$8,$9,$10::jsonb)`,
    [ctx.groupId,ctx.empresaId,batch.id,ctx.actorId,ctx.requestId,batch.account_hash,JSON.stringify(batch.account),batch.source_sha256,batch.statement_hash,JSON.stringify(batch.items)]);
  }
  async insertRows(ctx: RequestContext, batch: StageBatch, payloads: z.infer<typeof stagePayload>[], q: DbQueryExecutor) {
    for(const payload of payloads) {
      if (bankStatementIdentityHash(batch.account,payload.sourceId) !== payload.identityHash || bankStatementContentHash(payload) !== payload.contentHash) {
        throw new AppError(409,'BANK_STAGE_EVIDENCE_INVALID','Staging evidence invalid');
      }
    }
    await q.query(`INSERT INTO bank_statement_stage_rows(group_id,empresa_id,identity_hash,batch_id,content_hash,payload)
      SELECT $1,$2,payload->>'identityHash',$3,payload->>'contentHash',payload FROM jsonb_array_elements($4::jsonb) payload`,
    [ctx.groupId,ctx.empresaId,batch.id,JSON.stringify(payloads)]);
  }
  async reverse(ctx: RequestContext, batch: StageBatch, q: DbQueryExecutor) {
    const own = batch.items.filter(item => item.disposition==='NEW').map(item => item.identityHash);
    const dependencies = await q.query(`SELECT 1 FROM bank_statement_stage_batches b WHERE b.group_id=$1 AND b.empresa_id=$2
      AND b.id<>$3 AND NOT b.reversed AND EXISTS(SELECT 1 FROM jsonb_array_elements(b.items) item
        WHERE item->>'identityHash'=ANY($4::text[])) LIMIT 1`, [ctx.groupId,ctx.empresaId,batch.id,own]);
    if (dependencies.rows.length) throw new AppError(409,'BANK_STAGE_REFERENCED','Another active batch references these staged rows');
    const beforeBatch = await q.query(`SELECT to_jsonb(b) AS snapshot FROM bank_statement_stage_batches b
      WHERE group_id=$1 AND empresa_id=$2 AND id=$3 FOR UPDATE`,[ctx.groupId,ctx.empresaId,batch.id]);
    const before = z.record(z.unknown()).parse(beforeBatch.rows[0]?.snapshot);
    const reversal = { reversed:true,reversed_at:await this.createdAt(q),reversed_by:ctx.actorId,reversal_request_id:ctx.requestId };
    const updated = await q.query(`UPDATE bank_statement_stage_rows SET reversed=true,reversed_at=timezone('utc',now()),reversed_by=$4,reversal_request_id=$5
      WHERE group_id=$1 AND empresa_id=$2 AND batch_id=$3 AND NOT reversed AND identity_hash=ANY($6::text[]) RETURNING to_jsonb(bank_statement_stage_rows) AS snapshot`,
    [ctx.groupId,ctx.empresaId,batch.id,ctx.actorId,ctx.requestId,own]);
    if (updated.rowCount !== own.length) throw new AppError(409,'BANK_STAGE_CONFLICT','Staged rows changed');
    const expected = new Map(batch.items.filter(item=>item.disposition==='NEW').map(item=>[item.identityHash,{...item.snapshot,...reversal}]));
    for(const raw of updated.rows) {
      const snapshot=z.record(z.unknown()).parse(raw.snapshot);
      if(typeof snapshot.identity_hash!=='string' || !isDeepStrictEqual(expected.get(snapshot.identity_hash),snapshot)) {
        throw new AppError(409,'BANK_STAGE_CONFLICT','Staged rows changed');
      }
    }
    const result = await q.query(`UPDATE bank_statement_stage_batches SET reversed=true,reversed_at=timezone('utc',now()),reversed_by=$4,reversal_request_id=$5
      WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND NOT reversed RETURNING to_jsonb(bank_statement_stage_batches) AS snapshot`, [ctx.groupId,ctx.empresaId,batch.id,ctx.actorId,ctx.requestId]);
    if (result.rowCount !== 1) throw new AppError(409,'BANK_STAGE_CONFLICT','Staging batch changed');
    if(!isDeepStrictEqual(result.rows[0].snapshot,{...before,...reversal})) throw new AppError(409,'BANK_STAGE_CONFLICT','Staging batch changed');
  }
}
