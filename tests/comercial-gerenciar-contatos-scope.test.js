import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGerenciarContatosClienteQueryKey,
  isGerenciarContatosClienteScopeCurrent,
} from '../src/components/comercial/gerenciarContatosClienteScope.js';

test('GerenciarContatosCliente usa getInContext/updateInContext sem get/update unscoped', () => {
  const src = readFileSync('src/components/comercial/GerenciarContatosCliente.jsx', 'utf8');
  assert.match(src, /getInContext\(\s*["']Cliente["']/);
  assert.match(src, /updateInContext\(\s*["']Cliente["']/);
  assert.match(src, /READ_STALE_SCOPE/);
  assert.match(src, /buildGerenciarContatosClienteQueryKey/);
  assert.doesNotMatch(src, /entities\.Cliente\.get\(/);
  assert.doesNotMatch(src, /entities\.Cliente\.update\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
  assert.doesNotMatch(src, /Cliente\.filter\(\{\s*id:/);
});

test('queryKey separa Grupo, Empresa, ator, sessão e cliente', () => {
  const base = {
    groupId: 'g1',
    empresaId: 'e1',
    actorId: 'a1',
    sessionKey: 's1',
    clienteId: 'c9',
  };
  const k = buildGerenciarContatosClienteQueryKey(base);
  assert.deepEqual(k, ['cliente-contatos', 'g1', 'e1', 'a1', 's1', 'c9']);
  assert.notDeepEqual(
    buildGerenciarContatosClienteQueryKey({ ...base, sessionKey: 's2' }),
    k,
  );
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isGerenciarContatosClienteScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isGerenciarContatosClienteScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
  assert.equal(isGerenciarContatosClienteScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
