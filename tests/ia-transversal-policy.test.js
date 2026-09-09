import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertIaInvocation,
  assertIaUiContext,
  assertForecastUiContext,
  assertAnomalyScanContext,
  buildChurnSuggestions,
  buildConciliacaoMatchSuggestions,
  buildCrmAbcChurnSuggestions,
  buildFinanceAnomalySuggestions,
  buildFluxoCaixaProjection,
  buildReposicaoSuggestions,
  buildSecurityAnomalySuggestions,
  buildVendasRecompraSuggestions,
  isSensitiveIaExecution,
  stampAnomalyScanResult,
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

test('P2 Gate16 residual: upsell, recomendacao, PriceBrain e KYC fail-closed', async () => {
  const { buildUpsellSuggestions, buildRecomendacaoFromPedidos, stampIaLogSugestao } = await import('../src/components/lib/iaTransversalPolicy.js');

  const upsell = buildUpsellSuggestions({
    hoje: new Date('2026-09-09T12:00:00.000Z'),
    pedidos: [{
      data_pedido: '2026-08-10',
      margem_total_percentual: 30,
      itens_revenda: [{ produto_id: 'bitola_10mm', codigo_sku: 'bitola_10mm' }],
    }],
    pedidoAtual: { margem_total_percentual: 10, itens_revenda: [] },
  });
  assert.equal(upsell.modo, 'sugestao');
  assert.ok(upsell.sugestoes.length >= 1);

  const rec = buildRecomendacaoFromPedidos({
    pedidos: [{
      itens_revenda: [
        { produto_id: 'p1', descricao: 'Viga', quantidade: 2, preco_unitario: 10 },
        { produto_id: 'p1', descricao: 'Viga', quantidade: 1, preco_unitario: 10 },
      ],
    }],
    itensAtuais: [],
  });
  assert.equal(rec.recomendacoes[0].produto_id, 'p1');
  assert.equal(rec.recomendacoes[0].frequencia, 2);

  const log = stampIaLogSugestao({ resultado: 'Automático', group_id: 'g1', empresa_id: 'e1' });
  assert.equal(log.resultado, 'Sugestao');
  assert.equal(log.modo, 'sugestao');

  const upsellUi = await readFile(new URL('../src/components/comercial/IAUpsellPrecificacao.jsx', import.meta.url), 'utf8');
  const motorUi = await readFile(new URL('../src/components/comercial/MotorRecomendacao.jsx', import.meta.url), 'utf8');
  const priceUi = await readFile(new URL('../src/components/comercial/PriceBrain.jsx', import.meta.url), 'utf8');
  const kycUi = await readFile(new URL('../src/components/ia/IAKYCValidacao.jsx', import.meta.url), 'utf8');
  const iaPriceUi = await readFile(new URL('../src/components/ia/IAPriceBrain.jsx', import.meta.url), 'utf8');
  const top10Ui = await readFile(new URL('../src/components/comercial/Top10ProdutosCliente.jsx', import.meta.url), 'utf8');

  assert.match(upsellUi, /assertIaUiContext/);
  assert.match(upsellUi, /filterInContext/);
  assert.doesNotMatch(upsellUi, /entities\.Pedido\.filter/);
  assert.match(motorUi, /requireIaHumanConfirm/);
  assert.match(motorUi, /group_id: groupId/);
  assert.match(priceUi, /requireIaHumanConfirm/);
  assert.match(priceUi, /createInContext\('AuditoriaIA'/);
  assert.doesNotMatch(priceUi, /usuario_id: 'sistema'/);
  assert.match(kycUi, /stampIaLogSugestao/);
  assert.doesNotMatch(kycUi, /resultado: 'Automático'/);
  assert.match(iaPriceUi, /requireIaHumanConfirm/);
  assert.doesNotMatch(iaPriceUi, /localStorage\.getItem\('group_atual_id'\)/);
  assert.match(top10Ui, /assertIaUiContext/);
  assert.match(top10Ui, /group_id: groupId/);
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

test('P2 anomalias: stamp, seguranca e UIs no contrato de sugestao', async () => {
  assert.throws(() => assertAnomalyScanContext({ groupId: '', empresaId: 'e1' }), /Grupo/);
  assert.throws(() => assertAnomalyScanContext({ groupId: 'g1', empresaId: '', scopeType: 'empresa' }), /Empresa/);

  const stamped = stampAnomalyScanResult({
    details: [{ entidade: 'ContaReceber', severity: 'alto' }],
    warnings: [{ operation: 'alerta_externo_pendente_confirmacao' }],
    extra: { fonte: 'teste' },
  });
  assert.equal(stamped.modo, 'sugestao');
  assert.equal(stamped.anomaly, true);
  assert.equal(stamped.issues, 1);
  assert.equal(stamped.fonte, 'teste');

  const sec = buildSecurityAnomalySuggestions({
    windowMinutes: 15,
    agora: new Date('2026-09-08T12:00:00.000Z'),
    logs: Array.from({ length: 5 }, (_, i) => ({
      acao: 'Exclusão',
      data_hora: '2026-09-08T11:55:00.000Z',
      id: `l${i}`,
    })),
  });
  assert.equal(sec.modo, 'sugestao');
  assert.equal(sec.anomaly, true);
  assert.ok(sec.alerts.some((a) => /Exclusoes/i.test(a.tipo)));

  const anomUi = await readFile(new URL('../src/components/financeiro/IADetectorAnomalias.jsx', import.meta.url), 'utf8');
  const fin = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  const dash = await readFile(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
  const pedido = await readFile(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  const scan = await readFile(new URL('../base44/functions/iaFinanceAnomalyScan/entry.ts', import.meta.url), 'utf8');
  const secFn = await readFile(new URL('../base44/functions/securityAlerts/entry.ts', import.meta.url), 'utf8');
  const local = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');

  assert.match(anomUi, /assertAnomalyScanContext/);
  assert.match(anomUi, /Sugestão — sem baixa automática/);
  assert.match(fin, /IADetectorAnomalias/);
  assert.match(dash, /Sugestão/);
  assert.match(dash, /anomaliasIA\?\.anomaly/);
  assert.match(pedido, /filtros:\s*\{[\s\S]*group_id/);
  assert.match(pedido, /res\?\.data\?\.anomaly === true/);
  assert.match(scan, /modo: 'sugestao'/);
  assert.match(scan, /confirmado === true \|\| body\?\.alertar === true/);
  assert.match(secFn, /Grupo obrigatorio/);
  assert.match(secFn, /modo: 'sugestao'/);
  assert.match(local, /case 'iaFinanceAnomalyScan'/);
  assert.match(local, /modo: 'sugestao'/);
  assert.match(local, /case 'securityAlerts'/);
});
