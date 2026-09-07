const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const PORTAL_TIMEOUT_MS = 12000;

export const PORTAL_SCOPED_ENTITIES = new Set([
  'Pedido',
  'NotaFiscal',
  'NFe',
  'ContaReceber',
  'Entrega',
  'Chamado',
  'OrcamentoCliente',
  'Oportunidade',
]);

export const sanitizePortalClienteId = ({ requestedClienteId, adminMode = false } = {}) => {
  if (!adminMode) return null;
  return firstText(requestedClienteId) || null;
};

export const assertPortalClienteScope = ({ user, cliente, requestedClienteId, adminMode = false } = {}) => {
  const requested = firstText(requestedClienteId);
  if (requested && !adminMode) {
    if (!cliente || firstText(cliente.id) !== requested) {
      throw new Error('Acesso a outro cliente bloqueado.');
    }
  }
  if (cliente && user && firstText(cliente.portal_usuario_id) && firstText(cliente.portal_usuario_id) !== firstText(user.id) && !adminMode) {
    throw new Error('Cliente nao vinculado a este usuario.');
  }
  return true;
};

export const resolvePortalClienteId = (clientes = [], user = {}) => {
  const userId = firstText(user.id);
  if (!userId) return null;
  const mine = (Array.isArray(clientes) ? clientes : []).find((item) => firstText(item.portal_usuario_id) === userId);
  return mine?.id || null;
};

export const applyPortalReadScope = ({ entityName, records = [], portalClienteId } = {}) => {
  if (!portalClienteId) return records;
  const list = Array.isArray(records) ? records : [];
  if (entityName === 'Cliente') {
    return list.filter((item) => firstText(item.id) === firstText(portalClienteId));
  }
  if (!PORTAL_SCOPED_ENTITIES.has(entityName)) return list;
  return list.filter((item) => firstText(item.cliente_id) === firstText(portalClienteId));
};

export const resolvePortalSessionState = ({
  authLoading = false,
  authError = null,
  user = null,
  vinculoLoading = false,
  vinculoFetched = false,
  vinculoError = null,
  vinculoCliente = null,
  requestedClienteId = null,
  adminMode = false,
  elapsedMs = 0,
} = {}) => {
  if (authLoading) return { state: 'autenticando', cliente: null, title: 'Autenticando', message: 'Validando sua sessao.' };
  if (authError || !user) return { state: 'erro', cliente: null, title: 'Erro', message: 'Nao foi possivel autenticar no portal.' };
  if (elapsedMs >= PORTAL_TIMEOUT_MS && (vinculoLoading || authLoading)) {
    return { state: 'timeout', cliente: null, title: 'Timeout', message: 'O portal demorou demais para vincular o cliente.' };
  }
  if (vinculoLoading && !vinculoFetched) return { state: 'vinculando', cliente: null, title: 'Vinculando cliente', message: 'Localizando o cadastro vinculado ao seu usuario.' };
  if (vinculoError) return { state: 'erro', cliente: null, title: 'Erro', message: vinculoError.message || 'Falha ao carregar o cliente.' };
  if (!vinculoCliente) {
    return {
      state: adminMode ? 'sem_vinculo' : 'sem_vinculo',
      cliente: null,
      title: adminMode ? 'Sem vinculo para pre-visualizar' : 'Sem vinculo',
      message: adminMode
        ? 'Selecione um cliente em Cadastros para pre-visualizar, ou vincule um usuario ao cliente.'
        : 'Seu usuario nao esta vinculado a um cliente do portal.',
    };
  }
  try {
    assertPortalClienteScope({ user, cliente: vinculoCliente, requestedClienteId, adminMode });
  } catch (error) {
    return { state: 'sem_permissao', cliente: null, title: 'Sem permissao', message: error.message };
  }
  return { state: 'pronto', cliente: vinculoCliente, title: 'Pronto', message: '' };
};
