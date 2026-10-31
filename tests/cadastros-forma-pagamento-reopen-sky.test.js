/**
 * Pacote D/E: FormaPagamento (Completo montado + Form simples) —
 * reopen canônico via useCadastroRecordState + sky windowMode + ID técnico.
 * Preserva CadastroCodigoRegistroField (código ≠ ID). Sem count+1.
 * Não toca pin ID-only nem inventa registros.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [label, file] of [
  ['FormaPagamentoFormCompleto', 'src/components/cadastros/FormaPagamentoFormCompleto.jsx'],
  ['FormaPagamentoForm', 'src/components/cadastros/FormaPagamentoForm.jsx'],
]) {
  test(`${label}: recordState reopen + sky + ID técnico`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /useCadastroRecordState/);
    assert.match(source, /from-sky-50/);
    assert.match(source, /to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, /text-sky-600/);
    assert.match(source, /CadastroCodigoRegistroField/);
    assert.match(source, /updated_date/);
    assert.doesNotMatch(source, /prevIdRef/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.doesNotMatch(source, /from-purple-50/);
  });
}

test('Bloco3Financeiro continua montando FormaPagamentoFormCompleto (sem paralelo)', () => {
  const source = fs.readFileSync('src/components/cadastros/blocks/Bloco3Financeiro.jsx', 'utf8');
  assert.match(source, /FormaPagamentoFormCompleto/);
  assert.doesNotMatch(source, /FormaPagamentoForm[^C]/);
});
