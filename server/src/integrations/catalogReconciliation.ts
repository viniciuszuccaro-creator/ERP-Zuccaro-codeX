import { z } from 'zod';
import type { RequestContext } from '../audit/types.js';
import { CatalogOutbox, type ReconciliationState } from './catalogOutbox.js';
import { digest } from './saleIngressContract.js';

export type CatalogObserver = { probe(input: { eventId: string; key: string }, signal: AbortSignal): Promise<unknown> };
const receipt = z.object({ eventId: z.string().uuid(), key: z.string().min(1).max(512) }).strict();
const scanOptions=z.object({maxPages:z.number().int().min(1).max(25),signal:z.instanceof(AbortSignal).optional()}).strict();
export type CatalogScanOptions=z.input<typeof scanOptions>;

/** Compares published signal ACKs; does not claim to reconcile product/media/price/stock projections. */
export class CatalogReconciliation {
  constructor(private readonly outbox: CatalogOutbox, private readonly observerId: string, private readonly observer: CatalogObserver) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(observerId)) throw new Error('Invalid observer identity');
  }
  async runPage(ctx: RequestContext, scanKey: string, limit = 20, cursor?: { id: string; createdAt: string },options?:CatalogScanOptions) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(scanKey)) throw new Error('Invalid scan key');
    const parsed=options===undefined?undefined:scanOptions.safeParse(options);
    if(parsed&&!parsed.success)throw new Error('Invalid bounded scan options');
    const settings=parsed?.success?parsed.data:undefined;
    const counts={examined:0,CONSISTENT:0,MISSING:0,CONFLICT:0,UNAVAILABLE:0};
    let nextCursor=cursor??null,hasMore=false,interrupted=false,pagesRead=0;
    for(let i=0;i<(settings?.maxPages??1);i++){
      const page=await this.runSinglePage(ctx,scanKey,limit,nextCursor??undefined,settings?.signal);
      pagesRead++;for(const key of Object.keys(counts) as Array<keyof typeof counts>)counts[key]+=page.counts[key];
      nextCursor=page.nextCursor;hasMore=page.hasMore;interrupted=page.interrupted;
      if(!hasMore||interrupted)break;
    }
    return {counts,hasMore,nextCursor,scope:settings?'BATCH':'PAGE',correctionApplied:false,
      ...(settings?{pagesRead,interrupted}: {})};
  }

  private async runSinglePage(ctx:RequestContext,scanKey:string,limit:number,cursor?:{id:string;createdAt:string},signal?:AbortSignal){
    const page = await this.outbox.publishedPage(ctx, limit, cursor);
    const counts = { examined: 0, CONSISTENT: 0, MISSING: 0, CONFLICT: 0, UNAVAILABLE: 0 };
    let last=cursor??null;
    for (const source of page.items) {
      if(signal?.aborted)break;
      let state: ReconciliationState; let observedHash: string | null = null;
      const abort = new AbortController(); let timeout: ReturnType<typeof setTimeout> | undefined;
      let stop:()=>void=()=>{};
      const interrupted=new Promise<never>((_resolve,reject)=>{
        stop=()=>{reject(new Error('Scan interrupted'));abort.abort();};
        signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
      });
      try {
        const observed = await Promise.race([
          Promise.resolve().then(()=>{if(signal?.aborted)throw new Error('Scan interrupted');
            return this.observer.probe({ eventId: source.id, key: source.key }, abort.signal);}),
          new Promise<never>((_resolve,reject) => { timeout = setTimeout(() => { abort.abort(); reject(new Error('Observer timeout')); }, 5_000); }),
          interrupted,
        ]);
        if(signal?.aborted)break;
        if (observed === null) state = 'MISSING';
        else {
          const parsed = receipt.safeParse(observed);
          if (!parsed.success) state = 'CONFLICT';
          else {
            observedHash = digest(JSON.stringify(parsed.data));
            state = parsed.data.eventId === source.id && parsed.data.key === source.key ? 'CONSISTENT' : 'CONFLICT';
          }
        }
      } catch { if(signal?.aborted)break;state = 'UNAVAILABLE'; }
      finally { clearTimeout(timeout);signal?.removeEventListener('abort',stop);abort.abort(); }
      // Persistence/audit errors propagate. Probe failures become explicit observations, never false consistency.
      await this.outbox.recordReconciliation(ctx, source, this.observerId, scanKey, state, observedHash);
      counts[state]++;counts.examined++;last={id:source.id,createdAt:source.createdAt};
    }
    const hasMore=counts.examined<page.items.length||page.hasMore;
    return {counts,hasMore,nextCursor:hasMore?last:null,interrupted:signal?.aborted===true};
  }
}
