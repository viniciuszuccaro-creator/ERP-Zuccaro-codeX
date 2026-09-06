import { base44 } from "@/api/base44Client";
import { assertFaturamentoDentroDoPedido } from "@/components/lib/pedidoFaturamentoPolicy";

// Auditoria helpers
async function getUsuarioAtual() {
  try { return await base44.auth.me(); } catch { return null; }
}

function getBrowserContextoFallback() {
  if (typeof localStorage === 'undefined') return {};
  try {
    return {
      groupId: localStorage.getItem('group_atual_id') || localStorage.getItem('grupo_atual_id') || null,
      empresaId: localStorage.getItem('empresa_atual_id') || null
    };
  } catch {
    return {};
  }
}

function normalizarContextoOperacao(registro = {}, empresaId = null) {
  const browserCtx = getBrowserContextoFallback();
  const groupId = registro.group_id || registro.grupo_id || registro.group_atual_id || browserCtx.groupId || null;
  const empresaOperacaoId = empresaId || registro.empresa_id || registro.empresa_atual_id || browserCtx.empresaId || null;

  if (!groupId && !empresaOperacaoId) {
    throw new Error('Contexto multiempresa obrigatorio para executar fluxo de pedido');
  }

  return { groupId, empresaId: empresaOperacaoId };
}

function aplicarContextoPayload(payload = {}, contextoOperacao = {}) {
  return {
    ...payload,
    ...(contextoOperacao.groupId && !payload.group_id ? { group_id: contextoOperacao.groupId } : {}),
    ...(contextoOperacao.empresaId && !payload.empresa_id ? { empresa_id: contextoOperacao.empresaId } : {})
  };
}

async function filterScoped(entityName, criterios = {}, contextoOperacao = {}, order = undefined, limit = undefined) {
  const scoped = aplicarContextoPayload(criterios, contextoOperacao);
  return base44.entities[entityName].filter(scoped, order, limit);
}

async function createScoped(entityName, payload = {}, contextoOperacao = {}) {
  return base44.entities[entityName].create(aplicarContextoPayload(payload, contextoOperacao));
}

async function updateScoped(entityName, id, payload = {}, contextoOperacao = {}) {
  const before = await base44.entities[entityName].get?.(id).catch(() => null);
  const updated = await base44.entities[entityName].update(id, aplicarContextoPayload(payload, contextoOperacao));
  return { before, updated };
}

async function auditar(modulo, entidade, acao, registro_id, descricao, empresaId, dados_anteriores = null, dados_novos = null, groupId = null) {
  const user = await getUsuarioAtual();
  const mapModulo = (m) => {
    const mapa = {
      'Logistica': 'Expedicao',
      'Logística': 'Expedição',
      'Expedição': 'Expedição',
      'Producao': 'Producao',
      'Produção': 'Produção',
      'Estoque': 'Estoque',
      'Financeiro': 'Financeiro',
      'Comercial': 'Comercial'
    };
    return mapa[m] || m;
  };
  const moduloNorm = mapModulo(modulo);
  await base44.entities.AuditLog.create({
    empresa_id: empresaId,
    group_id: groupId,
    usuario: user?.full_name || user?.email || 'Sistema',
    usuario_id: user?.id || '',
    acao,
    action: acao,
    modulo: moduloNorm,
    entidade,
    entity_name: entidade,
    registro_id,
    descricao,
    dados_anteriores: dados_anteriores || undefined,
    dados_novos: dados_novos || undefined,
    data_hora: new Date().toISOString(),
    sucesso: true
  });
}

/**
 * 🔄 HOOK DE FLUXOS AUTOMÁTICOS DO PEDIDO V21.6 COMPLETO
 * 
 * ✅ FLUXO COMPLETO IMPLEMENTADO:
 * - Validação de crédito
 * - Baixa de estoque automática
 * - Geração de Contas a Receber
 * - Criação de Entrega/Retirada
 * - Atualização de status
 * - Cancelamento com estorno
 * 
 * Integrado com: AutomacaoFluxoPedido.jsx
 * Regra-Mãe: Sempre melhorar, nunca apagar
 */

/**
 * 1️⃣ APROVAR PEDIDO → Reserva Estoque + Gera OP + Valida Crédito
 */
export async function aprovarPedidoCompleto(pedido, empresaId) {
  const resultados = {
    validacaoCredito: null,
    reservasEstoque: [],
    opsGeradas: [],
    contasReceber: [],
    erros: []
  };

  try {
    const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);

    const validacaoCredito = await validarLimiteCredito(pedido, contextoOperacao);
    resultados.validacaoCredito = validacaoCredito;

    if (!validacaoCredito.aprovado) {
      resultados.erros.push(`Limite de credito insuficiente: disponivel R$ ${validacaoCredito.limite_disponivel}`);
      return resultados;
    }

    const baixasEstoque = [];
    if (pedido.itens_revenda?.length > 0) {
      for (const item of pedido.itens_revenda) {
        try {
          const baixa = await baixarEstoqueItemAprovacao(item, pedido, contextoOperacao.empresaId);
          baixasEstoque.push(baixa);
        } catch (error) {
          resultados.erros.push(`Erro ao baixar estoque ${item.descricao}: ${error.message}`);
        }
      }
    }
    resultados.reservasEstoque = baixasEstoque;

    if (pedido.itens_producao?.length > 0) {
      try {
        const op = await gerarOPAutomatica(pedido, contextoOperacao.empresaId);
        resultados.opsGeradas.push(op);
      } catch (error) {
        resultados.erros.push(`Erro ao gerar OP: ${error.message}`);
      }
    }

    if (pedido.forma_pagamento && pedido.parcelas?.length > 0) {
      for (const parcela of pedido.parcelas) {
        try {
          const conta = await gerarContaReceber(pedido, parcela, contextoOperacao.empresaId);
          resultados.contasReceber.push(conta);
        } catch (error) {
          resultados.erros.push(`Erro ao gerar conta a receber: ${error.message}`);
        }
      }
    }

    if (pedido.cliente_id) {
      await atualizarLimiteCreditoCliente(pedido.cliente_id, pedido.valor_total, 'adicionar', contextoOperacao);
    }

    const { before: pedidoAntes, updated: pedidoAtualizado } = await updateScoped('Pedido', pedido.id, {
      status: 'Aprovado',
      data_aprovacao: new Date().toISOString()
    }, contextoOperacao);
    await auditar('Comercial', 'Pedido', 'update', pedido.id, `Pedido ${pedido.numero_pedido} aprovado`, contextoOperacao.empresaId, pedidoAntes, pedidoAtualizado, contextoOperacao.groupId);

    const userHC = await getUsuarioAtual();
    await createScoped('HistoricoCliente', {
      empresa_id: contextoOperacao.empresaId,
      group_id: contextoOperacao.groupId,
      cliente_id: pedido.cliente_id,
      cliente_nome: pedido.cliente_nome,
      modulo_origem: 'Comercial',
      referencia_id: pedido.id,
      referencia_tipo: 'Pedido',
      referencia_numero: pedido.numero_pedido,
      tipo_evento: 'Aprovacao',
      titulo_evento: 'Pedido Aprovado e Processado',
      descricao_detalhada: `Pedido aprovado. ${resultados.reservasEstoque.length} baixas de estoque, ${resultados.opsGeradas.length} OPs geradas`,
      usuario_responsavel: (userHC?.full_name || userHC?.email || 'Sistema'),
      data_evento: new Date().toISOString(),
      valor_relacionado: pedido.valor_total
    }, contextoOperacao);
  } catch (error) {
    resultados.erros.push(`Erro geral: ${error.message}`);
  }

  return resultados;
}

async function validarLimiteCredito(pedido, contextoOperacao = null) {
  if (!pedido.cliente_id) {
    return { aprovado: true, motivo: 'Sem cliente vinculado' };
  }

  const contexto = contextoOperacao || normalizarContextoOperacao(pedido);
  const clientes = await filterScoped('Cliente', { id: pedido.cliente_id }, contexto);
  const cliente = clientes[0];

  if (!cliente) {
    return { aprovado: true, motivo: 'Cliente nao encontrado' };
  }

  const limiteTotal = cliente.condicao_comercial?.limite_credito || 0;
  const limiteUtilizado = cliente.condicao_comercial?.limite_credito_utilizado || 0;
  const limiteDisponivel = limiteTotal - limiteUtilizado;

  if (pedido.limite_credito_override) {
    return {
      aprovado: true,
      limite_total: limiteTotal,
      limite_utilizado: limiteUtilizado,
      limite_disponivel: limiteDisponivel,
      motivo: `Override aprovado: ${pedido.limite_credito_justificativa}`
    };
  }

  const aprovado = pedido.valor_total <= limiteDisponivel || limiteTotal === 0;

  return {
    aprovado,
    limite_total: limiteTotal,
    limite_utilizado: limiteUtilizado,
    limite_disponivel: limiteDisponivel,
    valor_pedido: pedido.valor_total,
    motivo: aprovado ? 'Credito aprovado' : 'Limite insuficiente'
  };
}

async function baixarEstoqueItemAprovacao(item, pedido, empresaId) {
  const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);
  const produtos = await filterScoped('Produto', { id: item.produto_id }, contextoOperacao);
  const produto = produtos[0];

  if (!produto) {
    throw new Error('Produto nao encontrado no estoque');
  }

  const estoqueAtual = produto.estoque_atual || 0;

  if (estoqueAtual < item.quantidade) {
    throw new Error(`Estoque insuficiente. Disponivel: ${estoqueAtual} ${item.unidade}`);
  }

  const novoEstoque = estoqueAtual - item.quantidade;
  const user = await getUsuarioAtual();
  const movimentacao = await createScoped('MovimentacaoEstoque', {
    empresa_id: contextoOperacao.empresaId,
    group_id: contextoOperacao.groupId,
    tipo_movimento: 'saida',
    origem_movimento: 'pedido',
    origem_documento_id: pedido.id,
    produto_id: item.produto_id,
    produto_descricao: item.descricao || item.produto_descricao,
    codigo_produto: item.codigo_sku,
    quantidade: item.quantidade,
    unidade_medida: item.unidade,
    estoque_anterior: estoqueAtual,
    estoque_atual: novoEstoque,
    reservado_anterior: 0,
    reservado_atual: 0,
    disponivel_anterior: estoqueAtual,
    disponivel_atual: novoEstoque,
    data_movimentacao: new Date().toISOString(),
    documento: pedido.numero_pedido,
    motivo: `Baixa automatica - Pedido ${pedido.numero_pedido} aprovado`,
    responsavel: (user?.full_name || user?.email || 'Sistema'),
    responsavel_id: user?.id,
    valor_unitario: item.preco_unitario || item.valor_unitario,
    valor_total: item.valor_total || (item.quantidade * (item.preco_unitario || 0)),
    aprovado: true
  }, contextoOperacao);

  const { before: produtoAntes, updated: produtoAtualizado } = await updateScoped('Produto', item.produto_id, { estoque_atual: novoEstoque }, contextoOperacao);
  await auditar('Estoque', 'MovimentacaoEstoque', 'create', movimentacao.id, `Baixa por aprovacao - Pedido ${pedido.numero_pedido}`, contextoOperacao.empresaId, null, movimentacao, contextoOperacao.groupId);
  await auditar('Estoque', 'Produto', 'update', item.produto_id, `Estoque atualizado por aprovacao - Pedido ${pedido.numero_pedido}`, contextoOperacao.empresaId, produtoAntes, produtoAtualizado, contextoOperacao.groupId);
  return movimentacao;
}

async function gerarOPAutomatica(pedido, empresaId) {
  const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);
  const numeroOP = `OP-${Date.now()}`;
  const materiaisNecessarios = [];
  let pesoTotal = 0;

  for (const item of pedido.itens_producao || []) {
    if (item.ferro_principal_bitola && item.ferro_principal_peso_kg) {
      materiaisNecessarios.push({ bitola_id: item.ferro_principal_bitola, descricao: `Ferro ${item.ferro_principal_bitola}`, quantidade_kg: item.ferro_principal_peso_kg * item.quantidade, unidade: 'KG' });
      pesoTotal += item.ferro_principal_peso_kg * item.quantidade;
    }
    if (item.estribo_bitola && item.estribo_peso_kg) {
      materiaisNecessarios.push({ bitola_id: item.estribo_bitola, descricao: `Estribo ${item.estribo_bitola}`, quantidade_kg: item.estribo_peso_kg * item.quantidade, unidade: 'KG' });
      pesoTotal += item.estribo_peso_kg * item.quantidade;
    }
  }

  const user = await getUsuarioAtual();
  const op = await createScoped('OrdemProducao', {
    empresa_id: contextoOperacao.empresaId,
    group_id: contextoOperacao.groupId,
    numero_op: numeroOP,
    pedido_id: pedido.id,
    numero_pedido: pedido.numero_pedido,
    cliente_id: pedido.cliente_id,
    cliente_nome: pedido.cliente_nome,
    origem: 'pedido',
    gerada_automaticamente: true,
    tipo_producao: 'misto',
    data_emissao: new Date().toISOString().split('T')[0],
    data_prevista_inicio: new Date().toISOString().split('T')[0],
    data_prevista_conclusao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    prazo_dias: 7,
    prioridade: pedido.prioridade || 'Normal',
    status: 'Liberada',
    itens_producao: pedido.itens_producao,
    materiais_necessarios: materiaisNecessarios,
    peso_teorico_total_kg: pesoTotal,
    itens_total: pedido.itens_producao?.length || 0,
    itens_concluidos: 0,
    percentual_conclusao: 0,
    historico_status: [{ status_anterior: null, status_novo: 'Liberada', data_hora: new Date().toISOString(), usuario: (user?.full_name || user?.email || 'Sistema'), observacao: 'OP gerada automaticamente na aprovacao do pedido' }]
  }, contextoOperacao);

  await auditar('Producao', 'OrdemProducao', 'create', op.id, `OP ${numeroOP} gerada do Pedido ${pedido.numero_pedido}`, contextoOperacao.empresaId, null, op, contextoOperacao.groupId);
  await updateScoped('Pedido', pedido.id, { ordem_producao_ids: [...(pedido.ordem_producao_ids || []), op.id], status: 'Em Producao' }, contextoOperacao);
  return op;
}

async function gerarContaReceber(pedido, parcela, empresaId) {
  const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);
  const conta = await createScoped('ContaReceber', {
    empresa_id: contextoOperacao.empresaId,
    group_id: contextoOperacao.groupId,
    origem_tipo: 'pedido',
    descricao: `Pedido ${pedido.numero_pedido} - Parcela ${parcela.numero_parcela}`,
    cliente: pedido.cliente_nome,
    cliente_id: pedido.cliente_id,
    pedido_id: pedido.id,
    valor: parcela.valor,
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: parcela.data_vencimento,
    status: 'Pendente',
    forma_recebimento: pedido.forma_pagamento,
    numero_parcela: parcela.numero_parcela.toString(),
    observacoes: `Gerado automaticamente do pedido ${pedido.numero_pedido}`
  }, contextoOperacao);
  await auditar('Financeiro', 'ContaReceber', 'create', conta.id, `CR gerada do Pedido ${pedido.numero_pedido} - Parcela ${parcela.numero_parcela}`, contextoOperacao.empresaId, null, conta, contextoOperacao.groupId);
  return conta;
}

async function atualizarLimiteCreditoCliente(clienteId, valor, operacao = 'adicionar', contextoOperacao = null) {
  const contexto = contextoOperacao || normalizarContextoOperacao({});
  const clientes = await filterScoped('Cliente', { id: clienteId }, contexto);
  const cliente = clientes[0];
  if (!cliente) return;

  const limiteAtual = cliente.condicao_comercial?.limite_credito_utilizado || 0;
  const novoLimite = operacao === 'adicionar' ? limiteAtual + valor : limiteAtual - valor;
  const { before, updated } = await updateScoped('Cliente', clienteId, {
    condicao_comercial: { ...(cliente.condicao_comercial || {}), limite_credito_utilizado: Math.max(0, novoLimite) }
  }, contexto);
  await auditar('Comercial', 'Cliente', 'update', clienteId, 'Limite de credito atualizado por fluxo de pedido', contexto.empresaId, before, updated, contexto.groupId);
}

/**
 * 7?????? FATURAR PEDIDO ??? Baixa Estoque + Cria Entrega
 */
export async function faturarPedidoCompleto(pedido, nfe, empresaId) {
  const resultados = {
    baixasEstoque: [],
    entrega: null,
    erros: []
  };

  const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);
  if (!contextoOperacao.empresaId) {
    throw new Error('Empresa obrigatoria para faturar pedido.');
  }

  const notasExistentes = (await filterScoped('NotaFiscal', { pedido_id: pedido.id }, contextoOperacao))
    .filter((nota) => String(nota.id) !== String(nfe?.id || ''));
  const notaNova = nfe || { valor_total: pedido.valor_total || pedido.valor_produtos || 0, pedido_id: pedido.id };
  const { status } = assertFaturamentoDentroDoPedido({ pedido, notasExistentes, notaNova });

  try {

    if (pedido.itens_revenda?.length > 0) {
      for (const item of pedido.itens_revenda) {
        try {
          const baixa = await baixarEstoqueItem(item, pedido, contextoOperacao.empresaId);
          resultados.baixasEstoque.push(baixa);
        } catch (error) {
          resultados.erros.push(`Erro ao baixar ${item.descricao}: ${error.message}`);
        }
      }
    }

    const user = await getUsuarioAtual();
    const entrega = await createScoped('Entrega', {
      empresa_id: contextoOperacao.empresaId,
      group_id: contextoOperacao.groupId,
      pedido_id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      nfe_id: nfe?.id,
      cliente_id: pedido.cliente_id,
      cliente_nome: pedido.cliente_nome,
      endereco_entrega_completo: pedido.endereco_entrega_principal,
      contato_entrega: pedido.contatos_cliente?.[0] || {},
      data_previsao: pedido.data_prevista_entrega,
      transportadora: pedido.transportadora,
      tipo_frete: pedido.tipo_frete,
      volumes: pedido.volumes,
      peso_total_kg: pedido.peso_total_kg,
      valor_frete: pedido.valor_frete,
      valor_mercadoria: pedido.valor_total,
      status: 'Pronto para Expedir',
      prioridade: pedido.prioridade || 'Normal',
      usuario_responsavel: (user?.full_name || user?.email || 'Sistema'),
      usuario_responsavel_id: user?.id,
      qr_code: `ENT-${Date.now()}`,
      historico_status: [{
        status: 'Pronto para Expedir',
        data_hora: new Date().toISOString(),
        usuario: (user?.full_name || user?.email || 'Sistema'),
        observacao: 'Entrega criada automaticamente no faturamento'
      }]
    }, contextoOperacao);

    await auditar('Logistica', 'Entrega', 'create', entrega.id, `Entrega criada do Pedido ${pedido.numero_pedido}`, contextoOperacao.empresaId, null, entrega, contextoOperacao.groupId);
    resultados.entrega = entrega;

    const { before: pedidoAntes, updated: pedidoAtualizado } = await updateScoped('Pedido', pedido.id, {
      status,
      ordem_expedicao_id: entrega.id,
      data_entrega_realizada: status === 'Faturado' ? new Date().toISOString().split('T')[0] : pedido.data_entrega_realizada || null
    }, contextoOperacao);
    await auditar('Comercial', 'Pedido', 'update', pedido.id, `Pedido ${pedido.numero_pedido} faturado`, contextoOperacao.empresaId, pedidoAntes, pedidoAtualizado, contextoOperacao.groupId);

  } catch (error) {
    resultados.erros.push(`Erro no faturamento: ${error.message}`);
  }

  return resultados;
}

/**
 * 8️⃣ BAIXAR ESTOQUE
 */
async function baixarEstoqueItem(item, pedido, empresaId) {
  const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);
  const produtos = await filterScoped('Produto', { id: item.produto_id }, contextoOperacao);
  const produto = produtos[0];

  if (!produto) {
    throw new Error('Produto nao encontrado');
  }

  const novoReservado = Math.max(0, (produto.estoque_reservado || 0) - item.quantidade);
  const novoEstoque = (produto.estoque_atual || 0) - item.quantidade;

  if (novoEstoque < 0) {
    throw new Error(`Estoque insuficiente para ${produto.descricao}`);
  }

  const user = await getUsuarioAtual();
  const movimentacao = await createScoped('MovimentacaoEstoque', {
    empresa_id: contextoOperacao.empresaId,
    group_id: contextoOperacao.groupId,
    tipo_movimento: 'liberacao_reserva',
    origem_movimento: 'pedido',
    origem_documento_id: pedido.id,
    produto_id: item.produto_id,
    produto_descricao: item.descricao,
    codigo_produto: item.codigo_sku,
    quantidade: item.quantidade,
    unidade_medida: item.unidade,
    estoque_anterior: produto.estoque_atual,
    estoque_atual: novoEstoque,
    reservado_anterior: produto.estoque_reservado || 0,
    reservado_atual: novoReservado,
    data_movimentacao: new Date().toISOString(),
    documento: pedido.numero_pedido,
    motivo: 'Baixa por faturamento - NF-e',
    responsavel: (user?.full_name || user?.email || 'Sistema'),
    responsavel_id: user?.id
  }, contextoOperacao);

  const { before: produtoAntes, updated: produtoAtualizado } = await updateScoped('Produto', item.produto_id, {
    estoque_atual: novoEstoque,
    estoque_reservado: novoReservado
  }, contextoOperacao);

  await auditar('Estoque', 'MovimentacaoEstoque', 'create', movimentacao.id, `Baixa por faturamento - Pedido ${pedido.numero_pedido}`, contextoOperacao.empresaId, null, movimentacao, contextoOperacao.groupId);
  await auditar('Estoque', 'Produto', 'update', item.produto_id, `Estoque atualizado por faturamento - Pedido ${pedido.numero_pedido}`, contextoOperacao.empresaId, produtoAntes, produtoAtualizado, contextoOperacao.groupId);
  return movimentacao;
}

/**
 * 9️⃣ CONCLUIR OP → Liberar para Expedição
 */
export async function concluirOPCompleto(op, empresaId) {
  const resultados = {
    baixasMaterial: [],
    entrega: null,
    erros: []
  };

  try {
    const contextoOperacao = normalizarContextoOperacao(op, empresaId);

    if (op.materiais_necessarios?.length > 0) {
      for (const material of op.materiais_necessarios) {
        try {
          const baixa = await baixarMaterialProducao(material, op, contextoOperacao.empresaId);
          if (baixa) resultados.baixasMaterial.push(baixa);
        } catch (error) {
          resultados.erros.push(`Material ${material.descricao}: ${error.message}`);
        }
      }
    }

    const user = await getUsuarioAtual();
    const { before: opAntes, updated: opAtualizada } = await updateScoped('OrdemProducao', op.id, {
      status: 'Finalizada',
      data_conclusao_real: new Date().toISOString(),
      percentual_conclusao: 100,
      historico_status: [
        ...(op.historico_status || []),
        {
          status_anterior: op.status,
          status_novo: 'Finalizada',
          data_hora: new Date().toISOString(),
          usuario: (user?.full_name || user?.email || 'Sistema'),
          observacao: 'OP concluida - material liberado para expedicao'
        }
      ]
    }, contextoOperacao);

    await auditar('Producao', 'OrdemProducao', 'update', op.id, `OP ${op.numero_op} finalizada`, contextoOperacao.empresaId, opAntes, opAtualizada, contextoOperacao.groupId);

    if (op.pedido_id) {
      const { before: pedidoAntes, updated: pedidoAtualizado } = await updateScoped('Pedido', op.pedido_id, {
        status: 'Pronto para Faturar'
      }, contextoOperacao);
      await auditar('Comercial', 'Pedido', 'update', op.pedido_id, `Pedido ${op.numero_pedido || ''} pronto para faturar (via OP ${op.numero_op})`, contextoOperacao.empresaId, pedidoAntes, pedidoAtualizado, contextoOperacao.groupId);
    }

  } catch (error) {
    resultados.erros.push(`Erro ao concluir OP: ${error.message}`);
  }

  return resultados;
}

/**
 * 🔟 BAIXAR MATERIAL DA PRODUÇÃO
 */
async function baixarMaterialProducao(material, op, empresaId) {
  const contextoOperacao = normalizarContextoOperacao(op, empresaId);
  const produtos = await filterScoped('Produto', { id: material.bitola_id || material.produto_id }, contextoOperacao);

  const produto = produtos[0];
  if (!produto) return null;

  const novoEstoque = (produto.estoque_atual || 0) - material.quantidade_kg;

  const user = await getUsuarioAtual();
  const movConsumo = await createScoped('MovimentacaoEstoque', {
    empresa_id: contextoOperacao.empresaId,
    group_id: contextoOperacao.groupId,
    tipo_movimento: 'saida',
    origem_movimento: 'producao',
    origem_documento_id: op.id,
    produto_id: produto.id,
    produto_descricao: material.descricao,
    quantidade: material.quantidade_kg,
    unidade_medida: 'KG',
    estoque_anterior: produto.estoque_atual,
    estoque_atual: novoEstoque,
    data_movimentacao: new Date().toISOString(),
    documento: op.numero_op,
    motivo: `Consumo na producao - OP ${op.numero_op}`,
    responsavel: (user?.full_name || user?.email || 'Sistema'),
    responsavel_id: user?.id
  }, contextoOperacao);

  await auditar('Estoque', 'MovimentacaoEstoque', 'create', movConsumo.id, `Consumo na producao - OP ${op.numero_op}`, contextoOperacao.empresaId, null, movConsumo, contextoOperacao.groupId);
  const { before: produtoAntes, updated: produtoAtualizado } = await updateScoped('Produto', produto.id, {
    estoque_atual: Math.max(0, novoEstoque)
  }, contextoOperacao);
  await auditar('Estoque', 'Produto', 'update', produto.id, `Estoque atualizado por consumo de producao - OP ${op.numero_op}`, contextoOperacao.empresaId, produtoAntes, produtoAtualizado, contextoOperacao.groupId);
  return movConsumo;
}

/**
 * 1️⃣1️⃣ CANCELAR PEDIDO → Libera Reservas + Cancela Contas
 */
export async function cancelarPedidoCompleto(pedido, empresaId) {
  const resultados = {
    reservasLiberadas: [],
    contasCanceladas: [],
    erros: []
  };

  try {
    const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);
    const movimentacoes = await filterScoped('MovimentacaoEstoque', {
      origem_documento_id: pedido.id,
      tipo_movimento: 'reserva'
    }, contextoOperacao);

    for (const mov of movimentacoes) {
      try {
        const reservaLiberada = await liberarReservaEstoque(mov, contextoOperacao.empresaId);
        resultados.reservasLiberadas.push(reservaLiberada || mov);
      } catch (error) {
        resultados.erros.push(`Erro ao liberar reserva: ${error.message}`);
      }
    }

    const contas = await filterScoped('ContaReceber', {
      pedido_id: pedido.id,
      status: 'Pendente'
    }, contextoOperacao);

    for (const conta of contas) {
      const { before: contaAntes, updated: contaAtualizada } = await updateScoped('ContaReceber', conta.id, {
        status: 'Cancelado'
      }, contextoOperacao);
      await auditar('Financeiro', 'ContaReceber', 'update', conta.id, `Conta a receber cancelada (Pedido ${pedido.numero_pedido})`, contextoOperacao.empresaId, contaAntes, contaAtualizada, contextoOperacao.groupId);
      resultados.contasCanceladas.push(contaAtualizada || conta);
    }

    if (pedido.cliente_id) {
      await atualizarLimiteCreditoCliente(pedido.cliente_id, pedido.valor_total, 'remover', contextoOperacao);
    }

    const { before: pedidoAntes, updated: pedidoAtualizado } = await updateScoped('Pedido', pedido.id, {
      status: 'Cancelado'
    }, contextoOperacao);
    await auditar('Comercial', 'Pedido', 'update', pedido.id, `Pedido ${pedido.numero_pedido} cancelado`, contextoOperacao.empresaId, pedidoAntes, pedidoAtualizado, contextoOperacao.groupId);

  } catch (error) {
    resultados.erros.push(`Erro ao cancelar: ${error.message}`);
  }

  return resultados;
}

/**
 * 1️⃣2️⃣ LIBERAR RESERVA DE ESTOQUE
 */
async function liberarReservaEstoque(movimentacaoReserva, empresaId) {
  const contextoOperacao = normalizarContextoOperacao(movimentacaoReserva, empresaId);
  const produtos = await filterScoped('Produto', { id: movimentacaoReserva.produto_id }, contextoOperacao);

  const produto = produtos[0];
  if (!produto) return null;

  const reservadoAtual = Math.max(0, (produto.estoque_reservado || 0) - movimentacaoReserva.quantidade);
  const user = await getUsuarioAtual();
  const mov = await createScoped('MovimentacaoEstoque', {
    empresa_id: contextoOperacao.empresaId,
    group_id: contextoOperacao.groupId,
    tipo_movimento: 'liberacao_reserva',
    origem_movimento: 'pedido',
    origem_documento_id: movimentacaoReserva.origem_documento_id,
    produto_id: produto.id,
    produto_descricao: produto.descricao,
    codigo_produto: produto.codigo,
    quantidade: movimentacaoReserva.quantidade,
    unidade_medida: produto.unidade_medida,
    estoque_anterior: produto.estoque_atual,
    estoque_atual: produto.estoque_atual,
    reservado_anterior: produto.estoque_reservado || 0,
    reservado_atual: reservadoAtual,
    data_movimentacao: new Date().toISOString(),
    documento: movimentacaoReserva.documento,
    motivo: 'Liberacao de reserva - pedido cancelado',
    responsavel: (user?.full_name || user?.email || 'Sistema'),
    responsavel_id: user?.id
  }, contextoOperacao);

  await auditar('Estoque', 'MovimentacaoEstoque', 'create', mov.id, 'Liberacao de reserva - pedido cancelado', contextoOperacao.empresaId, null, mov, contextoOperacao.groupId);
  const { before: produtoAntes, updated: produtoAtualizado } = await updateScoped('Produto', produto.id, {
    estoque_reservado: reservadoAtual
  }, contextoOperacao);
  await auditar('Estoque', 'Produto', 'update', produto.id, 'Reserva liberada por cancelamento de pedido', contextoOperacao.empresaId, produtoAntes, produtoAtualizado, contextoOperacao.groupId);
  return mov;
}

/**
 * 1️⃣3️⃣ EXECUTAR FLUXO COMPLETO DE FECHAMENTO
 * V21.6 - FUNÇÃO PRINCIPAL DE AUTOMAÇÃO
 */
export async function executarFechamentoCompleto(pedido, empresaId, callbacks = {}) {
  const {
    onProgresso = () => {},
    onLog = () => {},
    onEtapaConcluida = () => {},
    onComplete = () => {},
    onError = () => {}
  } = callbacks;

  const resultados = {
    estoque: { sucesso: false, itens: [], erros: [] },
    financeiro: { sucesso: false, contas: [], erros: [] },
    logistica: { sucesso: false, entrega: null, erros: [] },
    status: { sucesso: false, erros: [] }
  };

  try {
    const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);
    onLog('🚀 Iniciando fechamento automático...', 'info');
    onProgresso(0);

    // ETAPA 1: Baixar Estoque
    onLog('📦 Processando baixa de estoque...', 'info');
    try {
      const itens = [
        ...(pedido.itens_revenda || []),
        ...(pedido.itens_armado_padrao || []),
        ...(pedido.itens_corte_dobra || [])
      ];

      for (const item of itens) {
        if (item.produto_id) {
          try {
            const baixa = await baixarEstoqueItemAprovacao(item, pedido, contextoOperacao.empresaId);
            resultados.estoque.itens.push(baixa);
            onLog(`✅ ${item.descricao}: ${item.quantidade} ${item.unidade} baixado(s)`, 'success');
          } catch (error) {
            resultados.estoque.erros.push(error.message);
            onLog(`⚠️ ${item.descricao}: ${error.message}`, 'warning');
          }
        }
      }
      
      resultados.estoque.sucesso = true;
      onEtapaConcluida('estoque', true);
      onProgresso(25);
    } catch (error) {
      resultados.estoque.erros.push(error.message);
      onLog(`❌ Erro na baixa de estoque: ${error.message}`, 'error');
    }

    // ETAPA 2: Gerar Financeiro
    onLog('💰 Gerando contas a receber...', 'info');
    try {
      const numeroParcelas = pedido.numero_parcelas || 1;
      const valorParcela = pedido.valor_total / numeroParcelas;
      const dataEmissao = new Date();

      for (let i = 1; i <= numeroParcelas; i++) {
        const dataVencimento = new Date(dataEmissao);
        const intervalo = pedido.intervalo_parcelas || 30;
        dataVencimento.setDate(dataVencimento.getDate() + (i * intervalo));

        const conta = await createScoped('ContaReceber', {
           empresa_id: contextoOperacao.empresaId,
           group_id: contextoOperacao.groupId,
          origem_tipo: 'pedido',
          descricao: `Venda - Pedido ${pedido.numero_pedido} - Parcela ${i}/${numeroParcelas}`,
          cliente: pedido.cliente_nome,
          cliente_id: pedido.cliente_id,
          pedido_id: pedido.id,
          valor: valorParcela,
          data_emissao: dataEmissao.toISOString().split('T')[0],
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: 'Pendente',
          forma_recebimento: pedido.forma_pagamento || 'À Vista',
          numero_documento: pedido.numero_pedido,
          numero_parcela: `${i}/${numeroParcelas}`,
          visivel_no_portal: true
        }, contextoOperacao);

        await auditar('Financeiro', 'ContaReceber', 'create', conta.id, `CR gerada do Pedido ${pedido.numero_pedido} - Parcela ${i}/${numeroParcelas}`, contextoOperacao.empresaId, null, conta, contextoOperacao.groupId);
        resultados.financeiro.contas.push(conta);
        onLog(`✅ Parcela ${i}/${numeroParcelas}: R$ ${valorParcela.toFixed(2)} - Venc: ${dataVencimento.toLocaleDateString('pt-BR')}`, 'success');
      }

      resultados.financeiro.sucesso = true;
      onEtapaConcluida('financeiro', true);
      onProgresso(50);
    } catch (error) {
      resultados.financeiro.erros.push(error.message);
      onLog(`❌ Erro ao gerar financeiro: ${error.message}`, 'error');
    }

    // ETAPA 3: Criar Logística
    onLog('🚚 Criando registro de logística...', 'info');
    try {
      const tipoFrete = pedido.tipo_frete || 'CIF';
      
      if (tipoFrete === 'Retirada') {
        await updateScoped('Pedido', pedido.id, {
          observacoes_internas: (pedido.observacoes_internas || '') + '\n[AUTOMAÇÃO] Cliente irá retirar na loja.'
        }, contextoOperacao);
        onLog(`✅ Pedido marcado para RETIRADA`, 'success');
      } else {
        const user = await getUsuarioAtual();
        const entrega = await createScoped('Entrega', {
          empresa_id: contextoOperacao.empresaId,
          group_id: contextoOperacao.groupId,
          pedido_id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          cliente_id: pedido.cliente_id,
          cliente_nome: pedido.cliente_nome,
          endereco_entrega_completo: pedido.endereco_entrega_principal || {},
          contato_entrega: {
            nome: pedido.cliente_nome,
            telefone: pedido.contatos_cliente?.[0]?.valor || ''
          },
          data_previsao: pedido.data_prevista_entrega || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tipo_frete: tipoFrete,
          valor_mercadoria: pedido.valor_total,
          valor_frete: pedido.valor_frete || 0,
          peso_total_kg: pedido.peso_total_kg || 0,
          volumes: 1,
          status: 'Aguardando Separação',
          prioridade: pedido.prioridade || 'Normal',
          usuario_responsavel: (user?.full_name || user?.email || 'Sistema'),
          usuario_responsavel_id: user?.id
        }, contextoOperacao);

        await auditar('Expedição', 'Entrega', 'create', entrega.id, `Entrega criada do Pedido ${pedido.numero_pedido}`, contextoOperacao.empresaId, null, entrega, contextoOperacao.groupId);
        resultados.logistica.entrega = entrega;
        onLog(`✅ Entrega criada - Previsão: ${pedido.data_prevista_entrega || 'A definir'}`, 'success');
      }

      resultados.logistica.sucesso = true;
      onEtapaConcluida('logistica', true);
      onProgresso(75);
    } catch (error) {
      resultados.logistica.erros.push(error.message);
      onLog(`❌ Erro ao criar logística: ${error.message}`, 'error');
    }

    // ETAPA 4: Atualizar Status
    onLog('📝 Atualizando status do pedido...', 'info');
    try {
      const { before: pedidoAntes, updated: pedidoAtualizado } = await updateScoped('Pedido', pedido.id, {
        status: 'Pronto para Faturar',
        observacoes_internas: (pedido.observacoes_internas || '') +
          `\n[AUTOMAÇÃO ${new Date().toLocaleString('pt-BR')}] Fluxo automático concluído com sucesso.`
      }, contextoOperacao);
      await auditar('Comercial', 'Pedido', 'update', pedido.id, `Pedido ${pedido.numero_pedido} pronto para faturar (fechamento automático)`, contextoOperacao.empresaId, pedidoAntes, pedidoAtualizado, contextoOperacao.groupId);

      resultados.status.sucesso = true;
      onEtapaConcluida('status', true);
      onProgresso(100);
      onLog(`✅ Pedido atualizado para: PRONTO PARA FATURAR`, 'success');
      onLog(`🎉 AUTOMAÇÃO CONCLUÍDA COM SUCESSO!`, 'success');
      
      onComplete(resultados);
    } catch (error) {
      resultados.status.erros.push(error.message);
      onLog(`❌ Erro ao atualizar status: ${error.message}`, 'error');
      onError(error);
    }

  } catch (error) {
    onLog(`❌ Erro crítico: ${error.message}`, 'error');
    onError(error);
  }

  return resultados;
}

/**
 * 1️⃣4️⃣ VALIDAR ESTOQUE ANTES DE FECHAR
 * V21.6 - Validação preventiva
 */
export async function validarEstoqueCompleto(pedido, empresaId) {
  const itens = [
    ...(pedido.itens_revenda || []),
    ...(pedido.itens_armado_padrao || []),
    ...(pedido.itens_corte_dobra || [])
  ];

  const resultados = {
    valido: true,
    itensInsuficientes: [],
    itensOK: []
  };
  const contextoOperacao = normalizarContextoOperacao(pedido, empresaId);

  for (const item of itens) {
    if (item.produto_id) {
      const produtos = await filterScoped('Produto', {
        id: item.produto_id
      }, contextoOperacao);
      
      const produto = produtos[0];
      if (produto) {
        const estoqueAtual = produto.estoque_atual || 0;
        const quantidadeNecessaria = item.quantidade || 0;

        if (estoqueAtual >= quantidadeNecessaria) {
          resultados.itensOK.push({
            produto: item.descricao,
            estoque: estoqueAtual,
            necessario: quantidadeNecessaria,
            sobra: estoqueAtual - quantidadeNecessaria
          });
        } else {
          resultados.valido = false;
          resultados.itensInsuficientes.push({
            produto: item.descricao,
            estoque: estoqueAtual,
            necessario: quantidadeNecessaria,
            falta: quantidadeNecessaria - estoqueAtual
          });
        }
      }
    }
  }

  return resultados;
}

/**
 * 1️⃣5️⃣ ESTATÍSTICAS DE AUTOMAÇÃO
 * V21.6 - Analytics do sistema
 */
export async function obterEstatisticasAutomacao(empresaId = null, diasRetroativos = 7) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - diasRetroativos);

  const contextoOperacao = normalizarContextoOperacao({}, empresaId);

  // Buscar pedidos sempre dentro do contexto grupo/empresa
  const pedidos = await filterScoped('Pedido', {}, contextoOperacao, '-created_date', 500);

  const pedidosRecentes = pedidos.filter(p => {
    const dataPedido = new Date(p.created_date);
    return dataPedido >= dataLimite;
  });

  const pedidosFechados = pedidosRecentes.filter(p => 
    p.status === 'Pronto para Faturar' || 
    p.status === 'Faturado' || 
    p.status === 'Em Expedição'
  );

  const pedidosComAutomacao = pedidosFechados.filter(p => 
    p.observacoes_internas?.includes('[AUTOMAÇÃO')
  );

  const taxaAutomacao = pedidosFechados.length > 0 
    ? (pedidosComAutomacao.length / pedidosFechados.length) * 100 
    : 0;

  return {
    totalPedidos: pedidosRecentes.length,
    pedidosFechados: pedidosFechados.length,
    pedidosAutomaticos: pedidosComAutomacao.length,
    taxaAutomacao,
    diasAnalise: diasRetroativos,
    empresaId: contextoOperacao.empresaId,
    groupId: contextoOperacao.groupId
  };
}

export default {
  aprovarPedidoCompleto,
  faturarPedidoCompleto,
  concluirOPCompleto,
  cancelarPedidoCompleto,
  validarLimiteCredito,
  executarFechamentoCompleto, // V21.6
  validarEstoqueCompleto, // V21.6
  obterEstatisticasAutomacao // V21.6
};