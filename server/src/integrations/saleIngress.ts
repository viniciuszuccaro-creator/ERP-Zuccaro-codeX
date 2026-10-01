import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { PedidoService } from '../services/pedidoService.js';
import type { OrcamentoService } from '../services/orcamentoService.js';
import { AppError } from '../api/errors.js';
import { digest, saleReceiptSchema, saleStateSchema, type SaleState, type ReceiptStateQuery, type SaleReceipt, type ChannelIdentity, type SaleEnvelope, type ReceiptQuery, type ReceiptPageQuery, type ReceiptPage } from './saleIngressContract.js';

type CanonicalSales = {
  pedidoService: Pick<PedidoService, 'create'|'get'>;
  orcamentoService: Pick<OrcamentoService, 'create'|'get'>;
  auditRepo: AuditRepository; tenantGuard: TenantGuard; rbacGuard: RbacGuard;
};
export type { SaleReceipt } from './saleIngressContract.js';
type ReceiptEvent = { payload: unknown; status: string; aggregate_type: string; aggregate_id: string };
export async function assertIntegrationEventsReady(db: DbClient) {
  const role=await db.query<{safe:boolean}>("SELECT (NOT rolsuper AND NOT rolbypassrls) AS safe FROM pg_roles WHERE rolname=current_user");
  if(role.rows[0]?.safe!==true)throw new Error('Omnichannel runtime role must be NOSUPERUSER NOBYPASSRLS');
  const result = await db.query<{ ready: boolean; qualifier: string; check: string }>(`SELECT
    (c.relrowsecurity AND c.relforcerowsecurity AND p.polcmd='*' AND p.polpermissive AND p.polroles=ARRAY[0]::oid[]
      AND (SELECT count(*) FROM pg_policy WHERE polrelid=c.oid)=1) AS ready,
    pg_get_expr(p.polqual,p.polrelid) AS qualifier, pg_get_expr(p.polwithcheck,p.polrelid) AS check
    FROM pg_class c JOIN pg_policy p ON p.polrelid=c.oid AND p.polname='integration_events_scope'
    WHERE c.oid=to_regclass('integration_events')`);
  // Exact canonical expression, not substring matching: OR true/extra permissive policies must fail closed.
  const normalize = (value: string) => (value.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[^'"]+/g) ?? [])
    .map(part => part.startsWith("'") || part.startsWith('"') ? part
      : part.replace(/::text\b|[\s()]/gi, '').toLowerCase()).join('');
  const expected = normalize("group_id = NULLIF(current_setting('erp.group_id', true), '')::uuid AND empresa_id = NULLIF(current_setting('erp.empresa_id', true), '')::uuid");
  const policy = result.rows[0];
  if (policy?.ready !== true || typeof policy.qualifier !== 'string' || typeof policy.check !== 'string'
    || normalize(policy.qualifier) !== expected || normalize(policy.check) !== expected) {
    throw new Error('Omnichannel RLS gate not satisfied');
  }
}
const receiptKey = (identity: ChannelIdentity, envelope: Pick<SaleEnvelope, 'tipo' | 'idempotencyKey'>) =>
  `sale:v1:${digest(JSON.stringify([identity.groupId, identity.empresaId, identity.id, identity.channel, envelope.tipo, envelope.idempotencyKey]))}`;
const clientHash = (identity:ChannelIdentity)=>digest(JSON.stringify([identity.groupId,identity.empresaId,identity.id,identity.channel]));

/** Transport adapter; commercial validations, pricing and writes stay in the canonical services. */
export class SaleIngress {
  constructor(private readonly db: DbClient, private readonly sales: CanonicalSales) {}

  private async validateReceipt(event: ReceiptEvent, tipo: SaleReceipt['tipo'], ctx: RequestContext, query: DbQueryExecutor) {
    const parsed = saleReceiptSchema.safeParse((event.payload as { receipt?: unknown } | null)?.receipt);
    if (!parsed.success || parsed.data.tipo !== tipo || event.status !== 'processed'
      || event.aggregate_type !== tipo || event.aggregate_id !== parsed.data.id) {
      throw new AppError(500, 'CHANNEL_RECEIPT_INVALID', 'Stored receipt integrity failed');
    }
    // Fixed table allowlist; no status filter: ingestion receipt is not current fulfillment/payment state.
    const table = tipo === 'Pedido' ? 'pedidos' : 'orcamentos';
    const document = await query.query(`SELECT id FROM ${table} WHERE id=$1 AND group_id=$2 AND empresa_id=$3`,
      [parsed.data.id,ctx.groupId,ctx.empresaId]);
    if (!document.rows.length) throw new AppError(500, 'CHANNEL_RECEIPT_INVALID', 'Stored receipt integrity failed');
    return parsed.data;
  }

  async assertDatabaseReady() {
    await assertIntegrationEventsReady(this.db);
    const columns=await this.db.query<{total:number}>(`SELECT count(*)::int AS total FROM pg_attribute
      WHERE attrelid IN (to_regclass('pedidos'),to_regclass('orcamentos')) AND NOT attisdropped
        AND attname IN ('origem','canal','external_id','idempotency_key') AND atttypid='text'::regtype
        AND (attname<>'origem' OR attnotnull)`);
    if(columns.rows[0]?.total!==8)throw new Error('Canonical sales channel contracts not ready (025/028)');
  }

  async receive(identity: ChannelIdentity, envelope: SaleEnvelope, nonce: string, requestId: string) {
    const ctx: RequestContext = { groupId: identity.groupId, empresaId: identity.empresaId,
      actorId: identity.actorId, scopeType: 'empresa', requestId };
    await this.sales.tenantGuard.assertEmpresaInGroup(identity.groupId, identity.empresaId);
    await this.sales.rbacGuard.assertAllowed(ctx, 'Integracoes', 'vendas', 'importar', { allowGlobalWildcard: false });
    await this.sales.rbacGuard.assertAllowed(ctx, 'Comercial', envelope.tipo === 'Pedido' ? 'pedido' : 'orcamento', 'criar', { allowGlobalWildcard: false });
    const partition = [identity.groupId, identity.empresaId, identity.id, identity.channel];
    const key = receiptKey(identity, envelope);
    const hash = digest(JSON.stringify(envelope));
    const nonceHash = digest(JSON.stringify([...partition, nonce]));
    return this.db.withTransaction(async (query) => {
      await assertIntegrationEventsReady({...this.db,query:query.query.bind(query)});
      await query.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",
        [identity.groupId, identity.empresaId]);
      // Serialize by nonce first, then receipt key, preventing conflicting concurrent deliveries.
      for (const lock of [nonceHash, key]) await query.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lock]);
      const reused = await query.query(
        "SELECT id FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source=$3 AND event_type IN ('venda.recebida','venda.nonce') AND payload->>'nonce_hash'=$4 LIMIT 1",
        [identity.groupId, identity.empresaId, identity.channel, nonceHash]);
      if (reused.rows.length) throw new AppError(409, 'CHANNEL_NONCE_REUSED', 'Nonce already used');
      const existing = await query.query<ReceiptEvent & { payload_checksum: string }>(
        'SELECT payload_checksum,payload,status,aggregate_type,aggregate_id FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source=$3 AND event_type=$4 AND idempotency_key=$5',
        [identity.groupId, identity.empresaId, identity.channel, 'venda.recebida', key]);
      if (existing.rows[0]) {
        if (existing.rows[0].payload_checksum !== hash) throw new AppError(409, 'CHANNEL_IDEMPOTENCY_CONFLICT', 'Key already used for different sale');
        const receipt = await this.validateReceipt(existing.rows[0],envelope.tipo,ctx,query);
        // Consume fresh retry nonces too, atomically with audit; never overwrite the original receipt.
        const nonceEvent = await query.query<{ id: string }>(`INSERT INTO integration_events
          (group_id,empresa_id,source,event_type,idempotency_key,payload,status,schema_version,aggregate_type,aggregate_id,correlation_id)
          VALUES($1,$2,$3,'venda.nonce',$4,$5::jsonb,'processed',1,$6,$7,$8) RETURNING id`,
          [identity.groupId,identity.empresaId,identity.channel,`nonce:v1:${nonceHash}`,JSON.stringify({nonce_hash:nonceHash}),envelope.tipo,receipt.id,requestId]);
        await this.sales.auditRepo.append({...ctx,entity:'IntegracaoEvento',entityId:nonceEvent.rows[0].id,
          action:'create',afterData:{canal:identity.channel,tipo:envelope.tipo,documento_id:receipt.id,replayed:true}},query);
        return { receipt, replayed: true };
      }
      const document = { ...envelope.documento, origem:identity.channel,canal:identity.channel,
        external_id:`omni:v1:${digest(JSON.stringify([...partition,envelope.tipo,envelope.idempotencyKey]))}`,
        idempotency_key:key, itens: envelope.documento.itens.map((item) => ({
        ...item, preco_unitario: '0', desconto: '0',
      })) };
      const created = envelope.tipo === 'Pedido'
        ? await this.sales.pedidoService.create(ctx, document)
        : await this.sales.orcamentoService.create(ctx, document);
      const receipt: SaleReceipt = { id: created.id, tipo: envelope.tipo };
      const result = await query.query<{ id: string }>(
        `INSERT INTO integration_events(group_id,empresa_id,source,event_type,idempotency_key,payload,status,
          schema_version,aggregate_type,aggregate_id,correlation_id,payload_checksum)
         VALUES($1,$2,$3,'venda.recebida',$4,$5::jsonb,'processed',1,$6,$7,$8,$9) RETURNING id`,
        [identity.groupId, identity.empresaId, identity.channel, key, JSON.stringify({ receipt, nonce_hash: nonceHash,client_hash:clientHash(identity) }),
          envelope.tipo, created.id, requestId, hash]);
      await this.sales.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', entityId: result.rows[0].id,
        action: 'create', afterData: { canal: identity.channel, tipo: envelope.tipo, documento_id: created.id,
          schema_version: 1, request_hash: hash } }, query);
      return { receipt, replayed: false };
    });
  }

  async receipt(identity:ChannelIdentity,lookup:ReceiptQuery,requestId:string):Promise<SaleReceipt>;
  async receipt(identity:ChannelIdentity,lookup:ReceiptPageQuery,requestId:string):Promise<ReceiptPage>;
  async receipt(identity:ChannelIdentity,lookup:ReceiptStateQuery,requestId:string):Promise<SaleState>;
  async receipt(identity:ChannelIdentity,lookup:ReceiptQuery|ReceiptPageQuery|ReceiptStateQuery,requestId:string):Promise<SaleReceipt|ReceiptPage|SaleState>;
  async receipt(identity: ChannelIdentity, lookup: ReceiptQuery|ReceiptPageQuery|ReceiptStateQuery, requestId: string) {
    const ctx: RequestContext = { groupId: identity.groupId, empresaId: identity.empresaId,
      actorId: identity.actorId, scopeType: 'empresa', requestId };
    await this.sales.tenantGuard.assertEmpresaInGroup(identity.groupId, identity.empresaId);
    await this.sales.rbacGuard.assertAllowed(ctx, 'Integracoes', 'vendas', 'visualizar', { allowGlobalWildcard: false });
    await this.sales.rbacGuard.assertAllowed(ctx, 'Comercial', lookup.tipo === 'Pedido' ? 'pedido' : 'orcamento', 'visualizar', { allowGlobalWildcard: false });
    return this.db.withTransaction(async (query) => {
      await assertIntegrationEventsReady({...this.db,query:query.query.bind(query)});
      await query.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)", [identity.groupId, identity.empresaId]);
      if(lookup.operation==='receipt-page'){
        const result=await query.query<ReceiptEvent & {id:string;createdAt:string}>(`
          SELECT id,payload,status,aggregate_type,aggregate_id,
            to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
          FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source=$3 AND event_type='venda.recebida'
            AND payload->>'client_hash'=$4 AND aggregate_type=$5
            AND ($6::uuid IS NULL OR (created_at,id)>($7::timestamptz,$6::uuid))
          ORDER BY created_at,id LIMIT $8`,[identity.groupId,identity.empresaId,identity.channel,clientHash(identity),lookup.tipo,
            lookup.cursor?.id??null,lookup.cursor?.createdAt??null,lookup.limit+1]);
        const items=[];
        for(const event of result.rows.slice(0,lookup.limit))items.push({eventId:event.id,
          receipt:await this.validateReceipt(event,lookup.tipo,ctx,query),receivedAt:event.createdAt});
        const hasMore=result.rows.length>lookup.limit,last=items.at(-1);
        await this.sales.auditRepo.append({...ctx,entity:'IntegracaoEvento',action:'read',
          afterData:{operation:'receipt-page',canal:identity.channel,tipo:lookup.tipo,examined:items.length,limit:lookup.limit,hasMore}},query);
        return {tipo:lookup.tipo,items,hasMore,nextCursor:hasMore&&last?{id:last.eventId,createdAt:last.receivedAt}:null};
      }
      const result = await query.query<ReceiptEvent & { id: string }>(
        "SELECT id,payload,status,aggregate_type,aggregate_id FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source=$3 AND event_type='venda.recebida' AND idempotency_key=$4",
        [identity.groupId, identity.empresaId, identity.channel, receiptKey(identity, lookup)]);
      const event = result.rows[0];
      if (!event) throw new AppError(404, 'CHANNEL_RECEIPT_NOT_FOUND', 'Receipt not found');
      const receipt = await this.validateReceipt(event,lookup.tipo,ctx,query);
      if(lookup.operation==='receipt-state'){
        // Services/repositories remain the canonical read model and run in this scoped transaction.
        const document=lookup.tipo==='Pedido'?await this.sales.pedidoService.get(ctx,receipt.id)
          :await this.sales.orcamentoService.get(ctx,receipt.id);
        const state=saleStateSchema.safeParse({id:document.id,tipo:lookup.tipo,status:document.status,updatedAt:document.updated_at});
        if(!state.success||document.id!==receipt.id||document.group_id!==ctx.groupId||document.empresa_id!==ctx.empresaId){
          throw new AppError(500,'CHANNEL_DOCUMENT_STATE_INVALID','Canonical document state integrity failed');
        }
        await this.sales.auditRepo.append({...ctx,entity:'IntegracaoEvento',entityId:event.id,action:'read',
          afterData:{operation:'receipt-state',canal:identity.channel,tipo:lookup.tipo,documento_id:receipt.id,status:state.data.status}},query);
        return state.data;
      }
      await this.sales.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', entityId: event.id,
        action: 'read', afterData: { canal: identity.channel, tipo: lookup.tipo, documento_id: receipt.id } }, query);
      // Receipt confirms ingestion, not current payment, fulfillment or document status.
      return receipt;
    });
  }
}
