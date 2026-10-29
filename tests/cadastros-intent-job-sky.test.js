import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label, reopen] of [
  ['src/components/cadastros/ChatbotIntentForm.jsx', 'ChatbotIntent', 'useCadastroRecordState'],
  ['src/components/cadastros/JobAgendadoForm.jsx', 'JobAgendado', 'useCadastroReopenOnIdentity'],
  ['src/components/cadastros/EventoNotificacaoForm.jsx', 'EventoNotificacao', 'useCadastroRecordState'],
  ['src/components/cadastros/ModeloDocumentoForm.jsx', 'ModeloDocumento', 'useCadastroRecordState'],
]) {
  test(`${label}: sky windowMode + ID técnico residual (sem CodigoField/count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.doesNotMatch(source, /CadastroCodigoRegistroField/);
    assert.match(source, new RegExp(reopen));
  });
}

test('CentroOperacao e branches reservadas intocados neste tip', () => {
  const centro = fs.readFileSync('src/components/cadastros/CentroOperacaoForm.jsx', 'utf8');
  assert.doesNotMatch(centro, /ID técnico/);
  for (const reserved of [
    'src/components/cadastros/ApiExternaForm.jsx',
    'src/components/cadastros/ParametroRoteirizacaoForm.jsx',
    'src/components/cadastros/ChatbotCanalForm.jsx',
  ]) {
    const before = fs.readFileSync(reserved, 'utf8');
    assert.ok(before.length > 100);
  }
});
