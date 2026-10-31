/**
 * Pacote D: Banco + TipoDespesa + GrupoProduto —
 * reopen via useCadastroRecordState (id+updated_date+escopo) + sky + ID técnico.
 * Sem prevIdRef; sem count+1; pin ID-only intocado.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [label, file] of [
  ['BancoForm', 'src/components/cadastros/BancoForm.jsx'],
  ['TipoDespesaForm', 'src/components/cadastros/TipoDespesaForm.jsx'],
  ['GrupoProdutoForm', 'src/components/cadastros/GrupoProdutoForm.jsx'],
]) {
  test(`${label}: recordState reopen + sky + ID técnico`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /useCadastroRecordState/);
    assert.match(source, /from-sky-50/);
    assert.match(source, /to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, /updated_date/);
    assert.doesNotMatch(source, /prevIdRef/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
  });
}
