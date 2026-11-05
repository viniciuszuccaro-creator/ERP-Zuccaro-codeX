import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildAplicadorTabelaQueryKey,
  isAplicadorTabelaScopeCurrent,
} from '../src/components/comercial/aplicadorTabelaScope.js';

test('AplicadorTabelaPreco lista TabelaPreco via filterInContext', () => {
  const src = readFileSync('src/components/comercial/AplicadorTabelaPreco.jsx', 'utf8');
  assert.match(src, /filterInContext\('TabelaPreco'/);
  assert.doesNotMatch(src, /entities\.TabelaPreco\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /APLICADOR_TABELA_STALE_SCOPE/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildAplicadorTabelaQueryKey(base);
  assert.deepEqual(k, ['tabelas-preco-aplicador', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildAplicadorTabelaQueryKey({ ...base, actorId: 'a2' }), k);
  assert.notDeepEqual(buildAplicadorTabelaQueryKey({ ...base, sessionKey: 's2' }), k);
});

test('resposta tardia invalida escopo corrente', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isAplicadorTabelaScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isAplicadorTabelaScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
