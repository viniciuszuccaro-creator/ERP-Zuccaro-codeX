import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import { orcamentoCreateSchema, orcamentoItemSchema } from '../repositories/orcamentoTypes.js';
import { pedidoCreateSchema } from '../repositories/pedidoTypes.js';

export const channelIdentitySchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  channel: z.enum(['SITE', 'APP', 'CHATBOT', 'MARKETPLACE']),
  groupId: z.string().uuid(), empresaId: z.string().uuid(), actorId: z.string().uuid(),
  secret: z.string().min(32).max(256),
  previousKey: z.object({ secret: z.string().min(32).max(256), validFrom: z.string().datetime(), validUntil: z.string().datetime() }).strict()
    .refine((v) => {
      const duration = Date.parse(v.validUntil)-Date.parse(v.validFrom);
      return duration > 0 && duration <= 86_400_000;
    }, 'Bounded key overlap required').optional(),
}).strict();
export type ChannelIdentity = z.infer<typeof channelIdentitySchema>;
const plainText = (max: number) => z.string().trim().min(1).max(max)
  .refine((v) => !/[<>\u0000-\u001f\u007f]/.test(v), 'Plain text required');
const item = orcamentoItemSchema.omit({ preco_unitario: true, desconto: true }).extend({
  descricao: plainText(240), unidade_sigla: plainText(12),
  quantidade: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).refine((v) => Number(v) > 0),
}).strict();
const items = z.array(item).min(1).max(100);
export const saleEnvelopeSchema = z.discriminatedUnion('tipo', [
  z.object({ version: z.literal(1), tipo: z.literal('Pedido'),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
    documento: pedidoCreateSchema.omit({ itens: true, orcamento_id: true }).extend({ itens: items, observacoes: plainText(1000).optional() }).strict(),
  }).strict(),
  z.object({ version: z.literal(1), tipo: z.literal('Orcamento'),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
    documento: orcamentoCreateSchema.omit({ itens: true }).extend({ itens: items, observacoes: plainText(1000).optional() }).strict(),
  }).strict(),
]);
export type SaleEnvelope = z.infer<typeof saleEnvelopeSchema>;
export const saleReceiptSchema = z.object({ id: z.string().uuid(), tipo: z.enum(['Pedido','Orcamento']) }).strict();
export type SaleReceipt = z.infer<typeof saleReceiptSchema>;
// Operation is signed in the body: a sale signature cannot be replayed as a receipt query.
export const receiptQuerySchema = z.object({ version: z.literal(1), operation: z.literal('receipt'),
  tipo: z.enum(['Pedido', 'Orcamento']), idempotencyKey: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
}).strict();
export type ReceiptQuery = z.infer<typeof receiptQuerySchema>;
const receiptCursor = z.object({ id:z.string().uuid(),createdAt:z.string().datetime() }).strict();
export const receiptPageQuerySchema = z.object({version:z.literal(1),operation:z.literal('receipt-page'),
  tipo:z.enum(['Pedido','Orcamento']),limit:z.number().int().min(1).max(50),cursor:receiptCursor.optional(),
}).strict();
export const receiptReadSchema = z.discriminatedUnion('operation',[receiptQuerySchema,receiptPageQuerySchema]);
export type ReceiptPageQuery = z.infer<typeof receiptPageQuerySchema>;
export const receiptPageSchema = z.object({tipo:z.enum(['Pedido','Orcamento']),
  items:z.array(z.object({eventId:z.string().uuid(),receipt:saleReceiptSchema,receivedAt:z.string().datetime()}).strict()).max(50),
  hasMore:z.boolean(),nextCursor:receiptCursor.nullable(),
}).strict().refine(p=>p.items.every(i=>i.receipt.tipo===p.tipo)&&p.hasMore===(p.nextCursor!==null)
  &&(!p.hasMore||(p.items.length>0&&p.nextCursor?.id===p.items.at(-1)?.eventId&&p.nextCursor?.createdAt===p.items.at(-1)?.receivedAt)));
export type ReceiptPage = z.infer<typeof receiptPageSchema>;
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function signSale(secret: string, client: string, timestamp: string, nonce: string, body: Buffer): string {
  return createHmac('sha256', secret).update(`${client}.${timestamp}.${nonce}.`).update(body).digest('hex');
}
export function verifySale(identity: ChannelIdentity, timestamp: string, nonce: string, signature: string, body: Buffer, now: number) {
  if (!/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300_000
    || !/^[a-zA-Z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) {
    throw new AppError(401, 'CHANNEL_AUTH_INVALID', 'Invalid channel authentication');
  }
  const expected = signSale(identity.secret, identity.id, timestamp, nonce, body);
  const currentMatches = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  const previous = identity.previousKey;
  const signedAt = Number(timestamp)*1000;
  const overlapActive = previous && now >= Date.parse(previous.validFrom) && now < Date.parse(previous.validUntil)
    && signedAt >= Date.parse(previous.validFrom) && signedAt < Date.parse(previous.validUntil);
  const previousMatches = overlapActive
    ? timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signSale(previous.secret,identity.id,timestamp,nonce,body),'hex')) : false;
  if (!currentMatches && !previousMatches) {
    throw new AppError(401, 'CHANNEL_AUTH_INVALID', 'Invalid channel authentication');
  }
}
