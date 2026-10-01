import assert from 'node:assert/strict';
import test from 'node:test';
import {
  asUuidOrNull,
  formatExpedicaoHttpError,
  mapEntregaFormToHttpCreate,
} from '../src/components/lib/expedicaoHttpErrors.js';

test('formatExpedicaoHttpError mapeia codigos BFF e nao vaza token', () => {
  assert.match(formatExpedicaoHttpError({ code: 'ESTOQUE_SIDE_EFFECT_FAILED', status: 502 }), /estoque/i);
  assert.match(formatExpedicaoHttpError({ status: 403 }), /Permissao/i);
  assert.match(formatExpedicaoHttpError({ status: 404 }), /nao encontrado/i);
  assert.equal(
    formatExpedicaoHttpError({ message: 'Bearer abc.token.secret failed' }).includes('abc.token'),
    false,
  );
});

test('mapEntregaFormToHttpCreate omite IDs nao-UUID e exige itens', () => {
  assert.equal(asUuidOrNull('local_cli_1'), null);
  assert.ok(asUuidOrNull('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
  const payload = mapEntregaFormToHttpCreate({
    pedido_id: 'ped-local',
    numero_pedido: 'PED-1',
    cliente_id: 'cli-local',
    cliente_nome: 'Cliente Syn',
    cidade: 'Campinas',
    data_entrega_solicitada: '2027-01-15',
    itens: [{ descricao: 'Barra', unidade: 'UN', quantidade: 2 }],
    empresa_id: 'emp',
  });
  assert.equal(payload.pedido_id, null);
  assert.equal(payload.cliente_id, null);
  assert.equal(payload.pedido_numero, 'PED-1');
  assert.equal(payload.data_entrega_solicitada, '2027-01-15T12:00:00.000Z');
  assert.equal(payload.itens.length, 1);
  assert.equal(payload.itens[0].quantidade_pedida, 2);
});
