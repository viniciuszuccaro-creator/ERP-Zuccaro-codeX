import { z } from 'zod';
import type { RequestContext } from '../audit/types.js';
import { CatalogOutbox, type ReconciliationState } from './catalogOutbox.js';
import { digest } from './saleIngressContract.js';

export type CatalogObserver = { probe(input: { eventId: string; key: string }, signal: AbortSignal): Promise<unknown> };
const receipt = z.object({ eventId: z.string().uuid(), key: z.string().min(1).max(512) }).strict();

/** Compares published signal ACKs; does not claim to reconcile product/media/price/stock projections. */
export class CatalogReconciliation {
  constructor(private readonly outbox: CatalogOutbox, private readonly observerId: string, private readonly observer: CatalogObserver) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(observerId)) throw new Error('Invalid observer identity');
  }
  async runPage(ctx: RequestContext, scanKey: string, limit = 20, cursor?: { id: string; createdAt: string }) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(scanKey)) throw new Error('Invalid scan key');
    const page = await this.outbox.publishedPage(ctx, limit, cursor);
    const counts = { examined: page.items.length, CONSISTENT: 0, MISSING: 0, CONFLICT: 0, UNAVAILABLE: 0 };
    for (const source of page.items) {
      let state: ReconciliationState; let observedHash: string | null = null;
      const abort = new AbortController(); let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const observed = await Promise.race([
          this.observer.probe({ eventId: source.id, key: source.key }, abort.signal),
          new Promise<never>((_resolve,reject) => { timeout = setTimeout(() => { abort.abort(); reject(new Error('Observer timeout')); }, 5_000); }),
        ]);
        if (observed === null) state = 'MISSING';
        else {
          const parsed = receipt.safeParse(observed);
          if (!parsed.success) state = 'CONFLICT';
          else {
            observedHash = digest(JSON.stringify(parsed.data));
            state = parsed.data.eventId === source.id && parsed.data.key === source.key ? 'CONSISTENT' : 'CONFLICT';
          }
        }
      } catch { state = 'UNAVAILABLE'; }
      finally { clearTimeout(timeout); }
      // Persistence/audit errors propagate. Probe failures become explicit observations, never false consistency.
      await this.outbox.recordReconciliation(ctx, source, this.observerId, scanKey, state, observedHash);
      counts[state]++;
    }
    return { counts, hasMore: page.hasMore, nextCursor: page.nextCursor, scope: 'PAGE', correctionApplied: false };
  }
}
