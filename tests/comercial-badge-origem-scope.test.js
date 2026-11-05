import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildBadgeOrigemQueryKey,
  isBadgeOrigemScopeCurrent,
} from '../src/components/comercial/badgeOrigemScope.js';

test('BadgeOrigemPedido lista ParametroOrigemPedido via filterInContext', () => {
  const src = readFileSync('src/components/comercial/BadgeOrigemPedido.jsx', 'utf8');
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.doesNotMatch(src, /entities\.ParametroOrigemPedido\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /BADGE_ORIGEM_STALE_SCOPE/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildBadgeOrigemQueryKey(base);
  assert.deepEqual(k, ['parametros-origem-pedido-badge', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildBadgeOrigemQueryKey({ ...base, sessionKey: 's2' }), k);
});

test('resposta tardia invalida escopo corrente', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isBadgeOrigemScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isBadgeOrigemScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
