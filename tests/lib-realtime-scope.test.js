import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isRealtimeScopeCurrent,
  assertRealtimeContext,
  filterActiveRealtimeEntregas,
  pickRealtimeFirstRow,
} from '../src/components/lib/realtimeDataScope.js';

test('useRealtimeData usa filterInContext sem entities unscoped / fallback', () => {
  const src = readFileSync('src/components/lib/useRealtimeData.jsx', 'utf8');
  assert.match(src, /filterInContext\(/);
  assert.match(src, /REALTIME_KPI_STALE_SCOPE/);
  assert.match(src, /REALTIME_PEDIDOS_STALE_SCOPE/);
  assert.match(src, /assertRealtimeContext/);
  assert.doesNotMatch(src, /entities\.Pedido\.filter\(/);
  assert.doesNotMatch(src, /entities\.Entrega\.filter\(/);
  assert.doesNotMatch(src, /entities\.Notificacao\.filter\(/);
  assert.doesNotMatch(src, /entities\.PosicaoVeiculo\.filter\(/);
  assert.doesNotMatch(src, /entities\.OrdemProducao\.filter\(/);
  assert.doesNotMatch(src, /base44\.entities\[entity\]\.filter/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
  assert.doesNotMatch(src, /initialData:\s*defaultKPIs/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
});

test('helpers realtime', () => {
  assert.throws(() => assertRealtimeContext(null, null), /REALTIME_SCOPE_BLOCKED/);
  assert.doesNotThrow(() => assertRealtimeContext('g1', null));
  assert.equal(filterActiveRealtimeEntregas([
    { status: 'Em Rota' },
    { status: 'Entregue' },
  ]).length, 1);
  assert.equal(pickRealtimeFirstRow([{ id: 'a' }, { id: 'b' }]).id, 'a');
  assert.equal(pickRealtimeFirstRow([]), null);
  assert.equal(isRealtimeScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
});
