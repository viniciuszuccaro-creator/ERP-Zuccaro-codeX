/**
 * Lacuna integra: RepresentanteFormCompleto sky windowMode + ID técnico.
 * Espelha RepresentanteForm (já sky). Sem count+1; sem pin ID-only.
 * Branch independente — não altera #401 candidata em revisão.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const completo = 'src/components/cadastros/RepresentanteFormCompleto.jsx';
const simples = 'src/components/cadastros/RepresentanteForm.jsx';

test('RepresentanteFormCompleto: sky windowMode + ID técnico (sem count+1)', () => {
  const source = fs.readFileSync(completo, 'utf8');
  const wmIdx = source.indexOf('if (windowMode)');
  assert.ok(wmIdx >= 0, 'windowMode branch presente');
  const wm = source.slice(wmIdx, wmIdx + 900);
  assert.match(wm, /from-sky-50/);
  assert.match(wm, /to-sky-100/);
  assert.match(wm, /ID técnico/);
  assert.match(wm, /text-sky-600/);
  // Chrome da janela ≠ cards internos pré-existentes (ex.: comissão).
  assert.doesNotMatch(wm, /from-purple-50/);
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, /CadastroCodigoRegistroField/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});

test('RepresentanteForm (simples) permanece sky — sem regressão', () => {
  const source = fs.readFileSync(simples, 'utf8');
  assert.match(source, /from-sky-50/);
  assert.match(source, /to-sky-100/);
  assert.match(source, /text-sky-600/);
});
