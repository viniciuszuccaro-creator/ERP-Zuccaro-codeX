import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertIaInvocation,
  assertIaUiContext,
  assertForecastUiContext,
  buildChurnSuggestions,
  buildConciliacaoMatchSuggestions,
  buildCrmAbcChurnSuggestions,
  buildFinanceAnomalySuggestions,
  buildFluxoCaixaProjection,
  buildReposicaoSuggestions,
  buildVendasRecompraSuggestions,
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

test('P2 IA transversal: CRM, financeiro e logistica usam sugestao com contexto', async () => {
  assert.throws(() => assertIaUiContext({ groupId: '', empresaId: 'e1' }), /Grupo/);
  assert.throws(() => assertIaUiContext({ groupId: 'g1', empresaId: '', scopeType: 'empresa' }), /Empresa/);

  const crm = buildCrmAbcChurnSuggestions({
    clientes: [{
      id: 'c1',
      nome: 'Ana',
      status: 'Ativo',
      classificacao_abc: 'A',
      dias_sem_comprar: 95,
      valor_compras_12meses: 20000,
      ticket_medio: 1500,
    }],
  });
  assert.equal(crm.modo, 'sugestao');
  assert.equal(crm.oportunidades_criadas, 0);
  assert.equal(crm.clientes_risco, 1);

  const anom = buildFinanceAnomalySuggestions({
    receber: [
      { id: 'r1', descricao: 'X', valor: 100, data_vencimento: '2026-01-01' },
      { id: 'r2', descricao: 'X', valor: 100, data_vencimento: '2026-01-01' },
      { id: 'r3', descricao: 'Outlier', valor: 50000, data_vencimento: '2026-02-01' },
    ],
    pagar: [],
  });
  assert.equal(anom.modo, 'sugestao');
  assert.ok(anom.anomalias.some((a) => a.tipo === 'Possível Duplicidade'));

  const conc = buildConciliacaoMatchSuggestions({
    extratos: [{ id: 'e1', valor: 10, data_movimento: '2026-09-01', descricao: 'Pix' }],
    movimentos: [{ id: 'm1', valor: 10, data_movimento: '2026-09-01' }],
  });
  assert.equal(conc.conciliados, 1);
  assert.equal(conc.modo, 'sugestao');

  const crmUi = await readFile(new URL('../src/components/crm/IAChurnDetection.jsx', import.meta.url), 'utf8');
  const concUi = await readFile(new URL('../src/components/financeiro/ConciliacaoAutomaticaIA.jsx', import.meta.url), 'utf8');
  const anomUi = await readFile(new URL('../src/components/financeiro/IADetectorAnomalias.jsx', import.meta.url), 'utf8');
  const prevUi = await readFile(new URL('../src/components/logistica/IAPrevisaoEntrega.jsx', import.meta.url), 'utf8');
  const sim = await readFile(new URL('../src/components/integracoes/iaPrevisaoLogisticaData.js', import.meta.url), 'utf8');

  assert.match(crmUi, /buildCrmAbcChurnSuggestions/);
  assert.match(crmUi, /requireIaHumanConfirm/);
  assert.doesNotMatch(crmUi, /entities\.Oportunidade\.create/);
  assert.match(concUi, /buildConciliacaoMatchSuggestions/);
  assert.match(concUi, /requireIaHumanConfirm/);
  assert.match(anomUi, /buildFinanceAnomalySuggestions/);
  assert.match(prevUi, /assertIaUiContext/);
  assert.match(prevUi, /group_id: groupId/);
  assert.match(sim, /fonte: realAggregates/);
});

test('P2 previsoes: reposicao, recompra e caixa usam policy com sugestao', async () => {
  assert.throws(() => assertForecastUiContext({ groupId: 'g1', empresaId: '', scopeType: 'empresa' }), /Empresa/);

  const repos = buildReposicaoSuggestions({
    produtos: [{
      id: 'p1',
      descricao: 'Bitola',
      status: 'Ativo',
      estoque_atual: 2,
      estoque_reservado: 0,
      estoque_minimo: 10,
    }],
    movimentacoes: [],
  });
  assert.equal(repos.modo, 'sugestao');
  assert.equal(repos.sugestoes.length, 1);
  assert.ok(repos.sugestoes[0].quantidade_sugerida >= 8);

  const hoje = new Date('2026-09-07T12:00:00.000Z');
  const recompra = buildVendasRecompraSuggestions({
    hoje,
    clientes: [{
      id: 'c1',
      nome: 'Ana',
      status: 'Ativo',
      data_ultima_compra: '2026-08-01',
      classificacao_abc: 'A',
      ticket_medio: 1000,
    }],
    pedidos: [
      { cliente_id: 'c1', data_pedido: '2026-06-01' },
      { cliente_id: 'c1', data_pedido: '2026-07-01' },
      { cliente_id: 'c1', data_pedido: '2026-08-01' },
    ],
  });
  assert.equal(recompra.modo, 'sugestao');
  assert.ok(recompra.previsoes.length >= 1);

  const caixa = buildFluxoCaixaProjection({
    contasReceber: [{ status: 'Pendente', valor: 100, data_vencimento: '2026-09-15' }],
    contasPagar: [{ status: 'Pendente', valor: 40, data_vencimento: '2026-09-20' }],
    mesesProjecao: 1,
    hoje: new Date('2026-09-01T12:00:00.000Z'),
  });
  assert.equal(caixa.modo, 'sugestao');
  assert.equal(caixa.meses.length, 1);
  assert.equal(caixa.meses[0].receitaPrevista, 100);

  const reposUi = await readFile(new URL('../src/components/estoque/IAReposicao.jsx', import.meta.url), 'utf8');
  const vendasUi = await readFile(new URL('../src/components/ia/IAVendasPreditivas.jsx', import.meta.url), 'utf8');
  const formEntrega = await readFile(new URL('../src/components/expedicao/FormularioEntrega.jsx', import.meta.url), 'utf8');
  const fluxo = await readFile(new URL('../src/components/relatorios/FluxoCaixaProjetado.jsx', import.meta.url), 'utf8');

  assert.match(reposUi, /buildReposicaoSuggestions/);
  assert.match(reposUi, /requireIaHumanConfirm/);
  assert.match(vendasUi, /buildVendasRecompraSuggestions/);
  assert.doesNotMatch(vendasUi, /localStorage\.getItem\('group_atual_id'\)/);
  assert.doesNotMatch(vendasUi, /resultado: 'Automatico'/);
  assert.match(formEntrega, /aplicarPrevisaoIA/);
  assert.doesNotMatch(formEntrega, /data_previsao: resultado\.data_prevista/);
  assert.match(fluxo, /scopeType === 'grupo'/);
});
