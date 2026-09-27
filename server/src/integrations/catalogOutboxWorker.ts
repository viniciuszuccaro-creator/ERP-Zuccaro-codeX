import type { RequestContext } from '../audit/types.js';
import { CatalogOutbox, catalogSignalSchema } from './catalogOutbox.js';

export type CatalogPublisher = {
  publish(input: { eventId: string; key: string; schemaVersion: 1; produtoId: string; codigo: string | null },
    signal: AbortSignal): Promise<{ eventId: string; key: string }>;
};

/** Explicitly injected publisher; no default provider, timer, credentials or automatic bootstrap. */
export class CatalogOutboxWorker {
  constructor(private readonly outbox: CatalogOutbox, private readonly publisher: CatalogPublisher) {}
  async runOnce(ctx: RequestContext, limit = 10, signal?: AbortSignal) {
    // Limit counts examined events, including audited discards. Never scan an unbounded poisoned queue.
    // Claim one at a time: leases for later rows cannot expire while earlier network requests run.
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid worker limit');
    if(signal!==undefined&&!(signal instanceof AbortSignal))throw new Error('Invalid worker signal');
    const counts = { published: 0, retry: 0, dead_letter: 0 };
    for (let i = 0; i < limit; i++) {
      if(signal?.aborted)break;
      const claimed = await this.outbox.claimWithOutcomes(ctx, 1, 30);
      counts.dead_letter += claimed.discarded;
      const [lease] = claimed.leases;
      if (!lease) {
        if (claimed.discarded) continue;
        break;
      }
      if(signal?.aborted){
        const final=await this.outbox.finish(ctx,lease,{status:'retry',code:'CATALOG_RUN_INTERRUPTED'});
        counts[final]++;break;
      }
      const payload = catalogSignalSchema.safeParse(lease.payload);
      if (!payload.success || payload.data.produtoId !== lease.produtoId) {
        await this.outbox.finish(ctx, lease, { status: 'dead_letter', code: 'CATALOG_PAYLOAD_INVALID' }); counts.dead_letter++; continue;
      }
      const publishable=await this.outbox.isPublishable(ctx, lease, payload.data.codigo);
      if(signal?.aborted){
        const final=await this.outbox.finish(ctx,lease,{status:'retry',code:'CATALOG_RUN_INTERRUPTED'});
        counts[final]++;break;
      }
      if (!publishable) {
        await this.outbox.finish(ctx, lease, { status: 'dead_letter', code: 'CATALOG_SOURCE_CHANGED' }); counts.dead_letter++; continue;
      }
      let outcome: { status: 'published' } | { status: 'retry' | 'dead_letter'; code: string };
      try {
        const abort = new AbortController();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let stop:()=>void=()=>{};
        const interrupted=new Promise<never>((_resolve,reject)=>{
          stop=()=>{reject(new Error('Catalog run interrupted'));abort.abort();};
          signal?.addEventListener('abort',stop,{once:true});
          if(signal?.aborted)stop();
        });
        try {
          const receipt = await Promise.race([
            Promise.resolve().then(()=>{
              if(signal?.aborted)throw new Error('Catalog run interrupted');
              return this.publisher.publish({ eventId: lease.id, key: lease.key, schemaVersion: 1,
                produtoId: payload.data.produtoId, codigo: payload.data.codigo }, abort.signal);
            }),
            new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => { abort.abort(); reject(new Error('Publisher timeout')); }, 10_000); }),
            interrupted,
          ]);
          if(signal?.aborted)throw new Error('Catalog run interrupted');
          outcome = receipt.eventId === lease.id && receipt.key === lease.key
            ? { status: 'published' } : { status: 'dead_letter', code: 'CATALOG_RECEIPT_INVALID' };
        } finally { clearTimeout(timeout);signal?.removeEventListener('abort',stop);abort.abort(); }
      } catch { outcome = { status: 'retry', code: signal?.aborted?'CATALOG_RUN_INTERRUPTED':'CATALOG_PROVIDER_UNAVAILABLE' }; }
      // Never catch/convert DB or audit failure into provider failure. A late ACK cannot release stale lease.
      const final = await this.outbox.finish(ctx, lease, outcome);
      counts[final]++;
      if(signal?.aborted)break;
    }
    return counts;
  }
}
