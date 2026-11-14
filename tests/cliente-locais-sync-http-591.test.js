/**
 * #591 — write canônico `/clientes/:id/locais` (fidelidade + parcial reconciliável).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapUiEnderecoToClienteLocalCreate,
  mapClienteLocalToUiEndereco,
  mapTipoEnderecoToFinalidade,
  syncClienteLocaisViaHttp,
  syncClienteLocaisAtomicViaHttp,
  buildClienteLocaisSyncOperations,
  reconcileClienteLocaisDraftAfterPartial,
  assertClienteLocalUiExtrasWritable,
  isClienteLocalCanonicalId,
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
  pais: 'BRASIL',
  principal: true,
};

const uuidA = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const uuidB = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const uuidDrop = 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee';

test('local nao inventa numero, bairro, pais ou finalidade e conserva rascunho',()=>{
  for(const field of ['numero','bairro','pais'])for(const value of [undefined,null,'']) {
    const draft={...baseEndereco,[field]:value},before=structuredClone(draft);
    assert.throws(()=>mapUiEnderecoToClienteLocalCreate(draft),e=>e.status===422&&e.fields.includes(field));
    assert.deepEqual(draft,before);
  }
  assert.throws(()=>mapTipoEnderecoToFinalidade('SEM_PROVA'),e=>e.status===422);
  assert.throws(()=>mapUiEnderecoToClienteLocalCreate({...baseEndereco,cep:'x01310100'}),e=>e.status===422);
});

test('local reaberto conserva pais, coordenadas zero, origem e finalidades distintas',()=>{
  const original={id:uuidA,nome:'Synthetic',cep:'01310100',logradouro:'Rua Sintetica',numero:'0007',bairro:'Bairro',cidade:'Cidade',uf:'SP',pais:'PAIS COMPROVADO',
    codigo:'00042',latitude:0,longitude:0,coordinate_source:'GPS',finalidades:[{finalidade:'FISCAL',principal:true},{finalidade:'ENTREGA',principal:false}]};
  const draft=mapClienteLocalToUiEndereco(original);assert.equal(draft.pais,original.pais);
  assert.equal(draft.codigo,'00042'); // apresentação BFF — UI não gera sequência
  const body=mapUiEnderecoToClienteLocalCreate(draft);
  assert.equal(body.latitude,0);assert.equal(body.longitude,0);assert.equal(body.coordinate_source,'GPS');
  assert.equal(body.pais,original.pais);assert.deepEqual(body.finalidades,original.finalidades);
  assert.throws(()=>mapUiEnderecoToClienteLocalCreate({...baseEndereco,latitude:0}),e=>e.status===422);
  assert.throws(()=>mapUiEnderecoToClienteLocalCreate({...baseEndereco,latitude:91,longitude:0}),e=>e.status===422);
});

test('sync rejeita mais de50locais antes de qualquer escrita, sem truncar ou excluir',async()=>{
  let writes=0;const api=Object.fromEntries(['createLocal','updateLocal','setFinalidades','softDeleteLocal'].map(k=>[k,async()=>{writes++;}]));
  const draft=Array.from({length:51},(_,i)=>({...baseEndereco,apelido:'Synthetic '+i}));
  await assert.rejects(syncClienteLocaisViaHttp({clienteId:'synthetic',draft,baselineIds:[uuidDrop],api}),e=>e.status===422);
  assert.equal(writes,0);assert.equal(draft.length,51);
});

test('local rejeita truncamento e origem desconhecida de coordenadas reabertas',()=>{
  for (const [field,max] of Object.entries({apelido:160,logradouro:220,numero:40,bairro:160,cidade:160,pais:80,complemento:160,observacoes:500})) {
    const draft={...baseEndereco,[field]:'x'.repeat(max+1)},before=structuredClone(draft);
    assert.throws(()=>mapUiEnderecoToClienteLocalCreate(draft),e=>e.status===422&&e.fields.includes(field));
    assert.deepEqual(draft,before);
  }
  assert.throws(()=>mapUiEnderecoToClienteLocalCreate({...baseEndereco,_fonte:'cliente_locais',latitude:0,longitude:0,coordinate_source:null}),e=>e.status===422&&e.fields.includes('coordinate_source'));
  assert.equal(mapUiEnderecoToClienteLocalCreate({...baseEndereco,latitude:0,longitude:0,coordinate_source:'MANUAL'}).coordinate_source,'MANUAL');
});

test('mapTipoEnderecoToFinalidade: entrega ≠ cadastral ≠ cobrança', () => {
  assert.equal(mapTipoEnderecoToFinalidade('Entrega'), 'ENTREGA');
  assert.equal(mapTipoEnderecoToFinalidade('Cobrança'), 'COBRANCA');
  assert.equal(mapTipoEnderecoToFinalidade('Cadastral'), 'CADASTRAL');
  assert.equal(mapTipoEnderecoToFinalidade('Fiscal'), 'FISCAL');
});

test('mapClienteLocalToUiEndereco: CADASTRAL/FISCAL não viram Entrega', async () => {
  const { mapClienteLocalToUiEndereco } = await import('../src/api/clienteHttpPayload.js');
  assert.equal(
    mapClienteLocalToUiEndereco({
      id: uuidA, nome: 'Matriz', finalidades: [{ finalidade: 'CADASTRAL', principal: true }],
    }).tipo_endereco,
    'Cadastral',
  );
  assert.equal(
    mapClienteLocalToUiEndereco({
      id: uuidB, nome: 'Fiscal', finalidades: [{ finalidade: 'FISCAL' }],
    }).tipo_endereco,
    'Fiscal',
  );
  assert.equal(
    mapClienteLocalToUiEndereco({
      id: uuidDrop, nome: 'Obra', finalidades: [{ finalidade: 'ENTREGA' }],
    }).tipo_endereco,
    'Entrega',
  );
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

test('Completo PARTIAL: baseline + carimbo create; não substitui rascunho por mapped puro', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
  const start = src.indexOf('if (code === CLIENTE_LOCAIS_SYNC_PARTIAL)');
  const end = src.indexOf('throw syncErr', start);
  assert.ok(start > 0 && end > start, 'PARTIAL catch presente');
  const block = src.slice(start, end);
  assert.match(block, /listLocais/);
  assert.match(block, /reconcileClienteLocaisDraftAfterPartial/);
  assert.match(block, /locaisHttpBaselineRef\.current = mapped/);
  assert.equal(
    /setFormData\s*\(\s*\(prev\)\s*=>\s*\(\s*\{\s*\.\.\.prev,\s*locais_entrega:\s*mapped\s*\}\s*\)/.test(block),
    false,
    'PARTIAL não pode setFormData(...locais_entrega: mapped) puro',
  );

  // Create ok + create falha: carimba id do 1º; 2º permanece sem id para retry.
  const draftPending = [
    { ...baseEndereco, apelido: 'Novo-A' },
    { ...baseEndereco, apelido: 'Novo-B-pendente' },
  ];
  let creates = 0;
  let partial;
  try {
    await syncClienteLocaisViaHttp({
      clienteId: 'cli-partial-create',
      draft: draftPending,
      baselineIds: [],
      api: {
        createLocal: async () => {
          creates += 1;
          if (creates > 1) {
            const err = /** @type {Error & { status: number }} */ (new Error('remoto 503'));
            err.status = 503;
            throw err;
          }
          return { id: uuidA, codigo: '00007' };
        },
        updateLocal: async () => {},
        softDeleteLocal: async () => {},
        setFinalidades: async () => {},
      },
    });
  } catch (err) {
    partial = err;
  }
  assert.equal(partial?.code, CLIENTE_LOCAIS_SYNC_PARTIAL);
  assert.equal(partial?.summary?.created, 1);
  assert.equal(partial?.summary?.ops?.[0]?.localId, uuidA);
  const persisted = [
    mapClienteLocalToUiEndereco({
      id: uuidA, nome: 'Novo-A', codigo: '00007', cep: '01310100', logradouro: 'Av Paulista',
      numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', pais: 'BRASIL',
      ativo: true, finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    }),
  ];
  const reconciled = reconcileClienteLocaisDraftAfterPartial(draftPending, persisted, partial.summary);
  assert.equal(reconciled[0].id, uuidA);
  assert.equal(reconciled[0].codigo, '00007');
  assert.equal(reconciled[0].apelido, 'Novo-A');
  assert.equal(reconciled[1].apelido, 'Novo-B-pendente');
  assert.ok(!isClienteLocalCanonicalId(reconciled[1].id));
  // Retry keptIds incluiria uuidA — não soft-deleta o create já gravado.
  const retryPlan = buildClienteLocaisSyncOperations(reconciled, [uuidA]);
  assert.equal(retryPlan.operations.filter((op) => op.op === 'inactivate').length, 0);
  assert.equal(retryPlan.operations.filter((op) => op.op === 'create').length, 1);
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

test('atomic ops: create + update + purposes + inactivate; omit skipped', () => {
  assert.deepEqual(
    buildClienteLocaisSyncOperations(undefined, [uuidDrop]),
    { skipped: true, operations: [], overflow: false },
  );
  const draft = [
    { ...baseEndereco, apelido: 'Novo' },
    {
      ...baseEndereco, id: uuidA, apelido: 'Existente',
      _finalidades_detalhadas: [{ finalidade: 'ENTREGA', principal: true }],
      tipo_endereco: 'Cobrança', principal: false,
    },
  ];
  const built = buildClienteLocaisSyncOperations(draft, [uuidA, uuidDrop]);
  assert.equal(built.skipped, false);
  assert.equal(built.overflow, false);
  assert.equal(built.operations.filter((op) => op.op === 'create').length, 1);
  assert.equal(built.operations.filter((op) => op.op === 'update').length, 1);
  assert.equal(built.operations.filter((op) => op.op === 'purposes').length, 1);
  assert.equal(built.operations.filter((op) => op.op === 'inactivate').length, 1);
  assert.equal(built.operations.find((op) => op.op === 'inactivate')?.id, uuidDrop);
});

test('atomic ops: overflow >50 retorna flag sem lançar (legado pré-MASTER)', () => {
  // 26 updates + 26 purposes (fins mudam) = 52 > 50 — sem chamar snapshot.
  const many = Array.from({ length: 26 }, (_, i) => ({
    ...baseEndereco,
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    apelido: `L${i}`,
    tipo_endereco: 'Entrega',
    _tipo_endereco_original: 'Entrega',
    principal: false,
    _finalidades_detalhadas: [{ finalidade: 'ENTREGA', principal: true }],
  }));
  const built = buildClienteLocaisSyncOperations(many, many.map((r) => r.id));
  assert.equal(built.skipped, false);
  assert.equal(built.overflow, true);
  assert.ok(built.operations.length > 50);
});

test('atomic sync: overflow lança CLIENTE_LOCAIS_ATOMIC_OVERFLOW (não VALIDATION genérico)', async () => {
  const many = Array.from({ length: 26 }, (_, i) => ({
    ...baseEndereco,
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    apelido: `L${i}`,
    tipo_endereco: 'Entrega',
    _tipo_endereco_original: 'Entrega',
    principal: false,
    _finalidades_detalhadas: [{ finalidade: 'ENTREGA', principal: true }],
  }));
  await assert.rejects(
    () => syncClienteLocaisAtomicViaHttp({
      clienteId: 'cli-1',
      draft: many,
      baselineIds: many.map((r) => r.id),
      api: {
        snapshotLocais: async () => {
          throw new Error('snapshot não deve ser chamado em overflow');
        },
        syncLocais: async () => {
          throw new Error('sync não deve ser chamado em overflow');
        },
      },
    }),
    (err) => err?.code === 'CLIENTE_LOCAIS_ATOMIC_OVERFLOW',
  );
});

test('atomic sync: snapshot+syncLocais batchAtomic true; conflito não parcial', async () => {
  const version = 'a'.repeat(64);
  let syncBody;
  const summary = await syncClienteLocaisAtomicViaHttp({
    clienteId: 'cli-1',
    draft: [{ ...baseEndereco, apelido: 'Novo' }],
    baselineIds: [],
    api: {
      snapshotLocais: async () => ({ version, data: [] }),
      syncLocais: async (_id, body) => {
        syncBody = body;
        return { version: 'b'.repeat(64), batchAtomic: true, data: [{ id: uuidA }] };
      },
    },
  });
  assert.equal(summary.batchAtomic, true);
  assert.equal(summary.created, 1);
  assert.equal(syncBody.version, version);
  assert.equal(syncBody.operations[0].op, 'create');

  await assert.rejects(
    () => syncClienteLocaisAtomicViaHttp({
      clienteId: 'cli-1',
      draft: [{ ...baseEndereco, apelido: 'X' }],
      baselineIds: [],
      api: {
        snapshotLocais: async () => ({ version }),
        syncLocais: async () => {
          const err = /** @type {Error & { code: string, status: number }} */ (new Error('conflict'));
          err.code = 'CLIENTE_LOCAIS_VERSION_CONFLICT';
          err.status = 409;
          throw err;
        },
      },
    }),
    (err) => err?.code === 'CLIENTE_LOCAIS_VERSION_CONFLICT',
  );
});
