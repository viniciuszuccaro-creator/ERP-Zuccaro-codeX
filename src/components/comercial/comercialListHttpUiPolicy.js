/**
 * Listagem HTTP Orçamento/Pedido: empty-state ≠ erro (403/5xx/rede).
 * Extraído das telas canônicas para política testável e fail-closed compartilhada.
 */

/** Sanitiza observações livres (XSS/controle) antes do payload HTTP. */
export function sanitizeObservacoesText(value, max = 1000) {
  const raw = String(value ?? '');
  let withoutControls = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    // C0 + DEL → espaço (evita no-control-regex no eslint)
    withoutControls += code <= 0x1f || code === 0x7f ? ' ' : raw[i];
  }
  const cleaned = withoutControls
    .replace(/[<>]/g, '')
    .replace(/javascript:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.slice(0, max);
}

/**
 * Mensagem de erro HTTP comercial — nunca sugere “lista vazia”.
 * @param {unknown} error
 * @param {{ entityLabel?: string, conflictMessage?: string }} [options]
 */
export function formatComercialHttpError(error, options = {}) {
  const entity = options.entityLabel || 'Registro';
  const status = Number(error?.status);
  if (status === 403) return 'Seu perfil não possui permissão para esta ação.';
  if (status === 404) return `${entity} não encontrado neste contexto.`;
  if (status === 409) {
    return options.conflictMessage || 'O estado atual não permite esta ação.';
  }
  if (status === 422 && error?.body?.error?.code === 'ORCAMENTO_VALIDADE_EXPIRADA') {
    return 'Validade expirada — altere a data antes de salvar ou converter.';
  }
  if (status === 422) return error?.body?.error?.message || 'Revise os dados informados.';
  if (status === 400) return 'Contexto ou identificador inválido.';
  if (Number.isFinite(status) && status >= 500) {
    return 'Falha temporária no servidor. Tente novamente.';
  }
  return 'Não foi possível comunicar com o servidor. Tente novamente.';
}

/**
 * Estado visual da listagem: erro nunca colapsa em empty.
 * @returns {'loading'|'error'|'empty'|'ready'}
 */
export function resolveHttpListViewState({ isLoading, isError, rowCount } = {}) {
  if (isLoading) return 'loading';
  if (isError) return 'error';
  const count = Number(rowCount);
  if (!Number.isFinite(count) || count < 1) return 'empty';
  return 'ready';
}

/**
 * queryKey de listagem HTTP deve incluir groupId + empresaId (multiempresa).
 * @param {unknown[]} queryKey
 * @param {{ groupId?: string, empresaId?: string, prefix?: string }} [scope]
 */
export function isHttpListQueryKeyScoped(queryKey, scope = {}) {
  if (!Array.isArray(queryKey) || queryKey.length < 3) return false;
  const prefix = scope.prefix;
  if (prefix && queryKey[0] !== prefix) return false;
  const groupId = scope.groupId != null ? scope.groupId : queryKey[1];
  const empresaId = scope.empresaId != null ? scope.empresaId : queryKey[2];
  if (scope.groupId != null && queryKey[1] !== scope.groupId) return false;
  if (scope.empresaId != null && queryKey[2] !== scope.empresaId) return false;
  return Boolean(groupId) && Boolean(empresaId);
}
