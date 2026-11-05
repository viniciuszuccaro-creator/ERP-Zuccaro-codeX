import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPainelEntregasQueryKey,
  isPainelEntregasScopeCurrent,
} from '../src/components/comercial/painelEntregasScope.js';

test('PainelEntregasPedido lista Entrega via filterInContext por pedido_id', () => {
  const src = readFileSync('src/components/comercial/PainelEntregasPedido.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Entrega'/);
  assert.match(src, /pedido_id:\s*pedidoId/);
  assert.doesNotMatch(src, /entities\.Entrega\.list\(/);
  assert.match(src, /enabled: Boolean\(pedidoId\) && contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /PAINEL_ENTREGAS_STALE_SCOPE/);
});

test('queryKey separa pedido, Grupo, Empresa, ator e sessão', () => {
  const base = {
    pedidoId: 'p1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1',
  };
  const k = buildPainelEntregasQueryKey(base);
  assert.deepEqual(k, ['entregas-pedido', 'p1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildPainelEntregasQueryKey({ ...base, pedidoId: 'p2' }), k);
  assert.notDeepEqual(buildPainelEntregasQueryKey({ ...base, sessionKey: 's2' }), k);
});

test('resposta tardia invalida escopo corrente', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isPainelEntregasScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isPainelEntregasScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
