import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveTimelineClienteKpiState,
  isTimelineClienteScopeCurrent,
  countTimelineEventosPorModuloTipo,
  countTimelineComunicacoes,
  buildTimelineClienteQueryKey,
} from '../src/components/cliente/timelineClienteScope.js';

test('TimelineCliente usa filter/create InContext sem entities unscoped', () => {
  const src = readFileSync('src/components/cliente/TimelineCliente.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'HistoricoCliente'/);
  assert.match(src, /createInContext\(\s*'HistoricoCliente'/);
  assert.match(src, /TIMELINE_CLIENTE_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero eventos/);
  assert.match(src, /erro ≠ zeros/);
  assert.doesNotMatch(src, /entities\.HistoricoCliente\.(filter|create)\(/);
  assert.doesNotMatch(src, /data:\s*eventos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI e contagens fail-closed', () => {
  assert.equal(resolveTimelineClienteKpiState({
    contextoValido: true, clienteId: 'c1',
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveTimelineClienteKpiState({
    contextoValido: true, clienteId: 'c1',
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(countTimelineEventosPorModuloTipo([
    { modulo_origem: 'Comercial', tipo_evento: 'Criacao' },
    { modulo_origem: 'Expedicao', tipo_evento: 'Entrega' },
  ], 'Comercial', 'Criacao'), 1);
  assert.equal(countTimelineComunicacoes([
    { whatsapp_envio: true },
    { email_envio: false },
  ]), 1);
  assert.equal(isTimelineClienteScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  const key = buildTimelineClienteQueryKey('historico-cliente', {
    clienteId: 'c1', limite: 20, groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's',
  });
  assert.deepEqual(key, ['historico-cliente', 'c1', 20, null, null, 'g', 'e', 'a', 's']);
});
