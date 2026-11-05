/** Escopo vivo vs esperado (ator + sessão) — resposta tardia. */
export function isSimularPagamentoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/**
 * Resolve groupId/empresaId fail-closed: contexto visual prevalece;
 * props da conta só preenchem se baterem com o contexto ou se o contexto estiver parcial.
 */
export function resolveSimularPagamentoScopeIds({ groupId, empresaId, conta }) {
  const ctxGroup = groupId || null;
  const ctxEmpresa = empresaId || null;
  const contaGroup = conta?.group_id || conta?.groupId || null;
  const contaEmpresa = conta?.empresa_id || conta?.empresaId || null;

  if (ctxGroup && contaGroup && String(ctxGroup) !== String(contaGroup)) {
    return { ok: false, reason: 'GROUP_MISMATCH', groupId: null, empresaId: null };
  }
  if (ctxEmpresa && contaEmpresa && String(ctxEmpresa) !== String(contaEmpresa)) {
    return { ok: false, reason: 'EMPRESA_MISMATCH', groupId: null, empresaId: null };
  }

  const resolvedGroup = ctxGroup || contaGroup || null;
  const resolvedEmpresa = ctxEmpresa || contaEmpresa || null;
  if (!resolvedGroup && !resolvedEmpresa) {
    return { ok: false, reason: 'SCOPE_MISSING', groupId: null, empresaId: null };
  }
  return { ok: true, reason: null, groupId: resolvedGroup, empresaId: resolvedEmpresa };
}

export function buildSimularPagamentoPayload({
  groupId,
  empresaId,
  contaReceber,
  dadosSimulacao,
  user,
  pagamentoId,
}) {
  const pagamento = {
    group_id: groupId,
    empresa_id: empresaId,
    origem_pagamento: 'Simulação Manual',
    id_cliente: contaReceber.cliente_id,
    cliente_nome: contaReceber.cliente,
    cliente_cpf_cnpj: contaReceber.cliente_cpf_cnpj,
    valor_bruto: dadosSimulacao.valor_pago,
    valor_liquido: dadosSimulacao.valor_pago,
    forma_pagamento: dadosSimulacao.forma_pagamento,
    gateway_utilizado: contaReceber.provedor_pagamento || 'Asaas',
    status_transacao: 'Aprovado',
    status_conferencia: 'Pendente',
    data_transacao: dadosSimulacao.data_pagamento,
    id_transacao_gateway: `sim_${Date.now()}`,
    conta_receber_id: contaReceber.id,
    webhook_recebido: true,
    webhook_payload: {
      simulado: true,
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: contaReceber.id_cobranca_externa,
        status: 'RECEIVED',
        value: dadosSimulacao.valor_pago,
      },
    },
  };

  const contaUpdate = {
    status: 'Recebido',
    data_recebimento: dadosSimulacao.data_pagamento,
    valor_recebido: dadosSimulacao.valor_pago,
    forma_recebimento: dadosSimulacao.forma_pagamento,
    data_retorno_pagamento: new Date().toISOString(),
    status_cobranca: 'paga',
    webhook_status: 'pago',
  };

  const ordemLiquidacao = {
    group_id: groupId,
    empresa_id: empresaId,
    tipo_operacao: 'Recebimento',
    origem: 'Simulação Gateway',
    valor_total: dadosSimulacao.valor_pago,
    forma_pagamento_pretendida: dadosSimulacao.forma_pagamento,
    status: 'Pendente',
    titulos_vinculados: [{
      titulo_id: contaReceber.id,
      numero_titulo: contaReceber.numero_documento || contaReceber.descricao,
      cliente_fornecedor_nome: contaReceber.cliente,
      valor_titulo: dadosSimulacao.valor_pago,
      data_vencimento: contaReceber.data_vencimento,
    }],
    pagamento_omnichannel_id: pagamentoId || null,
    usuario_solicitante_id: user?.id,
  };

  const historico = contaReceber.cliente_id ? {
    group_id: groupId,
    empresa_id: empresaId,
    cliente_id: contaReceber.cliente_id,
    cliente_nome: contaReceber.cliente,
    modulo_origem: 'Financeiro',
    referencia_id: contaReceber.id,
    referencia_tipo: 'ContaReceber',
    tipo_evento: 'Recebimento',
    titulo_evento: `Recebimento via ${dadosSimulacao.forma_pagamento}`,
    descricao_detalhada: `Simulação de pagamento - R$ ${Number(dadosSimulacao.valor_pago).toFixed(2)}`,
    usuario_responsavel: user?.full_name || 'Sistema',
    data_evento: dadosSimulacao.data_pagamento,
    valor_relacionado: dadosSimulacao.valor_pago,
    resolvido: true,
  } : null;

  const logCobranca = {
    group_id: groupId,
    empresa_id: empresaId,
    conta_receber_id: contaReceber.id,
    tipo_operacao: 'webhook_pagamento',
    provedor: contaReceber.provedor_pagamento || 'Simulação',
    data_hora: new Date().toISOString(),
    status_operacao: 'simulado',
    mensagem: 'Pagamento simulado manualmente',
    valor_operacao: dadosSimulacao.valor_pago,
    usuario_nome: user?.full_name || 'Sistema',
  };

  return { pagamento, contaUpdate, ordemLiquidacao, historico, logCobranca };
}
