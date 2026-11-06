import { stampIaSuggestion } from './iaInvocationPolicy.js';

export const buildFinanceAnomalySuggestions = ({ receber = [], pagar = [], limite = 20 } = {}) => {
  const detectadas = [];
  const valores = [...receber, ...pagar].map((c) => c.valor || 0).filter((v) => v > 0);
  const media = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
  const desvio = valores.length
    ? Math.sqrt(valores.map((v) => Math.pow(v - media, 2)).reduce((a, b) => a + b, 0) / valores.length)
    : 0;

  [...receber, ...pagar].forEach((conta) => {
    if ((conta.valor || 0) > media + (3 * desvio) && desvio > 0) {
      detectadas.push({
        tipo: 'Valor Atípico',
        severidade: 'alta',
        conta,
        descricao: `Valor R$ ${Number(conta.valor).toLocaleString('pt-BR')} e 3x acima da media (R$ ${media.toFixed(2)})`,
        recomendacao: 'Verificar se o valor esta correto e se nao e duplicidade',
      });
    }
  });

  const mapa = {};
  [...receber, ...pagar].forEach((conta) => {
    const chave = `${conta.descricao}_${conta.valor}_${conta.data_vencimento}`;
    if (!mapa[chave]) mapa[chave] = [];
    mapa[chave].push(conta);
  });
  Object.values(mapa).forEach((grupo) => {
    if (grupo.length > 1) {
      detectadas.push({
        tipo: 'Possível Duplicidade',
        severidade: 'media',
        conta: grupo[0],
        descricao: `${grupo.length} titulos com descricao, valor e vencimento identicos`,
        recomendacao: 'Verificar se nao sao lancamentos duplicados',
        relacionados: grupo.slice(1).map((c) => c.id),
      });
    }
  });

  pagar.forEach((conta, idx) => {
    if (idx > 0 && conta.fornecedor === pagar[idx - 1].fornecedor) {
      const diff = Math.abs(
        new Date(conta.created_date).getTime() - new Date(pagar[idx - 1].created_date).getTime()
      ) / (1000 * 60);
      if (diff < 5) {
        detectadas.push({
          tipo: 'Lançamentos Sequenciais',
          severidade: 'baixa',
          conta,
          descricao: `2 lancamentos para ${conta.fornecedor} em ${Math.round(diff)} minutos`,
          recomendacao: 'Verificar se ambos sao necessarios',
        });
      }
    }
  });

  receber.forEach((conta) => {
    const taxa = conta.detalhes_pagamento?.taxa_operadora || 0;
    if (taxa > 5 && String(conta.forma_recebimento || '').includes('Cartão Débito')) {
      detectadas.push({
        tipo: 'Taxa Elevada',
        severidade: 'media',
        conta,
        descricao: `Taxa de ${taxa}% em cartao debito (esperado: 1-2%)`,
        recomendacao: 'Revisar taxa cobrada pela operadora',
      });
    }
    if (taxa > 8 && String(conta.forma_recebimento || '').includes('Cartão Crédito')) {
      detectadas.push({
        tipo: 'Taxa Elevada',
        severidade: 'media',
        conta,
        descricao: `Taxa de ${taxa}% em cartao credito (esperado: 2-5%)`,
        recomendacao: 'Revisar taxa cobrada pela operadora',
      });
    }
  });

  return stampIaSuggestion({
    anomalias: detectadas.slice(0, Math.max(1, Number(limite) || 20)),
    fonte: 'ia_financeira_local',
  });
};

export const buildConciliacaoMatchSuggestions = ({ extratos = [], movimentos = [] } = {}) => {
  const matches = [];
  let conciliados = 0;
  let divergencias = 0;
  const usados = new Set();

  (extratos || []).forEach((extrato) => {
    const movimentoMatch = (movimentos || []).find((mov) => {
      if (usados.has(mov.id)) return false;
      const diferencaValor = Math.abs(Math.abs(extrato.valor) - Math.abs(mov.valor));
      const diferencaDias = Math.abs(
        new Date(extrato.data_movimento).getTime() - new Date(mov.data_movimento).getTime()
      ) / (1000 * 60 * 60 * 24);
      return diferencaValor < 1 && diferencaDias <= 3;
    });

    if (movimentoMatch) {
      usados.add(movimentoMatch.id);
      const exato = Math.abs(Number(extrato.valor) - Number(movimentoMatch.valor)) < 0.01;
      if (exato) conciliados += 1;
      else divergencias += 1;
      matches.push({ extrato, movimento: movimentoMatch, exato });
    }
  });

  return stampIaSuggestion({
    total_analisados: (extratos || []).length,
    conciliados,
    divergencias,
    sem_match: (extratos || []).length - matches.length,
    matches,
    fonte: 'ia_conciliacao_local',
  });
};

export const buildFluxoCaixaProjection = ({
  contasReceber = [],
  contasPagar = [],
  mesesProjecao = 6,
  hoje = new Date(),
} = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  const recebido = (contasReceber || [])
    .filter((c) => c.status === 'Recebido')
    .reduce((sum, c) => sum + (Number(c.valor_recebido) || Number(c.valor) || 0), 0);
  const pago = (contasPagar || [])
    .filter((c) => c.status === 'Pago')
    .reduce((sum, c) => sum + (Number(c.valor_pago) || Number(c.valor) || 0), 0);
  let saldoAcumulado = recebido - pago;
  const meses = Math.min(Math.max(Number(mesesProjecao) || 6, 1), 24);
  const dados = [];

  for (let i = 0; i < meses; i += 1) {
    const mesRef = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const inicio = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
    const fim = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0, 23, 59, 59, 999);
    const inMes = (raw) => {
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && d >= inicio && d <= fim;
    };
    const receitaPrevista = (contasReceber || [])
      .filter((c) => (c.status === 'Pendente' || c.status === 'Atrasado') && inMes(c.data_vencimento))
      .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
    const despesaPrevista = (contasPagar || [])
      .filter((c) => (c.status === 'Pendente' || c.status === 'Atrasado') && inMes(c.data_vencimento))
      .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
    const saldoMes = receitaPrevista - despesaPrevista;
    saldoAcumulado += saldoMes;
    dados.push({
      mes: mesRef.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      mesCompleto: `${mesRef.getFullYear()}-${String(mesRef.getMonth() + 1).padStart(2, '0')}`,
      receitaPrevista,
      despesaPrevista,
      saldoMes,
      saldoAcumulado,
      deficitPrevisto: saldoAcumulado < 0,
      alertaNivel: saldoAcumulado < 0 ? 'critico' : saldoAcumulado < 10000 ? 'alerta' : 'ok',
    });
  }

  return stampIaSuggestion({
    saldoInicial: recebido - pago,
    meses: dados,
    fonte: 'previsao_caixa_local',
  });
};
