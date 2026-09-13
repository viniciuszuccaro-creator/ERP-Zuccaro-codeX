import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import {
  applyMigracaoOnCreate,
  assertReconciliacaoMigracao,
  buildPendingManualReconciliation,
  buildLoteMigracaoId,
  buildReconciliacaoMigracao,
  MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
  stampMigracaoRecord,
  stripSegredosMigracao,
} from '../src/components/lib/migracaoErpPolicy.js';
import { assertTituloOnCreate, assertTituloOnUpdate } from '../src/components/lib/financeiroTituloPolicy.js';

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

test('titulo financeiro sem evidencia fica isolado no staging para conciliacao manual', () => {
  const origem = {
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_legado: 'titulo-1',
    status: 'Pago',
    status_pagamento: 'Pago',
    data_pagamento: '2020-01-15',
    valor_pago: 125.5,
    valor: 125.5,
  };
  const snapshot = { ...origem };
  const staging = buildPendingManualReconciliation(origem, {
    arquivoNome: 'titulos.csv',
    registradoPor: 'financeiro-1',
    registradoEm: '2026-09-13T12:00:00.000Z',
  });

  assert.deepEqual(origem, snapshot);
  assert.equal(staging.status_migracao, MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION);
  assert.equal(staging.destino_migracao, 'staging');
  assert.equal(staging.confirmado, false);
  assert.equal(staging.bloqueio_operacional, true);
  assert.equal(staging.requer_conciliacao_manual, true);
  assert.equal(staging.decisao_financeira, null);
  assert.equal(staging.status, undefined);
  assert.equal(staging.status_pagamento, undefined);
  assert.equal(staging.data_pagamento, undefined);
  assert.equal(staging.valor_pago, undefined);
  assert.deepEqual(staging.dados_origem_migracao, origem);
  assert.deepEqual(staging.aprovacoes_conciliacao, []);
  assert.equal(staging.historico_conciliacao[0].usuario_id, 'financeiro-1');
  assert.equal(staging.historico_conciliacao[0].group_id, 'g1');
  assert.equal(staging.historico_conciliacao[0].empresa_id, 'e1');
});

test('conciliacao manual exige contexto completo, codigo legado e auditoria', () => {
  const base = { group_id: 'g1', empresa_id: 'e1', codigo_legado: 'titulo-1' };
  const audit = { registradoPor: 'financeiro-1', registradoEm: '2026-09-13T12:00:00.000Z' };
  assert.throws(
    () => buildPendingManualReconciliation({ ...base, empresa_id: '' }, audit),
    /Grupo e Empresa/,
  );
  assert.throws(
    () => buildPendingManualReconciliation({ ...base, codigo_legado: '' }, audit),
    /Codigo legado/,
  );
  assert.throws(
    () => buildPendingManualReconciliation(base),
    /Usuario e data/,
  );
  assert.throws(
    () => buildPendingManualReconciliation(base, { ...audit, registradoEm: 'data-invalida' }),
    /Data de auditoria invalida/,
  );
});

test('pendencia manual nao pode ser promovida nem liquidada pelo fluxo operacional', () => {
  const staging = buildPendingManualReconciliation({
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_legado: 'titulo-1',
    status_pagamento: 'Pago',
  }, {
    registradoPor: 'financeiro-1',
    registradoEm: '2026-09-13T12:00:00.000Z',
  });

  assert.throws(
    () => applyMigracaoOnCreate({ entityName: 'ContaPagar', record: { ...staging, confirmado: true } }),
    /permanece no staging/,
  );
  assert.throws(
    () => assertTituloOnCreate({ record: { ...staging, status: 'Pendente' } }),
    /permanecer no staging/,
  );
  assert.throws(
    () => assertTituloOnUpdate({
      before: { id: 'cp-1', ...staging },
      patch: { status: 'Pago', status_pagamento: 'Pago' },
    }),
    /nao pode ser alterado/,
  );
});

test('importadores existentes fazem staging e reconciliam', async () => {
  const lote = await readFile(new URL('../src/components/cadastros/ImportarProdutosLote.jsx', import.meta.url), 'utf8');
  const planilha = await readFile(new URL('../src/components/estoque/ImportadorProdutosPlanilha.jsx', import.meta.url), 'utf8');
  const nfe = await readFile(new URL('../src/components/cadastros/ImportarProdutosNFe.jsx', import.meta.url), 'utf8');
  const nfeAuto = await readFile(new URL('../src/components/cadastros/ImportacaoProdutoNFe.jsx', import.meta.url), 'utf8');
  const backup = await readFile(new URL('../src/components/sistema/ConfiguracaoBackup.jsx', import.meta.url), 'utf8');
  assert.match(lote, /assertReconciliacaoMigracao/);
  assert.match(lote, /confirmado: false/);
  assert.match(lote, /Boolean\(groupId\)/);
  assert.match(lote, /Codigo legado obrigatorio/);
  assert.match(planilha, /assertReconciliacaoMigracao/);
  assert.match(planilha, /confirmado: false/);
  assert.match(planilha, /contextoGrupoId/);
  assert.match(planilha, /Auditoria obrigatoria falhou/);
  assert.match(nfe, /stampMigracaoRecord/);
  assert.match(nfe, /assertReconciliacaoMigracao/);
  assert.match(nfe, /origem_migracao: 'nfe_xml'/);
  assert.match(nfe, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.doesNotMatch(nfe, /catch \(_\) \{\}/);
  assert.match(nfeAuto, /stampMigracaoRecord/);
  assert.match(nfeAuto, /assertReconciliacaoMigracao/);
  assert.match(nfeAuto, /origem_migracao: 'nfe_xml'/);
  assert.match(nfeAuto, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.doesNotMatch(nfeAuto, /catch \(_\) \{\}/);
  const fiscalXml = await readFile(new URL('../src/components/fiscal/ImportarXMLNFe.jsx', import.meta.url), 'utf8');
  assert.match(fiscalXml, /stampMigracaoRecord/);
  assert.match(fiscalXml, /assertReconciliacaoMigracao/);
  assert.match(fiscalXml, /origem_migracao: 'nfe_xml'/);
  assert.match(fiscalXml, /groupId && empresaSelecionadaId/);
  assert.match(fiscalXml, /createInContext\('AuditLog'/);
  assert.doesNotMatch(fiscalXml, /console\.warn\('Falha ao auditar importacao XML NF-e:/);
  const recebimento = await readFile(new URL('../src/components/compras/ImportacaoNFeRecebimento.jsx', import.meta.url), 'utf8');
  assert.match(recebimento, /groupId && empresaId/);
  assert.match(recebimento, /simulacao: true/);
  assert.match(recebimento, /Resultado simulado/);
  assert.match(recebimento, /throw error/);
  assert.doesNotMatch(recebimento, /console\.warn\('Falha ao auditar importacao de NF-e:/);
  const botoes = await readFile(new URL('../src/components/cadastros/BotoesImportacaoProduto.jsx', import.meta.url), 'utf8');
  assert.match(botoes, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.match(botoes, /Auditoria obrigatoria falhou/);
  assert.doesNotMatch(botoes, /catch \(_\) \{\}/);
  const ocTab = await readFile(new URL('../src/components/compras/OrdensCompraTab.jsx', import.meta.url), 'utf8');
  assert.match(ocTab, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.match(ocTab, /Auditoria obrigatoria falhou para ordem de compra/);
  assert.doesNotMatch(ocTab, /console\.warn\('Falha ao auditar ordem de compra:/);
  const ocForm = await readFile(new URL('../src/components/compras/RecebimentoOCForm.jsx', import.meta.url), 'utf8');
  assert.match(ocForm, /groupId && \(contexto === 'grupo' \|\| empresaId\)/);
  assert.match(ocForm, /Auditoria obrigatoria falhou para recebimento de OC/);
  for (const name of [
    'SolicitacaoCompraForm.jsx',
    'CotacaoForm.jsx',
    'CotacoesTab.jsx',
    'AvaliacaoFornecedorForm.jsx',
    'FornecedoresTabOptimized.jsx',
    'DetalhesFornecedor.jsx',
  ]) {
    const src = await readFile(new URL(`../src/components/compras/${name}`, import.meta.url), 'utf8');
    assert.match(src, /groupId && \(contexto === 'grupo' \|\| empresaId\)/, name);
    assert.match(src, /Auditoria obrigatoria falhou/, name);
    assert.doesNotMatch(src, /Boolean\(groupId \|\| empresaId\)/, name);
    assert.doesNotMatch(src, /console\.warn\('Falha ao auditar/, name);
  }
  assert.match(backup, /throw error/);
  assert.doesNotMatch(backup, /Falha ao registrar configuracao de backup\.', error\);\r?\n\s*\}/);
});
