import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertApontamento,
  assertOpOnCreate,
  findDuplicateOp,
  resolveStatusAposApontamento,
} from '../src/components/lib/ordemProducaoPolicy.js';

test('ordem de producao exige empresa', () => {
  assert.throws(
    () => assertOpOnCreate({ record: { pedido_id: 'p1' }, ops: [] }),
    /Empresa obrigatoria/,
  );
});

test('retry do mesmo pedido reusa a OP', () => {
  const existing = { id: 'op-1', empresa_id: 'e1', pedido_id: 'p1', status: 'Liberada' };
  const decision = assertOpOnCreate({
    record: { empresa_id: 'e1', pedido_id: 'p1' },
    ops: [existing],
  });
  assert.equal(decision.reuse.id, 'op-1');
  assert.equal(findDuplicateOp({ empresa_id: 'e1', pedido_id: 'p1' }, [existing])?.id, 'op-1');
});

test('apontamento sem OP ou quantidade e recusado', () => {
  assert.throws(() => assertApontamento({ op: null, apontamento: { quantidade_produzida: 1 }, empresaId: 'e1' }), /OP obrigatoria/);
  assert.throws(
    () => assertApontamento({ op: { id: 'op-1', empresa_id: 'e1' }, apontamento: { quantidade_produzida: 0 }, empresaId: 'e1' }),
    /quantidade ou peso/,
  );
});

test('apontamento 100% entra em conferencia', () => {
  assert.equal(resolveStatusAposApontamento({ percentual: 100, statusAtual: 'Em Corte' }), 'Em Conferência');
  assert.equal(resolveStatusAposApontamento({ percentual: 40, statusAtual: 'Em Corte' }), 'Em Corte');
});

test('fluxo existente nao usa relogio no numero da OP e liga conferencia', async () => {
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const modal = await readFile(new URL('../src/components/comercial/GerarOPModal.jsx', import.meta.url), 'utf8');
  const apontamento = await readFile(new URL('../src/components/producao/ApontamentoProducao.jsx', import.meta.url), 'utf8');
  const cadastro = await readFile(new URL('../src/api/localCadastroMasterPolicy.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fluxo, /OP-\$\{Date\.now\(\)\}/);
  assert.doesNotMatch(modal, /OP-\$\{Date\.now\(\)\}/);
  assert.match(cadastro, /OrdemProducao: \{ field: 'numero_op'/);
  assert.match(apontamento, /concluirOPCompleto/);
  assert.match(apontamento, /Conferir e liberar/);
});
