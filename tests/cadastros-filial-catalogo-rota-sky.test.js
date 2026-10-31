/**
 * Lacuna integra: Filial / CatalogoWeb / RotaPadrao — sky windowMode + ID técnico.
 * Chrome only (pin RecordState). Sem count+1. CI PG16 incluso no pacote.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label] of [
  ['src/components/cadastros/FilialForm.jsx', 'Filial'],
  ['src/components/cadastros/CatalogoWebForm.jsx', 'CatalogoWeb'],
  ['src/components/cadastros/RotaPadraoForm.jsx', 'RotaPadrao'],
]) {
  test(`${label}: sky windowMode + ID técnico (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50/);
    assert.match(source, /to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.match(source, /useCadastroRecordState/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.doesNotMatch(source, /from-purple-50/);
  });
}
