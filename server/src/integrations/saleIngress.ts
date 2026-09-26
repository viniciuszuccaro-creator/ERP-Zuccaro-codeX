import type { DbClient } from '../db/client.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { PedidoService } from '../services/pedidoService.js';
import type { OrcamentoService } from '../services/orcamentoService.js';
import { AppError } from '../api/errors.js';
import { digest, type ChannelIdentity, type SaleEnvelope, type ReceiptQuery } from './saleIngressContract.js';

type CanonicalSales = {
  pedidoService: Pick<PedidoService, 'create'>;
  orcamentoService: Pick<OrcamentoService, 'create'>;
  auditRepo: AuditRepository; tenantGuard: TenantGuard; rbacGuard: RbacGuard;
};
export type SaleReceipt = { id: string; tipo: 'Pedido' | 'Orcamento' };
const receiptKey = (identity: ChannelIdentity, envelope: Pick<SaleEnvelope, 'tipo' | 'idempotencyKey'>) =>
  `sale:v1:${digest(JSON.stringify([identity.groupId, identity.empresaId, identity.id, identity.channel, envelope.tipo, envelope.idempotencyKey]))}`;

/** Transport adapter; commercial validations, pricing and writes stay in the canonical services. */
export class SaleIngress {
  constructor(private readonly db: DbClient, private readonly sales: CanonicalSales) {}

  async assertDatabaseReady() {
    const result = await this.db.query<{ ready: boolean }>(`SELECT (c.relrowsecurity AND c.relforcerowsecurity
      AND EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='integration_events_scope')) AS ready
      FROM pg_class c WHERE c.oid=to_regclass('integration_events')`);
    if (result.rows[0]?.ready !== true) throw new Error('Omnichannel RLS gate not satisfied');
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
      await query.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",
        [identity.groupId, identity.empresaId]);
      // Serialize by nonce first, then receipt key, preventing conflicting concurrent deliveries.
      for (const lock of [nonceHash, key]) await query.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lock]);
      const existing = await query.query<{ payload_checksum: string; payload: { receipt: SaleReceipt } }>(
        'SELECT payload_checksum,payload FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source=$3 AND event_type=$4 AND idempotency_key=$5',
        [identity.groupId, identity.empresaId, identity.channel, 'venda.recebida', key]);
      if (existing.rows[0]) {
        if (existing.rows[0].payload_checksum !== hash) throw new AppError(409, 'CHANNEL_IDEMPOTENCY_CONFLICT', 'Key already used for different sale');
        return { receipt: existing.rows[0].payload.receipt, replayed: true };
      }
      const reused = await query.query(
        "SELECT id FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source=$3 AND event_type='venda.recebida' AND payload->>'nonce_hash'=$4 LIMIT 1",
        [identity.groupId, identity.empresaId, identity.channel, nonceHash]);
      if (reused.rows.length) throw new AppError(409, 'CHANNEL_NONCE_REUSED', 'Nonce already used');
      const document = { ...envelope.documento, itens: envelope.documento.itens.map((item) => ({
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
        [identity.groupId, identity.empresaId, identity.channel, key, JSON.stringify({ receipt, nonce_hash: nonceHash }),
          envelope.tipo, created.id, requestId, hash]);
      await this.sales.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', entityId: result.rows[0].id,
        action: 'create', afterData: { canal: identity.channel, tipo: envelope.tipo, documento_id: created.id,
          schema_version: 1, request_hash: hash } }, query);
      return { receipt, replayed: false };
    });
  }

  async receipt(identity: ChannelIdentity, lookup: ReceiptQuery, requestId: string) {
    const ctx: RequestContext = { groupId: identity.groupId, empresaId: identity.empresaId,
      actorId: identity.actorId, scopeType: 'empresa', requestId };
    await this.sales.tenantGuard.assertEmpresaInGroup(identity.groupId, identity.empresaId);
    await this.sales.rbacGuard.assertAllowed(ctx, 'Integracoes', 'vendas', 'visualizar', { allowGlobalWildcard: false });
    await this.sales.rbacGuard.assertAllowed(ctx, 'Comercial', lookup.tipo === 'Pedido' ? 'pedido' : 'orcamento', 'visualizar', { allowGlobalWildcard: false });
    return this.db.withTransaction(async (query) => {
      await query.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)", [identity.groupId, identity.empresaId]);
      const result = await query.query<{ id: string; payload: { receipt: SaleReceipt } }>(
        "SELECT id,payload FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source=$3 AND event_type='venda.recebida' AND idempotency_key=$4 AND status='processed'",
        [identity.groupId, identity.empresaId, identity.channel, receiptKey(identity, lookup)]);
      const event = result.rows[0];
      if (!event) throw new AppError(404, 'CHANNEL_RECEIPT_NOT_FOUND', 'Receipt not found');
      await this.sales.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', entityId: event.id,
        action: 'read', afterData: { canal: identity.channel, tipo: lookup.tipo, documento_id: event.payload.receipt.id } }, query);
      // Receipt confirms ingestion, not current payment, fulfillment or document status.
      return event.payload.receipt;
    });
  }
}
