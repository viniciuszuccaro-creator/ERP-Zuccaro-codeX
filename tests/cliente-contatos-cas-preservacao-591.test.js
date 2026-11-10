/**
 * Contraprovas sintéticas #591 — pareceres 6778237293 / 6778347806.
 * CAS expectedVersion; sem truncamento silencioso; omit ≠ []; null ≠ [].
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTATOS_MAX_ITEMS,
  CONTATO_OBS_MAX,
  applyContatosProjection,
  sanitizeContatosForHttp,
  toClienteMasterHttpPayload,
} from '../src/api/clienteHttpPayload.js';

test('adapter: CONTATOS_MAX_ITEMS=200 e OBS=2000 (contrato Codex)', () => {
  assert.equal(CONTATOS_MAX_ITEMS, 200);
  assert.equal(CONTATO_OBS_MAX, 2000);
});

test('adapter: 51 contatos e obs 900 são aceitos (não truncar)', () => {
  const many = Array.from({ length: 51 }, (_, i) => ({
    id: `synthetic-${i}`,
    tipo: 'Telefone',
    valor: '0001',
  }));
  const out = sanitizeContatosForHttp(many);
  assert.equal(out.length, 51);
  const rich = sanitizeContatosForHttp([{
    tipo: 'Telefone',
    valor: '11',
    observacao: 'x'.repeat(900),
  }]);
  assert.equal(String(rich[0].observacao).length, 900);
});

test('adapter: 201 itens e obs 2001 rejeitam sem truncar', () => {
  const overflow = Array.from({ length: 201 }, (_, i) => ({
    id: `o-${i}`,
    tipo: 'Telefone',
    valor: '1',
  }));
  assert.throws(() => sanitizeContatosForHttp(overflow), /excede 200/);
  assert.throws(
    () => sanitizeContatosForHttp([{ tipo: 'Telefone', valor: '1', observacao: 'y'.repeat(2001) }]),
    /observacao/,
  );
});

test('adapter: omissão de contatos ≠ []; [] = limpeza; CAS obrigatório na substituição', () => {
  const omit = toClienteMasterHttpPayload({ nome: 'SYNTHETIC', tipo: 'Pessoa Física' });
  assert.equal(Object.hasOwn(omit, 'contatos'), false);

  assert.throws(
    () => toClienteMasterHttpPayload({
      tipo: 'Pessoa Física',
      contatos: [{ tipo: 'Telefone', valor: '11' }],
    }),
    /expectedVersion|contatos_version/,
  );

  const version = 'a'.repeat(64);
  const wire = toClienteMasterHttpPayload({
    tipo: 'Pessoa Física',
    contatos: [],
    contatos_version: version,
  });
  assert.deepEqual(wire.contatos, []);
  assert.equal(wire.expectedVersion, version);
  assert.equal(Object.hasOwn(wire, 'contatos_version'), false);
});

test('adapter: principal ausente não vira false; ids duplicados / multi-principal / B2B rejeitados', () => {
  const kept = sanitizeContatosForHttp([{ tipo: 'Celular', valor: '1199', nome: null }]);
  assert.equal(Object.hasOwn(kept[0], 'principal'), false);
  assert.equal(kept[0].nome, null);

  assert.throws(
    () => sanitizeContatosForHttp([
      { id: 'dup', tipo: 'Telefone', valor: '1' },
      { id: 'dup', tipo: 'Celular', valor: '2' },
    ]),
    /duplicado/,
  );
  assert.throws(
    () => sanitizeContatosForHttp([
      { tipo: 'Telefone', valor: '1', principal: true },
      { tipo: 'Celular', valor: '2', principal: true },
    ]),
    /múltiplos principais/,
  );
  assert.throws(
    () => sanitizeContatosForHttp([{ tipo: 'Telefone', valor: '1', contato_b2b_id: 'unchecked' }]),
    /contato_b2b_id/,
  );
});

test('applyContatosProjection: contatos_version → expectedVersion; omissão neutra', () => {
  /** @type {Record<string, unknown>} */
  const out = {};
  applyContatosProjection({
    contatos: [{ tipo: 'E-mail', valor: 'a@b.c' }],
    contatos_version: 'b'.repeat(64),
  }, out);
  assert.equal(out.expectedVersion, 'b'.repeat(64));
  assert.equal(out.contatos?.[0]?.valor, 'a@b.c');

  /** @type {Record<string, unknown>} */
  const untouched = { email: 'keep@example.dev' };
  applyContatosProjection({ nome: 'X' }, untouched);
  assert.equal(Object.hasOwn(untouched, 'contatos'), false);
  assert.equal(untouched.email, 'keep@example.dev');
});
