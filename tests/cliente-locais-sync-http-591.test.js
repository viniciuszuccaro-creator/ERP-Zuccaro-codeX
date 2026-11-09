/**
 * #591 — write canônico `/clientes/:id/locais` (fidelidade + parcial reconciliável).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapUiEnderecoToClienteLocalCreate,
  mapTipoEnderecoToFinalidade,
  syncClienteLocaisViaHttp,
  assertClienteLocalUiExtrasWritable,
  CLIENTE_HTTP_UNSUPPORTED_FIELDS,
  CLIENTE_LOCAIS_SYNC_PARTIAL,
  CLIENTE_LOCAIS_BATCH_ATOMIC,
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

const uuidA = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const uuidB = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const uuidDrop = 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee';

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

test('contrato: lote multi-local NÃO é atômico no BFF atual', () => {
  assert.equal(CLIENTE_LOCAIS_BATCH_ATOMIC, false);
});

test('sync: create + update + soft-delete só com baseline carregado', async () => {
  /** @type {string[]} */
  const ops = [];
  const api = {
    createLocal: async (cid, body) => {
      ops.push(`create:${cid}:${body.nome}`);
      return { id: uuidB };
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
  const summary = await syncClienteLocaisViaHttp({
    clienteId: 'cli-1',
    draft: [
      { ...baseEndereco, id: uuidA, apelido: 'Keep' },
      { ...baseEndereco, apelido: 'Novo', principal: false },
    ],
    baselineIds: [uuidA, uuidDrop],
    api,
  });
  assert.deepEqual(ops, [
    `update:${uuidA}:Keep`,
    `fins:${uuidA}:ENTREGA`,
    'create:cli-1:Novo',
    `delete:${uuidDrop}`,
  ]);
  assert.equal(summary.updated, 1);
  assert.equal(summary.created, 1);
  assert.equal(summary.deleted, 1);
  assert.equal(summary.skipped, false);
  assert.equal(summary.batchAtomic, false);
  assert.equal(summary.reconcileRequired, false);
  assert.ok(summary.ops.some((o) => o.op === 'create' && o.localId === uuidB));
});

test('sync: baseline null (carga falhou) → não soft-delete', async () => {
  /** @type {string[]} */
  const ops = [];
  await syncClienteLocaisViaHttp({
    clienteId: 'cli-1',
    draft: [{ ...baseEndereco, apelido: 'Só create' }],
    baselineIds: null,
    api: {
      createLocal: async () => { ops.push('create'); return { id: uuidB }; },
      updateLocal: async () => { ops.push('update'); return {}; },
      softDeleteLocal: async () => { ops.push('delete'); return {}; },
      setFinalidades: async () => { ops.push('fins'); return {}; },
    },
  });
  assert.deepEqual(ops, ['create']);
});

test('sync: draft incompleto → preflight VALIDATION (zero writes)', async () => {
  let writes = 0;
  await assert.rejects(
    () => syncClienteLocaisViaHttp({
      clienteId: 'cli-1',
      draft: [{ apelido: 'Vazio' }],
      baselineIds: [],
      api: {
        createLocal: async () => { writes += 1; throw new Error('não deveria'); },
        updateLocal: async () => { writes += 1; },
        softDeleteLocal: async () => { writes += 1; },
        setFinalidades: async () => { writes += 1; },
      },
    }),
    (err) => err?.code === 'VALIDATION_ERROR',
  );
  assert.equal(writes, 0);
});

test('sync: extras no lote → preflight fail-closed (zero writes)', async () => {
  let writes = 0;
  await assert.rejects(
    () => syncClienteLocaisViaHttp({
      clienteId: 'cli-1',
      draft: [{ ...baseEndereco, horario_inicio: '08:00' }],
      baselineIds: [],
      api: {
        createLocal: async () => { writes += 1; return {}; },
        updateLocal: async () => { writes += 1; },
        softDeleteLocal: async () => { writes += 1; },
        setFinalidades: async () => { writes += 1; },
      },
    }),
    (err) => err?.code === CLIENTE_HTTP_UNSUPPORTED_FIELDS,
  );
  assert.equal(writes, 0);
});

test('sync: draft undefined → skip (omissão ≠ lista vazia)', async () => {
  /** @type {string[]} */
  const ops = [];
  const result = await syncClienteLocaisViaHttp({
    clienteId: 'cli-1',
    draft: undefined,
    baselineIds: [uuidA],
    api: {
      createLocal: async () => { ops.push('create'); return {}; },
      updateLocal: async () => { ops.push('update'); return {}; },
      softDeleteLocal: async () => { ops.push('delete'); return {}; },
      setFinalidades: async () => { ops.push('fins'); return {}; },
    },
  });
  assert.deepEqual(ops, []);
  assert.equal(result.skipped, true);
});

test('sync: falha intermediária → PARTIAL com ops + reconcileRequired', async () => {
  let creates = 0;
  await assert.rejects(
    () => syncClienteLocaisViaHttp({
      clienteId: 'cli-1',
      draft: [
        { ...baseEndereco, apelido: 'A' },
        { ...baseEndereco, apelido: 'B' },
      ],
      baselineIds: [],
      api: {
        createLocal: async () => {
          creates += 1;
          if (creates > 1) throw new Error('remoto 500');
          return { id: uuidA };
        },
        updateLocal: async () => {},
        softDeleteLocal: async () => {},
        setFinalidades: async () => {},
      },
    }),
    (err) => err?.code === CLIENTE_LOCAIS_SYNC_PARTIAL
      && err.summary?.created === 1
      && err.summary?.reconcileRequired === true
      && err.summary?.batchAtomic === false
      && Array.isArray(err.summary?.ops)
      && err.summary.ops[0]?.op === 'create'
      && /reconcilie via listLocais/i.test(err.message),
  );
});

test('sync: assertScope CONTEXT_CHANGED no meio do lote', async () => {
  let guards = 0;
  await assert.rejects(
    () => syncClienteLocaisViaHttp({
      clienteId: 'cli-1',
      draft: [
        { ...baseEndereco, apelido: 'A' },
        { ...baseEndereco, apelido: 'B' },
      ],
      baselineIds: [],
      assertScope: () => {
        guards += 1;
        if (guards > 1) {
          const err = /** @type {Error & { code: string }} */ (new Error('sessão trocou'));
          err.code = 'CONTEXT_CHANGED';
          throw err;
        }
      },
      api: {
        createLocal: async () => ({ id: uuidA }),
        updateLocal: async () => {},
        softDeleteLocal: async () => {},
        setFinalidades: async () => {},
      },
    }),
    (err) => err?.code === 'CONTEXT_CHANGED',
  );
});
