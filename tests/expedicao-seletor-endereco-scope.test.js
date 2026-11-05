import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isSeletorEnderecoScopeCurrent,
  assertSeletorEnderecoContext,
  assertSeletorEnderecoClienteId,
  buildSeletorEnderecoLocais,
} from '../src/components/expedicao/seletorEnderecoEntregaScope.js';

test('SeletorEnderecoEntrega usa updateInContext sem entities.Cliente.update', () => {
  const src = readFileSync('src/components/expedicao/SeletorEnderecoEntrega.jsx', 'utf8');
  assert.match(src, /updateInContext\(\s*"Cliente"/);
  assert.match(src, /SELETOR_ENDERECO_STALE_SCOPE/);
  assert.match(src, /assertSeletorEnderecoContext/);
  assert.doesNotMatch(src, /entities\.Cliente\.update\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('guards e construção de locais_entrega', () => {
  assert.throws(() => assertSeletorEnderecoContext(null, null), /SELETOR_ENDERECO_SCOPE_BLOCKED/);
  assert.doesNotThrow(() => assertSeletorEnderecoContext('g1', null));
  assert.equal(assertSeletorEnderecoClienteId({ id: 'c1' }), 'c1');
  assert.throws(() => assertSeletorEnderecoClienteId({}), /SELETOR_ENDERECO_CLIENTE_REQUIRED/);
  const locais = buildSeletorEnderecoLocais(
    { locais_entrega: [{ apelido: 'A' }] },
    { apelido: 'B' },
  );
  assert.equal(locais.length, 2);
  assert.equal(locais[1].apelido, 'B');
  assert.equal(isSeletorEnderecoScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.equal(isSeletorEnderecoScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'b', sessionKey: 's' },
  ), false);
});
