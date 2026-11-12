import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { clienteMasterExtraHunks } from './helpers/clienteMasterExtrasRemainder.js';
import { clienteMasterExtrasRemainder, clienteMasterExtrasComposition } from './helpers/clienteMasterExtrasCompositionRemainder.js';
import { clienteContatosHunks, clienteContatosRemainder } from './helpers/clienteContatosRemainder.js';
import { fornecedorHttpRemainder } from './helpers/fornecedorHttpRemainder.js';
import { consolidation81Remainder, clienteConferenciaRemainder, clienteSelectedReferenceRemainder,
  clienteConferenciaHistoricalRemainder } from './helpers/consolidation81Remainder.js';

test('composition bridge and reviewed manifest retain their complete bytes', () => {
  for (const [file, expected] of [
    ['./helpers/clienteMasterExtrasCompositionRemainder.js', '5f732fe1a9b96e9ab272a772730df8614bf563d386463645b66eeeaa653182d4'],
    ['./helpers/clienteMasterExtrasCompositionManifest.json', '7b87bd95567c0b94772b3c725fc2695c6b82400576f0fe42cfe76f5ac326fedc'],
  ]) {
    const source = Buffer.from(fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
    assert.equal(createHash('sha256').update(source).digest('hex'), expected);
    assert.notEqual(createHash('sha256').update(Buffer.concat([source, Buffer.from('FORGED')])).digest('hex'), expected);
  }
});

for (const [file, entry] of Object.entries(clienteMasterExtrasComposition.entries)) {
  test(file + ': keep-both bridge rejects every removed, repeated or modified composition hunk', () => {
    const current = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const previous = clienteMasterExtrasRemainder(file, current);
    assert.equal(createHash('sha256').update(previous).digest('hex'), entry.hash);
    for (const [after] of entry.hunks) {
      assert.equal(current.split(after).length, 2);
      for (const mutation of [current.replace(after, ''), current + after,
        current.replace(after, () => after + '// COMPOSITION_TAMPER\n')]) {
        assert.throws(() => clienteMasterExtrasRemainder(file, mutation));
      }
    }
    assert.throws(() => clienteMasterExtrasRemainder(file, current + '// OUTSIDE\n'));
  });
}

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
    const composed = clienteMasterExtrasComposition.entries[file];
    assert.equal(createHash('sha256').update(before).digest('hex'), composed?.hash ?? entry.hash);
    assert.throws(() => clienteMasterExtrasRemainder(file, current + '\nconst unrelatedMutation = true;\n'));
    const [hunk] = (composed ?? entry).hunks[0];
    assert.throws(() => clienteMasterExtrasRemainder(file, current.replace(hunk, hunk + '// changed reviewed code\n')));
    assert.equal(clienteMasterExtrasRemainder(file, before), before);
  });
}

for (const file of Object.keys(clienteMasterExtraHunks).filter(file => clienteContatosHunks[file])) {
  test(file + ': actual composed source still rejects mutations through every historical entry point', () => {
    const current = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const [hunk] = (clienteMasterExtrasComposition.entries[file] ?? clienteMasterExtraHunks[file]).hunks[0];
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
