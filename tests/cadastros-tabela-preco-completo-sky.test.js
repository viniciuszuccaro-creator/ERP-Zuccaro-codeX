/**
 * Lacuna integra: TabelaPrecoFormCompleto sky windowMode + ID técnico.
 * Espelha TabelaPrecoForm (já sky). Sem count+1. Indep. da #401.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const completo = 'src/components/cadastros/TabelaPrecoFormCompleto.jsx';
const simples = 'src/components/cadastros/TabelaPrecoForm.jsx';

test('TabelaPrecoFormCompleto: sky windowMode + ID técnico (sem count+1)', () => {
  const source = fs.readFileSync(completo, 'utf8');
  const wmIdx = source.indexOf('if (windowMode)');
  assert.ok(wmIdx >= 0, 'windowMode branch presente');
  const wm = source.slice(wmIdx, wmIdx + 900);
  assert.match(wm, /from-sky-50/);
  assert.match(wm, /to-sky-100/);
  assert.match(wm, /ID técnico/);
  assert.match(wm, /text-sky-600/);
  assert.doesNotMatch(wm, /from-purple-50/);
  assert.match(source, /useCadastroRecordState/);
  assert.match(source, /CadastroCodigoRegistroField/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});

test('TabelaPrecoForm (simples) permanece sky — sem regressão', () => {
  const source = fs.readFileSync(simples, 'utf8');
  assert.match(source, /from-sky-50/);
  assert.match(source, /to-sky-100/);
});
