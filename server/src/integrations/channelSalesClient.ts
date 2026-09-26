import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { channelIdentitySchema, saleEnvelopeSchema, receiptQuerySchema, signSale,
  type SaleEnvelope, type ReceiptQuery } from './saleIngressContract.js';

const receipt = z.object({ id: z.string().uuid(), tipo: z.enum(['Pedido', 'Orcamento']) }).strict();
const created = z.object({ data: receipt, replayed: z.boolean() }).strict();
const found = z.object({ data: receipt }).strict();
const optionsSchema = channelIdentitySchema.pick({ id: true, secret: true }).extend({
  endpoint: z.string().url(), attempts: z.number().int().min(1).max(3).default(3),
  timeoutMs: z.number().int().min(100).max(30_000).default(10_000),
  allowInsecureLoopback: z.boolean().default(false),
}).strict();

export class ChannelTransportError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super('Channel transport failed'); this.name = 'ChannelTransportError';
  }
}

/** Server-side channel adapter. Never import into a browser/app bundle or give secrets to end users. */
export class ChannelSalesClient {
  private readonly options: z.infer<typeof optionsSchema>;
  private readonly endpoint: string;
  constructor(options: z.input<typeof optionsSchema>, private readonly transport: typeof fetch = fetch,
    private readonly now = Date.now) {
    const parsed = optionsSchema.safeParse(options);
    if (!parsed.success) throw new ChannelTransportError('CHANNEL_CLIENT_CONFIG_INVALID');
    this.options = parsed.data;
    const url = new URL(this.options.endpoint);
    if (url.username || url.password || url.search || url.hash
      || !(url.protocol === 'https:' || (this.options.allowInsecureLoopback && url.protocol === 'http:'
        && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new ChannelTransportError('CHANNEL_CLIENT_CONFIG_INVALID');
    this.endpoint = url.href.replace(/\/$/, '');
  }

  async create(payload: SaleEnvelope): Promise<z.infer<typeof created>> {
    const parsed = saleEnvelopeSchema.safeParse(payload);
    if (!parsed.success) throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
    return this.request('', parsed.data, created);
  }

  async receipt(payload: ReceiptQuery): Promise<z.infer<typeof found>> {
    const parsed = receiptQuerySchema.safeParse(payload);
    if (!parsed.success) throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
    return this.request('/recibos', parsed.data, found);
  }

  private async request<T>(path: string, payload: SaleEnvelope | ReceiptQuery, schema: z.ZodType<T>): Promise<T> {
    // Serialize once: every retry retains exactly the same key and semantic payload.
    const body = Buffer.from(JSON.stringify(payload));
    if (body.length > 128 * 1024) throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
    for (let attempt = 0; attempt < this.options.attempts; attempt++) {
      const timestamp = String(Math.floor(this.now() / 1000));
      const nonce = randomUUID();
      let response: Response;
      try {
        response = await this.transport(this.endpoint + path, { method: 'POST', redirect: 'error',
          signal: AbortSignal.timeout(this.options.timeoutMs),
          headers: { 'content-type': 'application/json', 'x-channel-id': this.options.id,
            'x-channel-timestamp': timestamp, 'x-channel-nonce': nonce,
            'x-channel-signature': signSale(this.options.secret, this.options.id, timestamp, nonce, body) }, body });
        if (response.ok) {
          let decoded: unknown;
          try { decoded = await response.json(); }
          catch { throw new ChannelTransportError('CHANNEL_CLIENT_RESPONSE_INVALID', response.status); }
          const value = schema.safeParse(decoded);
          if (!value.success || (value.data as { data: { tipo: string } }).data.tipo !== payload.tipo) {
            throw new ChannelTransportError('CHANNEL_CLIENT_RESPONSE_INVALID', response.status);
          }
          return value.data;
        }
      } catch (error) {
        if (error instanceof ChannelTransportError) throw error;
        if (attempt + 1 === this.options.attempts) throw new ChannelTransportError('CHANNEL_CLIENT_UNAVAILABLE');
        await this.backoff(attempt); continue;
      }
      // Never replay rejected business/auth/schema requests. Treat transient failures as ambiguous delivery.
      const retryable = response.status >= 500;
      // Do not consume/store/log arbitrary upstream error bodies, including cancellation failures.
      try { await response.body?.cancel(); }
      catch { throw new ChannelTransportError('CHANNEL_CLIENT_UNAVAILABLE'); }
      if (!retryable || attempt + 1 === this.options.attempts) {
        throw new ChannelTransportError('CHANNEL_CLIENT_REJECTED', response.status);
      }
      await this.backoff(attempt);
    }
    throw new ChannelTransportError('CHANNEL_CLIENT_UNAVAILABLE');
  }

  private async backoff(attempt: number) {
    await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
  }
}
