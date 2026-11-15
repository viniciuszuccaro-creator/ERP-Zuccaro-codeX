// TEST ONLY: fixed repository sources; no connection, broad migration replay, seed or activation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function loadCanonicalRehearsalSources(table) {
  const matrix = JSON.parse(await readFile(new URL('../../docs/evidence/hml-object-review-matrix-20261114.json', import.meta.url), 'utf8'));
  const review = matrix.relationReviews?.[table];
  assert.ok(review, 'A prova exige revisao de fonte vinculada, nao atestado do destino');
  const sources = {};
  for (const pin of review.sourcePins) {
    assert.match(pin.path, /^server\/migrations\/\d{3}_[a-z0-9_]+\.sql$/);
    const sql = (await readFile(new URL(`../../${pin.path}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(sql).digest('hex'), pin.sha256, pin.path);
    sources[pin.path.split('/').at(-1)] = sql;
  }
  return { matrix, review, sources };
}

export function canonicalTable(sql, table) {
  assert.match(table, /^[a-z_]+$/);
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
  const end = sql.indexOf('\n);', start);
  assert.ok(start >= 0 && end > start, `Missing canonical CREATE ${table}`);
  return sql.slice(start, end + 3);
}
