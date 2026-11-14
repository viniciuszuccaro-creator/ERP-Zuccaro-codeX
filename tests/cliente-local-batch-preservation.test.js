import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { clienteLocalBatchRemainder, localBatchRoutesHunk } from './helpers/clienteLocalBatchRemainder.js';
import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';
import { clienteLocalOperationalRemainder } from './helpers/clienteLocalOperationalRemainder.js';

test('address review PostgreSQL suite is wired to the required database and rejects skipped runs', () => {
  const runner = readFileSync('server/scripts/runPostgresTests.mjs', 'utf8');
  assert.match(runner, /\['LEGACY_ADDRESS_REVIEW', 'tests\/legacy-address-postgres\.test\.ts'\]/);
  assert.match(runner, /label === 'LEGACY_ADDRESS_REVIEW' \? \{ LEGACY_ADDRESS_PG_TEST_URL: process\.env\.DATABASE_URL \}/);
  assert.match(runner, /result\.status !== 0 \|\| total < 1 \|\| skipped > 0/);
});

test('local batch preserves entire prior router and historical guard comparisons', () => {
  const file = 'server/src/api/router.ts';
  const source = clienteLocalOperationalRemainder(file, readFileSync(file, 'utf8')).replace(/\r\n/g, '\n');
  const previous = execFileSync('git', ['show', `64f0dcf2:${file}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  assert.equal(clienteLocalBatchRemainder(file, source, true), previous);
  assert.doesNotThrow(() => clienteConferenciaRemainder(file, source));
  for (const changed of [source + '\n// OUTSIDE_CHANGE\n',
    source.replace('req.query.cliente_id : undefined', 'req.query.cliente_id : "FORGED"'),
    source.replace('requireTenantScope, async (req', 'async (req'),
    source.replace('service.sync(', 'service.create('),
    source.replace(localBatchRoutesHunk, ''),
    source + localBatchRoutesHunk,
    source.replace('req.body));', 'req.query));')]) {
    assert.throws(() => clienteLocalBatchRemainder(file, changed, true));
  }
});

test('operational address wiring peels only exact additions and retains every ancestral byte', () => {
  for (const file of ['server/src/api/router.ts', 'src/api/httpApiClient.js']) {
    const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const previous = execFileSync('git', ['show', `84f820d823e87499b0037b0ea2c75e508369afaf:${file}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
    assert.equal(clienteLocalOperationalRemainder(file, source), previous);
    assert.equal(clienteLocalOperationalRemainder(file, previous), previous);
    assert.notEqual(clienteLocalOperationalRemainder(file, source + '\n// OUTSIDE\n'), previous);
    const marker = file.endsWith('router.ts') ? "req.query.include_review === 'true'" : 'createClienteLocalBatchHttpApi({ request, getScope, createHttpError })';
    const forged = source.replace(marker, marker + ' + FORGED');
    assert.throws(() => file.endsWith('router.ts')
      ? clienteLocalBatchRemainder(file, forged, true)
      : clienteConferenciaRemainder(file, forged));
  }
});
