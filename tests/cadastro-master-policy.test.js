import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyCodigoOnCreate,
  applyMasterCadastroOnCreate,
  findDuplicateMaster,
  resolveNextSequentialCode,
} from '../src/api/localCadastroMasterPolicy.js';

test('sequential product codes increment from existing records, not a page count', () => {
  const next = resolveNextSequentialCode({
    records: [{ codigo: '0007' }, { codigo: 'SKU-A' }, { codigo: '0012' }],
    field: 'codigo',
    width: 4,
    currentMax: 10,
  });
  assert.equal(next, '0013');
});

test('conflicting imported code is preserved as legado and replaced by the next internal code', () => {
  const record = applyCodigoOnCreate({
    entityName: 'Produto',
    record: { codigo: '0001', descricao: 'Barra 3/8', group_id: 'local_grupo_cpa' },
    records: [{ codigo: '0001', group_id: 'local_grupo_cpa' }],
    sequenceValue: 1,
  });
  assert.equal(record.codigo, '0002');
  assert.equal(record.codigo_origem, '0001');
  assert.equal(record.codigo_legado, '0001');
});

test('typed product code without migration is always reserved by the backend', () => {
  const record = applyCodigoOnCreate({
    entityName: 'Produto',
    record: { codigo: 'SKU-LIVRE', descricao: 'Barra', group_id: 'local_grupo_cpa' },
    records: [{ codigo: '0003', group_id: 'local_grupo_cpa' }],
    sequenceValue: 3,
  });
  assert.equal(record.codigo, '0004');
  assert.equal(record.codigo_origem, 'SKU-LIVRE');
});

test('master create without groupId fails closed', () => {
  assert.throws(
    () => applyMasterCadastroOnCreate({
      entityName: 'Cliente',
      record: { cnpj: '12.345.678/0001-99' },
      records: [],
    }),
    /group_id obrigatorio/,
  );
  assert.equal(findDuplicateMaster({
    entityName: 'Produto',
    record: { codigo: '0001' },
    records: [],
  })?.type, 'sem_grupo');
});

test('duplicate product code in the same group is rejected', () => {
  assert.equal(findDuplicateMaster({
    entityName: 'Produto',
    record: { codigo: '0007', group_id: 'local_grupo_cpa' },
    records: [{ id: 'p1', codigo: '0007', group_id: 'local_grupo_cpa' }],
  })?.type, 'codigo');
  assert.throws(
    () => applyMasterCadastroOnCreate({
      entityName: 'Produto',
      record: { codigo: '0007', group_id: 'local_grupo_cpa' },
      records: [{ id: 'p1', codigo: '0007', group_id: 'local_grupo_cpa' }],
      sequenceValue: 7,
    }),
    /Codigo duplicado/,
  );
});

test('duplicate customer document in the same group is rejected', () => {
  assert.equal(findDuplicateMaster({
    entityName: 'Cliente',
    record: { cnpj: '12.345.678/0001-99', group_id: 'local_grupo_cpa' },
    records: [{ id: 'cli-1', cnpj: '12345678000199', group_id: 'local_grupo_cpa' }],
  })?.type, 'documento');
  assert.throws(
    () => applyMasterCadastroOnCreate({
      entityName: 'Cliente',
      record: { cpf: '123.456.789-09', group_id: 'local_grupo_cpa' },
      records: [{ id: 'cli-2', cpf: '12345678909', group_id: 'local_grupo_cpa' }],
    }),
    /duplicado/,
  );
});

test('product form no longer invents the next code from a frontend list', async () => {
  const form = await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const viewer = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  const counts = await readFile(new URL('../src/components/lib/useEntityCounts.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(form, /ultimoCodigo \+ 1/);
  assert.doesNotMatch(form, /produtos-codes-sample/);
  assert.match(form, /Gerado ao salvar/);
  assert.match(form, /Nao foi possivel validar o codigo do produto/);
  assert.match(client, /applyLocalMasterCadastro/);
  assert.match(client, /applyMasterCadastroOnCreate/);
  assert.match(client, /group_id obrigatorio para cadastro mestre/);
  assert.match(viewer, /buildMultiempresaReadFilter/);
  assert.doesNotMatch(viewer, /return orConds\.length \? \{ \$or: orConds \} : \{\}/);
  assert.match(viewer, /contextoValido = !!\(empresaId \|\| groupId\)/);
  assert.match(counts, /Catálogos "simples" tambem recebem group\/empresa/);
});
