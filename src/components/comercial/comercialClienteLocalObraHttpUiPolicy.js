/**
 * Política UI ClienteLocal + Obra HTTP (Onda 3) — endereço/obra no Pedido.
 * Reutiliza rotas nested R06A/R06B sob `/api/v1/clientes/:id/locais|obras`.
 * Sem migration; sem list-for-scope flat (seleção exige cliente_id do vínculo).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail-closed: listagem HTTP de ClienteLocal exige Cadastros.cliente_local
 * OU visualizar Pedido Comercial.
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadClienteLocaisHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'cliente_local', 'visualizar')
    || hasPermission('Cadastros', 'cliente-local', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Fail-closed: listagem HTTP de Obra exige Cadastros.obra OU Pedido visualizar.
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadObrasHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'obra', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Extrai cliente_id do vínculo ClienteEmpresa já carregado.
 * @param {object | null | undefined} link
 * @returns {string}
 */
export function resolveClienteIdFromEmpresaLink(link) {
  if (!link || typeof link !== 'object') return '';
  const id = link.cliente_id || link.clienteId;
  return typeof id === 'string' && UUID_RE.test(id) ? id : '';
}

/**
 * Normaliza envelope list HTTP de locais ativos.
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeClienteLocaisListPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray(payload.data) ? payload.data : []);
  return rows.filter((row) => row && row.ativo !== false);
}

/**
 * Normaliza envelope list HTTP de obras ativas (operacionais no Pedido).
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeObrasListPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray(payload.data) ? payload.data : []);
  return rows.filter((row) => row && row.ativo !== false);
}

/**
 * Garante Local no mesmo grupo quando o servidor ecoa group_id/cliente_id.
 * @param {object | null | undefined} row
 * @param {{ groupId?: string, clienteId?: string }} scope
 */
export function assertClienteLocalNoContexto(row, scope) {
  if (row == null) return null;
  if (typeof row !== 'object') {
    throw new Error('ClienteLocal inválido.');
  }
  if (!scope?.groupId) {
    throw new Error('Contexto de grupo obrigatório.');
  }
  if (row.group_id && row.group_id !== scope.groupId) {
    throw new Error('ClienteLocal fora do grupo ativo.');
  }
  if (scope.clienteId && row.cliente_id && row.cliente_id !== scope.clienteId) {
    throw new Error('ClienteLocal fora do cliente selecionado.');
  }
  if (row.id && !UUID_RE.test(String(row.id))) {
    throw new Error('Identificador de ClienteLocal inválido.');
  }
  return row;
}

/**
 * Garante Obra no mesmo grupo/cliente quando o servidor ecoa ids.
 * @param {object | null | undefined} row
 * @param {{ groupId?: string, clienteId?: string }} scope
 */
export function assertObraNoContexto(row, scope) {
  if (row == null) return null;
  if (typeof row !== 'object') {
    throw new Error('Obra inválida.');
  }
  if (!scope?.groupId) {
    throw new Error('Contexto de grupo obrigatório.');
  }
  if (row.group_id && row.group_id !== scope.groupId) {
    throw new Error('Obra fora do grupo ativo.');
  }
  if (scope.clienteId && row.cliente_id && row.cliente_id !== scope.clienteId) {
    throw new Error('Obra fora do cliente selecionado.');
  }
  if (row.id && !UUID_RE.test(String(row.id))) {
    throw new Error('Identificador de Obra inválido.');
  }
  return row;
}

/**
 * @param {object | null | undefined} local
 * @param {string} [fallback]
 */
export function buildClienteLocalDisplayLabel(local, fallback = '') {
  if (!local || typeof local !== 'object') return fallback || '';
  return local.nome || local.apelido || local.cidade || local.id || fallback || '';
}

/**
 * @param {object | null | undefined} obra
 * @param {string} [fallback]
 */
export function buildObraDisplayLabel(obra, fallback = '') {
  if (!obra || typeof obra !== 'object') return fallback || '';
  if (obra.codigo && obra.nome) return `${obra.codigo} — ${obra.nome}`;
  return obra.nome || obra.codigo || obra.id || fallback || '';
}
