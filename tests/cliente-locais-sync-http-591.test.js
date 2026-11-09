/**
 * #591 — write canônico `/clientes/:id/locais` (completar contrato, sem storage paralelo).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapUiEnderecoToClienteLocalCreate,
  mapTipoEnderecoToFinalidade,
  syncClienteLocaisViaHttp,
  assertClienteLocalUiExtrasWritable,
  CLIENTE_HTTP_UNSUPPORTED_FIELDS,
} from '../src/api/clienteHttpPayload.js';

const baseEndereco = {
  apelido: 'Obra Norte',
  tipo_endereco: 'Entrega',
  cep: '01310-100',
  logradouro: 'Av Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  principal: true,
};

test('mapTipoEnderecoToFinalidade: entrega ≠ cadastral ≠ cobrança', () => {
  assert.equal(mapTipoEnderecoToFinalidade('Entrega'), 'ENTREGA');
  assert.equal(mapTipoEnderecoToFinalidade('Cobrança'), 'COBRANCA');
  assert.equal(mapTipoEnderecoToFinalidade('Cadastral'), 'CADASTRAL');
  assert.equal(mapTipoEnderecoToFinalidade('Fiscal'), 'FISCAL');
});

test('mapUiEnderecoToClienteLocalCreate: payload BFF + zeros CEP', () => {
  const body = mapUiEnderecoToClienteLocalCreate({ ...baseEndereco, cep: '01310-100' });
  assert.equal(body.cep, '01310100');
  assert.equal(body.uf, 'SP');
  assert.equal(body.pais, 'BRASIL');
  assert.deepEqual(body.finalidades, [{ finalidade: 'ENTREGA', principal: true }]);
  assert.equal(body.nome, 'Obra Norte');
});

test('extras logísticos significativos → fail-closed (sem drop)', () => {
  assert.throws(
    () => assertClienteLocalUiExtrasWritable({ horario_inicio: '08:00' }),
    (err) => err?.code === CLIENTE_HTTP_UNSUPPORTED_FIELDS
      && err.fields.includes('horario_inicio'),
  );
  assert.doesNotThrow(() => assertClienteLocalUiExtrasWritable({
    horario_inicio: '',
    contato_nome: '  ',
  }));
});

test('sync: create + update + soft-delete só com baseline carregado', async () => {
  /** @type {string[]} */
  const ops = [];
  const api = {
    createLocal: async (cid, body) => {
      ops.push(`create:${cid}:${body.nome}`);
      return { id: 'new' };
    },
    updateLocal: async (cid, lid, body) => {
      ops.push(`update:${lid}:${body.nome}`);
      return { id: lid };
    },
    softDeleteLocal: async (cid, lid) => {
      ops.push(`delete:${lid}`);
      return { id: lid };
    },
    setFinalidades: async (cid, lid, fins) => {
      ops.push(`fins:${lid}:${fins[0].finalidade}`);
      return {};
    },
  };
  const keepId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const dropId = 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  await syncClienteLocaisViaHttp({
    clienteId: 'cli-1',
    draft: [
      { ...baseEndereco, id: keepId, apelido: 'Keep' },
      { ...baseEndereco, apelido: 'Novo', principal: false },
    ],
    baselineIds: [keepId, dropId],
    api,
  });
  assert.deepEqual(ops, [
    `update:${keepId}:Keep`,
    `fins:${keepId}:ENTREGA`,
    'create:cli-1:Novo',
    `delete:${dropId}`,
  ]);
});

test('sync: baseline null (carga falhou) → não soft-delete', async () => {
  /** @type {string[]} */
  const ops = [];
  await syncClienteLocaisViaHttp({
    clienteId: 'cli-1',
    draft: [{ ...baseEndereco, apelido: 'Só create' }],
    baselineIds: null,
    api: {
      createLocal: async () => { ops.push('create'); return {}; },
      updateLocal: async () => { ops.push('update'); return {}; },
      softDeleteLocal: async () => { ops.push('delete'); return {}; },
      setFinalidades: async () => { ops.push('fins'); return {}; },
    },
  });
  assert.deepEqual(ops, ['create']);
});

test('sync: draft incompleto → erro (rascunho preservado)', async () => {
  await assert.rejects(
    () => syncClienteLocaisViaHttp({
      clienteId: 'cli-1',
      draft: [{ apelido: 'Vazio' }],
      baselineIds: [],
      api: {
        createLocal: async () => { throw new Error('não deveria'); },
        updateLocal: async () => {},
        softDeleteLocal: async () => {},
        setFinalidades: async () => {},
      },
    }),
    (err) => err?.code === 'VALIDATION_ERROR',
  );
});
