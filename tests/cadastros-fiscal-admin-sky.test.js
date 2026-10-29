/**
 * Residual cadastros: sky+ID CadastroFiscal / Empresa / Grupo / Perfil / Usuario
 * + ChatbotIntents adapter propaga windowMode. Preserva RecordState; sem count+1.
 * CentroOperacao / ConfiguracaoBoletos permanecem pin (fora deste lote).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label] of [
  ['src/components/cadastros/CadastroFiscalForm.jsx', 'CadastroFiscal'],
  ['src/components/cadastros/EmpresaForm.jsx', 'Empresa'],
  ['src/components/cadastros/GrupoEmpresarialForm.jsx', 'GrupoEmpresarial'],
  ['src/components/cadastros/PerfilAcessoForm.jsx', 'PerfilAcesso'],
  ['src/components/cadastros/UsuarioForm.jsx', 'Usuario'],
]) {
  test(`${label}: sky windowMode + ID técnico residual (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, /useCadastroRecordState/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
  });
}

test('ChatbotIntentsForm: propaga windowMode ao ChatbotIntentForm (sky existente)', () => {
  const adapter = fs.readFileSync('src/components/cadastros/ChatbotIntentsForm.jsx', 'utf8');
  const intent = fs.readFileSync('src/components/cadastros/ChatbotIntentForm.jsx', 'utf8');
  assert.match(adapter, /windowMode\s*=\s*false/);
  assert.match(adapter, /windowMode=\{windowMode\}/);
  assert.doesNotMatch(adapter, /windowMode=\{false\}/);
  assert.match(intent, /from-sky-50 to-sky-100/);
  assert.match(intent, /ID técnico/);
});
