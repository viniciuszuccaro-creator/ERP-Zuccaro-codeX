import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { MASTER_CODE_SPECS, applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import {
  applyComprasCreate,
  assertOrdemCompraOnCreate,
  assertRecebimentoOc,
  stampMovimentacaoRecebimentoOc,
} from '../src/components/lib/comprasOrdemPolicy.js';

test('compras codes are reserved by master sequence specs', () => {
  assert.equal(MASTER_CODE_SPECS.OrdemCompra.prefix, 'OC-');
  assert.equal(MASTER_CODE_SPECS.SolicitacaoCompra.prefix, 'SC-');
  assert.equal(MASTER_CODE_SPECS.Cotacao.prefix, 'COT-');
  const oc = applyCodigoOnCreate({
    entityName: 'OrdemCompra',
    record: { empresa_id: 'e1', group_id: 'g1' },
    records: [{ numero_oc: 'OC-000003', group_id: 'g1' }],
    sequenceValue: 3,
  });
  assert.equal(oc.numero_oc, 'OC-000004');
});

test('ordem de compra exige empresa e reusa a mesma solicitacao', () => {
  assert.throws(
    () => assertOrdemCompraOnCreate({ record: { solicitacao_compra_id: 'sc1' }, orders: [] }),
    /Empresa obrigatoria/,
  );
  const first = applyComprasCreate('OrdemCompra', {
    empresa_id: 'e1',
    solicitacao_compra_id: 'sc1',
  }, { ordensCompra: [] });
  assert.equal(first.reuse, null);
  assert.equal(first.record.origem, 'solicitacao');

  const retry = applyComprasCreate('OrdemCompra', first.record, {
    ordensCompra: [{ id: 'oc1', ...first.record }],
  });
  assert.equal(retry.reuse.id, 'oc1');
});

test('recebimento de OC e idempotente e carimba empresa na movimentacao', () => {
  const before = {
    id: 'oc1',
    empresa_id: 'e1',
    group_id: 'g1',
    numero_oc: 'OC-000001',
    status: 'Enviada ao Fornecedor',
    itens: [{ produto_id: 'p1', descricao: 'Barra', quantidade_solicitada: 2, valor_unitario: 10, valor_total: 20 }],
  };
  const received = assertRecebimentoOc({ before, patch: { status: 'Recebida', data_entrega_real: '2026-09-07' } });
  assert.equal(received.record.status, 'Recebida');
  const again = assertRecebimentoOc({ before: received.record, patch: { status: 'Recebida' } });
  assert.equal(again.reuse.id, 'oc1');

  const mov = stampMovimentacaoRecebimentoOc({
    oc: received.record,
    item: before.itens[0],
    dataRecebimento: '2026-09-07',
  });
  assert.equal(mov.empresa_id, 'e1');
  assert.equal(mov.origem_movimento, 'compra');
  assert.equal(mov.documento, 'OC-000001');
});

test('telas de compras deixam de inventar SC/OC/COT com Date.now', async () => {
  const ocForm = await readFile(new URL('../src/components/compras/OrdemCompraForm.jsx', import.meta.url), 'utf8');
  const scForm = await readFile(new URL('../src/components/compras/SolicitacaoCompraForm.jsx', import.meta.url), 'utf8');
  const cotForm = await readFile(new URL('../src/components/compras/CotacaoForm.jsx', import.meta.url), 'utf8');
  const scTab = await readFile(new URL('../src/components/compras/SolicitacoesCompraTab.jsx', import.meta.url), 'utf8');
  const cotTab = await readFile(new URL('../src/components/compras/CotacoesTab.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ocForm, /OC-\$\{Date\.now/);
  assert.doesNotMatch(scForm, /SC-\$\{Date\.now/);
  assert.doesNotMatch(cotForm, /COT-\$\{Date\.now/);
  assert.doesNotMatch(scTab, /OC-\$\{Date\.now/);
  assert.doesNotMatch(scTab, /SC-\$\{Date\.now/);
  assert.doesNotMatch(cotTab, /cotacoes\.length \+ 1/);
  assert.match(cotTab, /createInContext\('Cotacao'/);
  assert.match(scTab, /solicitacao_compra_id: solicitacao\.id/);
});
