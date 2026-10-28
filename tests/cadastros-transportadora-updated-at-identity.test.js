/**
 * #353 recuperação — TransportadoraForm: identidade de reopen reconhece updated_at HTTP.
 * Mantém useCadastroRecordState (pin callback); só corrige a chave que ignorava refresh canônico.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const FORM = new URL('../src/components/cadastros/TransportadoraForm.jsx', import.meta.url);

test('TransportadoraForm: identidade usa updated_at ?? updated_date (não só updated_date)', async () => {
  const src = await readFile(FORM, 'utf8');
  assert.match(src, /useCadastroRecordState/);
  assert.match(
    src,
    /transportadora\?\.updated_at\s*\?\?\s*transportadora\?\.updated_date/,
  );
  assert.doesNotMatch(
    src,
    /JSON\.stringify\(\[\s*transportadora\?\.id\s*\?\?\s*null,\s*transportadora\?\.updated_date\s*\?\?\s*null/,
  );
});

test('TransportadoraForm: preserva payload owner e CadastroCodigoRegistroField', async () => {
  const src = await readFile(FORM, 'utf8');
  assert.match(src, /codigo-registro-transportadora/);
  assert.match(src, /CadastroCodigoRegistroField/);
  assert.match(src, /podeCriar/);
  assert.match(src, /podeEditar/);
  assert.match(src, /contextoValido/);
});
