/**
 * Residual cadastros: sky+ID ApiExterna / ChatbotCanal.
 * Preserva useCadastroRecordState; sem count+1.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label] of [
  ['src/components/cadastros/ApiExternaForm.jsx', 'ApiExterna'],
  ['src/components/cadastros/ChatbotCanalForm.jsx', 'ChatbotCanal'],
]) {
  test(`${label}: sky windowMode + ID técnico residual (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, /useCadastroRecordState/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
  });
}
