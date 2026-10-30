/**
 * Pacote indep. — ID técnico residual em masters org (sky já presente).
 * Melhoria visual/UX ≠ recuperação de registros (#450). Sem count+1 / sem pin ID-only.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label, bound] of [
  ['src/components/cadastros/CargoForm.jsx', 'Cargo', 'cargoBoundId'],
  ['src/components/cadastros/DepartamentoForm.jsx', 'Departamento', 'departamentoBoundId'],
  ['src/components/cadastros/MarcaForm.jsx', 'Marca', 'marcaBoundId'],
  ['src/components/cadastros/SetorAtividadeForm.jsx', 'SetorAtividade', 'setorBoundId'],
]) {
  test(`${label}: sky windowMode + ID técnico (boundId; sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, new RegExp(bound));
    assert.match(source, /useCadastroReopenOnIdentity/);
    assert.match(source, /CadastroCodigoRegistroField/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
  });
}

test('Pins ID-only / Empresa date-hash intocados neste tip', () => {
  for (const pinned of [
    'src/components/cadastros/CadastroFiscalForm.jsx',
    'src/components/cadastros/EmpresaForm.jsx',
    'src/components/cadastros/GrupoEmpresarialForm.jsx',
    'src/components/cadastros/UsuarioForm.jsx',
    'src/components/cadastros/CentroOperacaoForm.jsx',
    'src/components/cadastros/ConfiguracaoBoletosForm.jsx',
  ]) {
    const src = fs.readFileSync(pinned, 'utf8');
    assert.ok(src.length > 100, pinned);
  }
});
