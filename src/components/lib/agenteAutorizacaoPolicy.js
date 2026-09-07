const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const AGENTES = {
  comercial: { modulo: 'Comercial', secao: 'Pedido', label: 'Agente Comercial' },
  financeiro: { modulo: 'Financeiro', secao: 'ContaReceber', label: 'Agente Financeiro' },
  fiscal: { modulo: 'Fiscal', secao: 'NotaFiscal', label: 'Agente Fiscal' },
  compras: { modulo: 'Compras', secao: 'OrdemCompra', label: 'Agente Compras' },
  estoque: { modulo: 'Estoque', secao: 'Produtos', label: 'Agente Estoque' },
  producao: { modulo: 'Producao', secao: 'OrdemProducao', label: 'Agente Produção' },
  logistica: { modulo: 'Expedicao', secao: 'Entrega', label: 'Agente Logística' },
  atendimento: { modulo: 'CRM', secao: 'Atendimento', label: 'Agente Atendimento' },
  auditor: { modulo: 'Sistema', secao: 'Auditoria', label: 'Agente Auditor' },
  seguranca: { modulo: 'Sistema', secao: 'Controle de Acesso', label: 'Agente Segurança' },
  migracao: { modulo: 'Sistema', secao: 'Integracoes', label: 'Agente Migração' },
  diretoria: { modulo: 'Relatorios', secao: 'Dashboard', label: 'Agente Diretoria' },
};

export const resolveAgentKey = (value) => {
  const normalized = firstText(value).toLowerCase();
  if (AGENTES[normalized]) return normalized;
  const match = Object.entries(AGENTES).find(([, spec]) => spec.label.toLowerCase() === normalized);
  return match?.[0] || null;
};

export const AGENT_FUNCTION_MAP = {
  iaFinanceAnomalyScan: { agent: 'financeiro', action: 'visualizar', critical: false },
  iaChurnAnalyzer: { agent: 'comercial', action: 'visualizar', critical: false },
  oportunidadeScorer: { agent: 'comercial', action: 'editar', critical: true },
  productPriceOptimizer: { agent: 'comercial', modulo: 'Comercial', secao: 'Produto', action: 'editar', critical: true },
  optimizerOrchestrator: { agent: 'comercial', modulo: 'Comercial', secao: 'Produto', action: 'editar', critical: true },
  permissionOptimizer: { agent: 'seguranca', action: 'editar', critical: true },
};

export const resolveAgentScope = (agent, functionSpec = null) => {
  const key = resolveAgentKey(agent) || functionSpec?.agent;
  const def = AGENTES[key] || {};
  return {
    agent: key,
    modulo: functionSpec?.modulo || def.modulo,
    secao: functionSpec?.secao || def.secao,
  };
};

const CRITICAL_ACTIONS = new Set([
  'criar',
  'editar',
  'excluir',
  'aprovar',
  'emitir',
  'pagar',
  'receber',
  'executar',
  'ajustar',
]);

export const isCriticalAgentAction = (action, functionSpec = null) => {
  if (functionSpec?.critical) return true;
  return CRITICAL_ACTIONS.has(String(action || '').toLowerCase());
};

export const assertAgentMayAct = ({
  agent,
  userAllowed,
  action = 'visualizar',
  confirmed = false,
  functionSpec = null,
} = {}) => {
  const key = resolveAgentKey(agent);
  if (!key) {
    throw new Error('Agente desconhecido.');
  }
  if (userAllowed !== true) {
    throw new Error('Agente herda a permissao do usuario. Acesso negado.');
  }
  if (isCriticalAgentAction(action, functionSpec) && confirmed !== true) {
    throw new Error('Acao critica do agente exige confirmacao humana.');
  }
  return {
    agent: key,
    modulo: AGENTES[key].modulo,
    secao: AGENTES[key].secao,
    action,
    modo: 'heranca_usuario',
    confirmed: Boolean(confirmed),
  };
};

export const assertMappedAgentFunction = ({ functionName, userAllowed, confirmed = false, agent } = {}) => {
  const spec = AGENT_FUNCTION_MAP[functionName];
  if (!spec) return null;
  return assertAgentMayAct({
    agent: agent || spec.agent,
    userAllowed,
    action: spec.action,
    confirmed,
    functionSpec: spec,
  });
};
