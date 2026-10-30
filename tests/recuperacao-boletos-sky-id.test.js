/**
 * Recuperação indep. — ConfiguracaoBoletos sky windowMode + ID técnico.
 * Base #444 JobAgendado; fora candidata #401 / cadeia #441/#442.
 * Permanece coorte ID-only (CadastroCodigoRegistroField + RecordState).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const SRC = 'src/components/cadastros/ConfiguracaoBoletosForm.jsx';

test('ConfiguracaoBoletos: sky windowMode + ID técnico (ID-only pin; sem data-action novo)', () => {
  const source = readFileSync(SRC, 'utf8');
  assert.match(source, /windowMode\s*=\s*false/);
  assert.match(source, /if\s*\(\s*windowMode\s*\)/);
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /bg-sky-600/);
  assert.match(source, /ID técnico/);
  assert.match(source, /idOnly/);
  assert.match(source, /useCadastroRecordState/);
  assert.match(source, /dadosIniciais\?\.id/);
  assert.doesNotMatch(source, /data-action="id-tecnico-boletos-sky/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
  assert.doesNotMatch(source, /bg-green-600 hover:bg-green-700/);
});
