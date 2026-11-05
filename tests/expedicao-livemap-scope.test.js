import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isLiveMapScopeCurrent,
  canLiveMapFetchDestino,
  pickLiveMapDestinoFromEntrega,
} from '../src/components/expedicao/painel-logistico/liveMapScope.js';

test('LiveMap usa filterInContext Entrega sem entities.filter', () => {
  const src = readFileSync('src/components/expedicao/painel-logistico/LiveMap.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Entrega'/);
  assert.match(src, /LIVE_MAP_DESTINO_STALE_SCOPE/);
  assert.match(src, /canLiveMapFetchDestino/);
  assert.doesNotMatch(src, /entities\.Entrega\.filter\(/);
});

test('guards e pick de destino', () => {
  assert.equal(canLiveMapFetchDestino({ entregaId: 'e1', contextoValido: true, canView: true }), true);
  assert.equal(canLiveMapFetchDestino({ entregaId: 'e1', contextoValido: false, canView: true }), false);
  assert.equal(canLiveMapFetchDestino({ entregaId: null, contextoValido: true, canView: true }), false);
  assert.equal(pickLiveMapDestinoFromEntrega({
    cliente_nome: 'A',
    endereco_entrega_completo: { latitude: 1, longitude: 2 },
  }).cliente, 'A');
  assert.equal(pickLiveMapDestinoFromEntrega({ endereco_entrega_completo: { latitude: 'x' } }), null);
  assert.equal(isLiveMapScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.equal(isLiveMapScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'b', sessionKey: 's' },
  ), false);
});
