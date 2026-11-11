import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setorRbacRemainder } from './helpers/setorRbacRemainder.js';
import { fornecedorHttpRemainder } from './helpers/fornecedorHttpRemainder.js';

const file = 'server/src/app.ts';
const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const wiring = "    authorization: { guard: rbacGuard, moduleName: 'Cadastros', section: 'setor_atividade' },\n";
test('Setor wiring preserves the complete published app, including supplier wiring', () => {
  assert.equal(source.split(wiring).length, 2, 'current source requires exactly one authorization wiring');
  const before = execFileSync('git', ['show', '3b4c856b68fa02683615edb276c87d49af1cbb6e:server/src/app.ts'], { encoding: 'utf8' });
  assert.equal(setorRbacRemainder(file, source), before);
  assert.doesNotThrow(() => fornecedorHttpRemainder(file, source));
});
test('Setor peel rejects unrelated changes and malformed or repeated authorization', () => {
  for (const changed of [source + '\nthrow new Error("OUTSIDE");\n',
    source.replace('app.use(notFoundHandler);', 'app.use(() => {});'),
    source.replace(wiring, wiring + wiring), source.replace("section: 'setor_atividade'", "section: 'cliente'"),
    source.replace(wiring, wiring + '    authorization: undefined,\n')]) {
    assert.throws(() => setorRbacRemainder(file, changed));
    assert.throws(() => fornecedorHttpRemainder(file, changed));
  }
});
