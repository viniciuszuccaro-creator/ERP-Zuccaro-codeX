/**
 * Política UI ClienteEmpresa HTTP (Onda 3) — list-for-scope na seleção Comercial.
 * Reutiliza API R05; sem migration; mutações continuam nested sob Cliente.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail-closed: listagem HTTP de ClienteEmpresa exige visualizar Cadastros.cliente_empresa
 * OU visualizar Comercial (orçamento/pedido).
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadClienteEmpresasHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'cliente_empresa', 'visualizar')
    || hasPermission('Cadastros', 'cliente-empresa', 'visualizar')
    || hasPermission('Comercial', 'orcamento', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Normaliza envelope list HTTP (`{ data, meta }` ou array) para vínculos operacionais.
 * Filtra inativos / não habilitados / bloqueados (elegibilidade comercial).
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeClienteEmpresasListPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray(payload.data) ? payload.data : []);
  return rows.filter((row) => (
    row
    && row.ativo !== false
    && row.habilitado_operacao !== false
    && row.bloqueado !== true
  ));
}

/**
 * Garante que o vínculo ecoa tenant quando o servidor enviar ids.
 * @param {object | null | undefined} row
 * @param {{ groupId?: string, empresaId?: string }} scope
 */
export function assertClienteEmpresaNoContexto(row, scope) {
  if (row == null) return null;
  if (typeof row !== 'object') {
    throw new Error('ClienteEmpresa inválido.');
  }
  if (!scope?.groupId || !scope?.empresaId) {
    throw new Error('Contexto de grupo/empresa obrigatório.');
  }
  if (row.group_id && row.group_id !== scope.groupId) {
    throw new Error('ClienteEmpresa fora do grupo ativo.');
  }
  if (row.empresa_id && row.empresa_id !== scope.empresaId) {
    throw new Error('ClienteEmpresa fora da empresa ativa.');
  }
  if (row.id && !UUID_RE.test(String(row.id))) {
    throw new Error('Identificador de ClienteEmpresa inválido.');
  }
  return row;
}

/**
 * Label estável do vínculo (fallback para código/cliente_id/id).
 * @param {object | null | undefined} link
 * @param {string} [clienteNome]
 * @param {string} [fallback]
 */
export function buildClienteEmpresaDisplayLabel(link, clienteNome = '', fallback = '') {
  if (clienteNome) return clienteNome;
  if (!link || typeof link !== 'object') return fallback || '';
  return link.codigo || link.legacy_code || link.cliente_id || link.id || fallback || '';
}
