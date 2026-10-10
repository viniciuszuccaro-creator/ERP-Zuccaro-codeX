import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  CENTRAL360_BLOCK_PAGE_SIZE,
  buildCentral360PaginationScopeKey,
  growCentral360BlockLimit,
  INITIAL_CENTRAL360_BLOCK_LIMITS,
  resolveCentral360LimitsForScope,
} from '../src/components/comercial/centralCliente360Pagination.js';

test('growCentral360BlockLimit aumenta só o bloco pedido', () => {
  const next = growCentral360BlockLimit(INITIAL_CENTRAL360_BLOCK_LIMITS, 'locais');
  assert.equal(next.locais, CENTRAL360_BLOCK_PAGE_SIZE * 2);
  assert.equal(next.pedidos, CENTRAL360_BLOCK_PAGE_SIZE);
  assert.equal(next.empresas, CENTRAL360_BLOCK_PAGE_SIZE);
});

test('troca de cliente/empresa/sessão reinicia paginação (sem limites inflados)', () => {
  const scopeA = buildCentral360PaginationScopeKey({
    clienteId: 'c1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 't1',
  });
  const scopeB = buildCentral360PaginationScopeKey({
    clienteId: 'c1', groupId: 'g1', empresaId: 'e2', actorId: 'a1', sessionKey: 't1',
  });
  assert.notEqual(scopeA, scopeB);
  const grown = growCentral360BlockLimit(INITIAL_CENTRAL360_BLOCK_LIMITS, 'pedidos');
  assert.equal(grown.pedidos, CENTRAL360_BLOCK_PAGE_SIZE * 2);
  const reset = resolveCentral360LimitsForScope(scopeA, scopeB, grown);
  assert.equal(reset.limits.pedidos, CENTRAL360_BLOCK_PAGE_SIZE);
  assert.deepEqual(reset.limits, INITIAL_CENTRAL360_BLOCK_LIMITS);
  const same = resolveCentral360LimitsForScope(scopeB, scopeB, grown);
  assert.equal(same.limits.pedidos, CENTRAL360_BLOCK_PAGE_SIZE * 2);
});

test('CentralCliente360Panel: Carregar mais real sem slice(0,5) morto', async () => {
  const source = await readFile(
    new URL('../src/components/comercial/CentralCliente360Panel.jsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /block\.data\.slice\(0,\s*5\)/);
  assert.doesNotMatch(source, /placeholderData:\s*(?!undefined)[a-zA-Z]/);
  assert.match(source, /placeholderData:\s*undefined/);
  assert.match(source, /data-action=\{`central360-\$\{blockKey\}-carregar-mais`\}/);
  assert.match(source, /Carregar mais/);
  assert.match(source, /growCentral360BlockLimit/);
  assert.match(source, /locaisOffset/);
  assert.match(source, /blockLimits\.locais/);
  assert.match(source, /setBlockLimits\(INITIAL_CENTRAL360_BLOCK_LIMITS\)/);
  assert.match(source, /\[clienteId, groupId, empresaId, actorId, sessionKey\]/);
  assert.match(source, /blockKey="crm"/);
  assert.match(source, /shouldUseCrmLegadoAdapter|status === 'skipped'/);
});
