import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  decideCadastroReopen,
  isCadastroFormDirty,
  cadastroFormMatchesIncoming,
} from '../src/components/cadastros/cadastroReopenPolicy.js';

const hooked = [
  'RepresentanteForm',
  'FormaPagamentoForm',
  'RepresentanteFormCompleto',
  'FormaPagamentoFormCompleto',
  'CadastroClienteCompleto',
  'CadastroFornecedorCompleto',
];

for (const name of hooked) {
  test(`${name} consome useCadastroReopenOnIdentity`, () => {
    const source = fs.readFileSync(`src/components/cadastros/${name}.jsx`, 'utf8');
    assert.match(source, /useCadastroReopenOnIdentity/);
  });
}

test('política canônica preserva dirty no mesmo id e aplica identidade limpa', () => {
  const baseline = JSON.stringify({ id: 'synthetic-a', nome: 'Original' });
  let formData = { id: 'synthetic-a', nome: 'Dirty value' };
  assert.equal(isCadastroFormDirty(formData, baseline), true);

  // mesma identidade: keep
  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: false, isDirty: true, matchesIncoming: false,
  }), 'keep');

  // troca de registro limpa
  assert.equal(decideCadastroReopen({
    idChanged: true, updatedChanged: false, isDirty: false, matchesIncoming: false,
  }), 'apply');

  // updated externo + dirty → acknowledge se recusar
  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: false,
    confirmDiscard: () => false,
  }), 'acknowledge');

  // updated externo + dirty → apply se confirmar
  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: false,
    confirmDiscard: () => true,
  }), 'apply');

  // eco do save
  formData = { id: 'synthetic-b', nome: 'Second' };
  const incoming = { id: 'synthetic-b', nome: 'Second' };
  assert.equal(cadastroFormMatchesIncoming(formData, incoming), true);
  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: true,
  }), 'apply');
});
