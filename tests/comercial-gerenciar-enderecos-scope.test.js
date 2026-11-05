import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGerenciarEnderecosClienteQueryKey,
  isGerenciarEnderecosClienteScopeCurrent,
  resolveGerenciarEnderecosClienteKpiState,
  pickClienteEnderecosFromRows,
  listLocaisEntrega,
} from '../src/components/comercial/gerenciarEnderecosClienteScope.js';

test('GerenciarEnderecosCliente usa filterInContext/updateInContext e remove Cliente.filter unscoped', () => {
  const src = readFileSync('src/components/comercial/GerenciarEnderecosCliente.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Cliente'/);
  assert.match(src, /updateInContext\(\s*'Cliente'/);
  assert.match(src, /GERENCIAR_ENDERECOS_CLIENTE_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero endereços/);
  assert.match(src, /Carregando endereços/);
  assert.doesNotMatch(src, /entities\.Cliente\.filter\(/);
  assert.doesNotMatch(src, /entities\.Cliente\.update\(/);
  assert.doesNotMatch(src, /from ["']@\/api\/base44Client["']/);
});

test('queryKey separa cliente, Grupo, Empresa, ator e sessão', () => {
  const base = {
    clienteId: 'c1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1',
  };
  const k = buildGerenciarEnderecosClienteQueryKey(base);
  assert.deepEqual(k, ['cliente-enderecos', 'c1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildGerenciarEnderecosClienteQueryKey({ ...base, actorId: 'a2' }), k);
});

test('KPI loading/erro nunca é ready (≠ zero endereços)', () => {
  assert.equal(resolveGerenciarEnderecosClienteKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveGerenciarEnderecosClienteKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveGerenciarEnderecosClienteKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('listLocaisEntrega / pickCliente preservam contrato', () => {
  assert.deepEqual(listLocaisEntrega(null), []);
  assert.deepEqual(listLocaisEntrega({ locais_entrega: [{ apelido: 'A' }] }).map((e) => e.apelido), ['A']);
  assert.equal(pickClienteEnderecosFromRows([{ id: 'c1' }])?.id, 'c1');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isGerenciarEnderecosClienteScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isGerenciarEnderecosClienteScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
