import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  CENTRAL360_BLOCK_PAGE_SIZE,
  growCentral360BlockLimit,
  INITIAL_CENTRAL360_BLOCK_LIMITS,
} from '../src/components/comercial/centralCliente360Pagination.js';

test('growCentral360BlockLimit aumenta só o bloco pedido', () => {
  const next = growCentral360BlockLimit(INITIAL_CENTRAL360_BLOCK_LIMITS, 'locais');
  assert.equal(next.locais, CENTRAL360_BLOCK_PAGE_SIZE * 2);
  assert.equal(next.pedidos, CENTRAL360_BLOCK_PAGE_SIZE);
  assert.equal(next.empresas, CENTRAL360_BLOCK_PAGE_SIZE);
});

test('CentralCliente360Panel: Carregar mais real sem slice(0,5) morto', async () => {
  const source = await readFile(
    new URL('../src/components/comercial/CentralCliente360Panel.jsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /block\.data\.slice\(0,\s*5\)/);
  assert.match(source, /data-action=\{`central360-\$\{blockKey\}-carregar-mais`\}/);
  assert.match(source, /Carregar mais/);
  assert.match(source, /growCentral360BlockLimit/);
  assert.match(source, /locaisOffset/);
  assert.match(source, /blockLimits\.locais/);
  assert.match(source, /blockKey="crm"/);
  assert.match(source, /status === 'skipped'/);
});
