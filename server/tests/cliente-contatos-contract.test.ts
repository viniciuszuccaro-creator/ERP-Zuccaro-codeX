import assert from 'node:assert/strict';
import test from 'node:test';
import { clienteContatoSchema, clienteContatosReplaceSchema,
  clienteUpdateSchema } from '../src/repositories/clienteTypes.ts';

const expectedVersion = 'a'.repeat(64);
test('existing rich channels preserve identity, order, zeros, preference and metadata', () => {
  const contatos = [
    { id: 'native-001', tipo: 'Telefone', valor: '00112233', nome: 'SINTETICO',
      cargo: 'Compras', ramal: '0007', observacao: 'Somente sintetico', principal: true,
      legacy_id: '00001', codigo_legado: '00025', source_system: 'SYNTHETIC' },
    { id: 'native-002', tipo: 'Telefone', valor: '00445566', principal: false },
    { id: 'native-003', tipo: 'Celular', valor: '00119999' },
  ];
  assert.deepEqual(clienteContatosReplaceSchema.parse({ expectedVersion, contatos }), { expectedVersion, contatos });
  assert.equal(contatos.some(contact => contact.tipo === 'WhatsApp'), false);
});
test('omission is not explicit removal and unknown version never authorizes replacement', () => {
  assert.deepEqual(clienteContatosReplaceSchema.parse({ expectedVersion }), { expectedVersion });
  assert.deepEqual(clienteContatosReplaceSchema.parse({ expectedVersion, contatos: [] }).contatos, []);
  for (const input of [{ contatos: [] }, { expectedVersion: null, contatos: [] },
    { expectedVersion, contatos: null }, { expectedVersion, group_id: 'forged', contatos: [] }]) {
    assert.equal(clienteContatosReplaceSchema.safeParse(input).success, false);
  }
});
test('metadata-only entry survives without fabricated value or preference', () => {
  const contact = { tipo: 'Telefone', nome: 'SINTETICO', observacao: 'Numero pendente', legacy_id: '0003' };
  assert.deepEqual(clienteContatoSchema.parse(contact), contact);
  const empty = clienteContatoSchema.safeParse({ tipo: 'Telefone' });
  assert.equal(empty.success, false);
});
test('unknown metadata is rejected, never stripped; documents are not contacts', () => {
  const contact = { tipo: 'E-mail', valor: 'sintetico@example.invalid' };
  for (const extra of [{ preferencias_comunicacao: { receber_marketing: true } },
    { documentos: [] }, { cpf: 'SYNTHETIC' }, { empresa_id: 'forged' }, { extra: 'preserve-or-reject' }]) {
    assert.equal(clienteContatoSchema.safeParse({ ...contact, ...extra }).success, false);
  }
  assert.equal(clienteContatoSchema.safeParse({ ...contact, valor: 'invalid-email' }).success, false);
});
test('ambiguous identities/preferences are rejected without merging records', () => {
  const contact = { id: 'same-native-id', tipo: 'Celular', valor: '001122', principal: true };
  assert.equal(clienteContatosReplaceSchema.safeParse({ expectedVersion, contatos: [contact, contact] }).success, false);
  assert.equal(clienteContatosReplaceSchema.safeParse({ expectedVersion,
    contatos: [contact, { ...contact, id: 'other-native-id' }] }).success, false);
  assert.equal(clienteContatosReplaceSchema.safeParse({ expectedVersion,
    contatos: [{ ...contact, principal: false }, { ...contact, id: 'other-native-id', principal: false }] }).success, true);
});
test('MASTER contacts require CAS; documents and public NULL replacement remain rejected', () => {
  assert.equal(clienteUpdateSchema.safeParse({ contatos: [] }).success, false);
  assert.equal(clienteUpdateSchema.safeParse({ expectedVersion, contatos: [] }).success, true);
  assert.equal(clienteUpdateSchema.safeParse({ expectedVersion, contatos: null }).success, false);
  assert.equal(clienteUpdateSchema.safeParse({ expectedVersion, contatos: Array.from({ length: 201 }, (_, i) =>
    ({ id: String(i), tipo: 'Telefone', valor: '0001' })) }).success, false);
  assert.equal(clienteUpdateSchema.safeParse({ documentos: [] }).success, false);
});
