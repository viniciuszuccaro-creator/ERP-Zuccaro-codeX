import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPerfilRiscoClienteQueryKey,
  isPerfilRiscoClienteScopeCurrent,
  resolvePerfilRiscoClienteKpiState,
  pickClienteRiscoFromRows,
} from '../src/components/comercial/perfilRiscoClienteScope.js';

test('WidgetPerfilRiscoCliente usa filterInContext e remove Cliente.get unscoped', () => {
  const src = readFileSync('src/components/comercial/WidgetPerfilRiscoCliente.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Cliente'/);
  assert.match(src, /PERFIL_RISCO_CLIENTE_STALE_SCOPE/);
  assert.match(src, /erro ≠ ausência/);
  assert.match(src, /Carregando perfil de risco/);
  assert.match(src, /enabled: Boolean\(clienteId\) && contextoValido/);
  assert.doesNotMatch(src, /entities\.Cliente\.get\(/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*cliente\s*=\s*null/);
});

test('queryKey separa cliente, Grupo, Empresa, ator e sessão', () => {
  const base = {
    clienteId: 'c1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1',
  };
  const k = buildPerfilRiscoClienteQueryKey(base);
  assert.deepEqual(k, ['cliente-risco', 'c1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildPerfilRiscoClienteQueryKey({ ...base, sessionKey: 's2' }), k);
  assert.notDeepEqual(buildPerfilRiscoClienteQueryKey({ ...base, actorId: 'a2' }), k);
  assert.notDeepEqual(buildPerfilRiscoClienteQueryKey({ ...base, empresaId: 'e2' }), k);
});

test('KPI loading/erro/unavailable nunca é ready (≠ ausência silenciosa)', () => {
  assert.equal(resolvePerfilRiscoClienteKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolvePerfilRiscoClienteKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolvePerfilRiscoClienteKpiState({
    contextoValido: false, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolvePerfilRiscoClienteKpiState({
    contextoValido: true, clienteId: null, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolvePerfilRiscoClienteKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('pickClienteRiscoFromRows preserva primeiro registro do escopo', () => {
  assert.equal(pickClienteRiscoFromRows(null), null);
  assert.equal(pickClienteRiscoFromRows([]), null);
  assert.equal(pickClienteRiscoFromRows([{ id: 'c1' }, { id: 'c2' }])?.id, 'c1');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isPerfilRiscoClienteScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isPerfilRiscoClienteScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
  assert.equal(isPerfilRiscoClienteScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
