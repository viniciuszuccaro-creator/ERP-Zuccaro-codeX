import fs from 'node:fs';

// Frozen emitter hashes were captured from CRLF checkouts. Canonicalize only
// physical line endings before the existing counted-hunk restoration.
export function runtimeProofSource(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n');
}
