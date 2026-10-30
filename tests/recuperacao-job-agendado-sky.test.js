/**
 * Recuperação indep. — JobAgendado sky windowMode + ID técnico.
 * Base #443 ChatbotIntent; fora candidata #401 / cadeia #441.
 * JobAgendado já graduou RecordState → useCadastroReopenOnIdentity.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const SRC = 'src/components/cadastros/JobAgendadoForm.jsx';

test('JobAgendado: sky windowMode + ID técnico (sem count+1; sem data-action novo)', () => {
  const source = readFileSync(SRC, 'utf8');
  assert.match(source, /windowMode\s*=\s*false/);
  assert.match(source, /if\s*\(\s*windowMode\s*\)/);
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /bg-sky-600/);
  assert.match(source, /ID técnico/);
  assert.match(source, /jobBoundId/);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.doesNotMatch(source, /data-action="id-tecnico-job/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
  assert.doesNotMatch(source, /bg-blue-600 hover:bg-blue-700/);
});
