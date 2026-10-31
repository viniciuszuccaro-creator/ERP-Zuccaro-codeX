/**
 * Lacuna integra: CentroResultado sky windowMode + ID técnico.
 * Usuario/GrupoEmpresarial ficam no pin ID-only (emit≡e36231b3) — sky via
 * substituição explícita no teste (padrão Webhook), não neste lote.
 * CI PG16 incluso. Sem count+1.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('CentroResultado: sky windowMode + ID técnico (sem count+1)', () => {
  const source = fs.readFileSync('src/components/cadastros/CentroResultadoForm.jsx', 'utf8');
  assert.match(source, /from-sky-50/);
  assert.match(source, /to-sky-100/);
  assert.match(source, /ID técnico/);
  assert.match(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
});

test('Usuario/GrupoEmpresarial: permanecem no pin ID-only (sem sky residual neste lote)', () => {
  for (const file of [
    'src/components/cadastros/UsuarioForm.jsx',
    'src/components/cadastros/GrupoEmpresarialForm.jsx',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from-sky-50 to-sky-100/);
    assert.match(source, /CadastroCodigoRegistroField/);
    assert.match(source, /idOnly/);
  }
});
