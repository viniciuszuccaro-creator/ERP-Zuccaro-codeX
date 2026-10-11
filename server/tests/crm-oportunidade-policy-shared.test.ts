import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertOportunidadeOnCreate } from '../src/domain/crmOportunidadePolicy.js';
import { applyCrmCreate } from '../src/domain/index.ts';

test('policy CRM compartilhada exige grupo ou empresa e não cria fonte paralela', () => {
  assert.throws(
    () => assertOportunidadeOnCreate({ record: { titulo: 'X', cliente_nome: 'Ana' }, oportunidades: [] }),
    /Grupo ou empresa/,
  );
  const created = applyCrmCreate('Oportunidade', {
    empresa_id: 'emp-a',
    group_id: 'grp-a',
    titulo: 'Portao',
    cliente_nome: 'Ana',
  }, { oportunidades: [] });
  assert.equal(created.reuse, null);
  assert.equal(created.record?.empresa_id, 'emp-a');
  assert.equal(created.record?.group_id, 'grp-a');
});

test('imagem da API empacota a mesma policy no dist/domain', async () => {
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /COPY src \.\/src/);
  assert.match(dockerfile, /dist\/domain\/crmOportunidadePolicy\.js/);
  const policy = await readFile(new URL('../src/domain/crmOportunidadePolicy.js', import.meta.url), 'utf8');
  assert.match(policy, /export const assertOportunidadeOnCreate/);
  assert.doesNotMatch(policy, /from ['"].*src\/components\/lib\/crmOportunidadePolicy/);
});
