import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { channelIdentitySchema, saleEnvelopeSchema, receiptReadSchema, receiptPageSchema, saleReceiptSchema, saleStateSchema, signSale,
  type SaleEnvelope, type ReceiptQuery, type ReceiptPageQuery, type ReceiptStateQuery } from './saleIngressContract.js';

const created = z.object({ data: saleReceiptSchema, replayed: z.boolean() }).strict();
const found = z.object({ data: saleReceiptSchema }).strict();
const paged = z.object({ data:receiptPageSchema }).strict();
const state = z.object({data:saleStateSchema}).strict();
const batchSchema = z.object({ operation: z.literal('sale-batch'), items: z.array(saleEnvelopeSchema).min(1).max(25) }).strict();
export type SaleBatch = z.infer<typeof batchSchema>;
export type SaleBatchResult = { items: Array<
  | { index: number; state: 'CONFIRMED'; result: z.infer<typeof created> }
  | { index: number; state: 'UNCONFIRMED'; code: string; status?: number }
  | { index: number; state: 'NOT_SENT' }
> };
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

  async create(payload: SaleEnvelope): Promise<z.infer<typeof created>>;
  async create(payload: SaleBatch): Promise<SaleBatchResult>;
  async create(payload: SaleEnvelope | SaleBatch): Promise<z.infer<typeof created> | SaleBatchResult> {
    if (payload && typeof payload === 'object' && 'operation' in payload && payload.operation === 'sale-batch') return this.createBatch(payload);
    const parsed = saleEnvelopeSchema.safeParse(payload);
    if (!parsed.success) throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
    return this.request('', parsed.data, created);
  }

  /** Each sale retains its canonical transaction. Stop on uncertainty; never roll back prior receipts. */
  private async createBatch(payload: SaleBatch): Promise<SaleBatchResult> {
    const parsed = batchSchema.safeParse(payload);
    if (!parsed.success) throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
    // Validate and snapshot the entire queue before its first side effect. No browser/local persistence here.
    const keys = new Set<string>(); let bytes = 0;
    for (const item of parsed.data.items) {
      const key = JSON.stringify([item.tipo, item.idempotencyKey]);
      const size = Buffer.byteLength(JSON.stringify(item)); bytes += size;
      if (keys.has(key) || size > 128 * 1024 || bytes > 1024 * 1024) {
        throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
      }
      keys.add(key);
    }
    const items: SaleBatchResult['items'] = []; let stopped = false;
    for (const [index, item] of parsed.data.items.entries()) {
      if (stopped) { items.push({ index, state: 'NOT_SENT' }); continue; }
      try { items.push({ index, state: 'CONFIRMED', result: await this.request('', item, created) }); }
      catch (error) {
        if (!(error instanceof ChannelTransportError)) throw error;
        // Even a final 4xx can follow an earlier ambiguous retry that committed. Never infer rejection.
        items.push({ index, state: 'UNCONFIRMED', code: error.code, ...(error.status ? { status: error.status } : {}) });
        stopped = true;
      }
    }
    return { items };
  }

  async receipt(payload:ReceiptQuery):Promise<z.infer<typeof found>>;
  async receipt(payload:ReceiptPageQuery):Promise<z.infer<typeof paged>>;
  async receipt(payload:ReceiptStateQuery):Promise<z.infer<typeof state>>;
  async receipt(payload: ReceiptQuery|ReceiptPageQuery|ReceiptStateQuery): Promise<z.infer<typeof found>|z.infer<typeof paged>|z.infer<typeof state>> {
    const parsed = receiptReadSchema.safeParse(payload);
    if (!parsed.success) throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
    if(parsed.data.operation==='receipt-page')return this.request('/recibos',parsed.data,paged);
    if(parsed.data.operation==='receipt-state')return this.request('/recibos',parsed.data,state);
    return this.request('/recibos',parsed.data,found);
  }

  private async request<T>(path: string, payload: SaleEnvelope | ReceiptQuery | ReceiptPageQuery | ReceiptStateQuery, schema: z.ZodType<T>): Promise<T> {
    // Serialize once: every retry retains exactly the same key and semantic payload.
    const body = Buffer.from(JSON.stringify(payload));
    if (body.length > 128 * 1024) throw new ChannelTransportError('CHANNEL_CLIENT_PAYLOAD_INVALID');
    for (let attempt = 0; attempt < this.options.attempts; attempt++) {
      const timestamp = String(Math.floor(this.now() / 1000));
      const nonce = randomUUID();
      let result: { value: T } | { status: number };
      try {
        result = await this.exchange(path, body, timestamp, nonce, schema, payload.tipo);
        if ('value' in result) return result.value;
      } catch (error) {
        if (error instanceof ChannelTransportError) throw error;
        if (attempt + 1 === this.options.attempts) throw new ChannelTransportError('CHANNEL_CLIENT_UNAVAILABLE');
        await this.backoff(attempt); continue;
      }
      // Never replay rejected business/auth/schema requests. Treat transient failures as ambiguous delivery.
      if (result.status < 500 || attempt + 1 === this.options.attempts) {
        throw new ChannelTransportError('CHANNEL_CLIENT_REJECTED', result.status);
      }
      await this.backoff(attempt);
    }
    throw new ChannelTransportError('CHANNEL_CLIENT_UNAVAILABLE');
  }

  /** One deadline covers fetch, body read and error-body cancellation, even for injected transports. */
  private async exchange<T>(path: string, body: Buffer<ArrayBuffer>, timestamp: string, nonce: string,
    schema: z.ZodType<T>, tipo: string): Promise<{ value: T } | { status: number }> {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error('Channel deadline')); abort.abort(); }, this.options.timeoutMs);
    });
    const operation = async (): Promise<{ value: T } | { status: number }> => {
      const response = await this.transport(this.endpoint + path, { method: 'POST', redirect: 'error', signal: abort.signal,
          headers: { 'content-type': 'application/json', 'x-channel-id': this.options.id,
            'x-channel-timestamp': timestamp, 'x-channel-nonce': nonce,
            'x-channel-signature': signSale(this.options.secret, this.options.id, timestamp, nonce, body) }, body });
      if (abort.signal.aborted) {
        void response.body?.cancel().catch(() => {});
        throw new Error('Channel deadline');
      }
      // Do not consume/store/log arbitrary upstream error bodies, including cancellation failures.
      if (!response.ok) {
        try { await response.body?.cancel(); }
        catch { throw new ChannelTransportError('CHANNEL_CLIENT_UNAVAILABLE'); }
        return { status: response.status };
      }
      const decoded = await this.decode(response, abort.signal);
      const value = schema.safeParse(decoded);
      if (!value.success || (value.data as { data: { tipo: string } }).data.tipo !== tipo) {
        throw new ChannelTransportError('CHANNEL_CLIENT_RESPONSE_INVALID', response.status);
      }
      return { value: value.data };
    };
    try { return await Promise.race([operation(), deadline]); }
    finally { clearTimeout(timer); abort.abort(); }
  }

  /** Receipts contain identifiers only; never buffer an arbitrary upstream response. */
  private async decode(response: Response, signal: AbortSignal): Promise<unknown> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancel = () => { void reader?.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      reader = response.body?.getReader();
      const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > 16 * 1024)) throw new Error('Response bound');
      if (!reader) throw new Error('Missing response');
      const chunks: Uint8Array[] = []; let bytes = 0;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 16 * 1024) throw new Error('Response bound');
        chunks.push(chunk.value);
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch {
      cancel();
      throw new ChannelTransportError('CHANNEL_CLIENT_RESPONSE_INVALID', response.status);
    } finally { signal.removeEventListener('abort', cancel); reader?.releaseLock(); }
  }

  private async backoff(attempt: number) {
    await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
  }
}
