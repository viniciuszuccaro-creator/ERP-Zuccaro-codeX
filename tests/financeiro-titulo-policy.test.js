import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertTituloOnCreate,
  assertTituloOnDelete,
  assertTituloOnUpdate,
  findDuplicateTitulo,
  tituloIdempotencyKey,
} from '../src/components/lib/financeiroTituloPolicy.js';

const titulo = {
  id: 'cr-1',
  empresa_id: 'cpa-aco',
  pedido_id: 'ped-1',
  numero_parcela: '1/3',
  valor: 100,
  status: 'Recebido',
  origem_tipo: 'pedido',
};

test('liquidated titles cannot be deleted', () => {
  assert.throws(() => assertTituloOnDelete(titulo), /Nao excluir titulo liquidado/);
  assert.doesNotThrow(() => assertTituloOnDelete({ ...titulo, status: 'Pendente' }));
});

test('settled amount and order link stay frozen after baixa', () => {
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { valor: 80 } }),
    /recalculados apos baixa/,
  );
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { pedido_id: '' } }),
    /recalculados apos baixa/,
  );
});

test('retry of the same settlement is idempotent', () => {
  const decision = assertTituloOnUpdate({
    before: titulo,
    patch: { status: 'Recebido', data_recebimento: '2026-09-07' },
  });
  assert.equal(decision.reuse.id, 'cr-1');
});

test('estorno keeps the original value and history', () => {
  const decision = assertTituloOnUpdate({
    before: titulo,
    patch: { status: 'Estornado' },
  });
  assert.equal(decision.estorno, true);
  assert.equal(decision.record.valor, 100);
  assert.equal(decision.record.pedido_id, 'ped-1');
  assert.equal(decision.record.historico_eventos.at(-1).acao, 'estorno');
});

test('duplicate receivable from the same order installment is reused', () => {
  const incoming = {
    empresa_id: 'cpa-aco',
    pedido_id: 'ped-1',
    numero_parcela: '1',
    origem_tipo: 'pedido',
    valor: 100,
  };
  assert.equal(tituloIdempotencyKey(incoming), tituloIdempotencyKey(titulo));
  assert.equal(findDuplicateTitulo(incoming, [titulo])?.id, 'cr-1');
  assert.equal(assertTituloOnCreate({ record: incoming, titles: [titulo] }).reuse.id, 'cr-1');
});

test('payment of another company is blocked', () => {
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { empresa_id: '3z' } }),
    /empresa correta/,
  );
});

test('finance persistence blocks delete of settled titles and reuses order installments', async () => {
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const lote = await readFile(new URL('../src/components/financeiro/LiquidacaoEmLote.jsx', import.meta.url), 'utf8');
  assert.match(client, /assertTituloOnDelete/);
  assert.match(client, /tituloSettlementAction/);
  assert.match(fluxo, /origem_documento_id: `\$\{pedido\.id\}/);
  assert.match(lote, /Sem permissao para baixa manual/);
});
