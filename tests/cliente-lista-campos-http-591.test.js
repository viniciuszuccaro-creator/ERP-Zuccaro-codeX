/**
 * #591 — grade Cadastros/Comercial Cliente deve exibir campos do contrato HTTP
 * (documento/email/telefone/celular), não só nome.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('Bloco1 Pessoas: Cliente lista documento + contatos escalares', () => {
  const src = read('src/components/cadastros/blocks/Bloco1Pessoas.jsx');
  assert.match(src, /k: 'Cliente'/);
  assert.match(src, /documento/);
  assert.match(src, /email/);
  assert.match(src, /telefone/);
  assert.match(src, /celular/);
});

test('ClientesTab Comercial: colunas alinhadas ao MASTER HTTP', () => {
  const src = read('src/components/comercial/ClientesTab.jsx');
  assert.match(src, /documento/);
  assert.match(src, /email/);
  assert.match(src, /telefone/);
  assert.match(src, /celular/);
});

test('V24: cpf/cnpj resolvem documento HTTP; sem misturar CPF↔CNPJ nem Telefone↔Celular', () => {
  const src = read('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx');
  assert.match(src, /documento: "CPF\/CNPJ"/);
  assert.match(src, /variants\.concat\(\['documento'/);
  assert.match(src, /\^cpf\$\/i/);
  assert.match(src, /\^cnpj\$\/i/);
  assert.doesNotMatch(src, /telefone\|fone\|celular\|whatsapp/);
  assert.match(src, /Telefone ≠ Celular ≠ WhatsApp/);
});

test('HTTP client hidrata UI a partir do MASTER', () => {
  const src = read('src/api/httpApiClient.js');
  assert.match(src, /hydrateClienteHttpRowForUi/);
  assert.doesNotMatch(src, /withHydratedContatos\(await base\.get/);
});

test('Completo: mapToForm espelha documento; Contatos mostra escalares sem wipe', () => {
  const src = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  assert.match(src, /documento_normalizado/);
  assert.match(src, /contatosViewForUi/);
  assert.match(src, /data-fonte="contatos-escalares-http"/);
});
