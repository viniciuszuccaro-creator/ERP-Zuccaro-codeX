import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fornecedorHttpRemainder } from './helpers/fornecedorHttpRemainder.js';

for (const file of ['server/src/app.ts', 'server/src/api/router.ts']) {
  test(`supplier wiring preserves entire prior ${file} and rejects outside edits`, () => {
    const source = fs.readFileSync(file, 'utf8');
    // Baseline composição #401 tip — adapter portado sem reescrever o restante.
    const previous = execFileSync('git', ['show', `5d9a7e37c:${file}`], { encoding: 'utf8' });
    assert.match(source, /fornecedorService/);
    assert.equal(fornecedorHttpRemainder(file, source).replace(/\r\n/g, '\n'), previous.replace(/\r\n/g, '\n'));
    for (const changed of [source + '\nthrow new Error("OUTSIDE_SCOPE");\n',
      source.replace('fornecedorService,', 'fornecedorService, fornecedorService,'),
      source.replace(/import[^\n]*Fornecedor[^\n]*\n/, ''),
      source.replace('fornecedorService', 'fornecedorService /* EXTRA */')]) {
      assert.throws(() => fornecedorHttpRemainder(file, changed));
    }
  });
}

test('legacy test retains whole-source equality and zero migration delta', () => {
  const file = 'tests/legado-importador-consolidacao.test.js';
  const source = fs.readFileSync(file, 'utf8');
  const previous = execFileSync('git', ['show', `5d9a7e37c:${file}`], { encoding: 'utf8' });
  assert.equal(fornecedorHttpRemainder(file, source).replace(/\r\n/g, '\n'), previous.replace(/\r\n/g, '\n'));
  assert.throws(() => fornecedorHttpRemainder(file, source + '\nthrow new Error("OUTSIDE_SCOPE");\n'));
  assert.throws(() => fornecedorHttpRemainder(file, source.replace("'server/migrations'", "'server/migrations', 'UNAUTHORIZED'")));
});
