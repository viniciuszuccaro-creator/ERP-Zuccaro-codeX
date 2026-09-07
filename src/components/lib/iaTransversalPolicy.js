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
