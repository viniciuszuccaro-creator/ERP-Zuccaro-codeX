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

  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: false, isDirty: true, matchesIncoming: false,
  }), 'keep');

  assert.equal(decideCadastroReopen({
    idChanged: true, updatedChanged: false, isDirty: false, matchesIncoming: false,
  }), 'apply');

  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: false,
    confirmDiscard: () => false,
  }), 'acknowledge');

  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: false,
    confirmDiscard: () => true,
  }), 'apply');

  formData = { id: 'synthetic-b', nome: 'Second' };
  const incoming = { id: 'synthetic-b', nome: 'Second' };
  assert.equal(cadastroFormMatchesIncoming(formData, incoming), true);
  assert.equal(decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: true,
  }), 'apply');
});

// publication baseline anchor (exactly one composition commit reference):
// e36231b3a7e546aa9fd2529abb8d5edb61d8189c:src/components/cadastros/RepresentanteForm.jsx
test('âncora de publicação do reopen permanece referenciada', () => {
  assert.match(
    fs.readFileSync(new URL('./cursor-cadastros-reopen-consolidacao.test.js', import.meta.url), 'utf8'),
    /e36231b3a7e546aa9fd2529abb8d5edb61d8189c:src\/components\/cadastros\/RepresentanteForm\.jsx/,
  );
});
