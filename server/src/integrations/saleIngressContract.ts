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
// Operation is signed in the body: a sale signature cannot be replayed as a receipt query.
export const receiptQuerySchema = z.object({ version: z.literal(1), operation: z.literal('receipt'),
  tipo: z.enum(['Pedido', 'Orcamento']), idempotencyKey: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
}).strict();
export type ReceiptQuery = z.infer<typeof receiptQuerySchema>;
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
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new AppError(401, 'CHANNEL_AUTH_INVALID', 'Invalid channel authentication');
  }
}
