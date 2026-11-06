/**
 * Aceite #462 sobre tip composição: reopen canônico = useCadastroReopenOnIdentity/boundId
 * (≠ useCadastroRecordState da origem) + sky + ID técnico. Sem prevIdRef / count+1.
 * Cadastro Banco = mestre financeiro ≠ infraestrutura de banco de dados.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [label, file, bound] of [
  ['BancoForm', 'src/components/cadastros/BancoForm.jsx', 'bancoBoundId'],
  ['TipoDespesaForm', 'src/components/cadastros/TipoDespesaForm.jsx', 'tipoDespesaBoundId'],
  ['GrupoProdutoForm', 'src/components/cadastros/GrupoProdutoForm.jsx', 'grupoProdutoBoundId'],
]) {
  test(`${label}: reopen boundId + sky + ID técnico (#462 aceite)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /useCadastroReopenOnIdentity/);
    assert.match(source, new RegExp(bound));
    assert.match(source, /from-sky-50/);
    assert.match(source, /to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.doesNotMatch(source, /prevIdRef/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    // Não regressar para o hook legado do tip #462 — boundId é o canônico atual.
    assert.doesNotMatch(source, /useCadastroRecordState/);
  });
}

test('Home reusa Dashboard canônico (placeholder desconectado)', () => {
  const home = fs.readFileSync('src/pages/Home.jsx', 'utf8');
  assert.match(home, /from ['"]\.\/Dashboard['"]/);
  assert.match(home, /<Dashboard/);
  assert.doesNotMatch(home, /Placeholder file/);
});
