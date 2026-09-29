import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertClienteNoContexto,
  buildClienteDisplayLabel,
  canLoadClientesHttp,
  canLoadUnidadesMedidaHttp,
  canOpenCentralCliente360Http,
  normalizeClientesListPayload,
  normalizeUnidadesListPayload,
} from '../src/components/comercial/comercialClienteHttpUiPolicy.js';

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLIENTE = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'synthetic.jwt.session';

test('canLoadClientesHttp fail-closed sem hasPermission', () => {
  assert.equal(canLoadClientesHttp(undefined), false);
  assert.equal(canLoadClientesHttp(() => false), false);
});

test('canLoadClientesHttp libera Cadastros.cliente ou Comercial visualizar', () => {
  assert.equal(
    canLoadClientesHttp((module, section, action) => (
      module === 'Cadastros' && section === 'cliente' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadClientesHttp((module, section, action) => (
      module === 'Comercial' && section === 'orcamento' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadClientesHttp((module, section, action) => (
      module === 'Comercial' && section === 'pedido' && action === 'visualizar'
    )),
    true,
  );
});

test('canLoadUnidadesMedidaHttp fail-closed e libera Cadastros/Comercial', () => {
  assert.equal(canLoadUnidadesMedidaHttp(undefined), false);
  assert.equal(
    canLoadUnidadesMedidaHttp((module, section, action) => (
      module === 'Cadastros' && section === 'unidade_medida' && action === 'visualizar'
    )),
    true,
  );
});

test('normalizeClientesListPayload aceita envelope e array e filtra inativos', () => {
  assert.deepEqual(
    normalizeClientesListPayload({
      data: [
        { id: 'a', ativo: true },
        { id: 'b', ativo: false },
      ],
      meta: { total: 2 },
    }),
    [{ id: 'a', ativo: true }],
  );
  assert.deepEqual(
    normalizeClientesListPayload([{ id: 'c', ativo: true }, { id: 'd' }]),
    [{ id: 'c', ativo: true }, { id: 'd' }],
  );
  assert.deepEqual(normalizeClientesListPayload(null), []);
});

test('normalizeUnidadesListPayload espelha filtro de ativos', () => {
  assert.deepEqual(
    normalizeUnidadesListPayload({ data: [{ id: 'u1', ativo: true }, { id: 'u2', ativo: false }] }),
    [{ id: 'u1', ativo: true }],
  );
});

test('buildClienteDisplayLabel prioriza razão social sem inventar', () => {
  assert.equal(buildClienteDisplayLabel({ razao_social: 'CPA', nome: 'X' }), 'CPA');
  assert.equal(buildClienteDisplayLabel({ nome_fantasia: 'Fantasia' }), 'Fantasia');
  assert.equal(buildClienteDisplayLabel(null, 'fallback'), 'fallback');
  assert.equal(buildClienteDisplayLabel({}), '');
});

test('assertClienteNoContexto fail-closed fora do grupo', () => {
  assert.throws(
    () => assertClienteNoContexto({ id: CLIENTE, group_id: 'other' }, { groupId: GROUP, empresaId: EMPRESA }),
    /fora do grupo/,
  );
  assert.throws(
    () => assertClienteNoContexto({ id: CLIENTE }, { groupId: GROUP }),
    /grupo\/empresa/,
  );
  const ok = assertClienteNoContexto(
    { id: CLIENTE, group_id: GROUP },
    { groupId: GROUP, empresaId: EMPRESA },
  );
  assert.equal(ok.id, CLIENTE);
});

test('canOpenCentralCliente360Http exige Bearer tenant e RBAC quando informado', () => {
  assert.equal(canOpenCentralCliente360Http({
    flag: true,
    clienteId: CLIENTE,
    groupId: GROUP,
    empresaId: EMPRESA,
    actorId: 'actor',
    token: TOKEN,
  }), true);
  assert.equal(canOpenCentralCliente360Http({
    flag: true,
    hasPermission: () => false,
    clienteId: CLIENTE,
    groupId: GROUP,
    empresaId: EMPRESA,
    actorId: 'actor',
    token: TOKEN,
  }), false);
  assert.equal(canOpenCentralCliente360Http({
    flag: true,
    hasPermission: (m, s, a) => m === 'Cadastros' && s === 'cliente' && a === 'visualizar',
    clienteId: CLIENTE,
    groupId: GROUP,
    empresaId: EMPRESA,
    actorId: 'actor',
    token: TOKEN,
  }), true);
  assert.equal(canOpenCentralCliente360Http({
    flag: true,
    clienteId: CLIENTE,
    groupId: GROUP,
    empresaId: EMPRESA,
    actorId: 'actor',
    token: '',
  }), false);
});
