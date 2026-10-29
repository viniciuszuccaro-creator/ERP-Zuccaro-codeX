/**
 * Residual cadastros: sky windowMode + ID técnico nos Parametro* (fora da coorte ID-only).
 * ConfiguracaoBoletos permanece na coorte ID-only golden (pin CANAL / bbcf55030).
 * Preserva useCadastroRecordState; sem count+1 no browser.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label, pin] of [
  ['src/components/cadastros/ParametroCaixaDiarioForm.jsx', 'ParametroCaixaDiario', 'useCadastroRecordState'],
  ['src/components/cadastros/ParametroConciliacaoBancariaForm.jsx', 'ParametroConciliacaoBancaria', 'useCadastroRecordState'],
  ['src/components/cadastros/ParametroPortalClienteForm.jsx', 'ParametroPortalCliente', 'useCadastroRecordState'],
  ['src/components/cadastros/ParametroRecebimentoNFeForm.jsx', 'ParametroRecebimentoNFe', 'useCadastroRecordState'],
  ['src/components/cadastros/ParametroRoteirizacaoForm.jsx', 'ParametroRoteirizacao', 'useCadastroRecordState'],
]) {
  test(`${label}: sky windowMode + ID técnico residual (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.match(source, new RegExp(pin));
  });
}

test('ConfiguracaoBoletos: permanece ID-only (CadastroCodigoRegistroField; sem sky windowMode)', () => {
  const source = fs.readFileSync('src/components/cadastros/ConfiguracaoBoletosForm.jsx', 'utf8');
  assert.match(source, /CadastroCodigoRegistroField/);
  assert.match(source, /idOnly/);
  assert.match(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /from-sky-50/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});
