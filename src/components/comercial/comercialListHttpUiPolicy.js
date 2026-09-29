/**
 * Listagem HTTP Orçamento/Pedido: empty-state ≠ erro (403/5xx/rede).
 * Extraído das telas canônicas para política testável e fail-closed compartilhada.
 * Filtros/search: sanitize + queryKey tenant+filters; empty de busca ≠ banner de erro.
 */

export const ORCAMENTO_LIST_FILTER_DEFAULTS = Object.freeze({
  search: '',
  status: 'TODOS',
  clienteEmpresaId: 'TODOS',
  validadeDe: '',
  validadeAte: '',
});

export const PEDIDO_LIST_FILTER_DEFAULTS = Object.freeze({
  search: '',
  status: 'TODOS',
  clienteEmpresaId: 'TODOS',
  tipoOperacao: 'TODOS',
});

const LIST_SEARCH_MAX = 80;

/** Remove controles C0/DEL sem regex (eslint no-control-regex). */
function stripControlChars(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    out += code <= 0x1f || code === 0x7f ? ' ' : raw[i];
  }
  return out;
}

/** Limite canônico alinhado a Zod/migration (Pedido/Orçamento ≤ 1000). */
export const COMERCIAL_OBSERVACOES_MAX_LENGTH = 1000;

/** Sanitiza observações livres (XSS/controle) antes do payload HTTP. */
export function sanitizeObservacoesText(value, max = COMERCIAL_OBSERVACOES_MAX_LENGTH) {
  const limit = Number.isFinite(max) && max > 0 ? max : COMERCIAL_OBSERVACOES_MAX_LENGTH;
  const cleaned = stripControlChars(String(value ?? ''))
    .replace(/[<>]/g, '')
    .replace(/javascript:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.slice(0, limit);
}

/**
 * Gate UX fail-closed do campo Observações (contador + bloqueio se > max).
 * Alinha Textarea/maxLength ao contrato backend (trim().max(1000)).
 * @param {unknown} value
 * @param {number} [max]
 * @returns {{
 *   max: number,
 *   length: number,
 *   remaining: number,
 *   overLimit: boolean,
 *   blockSave: boolean,
 *   nearLimit: boolean,
 *   counterLabel: string,
 *   hint: string | null,
 * }}
 */
export function evaluateObservacoesUiGate(value, max = COMERCIAL_OBSERVACOES_MAX_LENGTH) {
  const limit = Number.isFinite(max) && max > 0 ? max : COMERCIAL_OBSERVACOES_MAX_LENGTH;
  const length = String(value ?? '').length;
  const overLimit = length > limit;
  const remaining = Math.max(0, limit - length);
  return {
    max: limit,
    length,
    remaining,
    overLimit,
    blockSave: overLimit,
    nearLimit: length >= Math.floor(limit * 0.9),
    counterLabel: `${length}/${limit}`,
    hint: overLimit
      ? `Observações excedem o limite de ${limit} caracteres. Reduza o texto antes de salvar.`
      : null,
  };
}

/** Clamp defensivo no onChange (além de maxLength HTML). */
export function clampObservacoesInput(value, max = COMERCIAL_OBSERVACOES_MAX_LENGTH) {
  const limit = Number.isFinite(max) && max > 0 ? max : COMERCIAL_OBSERVACOES_MAX_LENGTH;
  return String(value ?? '').slice(0, limit);
}

/**
 * Sanitiza texto de busca da listagem (número/termo) — nunca envia markup/controle.
 * Empty após sanitize é resultado de busca válido (≠ erro HTTP).
 * @param {unknown} value
 * @param {number} [max]
 */
export function sanitizeListSearchText(value, max = LIST_SEARCH_MAX) {
  const limit = Number.isFinite(max) && max > 0 ? max : LIST_SEARCH_MAX;
  const cleaned = stripControlChars(String(value ?? ''))
    .replace(/[<>]/g, '')
    .replace(/javascript:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.slice(0, limit);
}

/**
 * Normaliza filtros UI de Orçamento antes de aplicar/queryKey/API.
 * @param {Record<string, unknown>} [raw]
 */
export function normalizeOrcamentoListFilters(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    search: sanitizeListSearchText(src.search),
    status: src.status === 'EM_ABERTO' || src.status === 'CANCELADO' ? src.status : 'TODOS',
    clienteEmpresaId: src.clienteEmpresaId && src.clienteEmpresaId !== 'TODOS'
      ? String(src.clienteEmpresaId).trim().slice(0, 80)
      : 'TODOS',
    validadeDe: /^\d{4}-\d{2}-\d{2}$/.test(String(src.validadeDe || '')) ? String(src.validadeDe) : '',
    validadeAte: /^\d{4}-\d{2}-\d{2}$/.test(String(src.validadeAte || '')) ? String(src.validadeAte) : '',
  };
}

/**
 * Normaliza filtros UI de Pedido antes de aplicar/queryKey/API.
 * @param {Record<string, unknown>} [raw]
 */
export function normalizePedidoListFilters(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const status = String(src.status || 'TODOS');
  return {
    search: sanitizeListSearchText(src.search),
    status: status && status !== 'TODOS' ? status.slice(0, 40) : 'TODOS',
    clienteEmpresaId: src.clienteEmpresaId && src.clienteEmpresaId !== 'TODOS'
      ? String(src.clienteEmpresaId).trim().slice(0, 80)
      : 'TODOS',
    tipoOperacao: src.tipoOperacao === 'ENTREGA' || src.tipoOperacao === 'RETIRADA'
      ? src.tipoOperacao
      : 'TODOS',
  };
}

/**
 * True quando há filtro ativo além do default (busca vazia sem filtros ≠ erro).
 * @param {Record<string, unknown>} filters
 * @param {Record<string, unknown>} defaults
 */
export function hasActiveComercialListFilters(filters, defaults) {
  const current = filters && typeof filters === 'object' ? filters : {};
  const base = defaults && typeof defaults === 'object' ? defaults : {};
  return Object.keys(base).some((key) => String(current[key] ?? '') !== String(base[key] ?? ''));
}

/**
 * Params HTTP de listagem Orçamento a partir dos filtros normalizados.
 * @param {ReturnType<typeof normalizeOrcamentoListFilters>} filters
 * @param {{ page?: number, pageSize?: number, signal?: AbortSignal }} [paging]
 */
export function buildOrcamentoListRequestParams(filters, paging = {}) {
  const page = Math.max(1, Number(paging.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(paging.pageSize) || 20));
  const params = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
  if (filters.search) params.search = filters.search;
  if (filters.status && filters.status !== 'TODOS') params.status = filters.status;
  if (filters.clienteEmpresaId && filters.clienteEmpresaId !== 'TODOS') {
    params.clienteEmpresaId = filters.clienteEmpresaId;
  }
  if (filters.validadeDe) params.validadeDe = filters.validadeDe;
  if (filters.validadeAte) params.validadeAte = filters.validadeAte;
  if (paging.signal) params.signal = paging.signal;
  return params;
}

/**
 * Params HTTP de listagem Pedido a partir dos filtros normalizados.
 * @param {ReturnType<typeof normalizePedidoListFilters>} filters
 * @param {{ page?: number, pageSize?: number, signal?: AbortSignal }} [paging]
 */
export function buildPedidoListRequestParams(filters, paging = {}) {
  const page = Math.max(1, Number(paging.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(paging.pageSize) || 20));
  const params = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
  if (filters.search) params.search = filters.search;
  if (filters.status && filters.status !== 'TODOS') params.status = filters.status;
  if (filters.clienteEmpresaId && filters.clienteEmpresaId !== 'TODOS') {
    params.clienteEmpresaId = filters.clienteEmpresaId;
  }
  if (filters.tipoOperacao && filters.tipoOperacao !== 'TODOS') {
    params.tipoOperacao = filters.tipoOperacao;
  }
  if (paging.signal) params.signal = paging.signal;
  return params;
}

/**
 * queryKey canônica: prefix + groupId + empresaId + page + pageSize + filters.
 * @param {{ prefix: string, groupId?: string, empresaId?: string, page?: number, pageSize?: number, filters?: unknown }} input
 */
export function buildHttpListQueryKey(input = {}) {
  return [
    input.prefix,
    input.groupId,
    input.empresaId,
    input.page ?? 1,
    input.pageSize ?? 20,
    input.filters ?? null,
  ];
}

/**
 * Mensagem de empty-state — nunca usada em erro HTTP (403/5xx).
 * @param {{ entityLabel?: string, hasActiveFilters?: boolean }} [options]
 */
export function formatHttpListEmptyMessage(options = {}) {
  const entity = options.entityLabel || 'registro';
  if (options.hasActiveFilters) {
    return `Nenhum ${entity} encontrado para os filtros desta empresa.`;
  }
  return `Nenhum ${entity} encontrado nesta empresa.`;
}

/**
 * Mensagem de erro HTTP comercial — nunca sugere “lista vazia”.
 * @param {unknown} error
 * @param {{ entityLabel?: string, conflictMessage?: string }} [options]
 */
export function formatComercialHttpError(error, options = {}) {
  const entity = options.entityLabel || 'Registro';
  const status = Number(error?.status);
  const code = error?.body?.error?.code || error?.code;
  if (code === 'DESCONTO_ALCADA_DENIED' || (status === 403 && /desconto.*al[cç]ada/i.test(String(error?.body?.error?.message || '')))) {
    const serverMsg = String(error?.body?.error?.message || '').trim();
    if (/outro aprovador/i.test(serverMsg)) {
      return `${entity}: desconto acima da alçada exige outro aprovador.`;
    }
    return `${entity}: desconto acima da alçada livre exige permissão de aprovar.`;
  }
  if (code === 'MARGEM_ALCADA_DENIED' || (status === 403 && /margem.*m[ií]nima/i.test(String(error?.body?.error?.message || '')))) {
    return `${entity}: margem abaixo da mínima exige permissão de aprovar.`;
  }
  if (status === 403) return 'Seu perfil não possui permissão para esta ação.';
  if (status === 404) return `${entity} não encontrado neste contexto.`;
  if (status === 409) {
    return options.conflictMessage || 'O estado atual não permite esta ação.';
  }
  if (status === 422 && code === 'ORCAMENTO_VALIDADE_EXPIRADA') {
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
 * Rede/offline ou 5xx — Retry reinvoca o mesmo load/simular.
 * 4xx (403/404/409/422) não são retryáveis pela mesma ação.
 * @param {unknown} error
 */
export function isComercialRetryableHttpError(error) {
  if (error == null) return false;
  const status = Number(error?.status);
  if (Number.isFinite(status) && status >= 500) return true;
  // Sem status HTTP válido (Failed to fetch / offline / abort genérico) → rede
  if (!Number.isFinite(status) || status === 0) return true;
  return false;
}

/**
 * Banner de falha simular-venda (rede/5xx) — reusa formatComercialHttpError.
 * Fail-closed: nunca sugere preview/empty silencioso.
 * @param {unknown} error
 * @param {{ entityLabel?: string, conflictMessage?: string }} [options]
 */
export function buildSimularHttpErrorBannerText(error, options = {}) {
  const formatted = formatComercialHttpError(error, {
    entityLabel: options.entityLabel || 'Simulação',
    conflictMessage: options.conflictMessage,
  });
  return `${formatted} Simulação não aplicada — use Tentar novamente (não trate como preview vazio).`;
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
 * Quando `requireFilters` ou `filters` for informado, exige o slot de filtros
 * (índice 5 em buildHttpListQueryKey) — empty search ainda é filtro válido.
 * @param {unknown[]} queryKey
 * @param {{ groupId?: string, empresaId?: string, prefix?: string, requireFilters?: boolean, filters?: unknown }} [scope]
 */
export function isHttpListQueryKeyScoped(queryKey, scope = {}) {
  if (!Array.isArray(queryKey) || queryKey.length < 3) return false;
  const prefix = scope.prefix;
  if (prefix && queryKey[0] !== prefix) return false;
  const groupId = scope.groupId != null ? scope.groupId : queryKey[1];
  const empresaId = scope.empresaId != null ? scope.empresaId : queryKey[2];
  if (scope.groupId != null && queryKey[1] !== scope.groupId) return false;
  if (scope.empresaId != null && queryKey[2] !== scope.empresaId) return false;
  if (!groupId || !empresaId) return false;
  const needsFilters = scope.requireFilters === true || Object.prototype.hasOwnProperty.call(scope, 'filters');
  if (needsFilters) {
    if (queryKey.length < 6) return false;
    if (Object.prototype.hasOwnProperty.call(scope, 'filters')) {
      try {
        if (JSON.stringify(queryKey[5]) !== JSON.stringify(scope.filters)) return false;
      } catch {
        return false;
      }
    }
  }
  return true;
}

/**
 * Estado do picker de mestre HTTP (Cliente/Condição/Tabela/Produto).
 * 403/5xx → 'error' (nunca colapsa em empty silencioso).
 * Sem permissão de carregar → 'denied' (fail-closed explícito).
 * @returns {'denied'|'loading'|'error'|'empty'|'ready'}
 */
export function resolveHttpMasterPickerState({
  isLoading,
  isError,
  rowCount,
  allowed = true,
} = {}) {
  if (allowed === false) return 'denied';
  if (isLoading) return 'loading';
  if (isError) return 'error';
  const count = Number(rowCount);
  if (!Number.isFinite(count) || count < 1) return 'empty';
  return 'ready';
}

/**
 * Placeholder do Select mestre — nunca sugere “lista vazia” em erro/loading.
 * @param {'denied'|'loading'|'error'|'empty'|'ready'|string} state
 * @param {string} [entityLabel]
 */
export function formatMasterPickerPlaceholder(state, entityLabel = 'itens') {
  if (state === 'loading') return 'Carregando...';
  if (state === 'error') return 'Falha ao carregar';
  if (state === 'denied') return 'Sem permissão';
  if (state === 'empty') return `Nenhum ${entityLabel}`;
  return 'Selecione';
}

/**
 * Mestre elegível para nova seleção (ativo; opcionalmente habilitado / não bloqueado).
 * Fail-closed: sem id ou inativo → false.
 * @param {unknown} row
 * @param {{ requireHabilitadoOperacao?: boolean, rejectBloqueado?: boolean }} [options]
 */
export function isComercialMasterRowActive(row, options = {}) {
  if (!row || typeof row !== 'object' || !row.id) return false;
  if (row.ativo === false) return false;
  if (options.requireHabilitadoOperacao === true && row.habilitado_operacao === false) return false;
  if (options.rejectBloqueado === true && row.bloqueado === true) return false;
  return true;
}

/** True quando a opção do picker é a seleção atual preservada (soft-delete / inativo). */
export function isInactiveMasterSelectionKept(row) {
  return Boolean(row && (row.ativo === false || row._inactiveSelection === true));
}

/**
 * Ghost row para seleção atual ausente da listagem ativa (soft-delete).
 * Nunca inventa id — só materializa o selectedId informado.
 * @param {unknown} selectedId
 * @param {{ codigo?: unknown, nome?: unknown, descricao?: unknown, label?: unknown }} [snapshot]
 */
export function buildInactiveMasterSelectionPlaceholder(selectedId, snapshot = {}) {
  const id = String(selectedId || '').trim();
  if (!id) return null;
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const codigo = String(snap.codigo || '').trim();
  const nome = String(snap.nome || snap.descricao || snap.label || '').trim();
  const descricao = String(snap.descricao || snap.nome || snap.label || '').trim();
  return {
    id,
    ativo: false,
    _inactiveSelection: true,
    codigo: codigo || undefined,
    nome: nome || undefined,
    descricao: descricao || undefined,
  };
}

/**
 * Label do SelectItem — marca seleção inativa preservada.
 * @param {object | null | undefined} row
 * @param {{ labelFn?: (row: object) => string }} [options]
 */
export function formatMasterPickerOptionLabel(row, options = {}) {
  if (!row || typeof row !== 'object') return '';
  const labelFn = typeof options.labelFn === 'function' ? options.labelFn : null;
  let base = '';
  if (labelFn) {
    try { base = String(labelFn(row) || '').trim(); } catch { base = ''; }
  }
  if (!base) {
    base = String(row.nome || row.descricao || row.codigo || row.label || row.id || '').trim();
  }
  if (!base) base = String(row.id || 'Cadastro');
  return isInactiveMasterSelectionKept(row) ? `${base} (inativo)` : base;
}

/**
 * Hint curto quando a seleção atual é inativa (soft-delete) — fail-closed UX.
 * @param {unknown} rows
 * @param {string} [entityLabel]
 */
export function inactiveMasterSelectionHint(rows, entityLabel = 'cadastro') {
  const list = Array.isArray(rows) ? rows : [];
  const kept = list.find((row) => isInactiveMasterSelectionKept(row));
  if (!kept) return null;
  return `${entityLabel} atual está inativo — selecione um ativo para novas operações (seleção atual preservada).`;
}

/**
 * Filtra mestres ativos; mantém a seleção atual mesmo se inativa (ghost ou row da lista).
 * Não inclui outros inativos. Fail-closed: ids vazios ignorados; placeholders só para selectedIds.
 * @param {unknown} rows
 * @param {unknown} selectedIds - string | string[] | null/undefined
 * @param {{
 *   requireHabilitadoOperacao?: boolean,
 *   rejectBloqueado?: boolean,
 *   placeholderById?: Record<string, { codigo?: unknown, nome?: unknown, descricao?: unknown, label?: unknown }>,
 * }} [options]
 * @returns {object[]}
 */
export function filterActiveMasterRowsKeepingSelection(rows, selectedIds, options = {}) {
  const list = Array.isArray(rows) ? rows.filter((row) => row && row.id != null && String(row.id).trim()) : [];
  const selected = [...new Set(
    (Array.isArray(selectedIds) ? selectedIds : [selectedIds])
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  )];
  const activeOpts = {
    requireHabilitadoOperacao: options.requireHabilitadoOperacao === true,
    rejectBloqueado: options.rejectBloqueado === true,
  };
  const active = list.filter((row) => isComercialMasterRowActive(row, activeOpts));
  /** @type {Map<string, object>} */
  const byId = new Map(active.map((row) => [String(row.id), row]));
  const placeholders = options.placeholderById && typeof options.placeholderById === 'object'
    ? options.placeholderById
    : {};

  for (const id of selected) {
    if (byId.has(id)) continue;
    const fromList = list.find((row) => String(row.id) === id);
    if (fromList) {
      byId.set(id, { ...fromList, ativo: false, _inactiveSelection: true });
      continue;
    }
    const snap = placeholders[id];
    const ghost = buildInactiveMasterSelectionPlaceholder(id, snap || {});
    if (ghost) byId.set(id, ghost);
  }

  return Array.from(byId.values());
}

/**
 * Banner de masters HTTP: reutiliza formatComercialHttpError e deixa explícito
 * que 403/5xx ≠ empty-state dos pickers.
 * @param {unknown} error
 * @param {{ entityLabel?: string }} [options]
 */
export function buildMastersHttpBannerText(error, options = {}) {
  const formatted = formatComercialHttpError(error, options);
  return `${formatted} Cadastros mestres (cliente/condição/produto/tabela) não carregados — não trate como lista vazia.`;
}

/**
 * aria-live para banners/list errors comerciais.
 * Erro/destructive → assertive; loading/info/hint → polite.
 * @param {'error'|'destructive'|'assertive'|'info'|'loading'|'polite'|string} [tone]
 * @returns {'assertive'|'polite'}
 */
export function resolveComercialBannerAriaLive(tone = 'info') {
  const normalized = String(tone || 'info').toLowerCase();
  if (normalized === 'error' || normalized === 'destructive' || normalized === 'assertive') {
    return 'assertive';
  }
  return 'polite';
}

/**
 * Props a11y para banners (Alert/list error). Sobrescreve role padrão do Alert
 * quando o tom é polite (status) vs error (alert+assertive).
 * @param {'error'|'destructive'|'assertive'|'info'|'loading'|'polite'|string} [tone]
 * @returns {{ role: 'alert'|'status', 'aria-live': 'assertive'|'polite', 'aria-atomic': true }}
 */
export function buildComercialBannerA11yProps(tone = 'info') {
  const live = resolveComercialBannerAriaLive(tone);
  return {
    role: live === 'assertive' ? 'alert' : 'status',
    'aria-live': live,
    'aria-atomic': true,
  };
}

/**
 * Id estável do hint de linha de item (aria-describedby).
 * @param {number} index
 * @param {string} [idPrefix]
 */
export function buildItemLineHintId(index, idPrefix = 'comercial-item') {
  const safeIndex = Number.isFinite(Number(index)) ? Math.max(0, Math.trunc(Number(index))) : 0;
  const prefix = String(idPrefix || 'comercial-item').trim() || 'comercial-item';
  return `${prefix}-${safeIndex}-hint`;
}

/**
 * aria-invalid + aria-describedby para campo de linha inválida (fail-closed UX).
 * @param {{
 *   index?: number,
 *   field?: string,
 *   issues?: Array<{ index?: number, field?: string, message?: string }>,
 *   lineHint?: string | null,
 *   idPrefix?: string,
 * }} [input]
 * @returns {{ 'aria-invalid': boolean, 'aria-describedby'?: string, describedById: string }}
 */
export function buildItemLineFieldA11y(input = {}) {
  const index = Number.isFinite(Number(input.index)) ? Math.max(0, Math.trunc(Number(input.index))) : 0;
  const field = String(input.field || '').trim();
  const issues = Array.isArray(input.issues) ? input.issues : [];
  const lineHint = String(input.lineHint || '').trim();
  const describedById = buildItemLineHintId(index, input.idPrefix);
  const fieldHit = issues.some((issue) => (
    issue
    && Number(issue.index) === index
    && String(issue.field || '').trim() === field
  ));
  let hintHit = false;
  if (lineHint && field) {
    if (field === 'quantidade') hintHit = /quantidade/i.test(lineHint);
    else if (field === 'preco_unitario') hintHit = /preço|preco/i.test(lineHint);
    else if (field === 'desconto') hintHit = /desconto/i.test(lineHint);
    else if (field === 'descricao') hintHit = /descri/i.test(lineHint);
    else if (field === 'produto_id') hintHit = /produto/i.test(lineHint);
    else if (field === 'unidade_id' || field === 'unidade_sigla') hintHit = /unidade|sigla/i.test(lineHint);
  }
  const invalid = Boolean(fieldHit || hintHit);
  /** @type {{ 'aria-invalid': boolean, 'aria-describedby'?: string, describedById: string }} */
  const props = {
    'aria-invalid': invalid,
    describedById,
  };
  if (invalid) props['aria-describedby'] = describedById;
  return props;
}

/**
 * Nome acessível estável para ações canônicas Orçamento/Pedido
 * (Simular / Salvar / Cancelar / Resumo / Converter / Retry).
 * @param {string} action
 * @param {{ entityLabel?: string, entity?: string, numero?: unknown, busy?: boolean, fallback?: string }} [options]
 */
export function comercialActionAriaLabel(action, options = {}) {
  const entity = String(options.entityLabel || options.entity || 'documento').trim() || 'documento';
  const numeroRaw = options.numero != null ? String(options.numero).trim() : '';
  const numero = numeroRaw ? ` ${numeroRaw}` : '';
  const busy = options.busy === true;
  switch (String(action || '').toLowerCase()) {
    case 'simular':
      return busy ? 'Simulando venda' : 'Simular venda';
    case 'salvar':
      return busy ? `Salvando ${entity}` : `Salvar ${entity}`;
    case 'cancelar':
      return `Cancelar ${entity}${numero}`;
    case 'resumo':
      return `Abrir resumo texto do ${entity}${numero}`;
    case 'imprimir':
    case 'print':
    case 'pdf':
      return `Imprimir PDF do ${entity}${numero}`;
    case 'converter':
    case 'convert':
      return busy ? 'Convertendo orçamento em pedido' : 'Converter orçamento em pedido';
    case 'fechar':
      return 'Fechar';
    case 'retry':
    case 'tentar-novamente':
      return 'Tentar novamente';
    default:
      return String(options.fallback || action || 'Ação comercial').trim() || 'Ação comercial';
  }
}

/**
 * Pickers mestres devem bloquear interação enquanto loading/erro.
 * @param {{ isLoading?: boolean, isError?: boolean }} [query]
 */
export function isMasterPickerBlocked(query = {}) {
  return Boolean(query.isLoading) || Boolean(query.isError);
}

/** Prefixos React Query do Comercial HTTP canônico (lista/mestres/delivery). */
export const COMERCIAL_HTTP_CACHE_PREFIXES = Object.freeze([
  'orcamentos-http',
  'pedidos-http',
  'orcamento-masters',
  'pedido-masters',
  'pedido-delivery',
  'pedido-delivery-local',
  'pedido-delivery-obra',
  'pedido-delivery-obra-local',
]);

/**
 * True quando groupId/empresaId mudou — troca de tenant exige reset fail-closed.
 * @param {{ groupId?: unknown, empresaId?: unknown }} previous
 * @param {{ groupId?: unknown, empresaId?: unknown }} next
 */
export function didComercialTenantScopeChange(previous = {}, next = {}) {
  return String(previous.groupId || '') !== String(next.groupId || '')
    || String(previous.empresaId || '') !== String(next.empresaId || '');
}

/**
 * queryKey comercial HTTP de outro tenant (ou sem escopo) — candidata a remoção.
 * Mantém apenas chaves do tenant atual; sem groupId+empresaId atuais remove todas as prefixadas.
 * @param {unknown} queryKey
 * @param {{ groupId?: string, empresaId?: string }} currentScope
 */
export function isStaleComercialHttpCacheQueryKey(queryKey, currentScope = {}) {
  if (!Array.isArray(queryKey) || queryKey.length < 1) return false;
  const prefix = queryKey[0];
  if (!COMERCIAL_HTTP_CACHE_PREFIXES.includes(prefix)) return false;
  const groupId = String(currentScope.groupId || '');
  const empresaId = String(currentScope.empresaId || '');
  if (!groupId || !empresaId) return true;
  return String(queryKey[1] || '') !== groupId || String(queryKey[2] || '') !== empresaId;
}

/**
 * Remove cache comercial HTTP de outro tenant e invalida o escopo atual (fail-closed).
 * @param {{ removeQueries?: Function, invalidateQueries?: Function }} queryClient
 * @param {{ groupId?: string, empresaId?: string }} currentScope
 */
export function clearComercialHttpCacheOnTenantSwitch(queryClient, currentScope = {}) {
  if (!queryClient || typeof queryClient.removeQueries !== 'function') {
    throw new Error('queryClient obrigatório para limpar cache comercial na troca de tenant.');
  }
  queryClient.removeQueries({
    predicate: (query) => isStaleComercialHttpCacheQueryKey(query?.queryKey, currentScope),
  });
  const groupId = String(currentScope.groupId || '');
  const empresaId = String(currentScope.empresaId || '');
  if (!groupId || !empresaId || typeof queryClient.invalidateQueries !== 'function') {
    return { removedStale: true, invalidatedCurrent: false };
  }
  for (const prefix of COMERCIAL_HTTP_CACHE_PREFIXES) {
    queryClient.invalidateQueries({ queryKey: [prefix, groupId, empresaId] });
  }
  return { removedStale: true, invalidatedCurrent: true };
}

/**
 * Patch de UI Orçamento após troca de tenant — descarta rascunho/diálogos sem prompt.
 * @param {{ emptyForm?: () => Record<string, unknown> }} [options]
 */
export function buildOrcamentoTenantSwitchReset(options = {}) {
  const emptyForm = typeof options.emptyForm === 'function' ? options.emptyForm : () => ({});
  return {
    page: 1,
    selected: null,
    selectedIds: [],
    formOpen: false,
    detailOpen: false,
    editing: null,
    form: emptyForm(),
    dirty: false,
    pendingCancel: null,
    pendingConversion: null,
    filters: { ...ORCAMENTO_LIST_FILTER_DEFAULTS },
    appliedFilters: { ...ORCAMENTO_LIST_FILTER_DEFAULTS },
    promoBps: '',
    promoCupom: '',
    simulacaoPreview: null,
    lastSimulation: null,
    simulacaoDirty: false,
    simularHttpError: null,
    condicaoSnapshot: null,
    tabelaSnapshot: null,
    promocaoSnapshot: null,
  };
}

/**
 * Patch de UI Pedido após troca de tenant — descarta rascunho/diálogos sem prompt.
 * @param {{ emptyForm?: () => Record<string, unknown> }} [options]
 */
export function buildPedidoTenantSwitchReset(options = {}) {
  const emptyForm = typeof options.emptyForm === 'function' ? options.emptyForm : () => ({});
  return {
    page: 1,
    selected: null,
    selectedIds: [],
    formOpen: false,
    detailOpen: false,
    editing: null,
    form: emptyForm(),
    dirty: false,
    history: [],
    pendingCancel: null,
    filters: { ...PEDIDO_LIST_FILTER_DEFAULTS },
    applied: { ...PEDIDO_LIST_FILTER_DEFAULTS },
    promoBps: '',
    promoCupom: '',
    simulacaoPreview: null,
    lastSimulation: null,
    simulacaoDirty: false,
    simularHttpError: null,
    condicaoSnapshot: null,
    tabelaSnapshot: null,
    promocaoSnapshot: null,
  };
}

/** Motivo canônico: bulk UI visível mas nunca executa (sem endpoint). */
export const COMERCIAL_LIST_BULK_STUB_REASON = 'em breve / sem endpoint';

/** Export CSV da página atual (dados já carregados no tenant) — não substitui export server-side. */
export const COMERCIAL_LIST_PAGE_EXPORT_SCOPE = 'pagina-atual';

/**
 * Escapa célula CSV (RFC-ish): aspas duplas e quebras.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeComercialCsvCell(value) {
  const text = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Monta CSV (header + linhas) a partir de colunas `{ key, header, format? }`.
 * @param {unknown[]} rows
 * @param {Array<{ key: string, header: string, format?: (row: object) => string }>} columns
 * @returns {string}
 */
export function buildComercialListCsv(rows, columns) {
  const cols = Array.isArray(columns) ? columns.filter((c) => c && c.key && c.header) : [];
  const list = Array.isArray(rows) ? rows : [];
  if (cols.length === 0) return '';
  const header = cols.map((c) => escapeComercialCsvCell(c.header)).join(',');
  const lines = list.map((row) => {
    const safe = row && typeof row === 'object' ? row : {};
    return cols.map((c) => {
      const raw = typeof c.format === 'function' ? c.format(safe) : safe[c.key];
      return escapeComercialCsvCell(raw);
    }).join(',');
  });
  return [header, ...lines].join('\n');
}

/**
 * Gate UX do botão Exportar CSV (página atual).
 * Fail-closed: sem visualizar, lista vazia/erro/loading → bloqueia.
 * @param {{
 *   listView?: string,
 *   rowCount?: number,
 *   canView?: boolean,
 * }} [input]
 */
export function resolveComercialListPageExportUi(input = {}) {
  const listView = String(input.listView || '');
  const rowCount = Number(input.rowCount) || 0;
  const canView = input.canView !== false;
  if (!canView) {
    return {
      canExport: false,
      blockExport: true,
      scope: COMERCIAL_LIST_PAGE_EXPORT_SCOPE,
      title: 'Sem permissão para exportar a listagem.',
      hint: 'Sem permissão para exportar a listagem.',
    };
  }
  if (listView === 'error') {
    return {
      canExport: false,
      blockExport: true,
      scope: COMERCIAL_LIST_PAGE_EXPORT_SCOPE,
      title: 'Corrija o erro da listagem antes de exportar.',
      hint: 'Corrija o erro da listagem antes de exportar.',
    };
  }
  if (listView === 'loading' || listView === '') {
    return {
      canExport: false,
      blockExport: true,
      scope: COMERCIAL_LIST_PAGE_EXPORT_SCOPE,
      title: 'Aguarde o carregamento da listagem.',
      hint: 'Aguarde o carregamento da listagem.',
    };
  }
  if (listView === 'empty' || rowCount <= 0) {
    return {
      canExport: false,
      blockExport: true,
      scope: COMERCIAL_LIST_PAGE_EXPORT_SCOPE,
      title: 'Nenhum registro na página para exportar.',
      hint: 'Nenhum registro na página para exportar.',
    };
  }
  return {
    canExport: true,
    blockExport: false,
    scope: COMERCIAL_LIST_PAGE_EXPORT_SCOPE,
    title: 'Exportar CSV da página atual (não é exportação completa do filtro).',
    hint: null,
  };
}

/**
 * Dispara download de texto CSV no browser (testável via deps).
 * @param {string} filename
 * @param {string} csvText
 * @param {{
 *   createObjectURL?: (blob: Blob) => string,
 *   revokeObjectURL?: (url: string) => void,
 *   document?: Document,
 * }} [deps]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function downloadComercialCsvText(filename, csvText, deps = {}) {
  const name = String(filename || '').trim() || 'comercial-lista.csv';
  const body = String(csvText ?? '');
  if (!body) return { ok: false, reason: 'CSV vazio.' };
  const doc = deps.document
    || (typeof globalThis !== 'undefined' && globalThis.document ? globalThis.document : null);
  const createObjectURL = deps.createObjectURL
    || (typeof globalThis !== 'undefined' && globalThis.URL && typeof globalThis.URL.createObjectURL === 'function'
      ? globalThis.URL.createObjectURL.bind(globalThis.URL)
      : null);
  const revokeObjectURL = deps.revokeObjectURL
    || (typeof globalThis !== 'undefined' && globalThis.URL && typeof globalThis.URL.revokeObjectURL === 'function'
      ? globalThis.URL.revokeObjectURL.bind(globalThis.URL)
      : null);
  if (!doc || typeof doc.createElement !== 'function' || typeof createObjectURL !== 'function') {
    return { ok: false, reason: 'Download indisponível neste ambiente.' };
  }
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
  const url = createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  if (typeof doc.body?.appendChild === 'function') doc.body.appendChild(anchor);
  if (typeof anchor.click === 'function') anchor.click();
  if (typeof anchor.remove === 'function') anchor.remove();
  else if (typeof doc.body?.removeChild === 'function' && anchor.parentNode === doc.body) {
    doc.body.removeChild(anchor);
  }
  if (typeof revokeObjectURL === 'function') revokeObjectURL(url);
  return { ok: true };
}

/** Colunas CSV Orçamento (página) — espelham a tabela, sem observações. */
export const ORCAMENTO_LIST_CSV_COLUMNS = Object.freeze([
  { key: 'numero', header: 'Numero' },
  { key: 'cliente_label', header: 'Cliente' },
  { key: 'created_at', header: 'Criado' },
  { key: 'validade_em', header: 'Validade' },
  { key: 'itens_count', header: 'Itens' },
  { key: 'subtotal', header: 'Subtotal' },
  { key: 'desconto', header: 'Desconto' },
  { key: 'total', header: 'Total' },
  { key: 'status', header: 'Status' },
]);

/** Colunas CSV Pedido (página) — espelham a tabela, sem observações. */
export const PEDIDO_LIST_CSV_COLUMNS = Object.freeze([
  { key: 'numero', header: 'Numero' },
  { key: 'cliente_label', header: 'Cliente' },
  { key: 'tipo_operacao', header: 'Operacao' },
  { key: 'data_entrega_solicitada', header: 'Entrega_solicitada' },
  { key: 'status', header: 'Status' },
  { key: 'total', header: 'Total' },
]);

/**
 * Mapeia linhas Orçamento → shape CSV (labels já resolvidos pelo caller).
 * @param {unknown[]} rows
 * @param {(clienteEmpresaId: string) => string} clienteLabelFn
 */
export function mapOrcamentoRowsForCsv(rows, clienteLabelFn) {
  const labelFn = typeof clienteLabelFn === 'function' ? clienteLabelFn : () => '';
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const r = row && typeof row === 'object' ? row : {};
    return {
      numero: r.numero ?? '',
      cliente_label: labelFn(r.cliente_empresa_id),
      created_at: r.created_at ?? '',
      validade_em: r.validade_em ?? '',
      itens_count: Array.isArray(r.itens) ? r.itens.length : 0,
      subtotal: r.subtotal ?? '',
      desconto: r.desconto ?? '',
      total: r.total ?? '',
      status: r.status ?? '',
    };
  });
}

/**
 * Mapeia linhas Pedido → shape CSV.
 * @param {unknown[]} rows
 * @param {(clienteEmpresaId: string) => string} clienteLabelFn
 */
export function mapPedidoRowsForCsv(rows, clienteLabelFn) {
  const labelFn = typeof clienteLabelFn === 'function' ? clienteLabelFn : () => '';
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const r = row && typeof row === 'object' ? row : {};
    return {
      numero: r.numero ?? '',
      cliente_label: labelFn(r.cliente_empresa_id),
      tipo_operacao: r.tipo_operacao ?? '',
      data_entrega_solicitada: r.data_entrega_solicitada ?? '',
      status: r.status ?? '',
      total: r.total ?? '',
    };
  });
}

/**
 * Normaliza ids selecionados da listagem (dedupe, trim, sem vazios).
 * @param {unknown} selectedIds
 * @returns {string[]}
 */
export function normalizeComercialListSelectedIds(selectedIds) {
  if (!Array.isArray(selectedIds)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of selectedIds) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @param {unknown} selectedIds
 * @param {unknown} rowId
 */
export function isComercialListRowSelected(selectedIds, rowId) {
  const id = String(rowId ?? '').trim();
  if (!id) return false;
  return normalizeComercialListSelectedIds(selectedIds).includes(id);
}

/**
 * Alterna seleção de uma linha (UI only — sem mutação HTTP).
 * @param {unknown} selectedIds
 * @param {unknown} rowId
 * @returns {string[]}
 */
export function toggleComercialListRowSelection(selectedIds, rowId) {
  const id = String(rowId ?? '').trim();
  const current = normalizeComercialListSelectedIds(selectedIds);
  if (!id) return current;
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

/**
 * Extrai ids de linhas da página atual.
 * @param {unknown} pageRows
 * @returns {string[]}
 */
export function comercialListPageRowIds(pageRows) {
  if (!Array.isArray(pageRows)) return [];
  return pageRows
    .map((row) => String(row?.id ?? row ?? '').trim())
    .filter(Boolean);
}

/**
 * Seleciona/desmarca todos os ids da página atual (mantém ids de outras páginas).
 * @param {unknown} selectedIds
 * @param {unknown} pageRows
 * @returns {string[]}
 */
export function toggleComercialListPageSelection(selectedIds, pageRows) {
  const pageIds = comercialListPageRowIds(pageRows);
  const current = normalizeComercialListSelectedIds(selectedIds);
  if (pageIds.length === 0) return current;
  const allSelected = pageIds.every((id) => current.includes(id));
  if (allSelected) {
    const drop = new Set(pageIds);
    return current.filter((id) => !drop.has(id));
  }
  const seen = new Set(current);
  const next = [...current];
  for (const id of pageIds) {
    if (!seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }
  return next;
}

/**
 * Bulk actions sempre desabilitadas — stub fail-closed (sem inventar API).
 * @param {unknown} [_action]
 * @returns {false}
 */
export function isComercialListBulkActionEnabled(_action) {
  void _action;
  return false;
}

/**
 * Tooltip/title das ações em lote (motivo + rótulo).
 * @param {'cancelar' | 'exportar' | string} [action]
 */
export function comercialListBulkActionTitle(action = 'cancelar') {
  const label = action === 'exportar'
    ? 'Exportar selecionados'
    : (action === 'cancelar' ? 'Cancelar selecionados' : 'Ação em lote');
  return `${label}: ${COMERCIAL_LIST_BULK_STUB_REASON}`;
}

/**
 * Estado UI da multi-seleção + barra de bulk (sempre disabled).
 * @param {{ selectedIds?: unknown, pageRows?: unknown }} [input]
 */
export function resolveComercialListBulkUiState(input = {}) {
  const selectedIds = normalizeComercialListSelectedIds(input.selectedIds);
  const pageIds = comercialListPageRowIds(input.pageRows);
  const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id));
  const allPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const somePageSelected = selectedOnPage.length > 0 && !allPageSelected;
  return {
    selectedIds,
    selectedCount: selectedIds.length,
    pageIds,
    allPageSelected,
    somePageSelected,
    headerChecked: allPageSelected,
    headerIndeterminate: somePageSelected,
    bulkEnabled: isComercialListBulkActionEnabled(),
    bulkReason: COMERCIAL_LIST_BULK_STUB_REASON,
    cancelTitle: comercialListBulkActionTitle('cancelar'),
    exportTitle: comercialListBulkActionTitle('exportar'),
  };
}

/**
 * Dirty form abandon — fail-closed: form dirty OU simulação dirty exigem confirmação.
 * Troca de tenant continua sem prompt (build*TenantSwitchReset).
 * @param {{ dirty?: boolean, simulacaoDirty?: boolean }} [flags]
 */
export function isComercialFormDirtyForAbandon(flags = {}) {
  return Boolean(flags.dirty) || Boolean(flags.simulacaoDirty);
}

/**
 * @param {'orcamento' | 'pedido'} [entity]
 */
export function comercialFormAbandonMessage(entity = 'orcamento') {
  const label = entity === 'pedido' ? 'pedido' : 'orçamento';
  return `Descartar as alterações deste ${label}?`;
}

/**
 * Confirma abandono. Sem confirm disponível → bloqueia (fail-closed).
 * @param {{
 *   dirty?: boolean,
 *   simulacaoDirty?: boolean,
 *   entity?: 'orcamento' | 'pedido',
 *   confirmFn?: (message: string) => boolean,
 * }} [input]
 * @returns {boolean} true se pode descartar
 */
export function confirmComercialFormAbandon(input = {}) {
  if (!isComercialFormDirtyForAbandon(input)) return true;
  const message = comercialFormAbandonMessage(input.entity);
  const confirmFn = typeof input.confirmFn === 'function'
    ? input.confirmFn
    : (typeof globalThis !== 'undefined' && typeof globalThis.confirm === 'function'
      ? globalThis.confirm.bind(globalThis)
      : null);
  if (typeof confirmFn !== 'function') return false;
  return confirmFn(message) === true;
}

/**
 * Controlled Dialog onOpenChange — recusar confirm mantém formOpen.
 * @param {{
 *   nextOpen: boolean,
 *   dirty?: boolean,
 *   simulacaoDirty?: boolean,
 *   entity?: 'orcamento' | 'pedido',
 *   confirmFn?: (message: string) => boolean,
 * }} input
 * @returns {{ formOpen: boolean, abandoned: boolean }}
 */
export function resolveComercialFormDialogOpenChange(input = {}) {
  if (input.nextOpen) return { formOpen: true, abandoned: false };
  if (!confirmComercialFormAbandon(input)) {
    return { formOpen: true, abandoned: false };
  }
  return { formOpen: false, abandoned: true };
}

/**
 * Handler beforeunload — só dispara quando há alterações não salvas.
 * @param {boolean | (() => boolean)} isDirty
 * @returns {(event: BeforeUnloadEvent) => void}
 */
export function createComercialFormBeforeUnloadHandler(isDirty) {
  return (event) => {
    const dirty = typeof isDirty === 'function' ? Boolean(isDirty()) : Boolean(isDirty);
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  };
}

/**
 * Liga beforeunload; retorna cleanup.
 * @param {Window | null | undefined} targetWindow
 * @param {boolean | (() => boolean)} isDirty
 * @returns {() => void}
 */
export function bindComercialFormBeforeUnload(targetWindow, isDirty) {
  const win = targetWindow
    || (typeof globalThis !== 'undefined' && globalThis.window ? globalThis.window : null);
  if (!win || typeof win.addEventListener !== 'function') return () => {};
  const handler = createComercialFormBeforeUnloadHandler(isDirty);
  win.addEventListener('beforeunload', handler);
  return () => {
    if (typeof win.removeEventListener === 'function') {
      win.removeEventListener('beforeunload', handler);
    }
  };
}
