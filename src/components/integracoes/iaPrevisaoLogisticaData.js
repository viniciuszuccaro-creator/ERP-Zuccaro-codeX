export function createLogisticsForecastSimulation() {
  return {
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
}