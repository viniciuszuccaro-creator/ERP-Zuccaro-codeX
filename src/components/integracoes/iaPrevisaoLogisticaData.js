/**
 * Simulation fallback for logistics forecast.
 * When realAggregates is provided, blends counts into the suggestion payload.
 */
export function createLogisticsForecastSimulation(realAggregates = null) {
  const base = {
    modo: 'sugestao',
    fonte: realAggregates ? 'hibrido_simulacao_mais_escopo' : 'simulacao',
    aviso: realAggregates
      ? 'Parcialmente baseado no escopo atual; volume futuro ainda e estimativa.'
      : 'Resultado simulado. Nao altera rotas, frota nem pedidos automaticamente.',
    proximo_mes: { entregas_previstas: 287, taxa_pontualidade: 94, entregas_criticas: 12, rotas_otimizadas: 45 },
    tendencias: [
      { mes: 'Jan', entregas: 245, pontualidade: 92, criticas: 18 },
      { mes: 'Fev', entregas: 267, pontualidade: 91, criticas: 22 },
      { mes: 'Mar', entregas: 289, pontualidade: 93, criticas: 15 },
      { mes: 'Abr (Prev)', entregas: 287, pontualidade: 94, criticas: 12 }
    ],
    alertas: [
      { tipo: 'warning', titulo: 'Pico de Demanda Detectado', descricao: 'Aumento de 15% nas entregas na regiao Sul previsto para semana 2', acao: 'Aumentar capacidade de frota' },
      { tipo: 'info', titulo: 'Rota Otimizada Sugerida', descricao: 'Nova rota entre SP-RJ economiza 45min e 12km', acao: 'Aplicar otimizacao' },
      { tipo: 'success', titulo: 'Melhoria na Pontualidade', descricao: 'Taxa de entregas no prazo aumentou 3% no ultimo mes', acao: 'Manter padrao' }
    ],
    regioes_criticas: [
      { regiao: 'Zona Sul - SP', entregas: 45, risco: 'Alto', dias_criticos: 'Sexta-feira' },
      { regiao: 'Centro - RJ', entregas: 32, risco: 'Medio', dias_criticos: 'Segunda-feira' },
      { regiao: 'Norte - BH', entregas: 28, risco: 'Baixo', dias_criticos: '-' }
    ],
    sugestoes_ia: [
      'Contratar motorista adicional para regiao Sul as sextas-feiras',
      'Antecipar carregamento de pedidos da Zona Sul para quinta a tarde',
      'Implementar janela de entrega diferenciada para Centro-RJ',
      'Avaliar parceria com transportadora local em BH',
      'Criar rota express para entregas criticas (prazo <24h)'
    ],
    economia_prevista: { km_economizados: 1250, tempo_economizado_horas: 89, custo_combustivel_economizado: 3750, reducao_atrasos_percentual: 18 }
  };

  if (!realAggregates || typeof realAggregates !== 'object') {
    return base;
  }

  const total = Number(realAggregates.totalEntregas) || 0;
  const noPrazo = Number(realAggregates.entregasNoPrazo) || 0;
  const criticas = Number(realAggregates.entregasCriticas) || 0;
  const pontualidade = total > 0 ? Math.round((noPrazo / total) * 100) : base.proximo_mes.taxa_pontualidade;
  const previstas = total > 0 ? Math.max(total, Math.round(total * 1.05)) : base.proximo_mes.entregas_previstas;

  return {
    ...base,
    proximo_mes: {
      ...base.proximo_mes,
      entregas_previstas: previstas,
      taxa_pontualidade: pontualidade,
      entregas_criticas: criticas || base.proximo_mes.entregas_criticas,
    },
    escopo: {
      group_id: realAggregates.groupId || null,
      empresa_id: realAggregates.empresaId || null,
      amostra_entregas: total,
    },
  };
}
