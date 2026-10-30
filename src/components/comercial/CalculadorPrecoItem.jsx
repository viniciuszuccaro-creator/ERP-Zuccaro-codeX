import React from "react";

/**
 * Calcula o preço de um item seguindo a ordem:
 * 1. Buscar preço da tabela
 * 2. Aplicar desconto padrão do cliente
 * 3. Aplicar desconto por item
 * 4. Validar margem mínima
 * 
 * Retorna: {
 *   preco_unitario_bruto,
 *   preco_unitario,
 *   valor_item,
 *   margem_percentual,
 *   margem_valor,
 *   margem_violada,
 *   detalhes_calculo
 * }
 */
export function calcularPrecoItem({
  produto,
  tabelaPreco,
  tabelaPrecoItens = [],
  descontoPadraoCliente = 0,
  descontoItemPercentual = 0,
  descontoItemValor = 0,
  quantidade = 1,
  margemMinimaCliente = null,
  margemMinimaSistema = 10
}) {
  
  // 1. Buscar preço da tabela de preço
  let precoUnitarioBruto = produto.preco_venda || 0;
  let origemPreco = "produto_base";
  
  if (tabelaPreco && tabelaPrecoItens.length > 0) {
    const itemTabela = tabelaPrecoItens.find(item => item.produto_id === produto.id);
    if (itemTabela && itemTabela.preco_com_desconto) {
      precoUnitarioBruto = itemTabela.preco_com_desconto;
      origemPreco = "tabela_preco";
    }
  }

  // Zero comprovado em custo_medio deve prevalecer (≠ cair em custo_aquisicao via ||).
  const custoMedioRaw = produto?.custo_medio;
  const custoAqRaw = produto?.custo_aquisicao;
  const custoUnitario = (() => {
    if (custoMedioRaw != null && custoMedioRaw !== "" && Number.isFinite(Number(custoMedioRaw))) {
      return Number(custoMedioRaw);
    }
    if (custoAqRaw != null && custoAqRaw !== "" && Number.isFinite(Number(custoAqRaw))) {
      return Number(custoAqRaw);
    }
    return 0;
  })();
  
  // 2. Aplicar desconto padrão do cliente
  let precoAposDescontoPadrao = precoUnitarioBruto;
  if (descontoPadraoCliente > 0) {
    precoAposDescontoPadrao = precoUnitarioBruto * (1 - descontoPadraoCliente / 100);
  }

  // 3. Aplicar desconto do item
  let precoUnitario = precoAposDescontoPadrao;
  let descontoAplicado = 0;
  
  if (descontoItemValor > 0) {
    precoUnitario = precoAposDescontoPadrao - descontoItemValor;
    descontoAplicado = descontoItemValor;
  } else if (descontoItemPercentual > 0) {
    const valorDesconto = precoAposDescontoPadrao * (descontoItemPercentual / 100);
    precoUnitario = precoAposDescontoPadrao - valorDesconto;
    descontoAplicado = valorDesconto;
  }

  const valorItem = precoUnitario * quantidade;

  // 4. Calcular margem
  const margemValor = (precoUnitario - custoUnitario) * quantidade;
  const margemPercentual = custoUnitario > 0 
    ? ((precoUnitario - custoUnitario) / precoUnitario) * 100 
    : 0;

  // 5. Determinar margem mínima aplicável
  const margemMinimaAplicada = Math.min(
    produto.margem_minima_percentual || 100,
    margemMinimaCliente !== null ? margemMinimaCliente : 100,
    margemMinimaSistema
  );

  const origemMargem = 
    (produto.margem_minima_percentual || 100) <= margemMinimaAplicada ? "produto" :
    (margemMinimaCliente !== null && margemMinimaCliente <= margemMinimaAplicada) ? "cliente" :
    "sistema";

  // 6. Validar se margem foi violada
  const margemViolada = margemPercentual < margemMinimaAplicada;

  return {
    preco_unitario_bruto: precoUnitarioBruto,
    preco_apos_desconto_padrao: precoAposDescontoPadrao,
    preco_unitario: precoUnitario,
    valor_item: valorItem,
    custo_unitario: custoUnitario,
    margem_percentual: margemPercentual,
    margem_valor: margemValor,
    margem_minima_aplicada: margemMinimaAplicada,
    margem_minima_origem: origemMargem,
    margem_violada: margemViolada,
    desconto_total_aplicado: precoUnitarioBruto - precoUnitario,
    origem_preco: origemPreco,
    detalhes_calculo: {
      preco_inicial: precoUnitarioBruto,
      desconto_padrao_cliente_valor: precoUnitarioBruto - precoAposDescontoPadrao,
      desconto_item_valor: descontoAplicado,
      preco_final: precoUnitario,
      custo: custoUnitario,
      margem_valor: margemValor,
      margem_percentual: margemPercentual
    }
  };
}

export default calcularPrecoItem;