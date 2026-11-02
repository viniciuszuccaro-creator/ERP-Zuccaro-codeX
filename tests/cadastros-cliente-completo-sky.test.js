/**
 * Lacuna integra: CadastroClienteCompleto sky windowMode + ID técnico.
 * Espelha RepresentanteFormCompleto / TabelaPrecoFormCompleto.
 * Sem count+1. Código numérico permanece CadastroCodigoRegistroField.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const path = 'src/components/cadastros/CadastroClienteCompleto.jsx';

test('CadastroClienteCompleto: sky windowMode + ID técnico (sem count+1)', () => {
  const source = fs.readFileSync(path, 'utf8');
  const wmIdx = source.indexOf('if (windowMode)');
  assert.ok(wmIdx >= 0, 'windowMode branch presente');
  const wm = source.slice(wmIdx, wmIdx + 900);
  assert.match(wm, /from-sky-50/);
  assert.match(wm, /to-sky-100/);
  assert.match(wm, /ID técnico/);
  assert.match(wm, /text-sky-600/);
  assert.doesNotMatch(wm, /from-purple-50/);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /CadastroCodigoRegistroField/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});
