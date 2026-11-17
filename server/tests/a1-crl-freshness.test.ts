import test from 'node:test';
import assert from 'node:assert/strict';
import {assertA1CrlFreshness} from '../src/services/a1CertificateValidation.ts';
import type {A1CertificateValidation} from '../src/services/a1CertificateValidation.ts';
test('root CRL publication interval never waives expiry, issuer role or recent snapshot',()=>{
 const day=86400000,now=Date.parse('2026-11-17T12:00:00Z');
 const trust={maxCrlAgeMs:7*day,retrievedAt:new Date(now-3600000).toISOString(),maxSnapshotAgeMs:day} as A1CertificateValidation['trust'];
 assert.doesNotThrow(()=>assertA1CrlFreshness(now-30*day,now+60*day,now,true,trust));
 for(const args of [
  [now-30*day,now+60*day,now,false,trust],
  [now-30*day,now+61*day,now,true,trust],
  [now-day,now,now,true,trust],
  [now+1,now+day,now,true,trust],
  [now-30*day,now+day,now,true,{...trust,retrievedAt:new Date(now-2*day).toISOString()}],
  [now-30*day,now+day,now,true,{...trust,retrievedAt:undefined}],
  [now-30*day,now+day,now,true,{...trust,retrievedAt:new Date(now+1).toISOString()}],
 ] as Parameters<typeof assertA1CrlFreshness>[]){assert.throws(()=>assertA1CrlFreshness(...args),{code:'A1_TRUST_UNAVAILABLE'});}
});
