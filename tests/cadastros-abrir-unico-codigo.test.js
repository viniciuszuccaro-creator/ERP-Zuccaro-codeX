import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { openCadastroEntityWindow } from '../src/components/cadastros/openCadastroWindow.js';
import {
  MASTER_CODE_SPECS,
  applyCodigoOnCreate,
  applyMasterCadastroOnCreate,
  resolveNextSequentialCode,
} from '../src/api/localCadastroMasterPolicy.js';

test('openCadastroEntityWindow passa uniqueKey Cadastros.<entidade>.visualizador', () => {
  const calls = [];
  openCadastroEntityWindow((component, props, options) => {
    calls.push({ component, props, options });
    return 'w1';
  }, {
    component: 'Viewer',
    entityName: 'GrupoProduto',
    title: 'Grupos/Linhas de Produto',
    props: { nomeEntidade: 'GrupoProduto' },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.uniqueKey, 'Cadastros.GrupoProduto.visualizador');
  assert.equal(calls[0].options.title, 'Grupos/Linhas de Produto');
});

test('openCadastroEntityWindow: segundo clique imediato ainda reusa uniqueKey', () => {
  const keys = [];
  const open = (_c, _p, options) => {
    keys.push(options.uniqueKey);
    return `w-${keys.length}`;
  };
  openCadastroEntityWindow(open, { component: 'X', entityName: 'SetorAtividade', title: 'Setores' });
  openCadastroEntityWindow(open, { component: 'X', entityName: 'SetorAtividade', title: 'Setores' });
  assert.deepEqual(keys, [
    'Cadastros.SetorAtividade.visualizador',
    'Cadastros.SetorAtividade.visualizador',
  ]);
});

test('MASTER_CODE_SPECS cobre auxiliares Cadastros Gerais (escopo Grupo)', () => {
  for (const entity of [
    'Marca', 'GrupoProduto', 'SetorAtividade', 'UnidadeMedida', 'Servico',
    'Cliente', 'Fornecedor', 'Produto',
  ]) {
    assert.ok(MASTER_CODE_SPECS[entity], `spec ausente: ${entity}`);
    assert.equal(MASTER_CODE_SPECS[entity].field, 'codigo');
  }
});

test('sequência: gaps preservados; próximo = max+1', () => {
  assert.equal(resolveNextSequentialCode({
    records: [{ codigo: '000007' }, { codigo: '000025' }, { codigo: '000103' }],
    field: 'codigo',
    width: 6,
  }), '000104');
});

test('Marca/Grupo: criação gera código; duplicado falha fechado', () => {
  const created = applyCodigoOnCreate({
    entityName: 'Marca',
    record: { group_id: 'g1', nome_marca: 'Nova' },
    records: [{ codigo: '000003', group_id: 'g1' }],
    sequenceValue: 3,
  });
  assert.equal(created.codigo, '000004');

  assert.throws(
    () => applyMasterCadastroOnCreate({
      entityName: 'GrupoProduto',
      record: { group_id: 'g1', nome_grupo: 'X', codigo: 'GATED-GP' },
      records: [{ id: 'gp1', group_id: 'g1', codigo: 'GATED-GP' }],
      sequenceValue: 0,
    }),
    /Codigo duplicado/,
  );
});

test('Blocos Cadastros usam openCadastroEntityWindow; migration 025 e reserve existem', async () => {
  const bloco2 = await readFile(new URL('../src/components/cadastros/blocks/Bloco2Produtos.jsx', import.meta.url), 'utf8');
  const wm = await readFile(new URL('../src/components/lib/WindowManager.jsx', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../server/migrations/025_cadastros_codigo_registro.sql', import.meta.url), 'utf8');
  const reserve = await readFile(new URL('../server/src/repositories/reserveEntityCodigo.ts', import.meta.url), 'utf8');
  assert.match(bloco2, /openCadastroEntityWindow/);
  assert.match(wm, /uniqueKeyRegistryRef/);
  assert.match(migration, /uq_marcas_group_codigo/);
  assert.match(migration, /SetorAtividade/);
  assert.match(reserve, /reserve_entity_codigo/);
  assert.match(reserve, /GREATEST/);
});
