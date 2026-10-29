/**
 * Residual cadastros: sky+ID em PerfilAcesso; ChatbotIntents propaga windowMode.
 * Fora deste lote (pins): CadastroFiscal / CentroOperacao / GrupoEmpresarial /
 * Usuario / ConfiguracaoBoletos (ID-only golden e36231b3) e EmpresaForm
 * (date-arithmetic emittedBeforeSha256). Sem count+1.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('PerfilAcesso: sky windowMode + ID técnico residual (sem count+1)', () => {
  const source = fs.readFileSync('src/components/cadastros/PerfilAcessoForm.jsx', 'utf8');
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /ID técnico/);
  assert.match(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});

test('ChatbotIntentsForm: propaga windowMode ao ChatbotIntentForm (sky existente)', () => {
  const adapter = fs.readFileSync('src/components/cadastros/ChatbotIntentsForm.jsx', 'utf8');
  const intent = fs.readFileSync('src/components/cadastros/ChatbotIntentForm.jsx', 'utf8');
  assert.match(adapter, /windowMode\s*=\s*false/);
  assert.match(adapter, /windowMode=\{windowMode\}/);
  assert.doesNotMatch(adapter, /windowMode=\{false\}/);
  assert.match(intent, /from-sky-50 to-sky-100/);
  assert.match(intent, /ID técnico/);
});

test('pins ID-only / date-arithmetic: Fiscal Empresa Grupo Usuario sem sky estrutural neste lote', () => {
  for (const file of [
    'src/components/cadastros/CadastroFiscalForm.jsx',
    'src/components/cadastros/EmpresaForm.jsx',
    'src/components/cadastros/GrupoEmpresarialForm.jsx',
    'src/components/cadastros/UsuarioForm.jsx',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from-sky-50 to-sky-100/);
  }
});
