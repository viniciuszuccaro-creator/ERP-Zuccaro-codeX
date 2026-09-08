const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

const SENSITIVE_IA_HINTS = [
  'pagar',
  'receber',
  'baixar',
  'baixa',
  'emitir',
  'cancelar nf',
  'estoque',
  'preco',
  'preço',
  'desconto',
  'permissao',
  'permissão',
  'liquidar',
];

export const IA_MODO_SUGESTAO = 'sugestao';

export const sanitizeIaPrompt = (value, max = 4000) => String(value ?? '')
  .replace(/[<>]/g, '')
  .replace(/javascript:/gi, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

export const isSensitiveIaExecution = (payload = {}) => {
  if (payload.executar === true || payload.auto_executar === true || payload.aplicar_automaticamente === true) {
    return true;
  }
  const action = `${payload.acao || ''} ${payload.action || ''}`.toLowerCase();
  return SENSITIVE_IA_HINTS.some((hint) => action.includes(hint));
};

export const assertIaInvocation = ({ payload = {}, groupId, empresaId } = {}) => {
  if (!firstText(groupId)) {
    throw new Error('Grupo obrigatorio para IA.');
  }
  if (isSensitiveIaExecution(payload)) {
    throw new Error('IA nao executa acao sensivel. Apenas sugere.');
  }
  return {
    ...payload,
    prompt: sanitizeIaPrompt(payload.prompt),
    group_id: firstText(groupId),
    empresa_id: firstText(empresaId) || null,
    modo: IA_MODO_SUGESTAO,
  };
};

export const buildChurnSuggestions = ({ clientes = [], pedidos = [], hoje = new Date() } = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  return (clientes || [])
    .filter((cliente) => String(cliente.status || 'Ativo') === 'Ativo')
    .map((cliente) => {
      const ultimaCompra = cliente.data_ultima_compra ? new Date(cliente.data_ultima_compra) : null;
      const diasSemComprar = ultimaCompra
        ? Math.floor((now - ultimaCompra) / (1000 * 60 * 60 * 24))
        : 999;
      let riscoChurn = 'Baixo';
      if (diasSemComprar > 180) riscoChurn = 'Crítico';
      else if (diasSemComprar > 120) riscoChurn = 'Alto';
      else if (diasSemComprar > 60) riscoChurn = 'Médio';
      const scoreAtual = Number(cliente.score_saude_cliente) || 100;
      let novoScore = scoreAtual;
      if (diasSemComprar > 60) novoScore -= (diasSemComprar - 60) * 0.5;
      if (novoScore < 0) novoScore = 0;
      return {
        ...cliente,
        pedidos_count: (pedidos || []).filter((pedido) => pedido.cliente_id === cliente.id).length,
        dias_sem_comprar: diasSemComprar,
        risco_churn: riscoChurn,
        score_saude_cliente: Math.round(novoScore),
      };
    })
    .filter((item) => item.risco_churn === 'Alto' || item.risco_churn === 'Crítico');
};

export const buildChurnOportunidade = (cliente = {}) => ({
  cliente_id: cliente.id,
  titulo: `Recuperação - ${cliente.nome}`,
  descricao: `Sugestao de IA: cliente em risco de churn (${cliente.risco_churn}) - ${cliente.dias_sem_comprar} dias sem comprar`,
  valor_estimado: cliente.ticket_medio || 0,
  probabilidade: cliente.risco_churn === 'Crítico' ? 20 : 40,
  origem: 'IA - Detecção de Churn',
  status: 'Nova',
  responsavel_id: cliente.vendedor_responsavel_id,
  proxima_acao: 'Ligar para o cliente e entender motivo da inatividade',
});

/** Fail-closed UI guard for module IA surfaces (Gate 16 / P2). */
export const assertIaUiContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => {
  if (!firstText(groupId)) {
    throw new Error('Grupo obrigatorio para IA.');
  }
  if (scopeType !== 'grupo' && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para IA no escopo empresa.');
  }
  return {
    group_id: firstText(groupId),
    empresa_id: firstText(empresaId) || null,
    scopeType: firstText(scopeType) || 'empresa',
    modo: IA_MODO_SUGESTAO,
  };
};

export const stampIaSuggestion = (payload = {}) => ({
  ...payload,
  modo: IA_MODO_SUGESTAO,
  fonte: firstText(payload.fonte) || 'ia_local',
});

/**
 * CRM ABC churn: suggest only (no create). Aligns sibling screen with Gate 16.
 */
export const buildCrmAbcChurnSuggestions = ({ clientes = [], limite = 10 } = {}) => {
  const risco = (clientes || [])
    .filter((cliente) => {
      if (!cliente?.classificacao_abc || !['A', 'B'].includes(cliente.classificacao_abc)) return false;
      if (String(cliente.status || 'Ativo') !== 'Ativo') return false;
      const dias = Number(cliente.dias_sem_comprar) || 0;
      const valorHistorico = Number(cliente.valor_compras_12meses) || 0;
      return dias > 30 && valorHistorico > 5000;
    })
    .map((cliente) => {
      const dias = Number(cliente.dias_sem_comprar) || 0;
      const motivo_risco = dias > 90 ? 'Crítico - 90+ dias' : dias > 60 ? 'Alto - 60+ dias' : 'Médio - 30+ dias';
      return {
        ...cliente,
        motivo_risco,
        prioridade_crm: dias > 90 ? 'Urgente' : 'Alta',
        risco_churn: dias > 90 ? 'Crítico' : dias > 60 ? 'Alto' : 'Médio',
      };
    })
    .slice(0, Math.max(1, Number(limite) || 10));

  return stampIaSuggestion({
    total_analisados: (clientes || []).length,
    clientes_risco: risco.length,
    sugestoes: risco,
    oportunidades_criadas: 0,
  });
};

export const buildCrmAbcChurnOportunidade = (cliente = {}) => ({
  titulo: `Risco Churn - ${cliente.nome_fantasia || cliente.nome || 'Cliente'}`,
  descricao: `Sugestao de IA: cliente classe ${cliente.classificacao_abc} sem comprar ha ${cliente.dias_sem_comprar} dias. Valor historico: R$ ${Number(cliente.valor_compras_12meses || 0).toLocaleString('pt-BR')}`,
  cliente_id: cliente.id,
  cliente_nome: cliente.nome_fantasia || cliente.nome,
  origem: 'IA Churn',
  responsavel_id: cliente.vendedor_responsavel_id,
  etapa: 'Reativação',
  valor_estimado: Math.round(Number(cliente.ticket_medio) || Number(cliente.valor_compras_12meses || 0) / 12),
  probabilidade: 40,
  temperatura: 'Morno',
  status: 'Aberto',
  score: 60,
  proxima_acao: `Contatar cliente - Risco de churn (${cliente.dias_sem_comprar} dias sem compra)`,
  observacoes: `Sugestao IA (confirmada pelo usuario). Motivo: ${cliente.motivo_risco || ''}`,
});

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

export const requireIaHumanConfirm = (mensagem) => {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return false;
  }
  return Boolean(window.confirm(String(mensagem || 'Confirmar aplicacao da sugestao de IA?')));
};

/** Fail-closed context for anomaly scans (financeiro/seguranca). */
export const assertAnomalyScanContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => (
  assertIaUiContext({ groupId, empresaId, scopeType })
);

export const stampAnomalyScanResult = ({
  issues = null,
  details = null,
  sugestoes = [],
  previsoes = [],
  warnings = [],
  ok = true,
  extra = {},
} = {}) => {
  const list = Array.isArray(details)
    ? details
    : (Array.isArray(issues) ? issues : []);
  let issueCount = list.length;
  if (typeof issues === 'number' && Number.isFinite(issues)) {
    issueCount = issues;
  } else if (Array.isArray(issues) && issues.length > 0 && typeof issues[0] !== 'object') {
    issueCount = issues.length;
  }
  return stampIaSuggestion({
    ok: ok !== false,
    anomaly: list.length > 0 || issueCount > 0,
    issues: issueCount,
    details: list,
    sugestoes: Array.isArray(sugestoes) ? sugestoes : [],
    previsoes: Array.isArray(previsoes) ? previsoes : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    fonte: firstText(extra.fonte) || 'anomalia_local',
    ...extra,
  });
};

export const buildSecurityAnomalySuggestions = ({
  logs = [],
  windowMinutes = 15,
  agora = new Date(),
} = {}) => {
  const now = agora instanceof Date ? agora : new Date(agora);
  const windowStart = new Date(now.getTime() - (Number(windowMinutes) || 15) * 60 * 1000);
  const getLogDate = (l) => {
    if (l?.data_hora) return new Date(l.data_hora);
    if (l?.created_date) return new Date(l.created_date);
    return null;
  };
  const recent = (logs || []).filter((l) => {
    const d = getLogDate(l);
    return d && d >= windowStart;
  });
  const byAction = recent.reduce((acc, l) => {
    const k = l.acao || '';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const suspicious = [];
  if ((byAction.Exclusao || byAction['Exclusão'] || 0) >= 5) {
    suspicious.push({
      tipo: 'Exclusoes em massa',
      severidade: 'Alta',
      detalhes: `Exclusoes recentes: ${byAction.Exclusao || byAction['Exclusão'] || 0}`,
    });
  }
  const perfilChanges = recent.filter((l) => (
    l.entidade === 'PerfilAcesso' && (l.acao === 'Criacao' || l.acao === 'Criação' || l.acao === 'Edicao' || l.acao === 'Edição')
  ));
  if (perfilChanges.length >= 3) {
    suspicious.push({
      tipo: 'Mudancas frequentes de perfil',
      severidade: 'Media',
      detalhes: `${perfilChanges.length} mudancas em ${windowMinutes} min`,
    });
  }
  const blocks = recent.filter((l) => l.acao === 'Bloqueio');
  if (blocks.length >= 10) {
    suspicious.push({
      tipo: 'Muitos bloqueios de acesso',
      severidade: 'Media',
      detalhes: `${blocks.length} bloqueios em ${windowMinutes} min`,
    });
  }
  return stampIaSuggestion({
    alerts: suspicious,
    analyzed: recent.length,
    anomaly: suspicious.length > 0,
    fonte: 'anomalia_seguranca_local',
  });
};

/** Fail-closed context for forecast UIs (caixa, reposicao, recompra, atraso). */
export const assertForecastUiContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => (
  assertIaUiContext({ groupId, empresaId, scopeType })
);

export const buildReposicaoSuggestions = ({
  produtos = [],
  movimentacoes = [],
  empresaId = null,
  hoje = new Date(),
} = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  const ha30Dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sugestoes = [];

  (produtos || [])
    .filter((p) => (!empresaId || p.empresa_id === empresaId) && String(p.status || 'Ativo') === 'Ativo')
    .forEach((produto) => {
      const disponivel = (Number(produto.estoque_atual) || 0) - (Number(produto.estoque_reservado) || 0);
      const minimo = Number(produto.estoque_minimo) || 0;
      const saidas = (movimentacoes || []).filter((m) => (
        m.produto_id === produto.id
        && String(m.tipo_movimento || '').toLowerCase() === 'saida'
        && m.data_movimentacao
        && new Date(m.data_movimentacao) >= ha30Dias
      ));
      const consumoTotal = saidas.reduce((sum, m) => sum + (Number(m.quantidade) || 0), 0);
      const consumoMedioDiario = consumoTotal / 30;
      const consumoProjetado30Dias = consumoMedioDiario * 30;
      if (disponivel < minimo || consumoProjetado30Dias > disponivel) {
        const quantidadeSugerida = Math.ceil(Math.max(
          minimo - disponivel,
          consumoProjetado30Dias - disponivel,
        ));
        sugestoes.push({
          produto_id: produto.id,
          produto_descricao: produto.descricao,
          produto_codigo: produto.codigo,
          estoque_atual: produto.estoque_atual,
          estoque_disponivel: disponivel,
          estoque_minimo: minimo,
          consumo_medio_diario: Number(consumoMedioDiario.toFixed(2)),
          consumo_projetado_30d: Number(consumoProjetado30Dias.toFixed(2)),
          quantidade_sugerida: quantidadeSugerida,
          criticidade: disponivel < minimo ? 'alta' : 'media',
          motivo: disponivel < minimo
            ? 'Estoque abaixo do minimo'
            : 'Consumo projetado excede disponivel',
        });
      }
    });

  sugestoes.sort((a, b) => (b.criticidade === 'alta' ? 1 : 0) - (a.criticidade === 'alta' ? 1 : 0));
  return stampIaSuggestion({
    sugestoes,
    total: sugestoes.length,
    fonte: 'previsao_reposicao_local',
  });
};

export const buildVendasRecompraSuggestions = ({
  clientes = [],
  pedidos = [],
  hoje = new Date(),
  probabilidadeMinima = 60,
} = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  const previsoes = [];

  (clientes || [])
    .filter((c) => String(c.status || 'Ativo') === 'Ativo' && c.data_ultima_compra)
    .forEach((cliente) => {
      const pedidosCliente = (pedidos || []).filter((p) => p.cliente_id === cliente.id);
      if (pedidosCliente.length < 2) return;

      const datas = pedidosCliente
        .map((p) => new Date(p.data_pedido))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a - b);
      if (datas.length < 2) return;

      const intervalos = [];
      for (let i = 1; i < datas.length; i += 1) {
        intervalos.push(Math.floor((datas[i] - datas[i - 1]) / (1000 * 60 * 60 * 24)));
      }
      const cicloMedio = intervalos.reduce((sum, i) => sum + i, 0) / intervalos.length;
      if (!cicloMedio) return;

      const diasDesdeUltima = Math.floor(
        (now - new Date(cliente.data_ultima_compra)) / (1000 * 60 * 60 * 24),
      );
      let probabilidade = Math.min(100, Math.max(0, (diasDesdeUltima / cicloMedio) * 100));
      if (cliente.classificacao_abc === 'A') probabilidade += 10;
      if (Number(cliente.score_pagamento) > 90) probabilidade += 5;
      if (diasDesdeUltima > cicloMedio * 1.5) probabilidade -= 20;
      probabilidade = Math.min(100, Math.max(0, probabilidade));

      if (probabilidade >= probabilidadeMinima) {
        previsoes.push({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          probabilidade: Number(probabilidade.toFixed(0)),
          ciclo_medio_dias: Number(cicloMedio.toFixed(0)),
          dias_desde_ultima: diasDesdeUltima,
          ticket_medio: Number(cliente.ticket_medio) || 0,
          produtos_preferidos: cliente.produtos_mais_comprados?.slice(0, 3) || [],
          temperatura: probabilidade > 80 ? 'Quente' : probabilidade > 60 ? 'Morno' : 'Frio',
        });
      }
    });

  previsoes.sort((a, b) => b.probabilidade - a.probabilidade);
  return stampIaSuggestion({
    previsoes,
    total: previsoes.length,
    fonte: 'previsao_recompra_local',
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
