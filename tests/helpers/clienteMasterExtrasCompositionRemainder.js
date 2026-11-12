import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { clienteMasterExtrasRemainder as historical } from './clienteMasterExtrasRemainder.js';

// Exact composition layer; the original extension helper and its golden stay untouched.
export const clienteMasterExtrasComposition = JSON.parse(fs.readFileSync(
  new URL('./clienteMasterExtrasCompositionManifest.json', import.meta.url), 'utf8'));
const hash = source => createHash('sha256').update(source).digest('hex');
export function clienteMasterExtrasRemainder(file, text) {
  const entry = clienteMasterExtrasComposition.entries[file];
  const source = text.replace(/\r\n/g, '\n');
  if (!entry) return historical(file, text);
  if (hash(source) === entry.hash) return text;
  if (!entry.hunks.some(([after]) => source.includes(after))) {
    const previous = historical(file, text);
    assert.ok(entry.ancestorHashes.includes(hash(previous.replace(/\r\n/g, '\n'))),
      `${file}: reviewed ancestor required; malformed composition cannot bypass the guard`);
    return previous;
  }
  let before = source;
  for (const [after, previous] of entry.hunks) {
    assert.equal(before.split(after).length, 2, `${file}: exact keep-both composition hunk`);
    before = before.replace(after, () => previous);
  }
  assert.equal(hash(before), entry.hash, `${file}: entire reviewed pre-composition source`);
  return text.includes('\r\n') ? before.replace(/\n/g, '\r\n') : before;
}
