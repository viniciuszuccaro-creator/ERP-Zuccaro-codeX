import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertApontamento,
  assertOpOnCreate,
  assertOpOnDelete,
  assertOpOnUpdate,
  classifyOpStatusTransition,
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

test('status transitions classify apontar vs aprovar and freeze empresa', () => {
  assert.equal(classifyOpStatusTransition('Planejada', 'Em Corte'), 'apontar');
  assert.equal(classifyOpStatusTransition('Em Conferência', 'Pronto para Expedição'), 'aprovar');
  const before = { id: 'op-1', empresa_id: 'e1', pedido_id: 'p1', numero_op: 'OP-1', status: 'Em Corte' };
  assert.equal(assertOpOnUpdate({ before, patch: { status: 'Em Conferência' } }).action, 'apontar');
  assert.throws(
    () => assertOpOnUpdate({ before: { ...before, status: 'Concluída' }, patch: { empresa_id: 'e2' } }),
    /empresa correta/,
  );
  assert.throws(() => assertOpOnDelete({ status: 'Concluída' }), /OP finalizada/);
  assert.throws(() => assertOpOnDelete({ status: 'Em Corte', estoque_baixado: true }), /estoque consumido/);
});

test('fluxo existente nao usa relogio no numero da OP e fecha fail-open de editar', async () => {
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const modal = await readFile(new URL('../src/components/comercial/GerarOPModal.jsx', import.meta.url), 'utf8');
  const apontamento = await readFile(new URL('../src/components/producao/ApontamentoProducao.jsx', import.meta.url), 'utf8');
  const cadastro = await readFile(new URL('../src/api/localCadastroMasterPolicy.js', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const kanban = await readFile(new URL('../src/components/producao/KanbanProducao.jsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../src/components/producao/FormularioOrdemProducao.jsx', import.meta.url), 'utf8');
  const pedidos = await readFile(new URL('../src/components/comercial/PedidosTab.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(fluxo, /OP-\$\{Date\.now\(\)\}/);
  assert.doesNotMatch(fluxo, /Estoque atualizado por consumo de producao/);
  assert.doesNotMatch(modal, /OP-\$\{Date\.now\(\)\}/);
  assert.match(modal, /Sem permissao para gerar ordem de producao/);
  assert.match(cadastro, /OrdemProducao: \{ field: 'numero_op'/);
  assert.match(apontamento, /concluirOPCompleto/);
  assert.match(apontamento, /Conferir e liberar/);
  assert.doesNotMatch(apontamento, /Ordens Producao", "editar"\)/);
  assert.match(client, /OrdemProducao: \{ module: 'Producao'/);
  assert.match(client, /assertOpOnUpdate/);
  assert.match(client, /assertOpOnDelete/);
  assert.match(kanban, /filterInContext\('OrdemProducao'/);
  assert.match(kanban, /Sem permissao para alterar OP no Kanban/);
  assert.match(form, /groupId && empresaId/);
  assert.match(form, /canAprovarOP/);
  assert.match(pedidos, /Producao', 'OrdemProducao', 'criar'/);
});
