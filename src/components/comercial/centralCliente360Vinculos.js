/**
 * Vínculos comerciais no Cliente MASTER (vendedor / indicador / região).
 * Campos contratados na UI Completo; escrita HTTP ainda fail-closed (ALLOWED_KEYS).
 * Não inventa vínculo; omit ≠ limpar.
 */

const VINCULO_FIELDS = [
  { key: 'vendedor_responsavel_id', label: 'Vendedor', textKey: 'vendedor_responsavel' },
  { key: 'indicador_id', label: 'Indicador', textKey: 'indicador_nome' },
  { key: 'regiao_atendimento_id', label: 'Região', textKey: 'regiao_atendimento' },
];

/**
 * @param {unknown} value
 */
function meaningful(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * @param {unknown} row
 * @param {{ forbidden?: boolean, loadError?: boolean }} [flags]
 */
export function classifyCentral360Vinculos(row, flags = {}) {
  if (flags.forbidden) {
    return {
      status: 'forbidden',
      fields: [],
      message: 'Vínculos comerciais não autorizados ao perfil',
    };
  }
  if (flags.loadError) {
    return {
      status: 'unavailable',
      fields: [],
      message: 'Falha ao carregar vínculos comerciais',
    };
  }
  if (row == null || typeof row !== 'object' || Array.isArray(row)) {
    return {
      status: 'unavailable',
      fields: [],
      message: 'Vínculos indisponíveis',
    };
  }
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (row);
  /** @type {{ key: string, label: string, status: string, value: string|null, text: string|null }[]} */
  const fields = [];
  let anyPresent = false;
  let anyAbsent = false;
  for (const def of VINCULO_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, def.key)
      && !Object.prototype.hasOwnProperty.call(record, def.textKey)) {
      fields.push({
        key: def.key,
        label: def.label,
        status: 'absent',
        value: null,
        text: null,
      });
      anyAbsent = true;
      continue;
    }
    const idVal = record[def.key];
    const textVal = record[def.textKey];
    if (idVal === null && (textVal === null || textVal === undefined)) {
      fields.push({
        key: def.key,
        label: def.label,
        status: 'unknown',
        value: null,
        text: null,
      });
      continue;
    }
    if (!meaningful(idVal) && !meaningful(textVal)) {
      fields.push({
        key: def.key,
        label: def.label,
        status: 'empty',
        value: '',
        text: '',
      });
      continue;
    }
    anyPresent = true;
    fields.push({
      key: def.key,
      label: def.label,
      status: 'present_bff_pending',
      value: meaningful(idVal) ? String(idVal) : null,
      text: meaningful(textVal) ? String(textVal) : null,
    });
  }
  const status = anyPresent
    ? 'present_bff_pending'
    : (anyAbsent ? 'absent' : 'empty');
  return {
    status,
    fields,
    message: anyPresent
      ? 'Vínculos recuperados — escrita HTTP aguarda contrato BFF'
      : (anyAbsent
        ? 'Vínculos ausentes nesta carga (omit ≠ limpar; pendente importação/BFF)'
        : 'Nenhum vínculo comercial na origem'),
  };
}

export const CENTRAL360_VINCULO_FIELDS = VINCULO_FIELDS;
