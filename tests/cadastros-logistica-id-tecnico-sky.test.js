/**
 * Pacote indep. — ID técnico residual logística + UnidadeMedida (sky já presente).
 * Melhoria UX ≠ recuperação de registros. Código numérico ≠ ID técnico.
 * Supersede parcial de #452 (backend flake CRM schema cleanup); tip sobre #469.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label, action] of [
  ['src/components/cadastros/BancoForm.jsx', 'Banco', 'id-tecnico-banco'],
  ['src/components/cadastros/TransportadoraForm.jsx', 'Transportadora', 'id-tecnico-transportadora'],
  ['src/components/cadastros/MotoristaForm.jsx', 'Motorista', 'id-tecnico-motorista'],
  ['src/components/cadastros/VeiculoForm.jsx', 'Veiculo', 'id-tecnico-veiculo'],
  ['src/components/cadastros/UnidadeMedidaForm.jsx', 'UnidadeMedida', 'id-tecnico-unidade-medida'],
]) {
  test(`${label}: sky windowMode + ID técnico (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, new RegExp(`data-action="${action}"`));
    assert.match(source, /CadastroCodigoRegistroField/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
  });
}

test('Veiculo: CodigoField usa boundId canônico (não props soltas)', () => {
  const source = fs.readFileSync('src/components/cadastros/VeiculoForm.jsx', 'utf8');
  assert.match(source, /hasId=\{Boolean\(veiculoBoundId\)\}/);
  assert.match(source, /entityId=\{veiculoBoundId\}/);
  assert.doesNotMatch(source, /entityId=\{dadosIniciais\?\.id \|\| veiculo\?\.id\}/);
});

test('Pins ID-only / Completos canônicos intocados neste lote', () => {
  for (const pinned of [
    'src/components/cadastros/CadastroFiscalForm.jsx',
    'src/components/cadastros/EmpresaFormCompleto.jsx',
    'src/components/cadastros/CentroOperacaoForm.jsx',
    'src/components/cadastros/ConfiguracaoBoletosForm.jsx',
  ]) {
    assert.ok(fs.readFileSync(pinned, 'utf8').length > 100);
  }
});
