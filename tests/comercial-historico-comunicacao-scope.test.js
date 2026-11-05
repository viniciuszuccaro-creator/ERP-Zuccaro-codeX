import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildHistoricoComunicacaoQueryKey,
  isHistoricoComunicacaoScopeCurrent,
  filterHistoricoComunicacaoEventos,
  resolveHistoricoComunicacaoKpiState,
} from '../src/components/comercial/historicoComunicacaoScope.js';

test('HistoricoComunicacao lista HistoricoCliente via filterInContext (sem list unscoped)', () => {
  const src = readFileSync('src/components/comercial/HistoricoComunicacao.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'HistoricoCliente'/);
  assert.match(src, /HISTORICO_COMUNICACAO_STALE_SCOPE/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /enabled: hasTarget && contextoValido/);
  assert.match(src, /contagemIndisponivel/);
  assert.doesNotMatch(src, /entities\.HistoricoCliente\.list\(/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*historico\s*=\s*\[\]/);
});

test('queryKey separa alvo, Grupo, Empresa, ator e sessão', () => {
  const base = {
    clienteId: 'c1',
    pedidoId: 'p1',
    groupId: 'g1',
    empresaId: 'e1',
    actorId: 'a1',
    sessionKey: 's1',
  };
  const k = buildHistoricoComunicacaoQueryKey(base);
  assert.deepEqual(k, ['historico-comunicacao', 'c1', 'p1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildHistoricoComunicacaoQueryKey({ ...base, actorId: 'a2' }), k);
  assert.notDeepEqual(buildHistoricoComunicacaoQueryKey({ ...base, sessionKey: 's2' }), k);
  assert.notDeepEqual(buildHistoricoComunicacaoQueryKey({ ...base, empresaId: 'e2' }), k);
});

test('filtro legado: pedido_id OU referencia_id; cliente_id sem pedido', () => {
  const rows = [
    { id: 1, pedido_id: 'p1', cliente_id: 'c1' },
    { id: 2, referencia_id: 'p1', cliente_id: 'c1' },
    { id: 3, pedido_id: 'p2', cliente_id: 'c1' },
    { id: 4, cliente_id: 'c2' },
  ];
  assert.deepEqual(
    filterHistoricoComunicacaoEventos(rows, { pedidoId: 'p1' }).map((r) => r.id),
    [1, 2],
  );
  assert.deepEqual(
    filterHistoricoComunicacaoEventos(rows, { clienteId: 'c1' }).map((r) => r.id),
    [1, 2, 3],
  );
});

test('KPI loading/erro/unavailable nunca é ready (≠ zero eventos)', () => {
  assert.equal(resolveHistoricoComunicacaoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveHistoricoComunicacaoKpiState({
    contextoValido: true, pedidoId: 'p1', isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveHistoricoComunicacaoKpiState({
    contextoValido: false, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveHistoricoComunicacaoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isHistoricoComunicacaoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isHistoricoComunicacaoScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
  assert.equal(isHistoricoComunicacaoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
