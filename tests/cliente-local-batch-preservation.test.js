import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { clienteLocalBatchRemainder, localBatchRoutesHunk } from './helpers/clienteLocalBatchRemainder.js';
import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';

test('local batch preserves entire prior router and historical guard comparisons', () => {
  const file = 'server/src/api/router.ts';
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const previous = execFileSync('git', ['show', `cbafa81b:${file}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  assert.equal(clienteLocalBatchRemainder(file, source, true), previous);
  assert.doesNotThrow(() => clienteConferenciaRemainder(file, source));
  for (const changed of [source + '\n// OUTSIDE_CHANGE\n',
    source.replace('requireTenantScope, async (req', 'async (req'),
    source.replace('service.sync(', 'service.create('),
    source.replace(localBatchRoutesHunk, ''),
    source + localBatchRoutesHunk,
    source.replace('req.body));', 'req.query));')]) {
    assert.throws(() => clienteLocalBatchRemainder(file, changed, true));
  }
});
