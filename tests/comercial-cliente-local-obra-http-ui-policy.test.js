import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertClienteLocalNoContexto,
  assertObraNoContexto,
  buildClienteLocalDisplayLabel,
  buildObraDisplayLabel,
  canLoadClienteLocaisHttp,
  canLoadObrasHttp,
  normalizeClienteLocaisListPayload,
  normalizeObrasListPayload,
  resolveClienteIdFromEmpresaLink,
} from '../src/components/comercial/comercialClienteLocalObraHttpUiPolicy.js';

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLIENTE = '22222222-2222-4222-8222-222222222222';
const LOCAL = '33333333-3333-4333-8333-333333333333';
const OBRA = '44444444-4444-4444-8444-444444444444';

test('canLoadClienteLocaisHttp fail-closed sem hasPermission', () => {
  assert.equal(canLoadClienteLocaisHttp(undefined), false);
  assert.equal(canLoadClienteLocaisHttp(() => false), false);
});

test('canLoadClienteLocaisHttp libera Cadastros ou Pedido visualizar', () => {
  assert.equal(
    canLoadClienteLocaisHttp((module, section, action) => (
      module === 'Cadastros' && section === 'cliente_local' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadClienteLocaisHttp((module, section, action) => (
      module === 'Comercial' && section === 'pedido' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadClienteLocaisHttp((module, section, action) => (
      module === 'Comercial' && section === 'orcamento' && action === 'visualizar'
    )),
    false,
  );
});

test('canLoadObrasHttp fail-closed e libera Cadastros.obra ou Pedido', () => {
  assert.equal(canLoadObrasHttp(undefined), false);
  assert.equal(
    canLoadObrasHttp((module, section, action) => (
      module === 'Cadastros' && section === 'obra' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadObrasHttp((module, section, action) => (
      module === 'Comercial' && section === 'pedido' && action === 'visualizar'
    )),
    true,
  );
});

test('normalize payloads filtram inativos', () => {
  assert.deepEqual(
    normalizeClienteLocaisListPayload({
      data: [
        { id: 'a', ativo: true },
        { id: 'b', ativo: false },
      ],
    }).map((row) => row.id),
    ['a'],
  );
  assert.deepEqual(
    normalizeObrasListPayload([{ id: 'o', ativo: true }, { id: 'x', ativo: false }]).map((r) => r.id),
    ['o'],
  );
  assert.deepEqual(normalizeClienteLocaisListPayload(null), []);
});

test('resolveClienteIdFromEmpresaLink valida UUID', () => {
  assert.equal(resolveClienteIdFromEmpresaLink({ cliente_id: CLIENTE }), CLIENTE);
  assert.equal(resolveClienteIdFromEmpresaLink({ cliente_id: 'x' }), '');
  assert.equal(resolveClienteIdFromEmpresaLink(null), '');
});

test('assertClienteLocalNoContexto e assertObraNoContexto falham cross-tenant', () => {
  assert.throws(
    () => assertClienteLocalNoContexto({ id: LOCAL, group_id: GROUP }, {}),
    /grupo/,
  );
  assert.throws(
    () => assertClienteLocalNoContexto(
      { id: LOCAL, group_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', cliente_id: CLIENTE },
      { groupId: GROUP, clienteId: CLIENTE },
    ),
    /grupo ativo/,
  );
  assert.throws(
    () => assertObraNoContexto(
      { id: OBRA, group_id: GROUP, cliente_id: '55555555-5555-4555-8555-555555555555' },
      { groupId: GROUP, clienteId: CLIENTE },
    ),
    /cliente selecionado/,
  );
  assert.equal(
    assertClienteLocalNoContexto(
      { id: LOCAL, group_id: GROUP, cliente_id: CLIENTE },
      { groupId: GROUP, clienteId: CLIENTE },
    ).id,
    LOCAL,
  );
  assert.equal(
    assertObraNoContexto(
      { id: OBRA, group_id: GROUP, cliente_id: CLIENTE },
      { groupId: GROUP, clienteId: CLIENTE },
    ).id,
    OBRA,
  );
});

test('display labels preferem nome/código', () => {
  assert.equal(buildClienteLocalDisplayLabel({ nome: 'Depósito' }), 'Depósito');
  assert.equal(buildObraDisplayLabel({ codigo: '000001', nome: 'Torre' }), '000001 — Torre');
});
