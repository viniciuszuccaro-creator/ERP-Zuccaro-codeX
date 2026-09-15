import assert from 'node:assert/strict';
import test from 'node:test';

import { runLocalEntityBulkCreatePipeline } from '../src/api/localEntityBulkCreatePipeline.js';

const createDependencies = (overrides = {}) => ({
  legacyReferenceSpecs: {
    Colaborador: { field: 'codigo_vendedor_legado' },
  },
  supplierProtectedFieldScopes: [
    { fields: ['cpf_cnpj', 'dados_bancarios'] },
  ],
  assertMutationAllowed: () => {},
  createItem: async (item) => ({ ...item, id: `novo-${item.codigo}` }),
  ...overrides,
});

test('lote comum reutiliza create em sequencia sem exigir importar', async () => {
  const calls = [];
  const result = await runLocalEntityBulkCreatePipeline({
    entityName: 'Cliente',
    items: [{ codigo: '1' }, { codigo: '2' }],
    dependencies: createDependencies({
      assertMutationAllowed: () => calls.push('permission'),
      createItem: async (item) => {
        calls.push(`create-${item.codigo}`);
        return { ...item, id: `c${item.codigo}` };
      },
    }),
  });

  assert.deepEqual(calls, ['create-1', 'create-2']);
  assert.deepEqual(result.map((item) => item.id), ['c1', 'c2']);
});

test('codigo legado preenchido exige importar antes de criar qualquer item', async () => {
  const calls = [];
  await runLocalEntityBulkCreatePipeline({
    entityName: 'Colaborador',
    items: [{ codigo: '1', codigo_vendedor_legado: 'V-10' }],
    dependencies: createDependencies({
      assertMutationAllowed: (...args) => calls.push(['permission', ...args]),
      createItem: async (item) => {
        calls.push(['create', item.codigo]);
        return item;
      },
    }),
  });

  assert.deepEqual(calls, [
    ['permission', 'Colaborador', 'importar'],
    ['create', '1'],
  ]);
});

test('codigo legado vazio nao eleva a operacao para importar', async () => {
  const permissions = [];
  await runLocalEntityBulkCreatePipeline({
    entityName: 'Colaborador',
    items: [{ codigo: '1', codigo_vendedor_legado: '   ' }],
    dependencies: createDependencies({
      assertMutationAllowed: (...args) => permissions.push(args),
    }),
  });
  assert.deepEqual(permissions, []);
});

test('campo protegido de Fornecedor exige permissao de importar', async () => {
  const permissions = [];
  await runLocalEntityBulkCreatePipeline({
    entityName: 'Fornecedor',
    items: [{ codigo: '1', dados_bancarios: {} }],
    dependencies: createDependencies({
      assertMutationAllowed: (...args) => permissions.push(args),
    }),
  });

  assert.deepEqual(permissions, [['Fornecedor', 'importar']]);
});

test('mesmo nome de campo em outra entidade nao exige permissao de Fornecedor', async () => {
  const permissions = [];
  await runLocalEntityBulkCreatePipeline({
    entityName: 'Cliente',
    items: [{ codigo: '1', cpf_cnpj: '123' }],
    dependencies: createDependencies({
      assertMutationAllowed: (...args) => permissions.push(args),
    }),
  });
  assert.deepEqual(permissions, []);
});

test('falha em um create interrompe o lote antes dos itens seguintes', async () => {
  const attempted = [];
  await assert.rejects(() => runLocalEntityBulkCreatePipeline({
    entityName: 'Cliente',
    items: [{ codigo: '1' }, { codigo: '2' }, { codigo: '3' }],
    dependencies: createDependencies({
      createItem: async (item) => {
        attempted.push(item.codigo);
        if (item.codigo === '2') throw new Error('Item invalido');
        return item;
      },
    }),
  }), /Item invalido/);
  assert.deepEqual(attempted, ['1', '2']);
});

test('lote vazio nao exige permissao nem executa create', async () => {
  const calls = [];
  const result = await runLocalEntityBulkCreatePipeline({
    entityName: 'Fornecedor',
    dependencies: createDependencies({
      assertMutationAllowed: () => calls.push('permission'),
      createItem: async () => { calls.push('create'); return {}; },
    }),
  });
  assert.deepEqual(result, []);
  assert.deepEqual(calls, []);
});
