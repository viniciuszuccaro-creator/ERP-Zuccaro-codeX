/**
 * Entregas do cliente na Central360 — API canônica `/api/v1/entregas?clienteId=`.
 * Sem inventar sucesso; estados explícitos; ctx pós-await no painel.
 */

/**
 * @param {unknown} page — resposta listEntregas (unwrap:false) ou array
 * @param {{ forbidden?: boolean, loadError?: boolean }} [flags]
 */
export function classifyCentral360Entregas(page, flags = {}) {
  if (flags.forbidden) {
    return {
      status: 'forbidden',
      rows: [],
      total: null,
      message: 'Entregas não autorizadas ao perfil',
    };
  }
  if (flags.loadError) {
    return {
      status: 'unavailable',
      rows: [],
      total: null,
      message: 'Falha ao carregar entregas do cliente',
    };
  }
  if (page == null) {
    return {
      status: 'unavailable',
      rows: [],
      total: null,
      message: 'Entregas indisponíveis nesta carga',
    };
  }

  let rows = [];
  let total = null;
  if (Array.isArray(page)) {
    rows = page;
    total = page.length;
  } else if (typeof page === 'object') {
    /** @type {Record<string, unknown>} */
    const body = /** @type {Record<string, unknown>} */ (page);
    if (Array.isArray(body.data)) rows = body.data;
    else if (Array.isArray(body.items)) rows = body.items;
    const meta = body.meta && typeof body.meta === 'object'
      ? /** @type {Record<string, unknown>} */ (body.meta)
      : null;
    if (meta && Number.isFinite(Number(meta.total))) total = Number(meta.total);
    else if (Number.isFinite(Number(body.total))) total = Number(body.total);
  } else {
    return {
      status: 'invalid',
      rows: [],
      total: null,
      message: 'Formato de entregas inválido',
    };
  }

  if (rows.length === 0) {
    return {
      status: 'empty',
      rows: [],
      total: total == null ? 0 : total,
      message: total === 0 || total == null
        ? 'Nenhuma entrega vinculada a este cliente neste contexto'
        : `Nenhuma entrega nesta página (total ${total})`,
    };
  }

  return {
    status: 'ok',
    rows,
    total: total == null ? rows.length : total,
    message: total != null && total > rows.length
      ? `${rows.length} de ${total} entrega(s)`
      : `${rows.length} entrega(s)`,
  };
}

/**
 * Permissão de leitura de entregas (aliases Expedicao/Expedição).
 * @param {(module: string, resource: string|null, action: string) => boolean} hasPermission
 */
export function canViewCentral360Entregas(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Expedicao', 'Entregas', 'visualizar')
    || hasPermission('Expedicao', 'Entrega', 'visualizar')
    || hasPermission('Expedicao', 'Entregas', 'ver')
    || hasPermission('Expedicao', 'Entrega', 'ver')
    || hasPermission('Expedição', 'Entregas', 'visualizar')
    || hasPermission('Expedição', 'Entrega', 'visualizar')
    || hasPermission('Expedicao', null, 'visualizar')
    || hasPermission('Expedição', null, 'visualizar')
  );
}
