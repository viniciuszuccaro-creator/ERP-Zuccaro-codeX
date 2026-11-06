import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook centralizado para gerenciar formas de pagamento
 * Busca dados de FormaPagamento e Banco configurados em Cadastros Gerais
 * 
 * Usado em: PDV, Pedidos, Contas a Receber, Contas a Pagar, Portal, Site, Chatbot, etc.
 */
export function useFormasPagamento(filtros = {}) {
  // Buscar formas de pagamento ativas
  const { data: formasPagamento = [], isLoading: loadingFormas } = useQuery({
    queryKey: ['formas-pagamento', filtros],
    queryFn: async () => {
      const formas = await base44.entities.FormaPagamento.filter({
        ativa: true,
        ...filtros
      });
      return formas.sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    },
    staleTime: 300000, // 5 minutos
  });

  // Buscar bancos cadastrados
  const { data: bancos = [], isLoading: loadingBancos } = useQuery({
    queryKey: ['bancos'],
    queryFn: async () => {
      return await base44.entities.Banco.filter({ ativo: true });
    },
    staleTime: 300000,
  });

  // Filtrar formas disponíveis por contexto
  const obterFormasPorContexto = (contexto = 'pdv') => {
    if (contexto === 'pdv') {
      return formasPagamento.filter(f => f.disponivel_pdv);
    }
    if (contexto === 'ecommerce') {
      return formasPagamento.filter(f => f.disponivel_ecommerce);
    }
    return formasPagamento;
  };

  // Obter banco específico por tipo de pagamento
  const obterBancoPorTipo = (tipoFormaPagamento) => {
    if (tipoFormaPagamento === 'Boleto') {
      return bancos.find(b => b.suporta_cobranca_boleto);
    }
    if (tipoFormaPagamento === 'PIX') {
      return bancos.find(b => b.suporta_cobranca_pix);
    }
    return null;
  };

  // Buscar gateways de pagamento
  const { data: gateways = [] } = useQuery({
    queryKey: ['gateways-pagamento'],
    queryFn: async () => {
      return await base44.entities.GatewayPagamento.filter({ ativo: true });
    },
    staleTime: 300000,
  });

  // Obter configuração completa de uma forma de pagamento
  const obterConfiguracao = (formaPagamentoId) => {
    const forma = formasPagamento.find(f => f.id === formaPagamentoId);
    if (!forma) return null;

    const banco = obterBancoPorTipo(forma.tipo);
    const gateway = forma.usa_gateway && forma.gateway_pagamento_id 
      ? gateways.find(g => g.id === forma.gateway_pagamento_id)
      : null;
    
    return {
      ...forma,
      ativa: forma.ativa,
      aceita_desconto: forma.aceita_desconto,
      percentual_desconto_padrao: forma.percentual_desconto_padrao,
      aplicar_acrescimo: forma.aplicar_acrescimo,
      percentual_acrescimo_padrao: forma.percentual_acrescimo_padrao,
      taxa_por_parcela: forma.taxa_por_parcela,
      intervalo_parcelas_dias: forma.intervalo_parcelas_dias,
      banco: banco,
      gateway: gateway,
      usa_gateway: forma.usa_gateway || false,
      requer_integracao: forma.integracao_obrigatoria,
      permite_desconto: forma.aceita_desconto,
      desconto_padrao: forma.percentual_desconto_padrao || 0,
      acrescimo_padrao: forma.percentual_acrescimo_padrao || 0,
      prazo_dias: forma.prazo_compensacao_dias || 0,
      max_parcelas: forma.maximo_parcelas || 1,
      permite_parcelar: forma.permite_parcelamento
    };
  };

  // Obter forma de pagamento por descrição (compatibilidade)
  const obterFormaPorDescricao = (descricao) => {
    return formasPagamento.find(f => 
      f.descricao === descricao || f.tipo === descricao
    );
  };

  // Validar se forma está disponível e configurada
  const validarFormaPagamento = (formaPagamentoId) => {
    const config = obterConfiguracao(formaPagamentoId);
    if (!config) {
      return { valido: false, erro: 'Forma de pagamento não encontrada' };
    }
    if (!config.ativa) {
      return { valido: false, erro: 'Forma de pagamento inativa' };
    }
    if (config.requer_integracao && !config.banco) {
      return { valido: false, erro: 'Banco não configurado para esta forma de pagamento' };
    }
    return { valido: true };
  };

  // Aplicar descontos/acréscimos automáticos
  const calcularValorFinal = (valorBase, formaPagamentoId) => {
    const config = obterConfiguracao(formaPagamentoId);
    if (!config) return valorBase;

    let valorFinal = valorBase;
    
    if (config.aceita_desconto && config.percentual_desconto_padrao > 0) {
      valorFinal -= (valorBase * config.percentual_desconto_padrao / 100);
    }
    
    if (config.aplicar_acrescimo && config.percentual_acrescimo_padrao > 0) {
      valorFinal += (valorBase * config.percentual_acrescimo_padrao / 100);
    }
    
    return valorFinal;
  };

  // Calcular parcelas com juros
  const calcularParcelas = (valorBase, formaPagamentoId, numeroParcelas) => {
    const config = obterConfiguracao(formaPagamentoId);
    if (!config || !config.permite_parcelar) {
      return null;
    }

    const maxParcelas = Math.min(numeroParcelas, config.max_parcelas);
    const valorComAjustes = calcularValorFinal(valorBase, formaPagamentoId);
    const parcelas = [];

    for (let i = 1; i <= maxParcelas; i++) {
      const valorParcela = valorComAjustes / i;
      const taxaParcela = config.taxa_por_parcela || 0;
      const valorComJuros = valorParcela * (1 + (taxaParcela / 100));
      const valorTotal = valorComJuros * i;

      parcelas.push({
        numero_parcelas: i,
        valor_parcela: valorComJuros,
        valor_total: valorTotal,
        taxa_aplicada: taxaParcela,
        intervalo_dias: config.intervalo_parcelas_dias || 30,
        economia_vs_avista: valorBase - valorTotal
      });
    }

    return parcelas;
  };

  // Recomendar melhor forma de pagamento (IA)
  const recomendarMelhorForma = (valorCompra, contexto = 'pdv') => {
    const formasDisponiveis = obterFormasPorContexto(contexto);
    
    const analise = formasDisponiveis.map(forma => {
      const config = obterConfiguracao(forma.id);
      const valorFinal = calcularValorFinal(valorCompra, forma.id);
      const economia = valorCompra - valorFinal;
      
      return {
        forma,
        valor_final: valorFinal,
        economia,
        percentual_economia: (economia / valorCompra) * 100,
        prazo_compensacao: config.prazo_dias,
        score_cliente: economia * 10 - (config.prazo_dias * 0.5) // Mais economia = melhor
      };
    });

    return analise.sort((a, b) => b.score_cliente - a.score_cliente);
  };

  // Sugerir parcelamento ideal
  const sugerirParcelamentoIdeal = (valorCompra, capacidadePagamentoMensal) => {
    const formasParcelaveis = formasPagamento.filter(f => f.permite_parcelamento && f.ativa);
    
    const sugestoes = formasParcelaveis.map(forma => {
      const config = obterConfiguracao(forma.id);
      let parcelasIdeais = 1;
      
      // Calcular quantas parcelas cabem no orçamento
      for (let i = 1; i <= config.max_parcelas; i++) {
        const valorParcela = calcularValorFinal(valorCompra, forma.id) / i;
        const taxaParcela = config.taxa_por_parcela || 0;
        const valorComJuros = valorParcela * (1 + (taxaParcela / 100));
        
        if (valorComJuros <= capacidadePagamentoMensal) {
          parcelasIdeais = i;
        } else {
          break;
        }
      }

      return {
        forma,
        parcelas_ideais: parcelasIdeais,
        valor_parcela: (calcularValorFinal(valorCompra, forma.id) / parcelasIdeais) * (1 + ((config.taxa_por_parcela || 0) / 100)),
        valor_total: calcularValorFinal(valorCompra, forma.id) * (1 + ((config.taxa_por_parcela || 0) / 100) * parcelasIdeais)
      };
    });

    return sugestoes.filter(s => s.parcelas_ideais > 1);
  };

  return {
    formasPagamento,
    bancos,
    gateways,
    isLoading: loadingFormas || loadingBancos,
    obterFormasPorContexto,
    obterBancoPorTipo,
    obterConfiguracao,
    obterFormaPorDescricao,
    validarFormaPagamento,
    calcularValorFinal,
    calcularParcelas,
    recomendarMelhorForma,
    sugerirParcelamentoIdeal
  };
}

export default useFormasPagamento;
