import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import {
  applyMigracaoOnCreate,
  assertReconciliacaoMigracao,
  buildLoteMigracaoId,
  buildReconciliacaoMigracao,
  stampMigracaoRecord,
  stripSegredosMigracao,
} from '../src/components/lib/migracaoErpPolicy.js';

test('lote de migracao e estavel para o mesmo arquivo e contexto', () => {
  const a = buildLoteMigracaoId({
    arquivoNome: 'produtos-erp-antigo.csv',
    groupId: 'g1',
    empresaId: 'e1',
    entidade: 'Produto',
  });
  const b = buildLoteMigracaoId({
    arquivoNome: 'produtos-erp-antigo.csv',
    groupId: 'g1',
    empresaId: 'e1',
    entidade: 'Produto',
  });
  assert.equal(a, b);
  assert.match(a, /^MIG-produto-g1-e1-produtos-erp-antigo-csv$/);
});

test('migracao sem confirmacao nao grava em producao', () => {
  assert.throws(
    () => applyMigracaoOnCreate({
      entityName: 'Produto',
      record: {
        group_id: 'g1',
        empresa_id: 'e1',
        codigo: 'SKU-1',
        codigo_legado: 'SKU-1',
        origem_migracao: 'erp_antigo',
        lote_migracao: 'MIG-1',
      },
      records: [],
    }),
    /confirmacao/,
  );
});

test('migracao exige codigo legado', () => {
  assert.throws(
    () => applyMigracaoOnCreate({
      entityName: 'Produto',
      record: {
        group_id: 'g1',
        empresa_id: 'e1',
        origem_migracao: 'erp_antigo',
        lote_migracao: 'MIG-1',
        confirmado: true,
      },
      records: [],
    }),
    /Codigo legado/,
  );
});

test('retry da migracao reusa o mesmo registro pelo codigo legado', () => {
  const first = applyMigracaoOnCreate({
    entityName: 'Produto',
    record: {
      group_id: 'g1',
      empresa_id: 'e1',
      codigo: 'SKU-1',
      codigo_legado: 'SKU-1',
      origem_migracao: 'erp_antigo',
      lote_migracao: 'MIG-1',
      confirmado: true,
    },
    records: [],
  });
  assert.equal(first.reuse, null);
  assert.equal(first.record.codigo_legado, 'SKU-1');

  const retry = applyMigracaoOnCreate({
    entityName: 'Produto',
    record: first.record,
    records: [{ id: 'prod-1', group_id: 'g1', empresa_id: 'e1', codigo_legado: 'SKU-1', codigo: '0002' }],
  });
  assert.equal(retry.reuse.id, 'prod-1');
});

test('senha legada e removida na migracao de usuario', () => {
  const stamped = stampMigracaoRecord({
    group_id: 'g1',
    email: 'user@example.com',
    codigo_legado: 'user@example.com',
    senha: 'secret-legado',
    password: 'secret-legado',
  }, { entidade: 'User', confirmado: true });
  assert.equal(stamped.senha, undefined);
  assert.equal(stamped.password, undefined);
  const created = applyMigracaoOnCreate({
    entityName: 'User',
    record: stamped,
    records: [],
  });
  assert.equal(created.record.senha, undefined);
  assert.equal(stripSegredosMigracao({ senha_hash: 'x', nome: 'Ana' }).senha_hash, undefined);
});

test('codigo legado permanece mesmo sem conflito interno', () => {
  const record = applyCodigoOnCreate({
    entityName: 'Produto',
    record: {
      codigo: 'SKU-LEGADO',
      origem_migracao: 'erp_antigo',
      lote_migracao: 'MIG-1',
      group_id: 'g1',
    },
    records: [{ codigo: '0001', group_id: 'g1' }],
    sequenceValue: 1,
  });
  assert.equal(record.codigo, 'SKU-LEGADO');
  assert.equal(record.codigo_legado, 'SKU-LEGADO');
});

test('reconciliacao compara quantidade e bloqueia divergencia', () => {
  const report = buildReconciliacaoMigracao({
    origem: [{ preco_venda: 10 }, { preco_venda: 20 }],
    gravados: [{ preco_venda: 10, codigo: '0001', codigo_legado: 'A' }],
    reusos: [{ preco_venda: 20, codigo: '0002', codigo_legado: 'B' }],
  });
  assert.equal(report.quantidade_origem, 2);
  assert.equal(report.quantidade_gravada, 1);
  assert.equal(report.quantidade_reuso, 1);
  assert.equal(report.divergencia_quantidade, 0);
  assert.equal(report.total_financeiro_origem, 30);
  assert.equal(assertReconciliacaoMigracao(report), true);
  assert.throws(
    () => assertReconciliacaoMigracao({
      ...report,
      divergencia_quantidade: 1,
    }),
    /divergencia/,
  );
});

test('importadores existentes fazem staging e reconciliam', async () => {
  const lote = await readFile(new URL('../src/components/cadastros/ImportarProdutosLote.jsx', import.meta.url), 'utf8');
  const planilha = await readFile(new URL('../src/components/estoque/ImportadorProdutosPlanilha.jsx', import.meta.url), 'utf8');
  assert.match(lote, /assertReconciliacaoMigracao/);
  assert.match(lote, /confirmado: false/);
  assert.match(lote, /Boolean\(groupId\)/);
  assert.match(lote, /Codigo legado obrigatorio/);
  assert.match(planilha, /assertReconciliacaoMigracao/);
  assert.match(planilha, /confirmado: false/);
  assert.match(planilha, /contextoGrupoId/);
  assert.match(planilha, /Auditoria obrigatoria falhou/);
});
