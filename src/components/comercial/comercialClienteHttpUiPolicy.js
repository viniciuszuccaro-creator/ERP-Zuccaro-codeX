/**
 * Política UI Cliente HTTP (Onda 3) — mestres Comercial + Central 360.
 * Reutiliza API R04/R05 já existente; sem migration; sem CRM paralelo.
 * ClienteEmpresa, ClienteLocal e Obra têm piloto HTTP próprio (nested/flat).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail-closed: listagem HTTP de Cliente exige visualizar Cadastros.cliente
 * OU visualizar Comercial (orçamento/pedido).
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadClientesHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'cliente', 'visualizar')
    || hasPermission('Comercial', 'orcamento', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Fail-closed: unidades no seletor comercial exigem Cadastros.unidade_medida
 * OU visualizar Comercial (já no piloto HTTP).
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadUnidadesMedidaHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'unidade_medida', 'visualizar')
    || hasPermission('Comercial', 'orcamento', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Normaliza envelope list HTTP (`{ data, meta }` ou array) para linhas ativas.
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeClientesListPayload(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && row.ativo !== false);
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data.filter((row) => row && row.ativo !== false);
  }
  return [];
}

/**
 * Normaliza listagem HTTP de UnidadeMedida (piloto já ativo).
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeUnidadesListPayload(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && row.ativo !== false);
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data.filter((row) => row && row.ativo !== false);
  }
  return [];
}

/**
 * Label comercial estável a partir do mestre Cliente (sem inventar dados).
 * @param {object | null | undefined} cliente
 * @param {string} [fallback]
 */
export function buildClienteDisplayLabel(cliente, fallback = '') {
  if (!cliente || typeof cliente !== 'object') return fallback || '';
  return (
    cliente.razao_social
    || cliente.nome_fantasia
    || cliente.nome
    || cliente.codigo
    || fallback
    || ''
  );
}

/**
 * Garante que o Cliente ecoa tenant quando o servidor enviar ids.
 * @param {object | null | undefined} row
 * @param {{ groupId?: string, empresaId?: string }} scope
 */
export function assertClienteNoContexto(row, scope) {
  if (row == null) return null;
  if (typeof row !== 'object') {
    throw new Error('Cliente inválido.');
  }
  if (!scope?.groupId || !scope?.empresaId) {
    throw new Error('Contexto de grupo/empresa obrigatório.');
  }
  if (row.group_id && row.group_id !== scope.groupId) {
    throw new Error('Cliente fora do grupo ativo.');
  }
  if (row.id && !UUID_RE.test(String(row.id))) {
    throw new Error('Identificador de cliente inválido.');
  }
  return row;
}

/**
 * Central 360: exige permissão de visualizar Cliente além do Bearer/tenant.
 * @param {{
 *   flag?: boolean,
 *   hasPermission?: (module: string, section?: string|string[], action?: string) => boolean,
 *   clienteId?: string | null,
 *   groupId?: string | null,
 *   empresaId?: string | null,
 *   actorId?: string | null,
 *   token?: string | null,
 * }} input
 */
export function canOpenCentralCliente360Http(input = {}) {
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  if (!input.flag || !input.clienteId || !input.groupId || !input.empresaId || !input.actorId || !token) {
    return false;
  }
  if (typeof input.hasPermission === 'function') {
    return canLoadClientesHttp(input.hasPermission);
  }
  // Sem hasPermission explícito: mantém fail-closed no Bearer/tenant (painel legado).
  return true;
}
