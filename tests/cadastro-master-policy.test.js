import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyLegacyReferenceCodePolicy,
  applyCodigoOnCreate,
  applyMasterCadastroOnCreate,
  assertLegacyReferenceScope,
  findDuplicateMaster,
  normalizeLegacyReferenceCode,
  resolveNextSequentialCode,
} from '../src/api/localCadastroMasterPolicy.js';

test('legacy reference codes follow an explicit format contract', () => {
  assert.equal(normalizeLegacyReferenceCode('  VEND-01/CPA  '), 'VEND-01/CPA');
  assert.throws(() => normalizeLegacyReferenceCode('<script>1</script>'), /Codigo legado invalido/);
  assert.throws(() => normalizeLegacyReferenceCode('A'.repeat(65)), /Codigo legado invalido/);
});

test('legacy reference codes are unique inside the group and reusable in another group', () => {
  const records = [{ id: 'tab-1', group_id: 'g1', codigo_tabela_legado: 'TAB-01' }];
  assert.throws(
    () => applyLegacyReferenceCodePolicy({
      entityName: 'TabelaPreco',
      record: { group_id: 'g1', codigo_tabela_legado: 'tab-01' },
      records,
    }),
    /duplicado no grupo/,
  );
  assert.equal(applyLegacyReferenceCodePolicy({
    entityName: 'TabelaPreco',
    record: { group_id: 'g2', codigo_tabela_legado: 'TAB-01' },
    records,
  }).codigo_tabela_legado, 'TAB-01');
});

test('legacy seller code requires group context', () => {
  assert.throws(
    () => applyLegacyReferenceCodePolicy({
      entityName: 'Colaborador',
      record: { codigo_vendedor_legado: 'VEND-01' },
      records: [],
    }),
    /group_id obrigatorio/,
  );
});

test('legacy reference code blocks a company outside the resolved group', () => {
  assert.throws(
    () => assertLegacyReferenceScope({
      entityName: 'Colaborador',
      record: {
        group_id: 'g1',
        empresa_alocada_id: 'e2',
        codigo_vendedor_legado: 'VEND-01',
      },
      currentGroupId: 'g1',
      companies: [{ id: 'e2', group_id: 'g2' }],
    }),
    /Empresa externa ao grupo bloqueada/,
  );
  assert.equal(assertLegacyReferenceScope({
    entityName: 'Colaborador',
    record: {
      group_id: 'g1',
      empresa_alocada_id: 'e1',
      codigo_vendedor_legado: 'VEND-01',
    },
    currentGroupId: 'g1',
    companies: [{ id: 'e1', group_id: 'g1' }],
  }), true);
});

test('clearing a legacy reference cannot move the record to another group', () => {
  assert.throws(
    () => assertLegacyReferenceScope({
      entityName: 'TabelaPreco',
      before: { group_id: 'g1', codigo_tabela_legado: 'TAB-01' },
      record: { group_id: 'g2', codigo_tabela_legado: '' },
      currentGroupId: 'g1',
      companies: [],
    }),
    /Escopo de grupo invalido/,
  );
});

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

test('legacy reference fields are exposed with RBAC and searchable by backend', async () => {
  const tabela = await readFile(new URL('../src/components/cadastros/TabelaPrecoFormCompleto.jsx', import.meta.url), 'utf8');
  const colaborador = await readFile(new URL('../src/components/rh/ColaboradorForm.jsx', import.meta.url), 'utf8');
  const listSorted = await readFile(new URL('../base44/functions/entityListSorted/entry.ts', import.meta.url), 'utf8');
  const backendSanitizer = await readFile(new URL('../base44/functions/sanitizeOnWrite/entry.ts', import.meta.url), 'utf8');
  assert.match(tabela, /codigo_tabela_legado/);
  assert.match(tabela, /Cadastros\.Produtos\.TabelaPreco\.codigo_tabela_legado\.editar/);
  assert.match(colaborador, /codigo_vendedor_legado/);
  assert.match(colaborador, /Cadastros\.Pessoas\.Colaborador\.codigo_vendedor_legado\.editar/);
  assert.match(listSorted, /codigo_tabela_legado/);
  assert.match(listSorted, /codigo_vendedor_legado/);
  assert.match(backendSanitizer, /legacy_reference_duplicate_in_group/);
  assert.match(backendSanitizer, /empresa_outside_group/);
  const layout = await readFile(new URL('../src/Layout.jsx', import.meta.url), 'utf8');
  const localClient = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  assert.match(layout, /checkLegacyFieldRBAC/);
  assert.match(localClient, /assertLocalLegacyFieldAllowed/);
});
