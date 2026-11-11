/**
 * RG + documentos[] na Central360 — classificação de estados (sem storage paralelo).
 * RG contratado no Completo; persistência HTTP ainda fail-closed até BFF.
 * documentos[] ≠ CPF/CNPJ MASTER ≠ ModeloDocumento.
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function hasMeaningfulScalar(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return Boolean(value);
}

/**
 * Classifica RG no GET Cliente.
 * @param {unknown} row
 * @param {{ forbidden?: boolean, loadError?: boolean }} [flags]
 */
export function classifyCentral360Rg(row, flags = {}) {
  if (flags.forbidden) {
    return { status: 'forbidden', value: null, message: 'RG não autorizado ao perfil' };
  }
  if (flags.loadError) {
    return { status: 'unavailable', value: null, message: 'Falha ao carregar RG' };
  }
  if (row == null || typeof row !== 'object' || Array.isArray(row)) {
    return { status: 'unavailable', value: null, message: 'RG indisponível' };
  }
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (row);
  if (!Object.prototype.hasOwnProperty.call(record, 'rg')) {
    return {
      status: 'absent',
      value: null,
      message: 'RG ausente nesta carga (omit ≠ limpar; pendente de importação ou BFF)',
    };
  }
  if (record.rg === null) {
    return {
      status: 'unknown',
      value: null,
      message: 'RG desconhecido (null — não comando de limpeza)',
    };
  }
  if (!hasMeaningfulScalar(record.rg)) {
    return {
      status: 'empty',
      value: '',
      message: 'RG vazio na origem',
    };
  }
  return {
    status: 'present_bff_pending',
    value: String(record.rg),
    message: 'RG recuperado — escrita HTTP aguarda contrato BFF',
  };
}

/**
 * Classifica anexos documentos[] no GET Cliente.
 * @param {unknown} row
 * @param {{ forbidden?: boolean, loadError?: boolean }} [flags]
 */
export function classifyCentral360Documentos(row, flags = {}) {
  if (flags.forbidden) {
    return { status: 'forbidden', items: [], message: 'Documentos não autorizados ao perfil' };
  }
  if (flags.loadError) {
    return { status: 'unavailable', items: [], message: 'Falha ao carregar documentos' };
  }
  if (row == null || typeof row !== 'object' || Array.isArray(row)) {
    return { status: 'unavailable', items: [], message: 'Documentos indisponíveis' };
  }
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (row);
  if (!Object.prototype.hasOwnProperty.call(record, 'documentos')) {
    return {
      status: 'absent',
      items: [],
      message: 'documentos[] ausentes nesta carga (omit ≠ limpar; BFF pendente)',
    };
  }
  if (record.documentos === null) {
    return {
      status: 'unknown',
      items: [],
      message: 'documentos[] desconhecidos (null — não limpeza)',
    };
  }
  if (!Array.isArray(record.documentos)) {
    return {
      status: 'invalid',
      items: [],
      message: 'Formato de documentos[] inválido',
    };
  }
  if (record.documentos.length === 0) {
    return {
      status: 'empty',
      items: [],
      message: 'Nenhum anexo documentos[] na origem',
    };
  }
  /** @type {Record<string, unknown>[]} */
  const items = [];
  /** @type {Record<string, unknown>[]} */
  const quarentena = [];
  for (const raw of record.documentos) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      quarentena.push({ _invalid: true });
      continue;
    }
    const doc = /** @type {Record<string, unknown>} */ (raw);
    const nome = String(doc.nome_arquivo || doc.nome || doc.filename || '').trim();
    if (!nome && !hasMeaningfulScalar(doc.url_arquivo || doc.url)) {
      quarentena.push(doc);
      continue;
    }
    items.push(doc);
  }
  return {
    status: items.length ? 'present_bff_pending' : 'invalid',
    items,
    quarentena,
    message: quarentena.length
      ? `${items.length} anexo(s) · ${quarentena.length} em quarentena — escrita BFF pendente`
      : `${items.length} anexo(s) recuperado(s) — escrita HTTP aguarda BFF`,
  };
}
