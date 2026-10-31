/**
 * Lacuna integra: Config Integração/WhatsApp/ModeloDocumento/EventoNotificacao
 * sky windowMode + ID técnico. RecordState pin-safe (só chrome). Sem count+1.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label] of [
  ['src/components/cadastros/ConfiguracaoIntegracaoForm.jsx', 'ConfiguracaoIntegracao'],
  ['src/components/cadastros/ConfiguracaoWhatsAppForm.jsx', 'ConfiguracaoWhatsApp'],
  ['src/components/cadastros/ModeloDocumentoForm.jsx', 'ModeloDocumento'],
  ['src/components/cadastros/EventoNotificacaoForm.jsx', 'EventoNotificacao'],
]) {
  test(`${label}: sky windowMode + ID técnico (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50/);
    assert.match(source, /to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.doesNotMatch(source, /from-purple-50/);
  });
}
