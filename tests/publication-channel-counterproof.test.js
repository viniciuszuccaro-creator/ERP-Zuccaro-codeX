import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
    const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
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
