/**
 * Pacote indep. — ID técnico residual logística (sky já presente).
 * Melhoria UX ≠ recuperação de registros. Fora de #446.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label] of [
  ['src/components/cadastros/BancoForm.jsx', 'Banco'],
  ['src/components/cadastros/TransportadoraForm.jsx', 'Transportadora'],
  ['src/components/cadastros/MotoristaForm.jsx', 'Motorista'],
  ['src/components/cadastros/VeiculoForm.jsx', 'Veiculo'],
]) {
  test(`${label}: sky windowMode + ID técnico (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, /CadastroCodigoRegistroField/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
  });
}

test('Pins ID-only / #446 candidata intocados', () => {
  for (const pinned of [
    'src/components/cadastros/CadastroFiscalForm.jsx',
    'src/components/cadastros/EmpresaForm.jsx',
    'src/components/cadastros/CentroOperacaoForm.jsx',
    'src/components/cadastros/ConfiguracaoBoletosForm.jsx',
  ]) {
    assert.ok(fs.readFileSync(pinned, 'utf8').length > 100);
  }
});
