import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertIaInvocation,
  buildChurnSuggestions,
  isSensitiveIaExecution,
} from '../src/components/lib/iaTransversalPolicy.js';

test('IA exige grupo e nao executa acao sensivel', () => {
  assert.throws(() => assertIaInvocation({ payload: { prompt: 'oi' } }), /Grupo obrigatorio/);
  assert.equal(isSensitiveIaExecution({ executar: true }), true);
  assert.throws(
    () => assertIaInvocation({ payload: { prompt: 'baixar titulo', acao: 'receber' }, groupId: 'g1' }),
    /Apenas sugere/,
  );
  const stamped = assertIaInvocation({ payload: { prompt: '<script>x</script> resumo' }, groupId: 'g1', empresaId: 'e1' });
  assert.equal(stamped.modo, 'sugestao');
  assert.doesNotMatch(stamped.prompt, /</);
  assert.equal(stamped.group_id, 'g1');
});

test('churn sugere risco sem gravar cadastro', () => {
  const sugestoes = buildChurnSuggestions({
    hoje: new Date('2026-09-07T12:00:00.000Z'),
    clientes: [{
      id: 'c1',
      nome: 'Ana',
      status: 'Ativo',
      data_ultima_compra: '2026-01-01',
      score_saude_cliente: 90,
    }],
    pedidos: [],
  });
  assert.equal(sugestoes.length, 1);
  assert.equal(sugestoes[0].risco_churn, 'Crítico');
});

test('churn e invoke local deixam de persistir sozinhos', async () => {
  const churn = await readFile(new URL('../src/components/ia/IAChurnMonitoramento.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  assert.match(churn, /buildChurnSuggestions/);
  assert.match(churn, /window\.confirm/);
  assert.doesNotMatch(churn, /entities\.Cliente\.update/);
  assert.doesNotMatch(churn, /resultado: 'Automático'/);
  assert.match(client, /assertIaInvocation/);
  assert.match(client, /modo: stamped\.modo/);
});
