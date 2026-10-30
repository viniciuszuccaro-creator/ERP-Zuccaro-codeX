/**
 * Recuperação indep. — ChatbotIntent sky windowMode + ID técnico.
 * Adapter ChatbotIntentsForm propaga windowMode (não força false).
 * Base #439 CentroOperacao; fora candidata #401 / cadeia #441.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const INTENT = 'src/components/cadastros/ChatbotIntentForm.jsx';
const INTENTS = 'src/components/cadastros/ChatbotIntentsForm.jsx';

test('ChatbotIntent: sky windowMode + ID técnico (sem count+1)', () => {
  const source = readFileSync(INTENT, 'utf8');
  assert.match(source, /windowMode\s*=\s*false/);
  assert.match(source, /if\s*\(\s*windowMode\s*\)/);
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /bg-sky-600/);
  assert.match(source, /ID técnico/);
  assert.match(source, /id-tecnico-chatbot-intent/);
  assert.match(source, /data-permission="Cadastros\.ChatbotIntent/);
  assert.match(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
  assert.doesNotMatch(source, /bg-blue-600 hover:bg-blue-700/);
});

test('ChatbotIntentsForm: propaga windowMode (não força false)', () => {
  const source = readFileSync(INTENTS, 'utf8');
  assert.match(source, /windowMode\s*=\s*false/);
  assert.match(source, /windowMode=\{windowMode\}/);
  assert.doesNotMatch(source, /windowMode=\{false\}/);
  assert.match(source, /ChatbotIntentForm/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});
