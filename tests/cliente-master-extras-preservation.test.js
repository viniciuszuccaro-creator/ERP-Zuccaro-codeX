import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { clienteMasterExtraHunks, clienteMasterExtrasRemainder } from './helpers/clienteMasterExtrasRemainder.js';
import { clienteContatosHunks, clienteContatosRemainder } from './helpers/clienteContatosRemainder.js';
import { fornecedorHttpRemainder } from './helpers/fornecedorHttpRemainder.js';
import { consolidation81Remainder, clienteConferenciaRemainder, clienteSelectedReferenceRemainder,
  clienteConferenciaHistoricalRemainder } from './helpers/consolidation81Remainder.js';

test('new extension guard retains its complete reviewed bytes', () => {
  const source = fs.readFileSync(new URL('./helpers/clienteMasterExtrasRemainder.js', import.meta.url));
  const expected = '5f579b16b02e980742defc3bbfe01238fa645826efc724e3ec898f3fc2a536e3';
  assert.equal(createHash('sha256').update(source).digest('hex'), expected);
  assert.notEqual(createHash('sha256').update(Buffer.concat([source, Buffer.from('// changed')])).digest('hex'), expected);
});
for (const [file, entry] of Object.entries(clienteMasterExtraHunks)) {
  test(file + ': entire previous source survives only the exact reviewed extensions', () => {
    const current = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const before = clienteMasterExtrasRemainder(file, current);
    assert.equal(createHash('sha256').update(before).digest('hex'), entry.hash);
    assert.throws(() => clienteMasterExtrasRemainder(file, current + '\nconst unrelatedMutation = true;\n'));
    const [hunk] = entry.hunks[0];
    assert.throws(() => clienteMasterExtrasRemainder(file, current.replace(hunk, hunk + '// changed reviewed code\n')));
    assert.equal(clienteMasterExtrasRemainder(file, before), before);
  });
}

for (const file of Object.keys(clienteMasterExtraHunks).filter(file => clienteContatosHunks[file])) {
  test(file + ': actual composed source still rejects mutations through every historical entry point', () => {
    const current = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const [hunk] = clienteMasterExtraHunks[file].hunks[0];
    const mutations = [current + '\nconst unrelated = true;\n', current.replace(hunk, ''), current + hunk,
      current.replace(hunk, hunk + '// changed extension\n')];
    for (const mutation of mutations) {
      assert.notEqual(mutation, current);
      for (const peel of [clienteContatosRemainder, fornecedorHttpRemainder, clienteConferenciaRemainder,
        clienteSelectedReferenceRemainder, clienteConferenciaHistoricalRemainder,
        (path,text) => consolidation81Remainder(path,text,false)]) {
        assert.throws(() => peel(file, mutation));
      }
    }
  });
}
