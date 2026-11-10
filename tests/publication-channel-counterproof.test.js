import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { clienteContatosBaseline, clienteContatosHunks, clienteContatosRemainder } from './helpers/clienteContatosRemainder.js';
import { fornecedorHttpRemainder } from './helpers/fornecedorHttpRemainder.js';
import { consolidation81Remainder } from './helpers/consolidation81Remainder.js';
import { clienteConferenciaHunks, clienteConferenciaRemainder, clienteSelectedReferenceHunks, clienteSelectedReferenceRemainder, clienteConferenciaHistoricalRemainder } from './helpers/consolidation81Remainder.js';

for (const [file, entry] of Object.entries(clienteConferenciaHunks)) {
  test(file + ': channel normalization refuses changed, repeated and out-of-scope bytes', () => {
    const composedSource = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    assert.doesNotThrow(() => clienteConferenciaRemainder(file, composedSource));
    assert.throws(() => clienteConferenciaRemainder(file, composedSource + '\n// SYNTHETIC_UNAPPROVED_CHANGE\n'));
    const source = clienteSelectedReferenceRemainder(file, composedSource);
    assert.doesNotThrow(() => clienteConferenciaHistoricalRemainder(file, source));
    assert.throws(() => clienteConferenciaHistoricalRemainder(file, source + '\n// SYNTHETIC_UNAPPROVED_CHANGE\n'));
    for (const [after] of entry.hunks) {
      assert.equal(source.split(after).length, 2);
      const midpoint = Math.floor(after.length / 2);
      const changed = after.slice(0, midpoint) + ' ' + after.slice(midpoint);
      assert.notEqual(changed, after);
      assert.throws(() => clienteConferenciaHistoricalRemainder(file, source.replace(after, () => changed)));
      assert.throws(() => clienteConferenciaHistoricalRemainder(file, source + after));
    }
  });
}

for (const [file, entry] of Object.entries(clienteSelectedReferenceHunks)) {
  test(file + ': selected-reference composition refuses changed, omitted and repeated hunks', () => {
    const source = clienteContatosRemainder(file, fs.readFileSync(file, 'utf8')).replace(/\r\n/g, '\n');
    assert.doesNotThrow(() => clienteConferenciaRemainder(file, source));
    for (const [after] of entry.hunks) {
      assert.equal(source.split(after).length, 2);
      const midpoint = Math.floor(after.length / 2);
      const changed = after.slice(0, midpoint) + ' ' + after.slice(midpoint);
      const mutated = source.replace(after, () => changed);
      assert.notEqual(mutated, source);
      assert.throws(() => clienteConferenciaRemainder(file, mutated));
      assert.throws(() => clienteConferenciaRemainder(file, source.replace(after, () => '')));
      assert.throws(() => clienteConferenciaRemainder(file, source + after));
    }
  });
}

const sha = text => createHash('sha256').update(text).digest('hex');
test('contacts helper: entire reviewed source is pinned, not just matching declarations', () => {
  const source = fs.readFileSync(new URL('./helpers/clienteContatosRemainder.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const expected = '6bf7eca1801d8caaf1eb9f70973aad0a325f0342f6e4a838f5500d9a9ab2cc7f';
  const verify = text => assert.equal(sha(text), expected);
  verify(source);
  for (const changed of [source + '\n// SYNTHETIC_OUTSIDE\n', '', source + source,
    source.replace('assert.equal(source.split(after).length, 2', 'assert.equal(source.split(after).length, 3')]) {
    assert.notEqual(changed, source);
    assert.throws(() => verify(changed));
  }
});
for (const [file, entry] of Object.entries(clienteContatosHunks)) {
  test(file + ': exact contacts peel preserves full 0bb7313c and ancestor pins', () => {
    const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const baseline = execFileSync('git', ['show', clienteContatosBaseline + ':' + file], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
    assert.equal(sha(baseline), entry.hash);
    assert.equal(clienteContatosRemainder(file, source), baseline);
    assert.equal(clienteContatosRemainder(file, baseline), baseline);
    assert.equal(clienteContatosRemainder(file, source.replace(/\n/g, '\r\n')).replace(/\r\n/g, '\n'), baseline);
    assert.equal(clienteConferenciaRemainder(file, source), clienteConferenciaRemainder(file, baseline));
    assert.equal(clienteSelectedReferenceRemainder(file, source), clienteSelectedReferenceRemainder(file, baseline));
    assert.equal(consolidation81Remainder(file, source, false), consolidation81Remainder(file, baseline, false));
    assert.equal(clienteConferenciaHistoricalRemainder(file, source), clienteConferenciaHistoricalRemainder(file, baseline));
    const reject = mutation => {
      assert.notEqual(mutation, source);
      for (const peel of [clienteContatosRemainder, fornecedorHttpRemainder, clienteSelectedReferenceRemainder,
        clienteConferenciaRemainder, clienteConferenciaHistoricalRemainder,
        (path, text) => consolidation81Remainder(path, text, false)]) {
        assert.throws(() => peel(file, mutation), file + ': reject unauthorized contacts delta');
      }
    };
    reject(source + '\n// SYNTHETIC_OUTSIDE_CONTACTS\n');
    reject(source.replace(/class /, 'class /* SYNTHETIC_OUTSIDE */ '));
    for (const [after] of entry.hunks) {
      assert.equal(source.split(after).length, 2);
      reject(source.replace(after, ''));
      reject(source + after);
      const midpoint = Math.floor(after.length / 2);
      reject(source.replace(after, () => after.slice(0, midpoint) + ' ' + after.slice(midpoint)));
    }
  });
}
