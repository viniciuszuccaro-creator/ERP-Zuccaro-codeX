import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clienteConferenciaHunks, clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';

for (const [file, entry] of Object.entries(clienteConferenciaHunks)) {
  test(file + ': channel normalization refuses changed, repeated and out-of-scope bytes', () => {
    const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    assert.doesNotThrow(() => clienteConferenciaRemainder(file, source));
    assert.throws(() => clienteConferenciaRemainder(file, source + '\n// SYNTHETIC_UNAPPROVED_CHANGE\n'));
    for (const [after] of entry.hunks) {
      assert.equal(source.split(after).length, 2);
      const midpoint = Math.floor(after.length / 2);
      const changed = after.slice(0, midpoint) + ' ' + after.slice(midpoint);
      assert.notEqual(changed, after);
      assert.throws(() => clienteConferenciaRemainder(file, source.replace(after, changed)));
      assert.throws(() => clienteConferenciaRemainder(file, source + after));
    }
  });
}
