/**
 * #353 recuperação — forms RecordState: identidade de reopen reconhece updated_at HTTP.
 * Mantém useCadastroRecordState (pins callback); só corrige a chave que ignorava refresh canônico.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const TRANSPORTADORA = new URL('../src/components/cadastros/TransportadoraForm.jsx', import.meta.url);
const PRODUTO = new URL('../src/components/cadastros/ProdutoForm.jsx', import.meta.url);
const DESPESA = new URL('../src/components/cadastros/ConfiguracaoDespesaRecorrenteForm.jsx', import.meta.url);

test('TransportadoraForm: identidade usa updated_at ?? updated_date (não só updated_date)', async () => {
  const src = await readFile(TRANSPORTADORA, 'utf8');
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
  const src = await readFile(TRANSPORTADORA, 'utf8');
  assert.match(src, /codigo-registro-transportadora/);
  assert.match(src, /CadastroCodigoRegistroField/);
  assert.match(src, /podeCriar/);
  assert.match(src, /podeEditar/);
  assert.match(src, /contextoValido/);
});

test('ProdutoForm: identidade usa updated_at ?? updated_date (não só updated_date)', async () => {
  const src = await readFile(PRODUTO, 'utf8');
  assert.match(src, /useCadastroRecordState/);
  assert.match(
    src,
    /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/,
  );
});

test('ConfiguracaoDespesaRecorrenteForm: identidade usa updated_at ?? updated_date', async () => {
  const src = await readFile(DESPESA, 'utf8');
  assert.match(src, /useCadastroRecordState/);
  assert.match(
    src,
    /config\?\.updated_at\s*\?\?\s*config\?\.updated_date/,
  );
});

test('Config forms Bloco integração: identidade usa updated_at ?? updated_date', async () => {
  const files = [
    ['ConfiguracaoBoletosForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['ConfiguracaoWhatsAppForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['ConfiguracaoIntegracaoForm.jsx', /dadosIniciais\?\.updated_at\s*\?\?\s*dadosIniciais\?\.updated_date/],
    ['ConfiguracaoNFeForm.jsx', /config\?\.updated_at\s*\?\?\s*config\?\.updated_date/],
  ];
  for (const [name, re] of files) {
    const src = await readFile(new URL(`../src/components/cadastros/${name}`, import.meta.url), 'utf8');
    assert.match(src, /useCadastroRecordState/);
    assert.match(src, re, name);
  }
});
