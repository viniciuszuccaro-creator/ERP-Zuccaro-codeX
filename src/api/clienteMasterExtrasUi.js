/**
 * Extensões MASTER do Cliente (contrato Codex Continuity / consolidacao):
 * rg, numero_caixa_postal, cep_caixa_postal, caixa_postal_cobranca, inscricao_produtor_rural.
 * Opcionais; omissão ≠ limpar; schema antigo → 503 CLIENTE_MASTER_STORAGE_REQUIRED.
 * Reusa CLIENTE_MASTER_EXTRA_KEYS do payload canônico — sem ClienteV2.
 */
import { CLIENTE_MASTER_EXTRA_KEYS } from './clienteHttpPayload.js';

export { CLIENTE_MASTER_EXTRA_KEYS };

export const CLIENTE_MASTER_STORAGE_REQUIRED = 'CLIENTE_MASTER_STORAGE_REQUIRED';

export const CLIENTE_MASTER_EXTRA_LABELS = Object.freeze({
  rg: 'RG',
  numero_caixa_postal: 'Nº caixa postal',
  cep_caixa_postal: 'CEP caixa postal',
  caixa_postal_cobranca: 'Caixa postal cobrança',
  inscricao_produtor_rural: 'Inscrição produtor rural',
});

/**
 * null = limpeza explícita; '' / só whitespace = omissão (default intocado ≠ clear).
 * @param {unknown} value
 * @param {number} max
 * @returns {string|null|undefined}
 */
export function sanitizeMasterExtraText(value, max) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const text = String(value).replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
  // Default UI '' e string vazia: omitir — alinhado a toClienteMasterHttpPayload ('' continue).
  if (text.length === 0) return undefined;
  if (text.length > max) {
    const err = /** @type {Error & { code: string, status: number }} */ (
      new Error(`Campo master excede ${max} — rejeitado sem truncamento.`)
    );
    err.code = 'CLIENTE_MASTER_EXTRA_VALIDATION';
    err.status = 422;
    throw err;
  }
  return text;
}

/**
 * CEP caixa postal: exatamente 8 dígitos, ≠ 00000000.
 * null = limpeza explícita; '' = omissão.
 * @param {unknown} value
 * @returns {string|null|undefined}
 */
export function sanitizeCepCaixaPostal(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return undefined;
  if (digits.length !== 8 || digits === '00000000') {
    const err = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
      new Error('CEP caixa postal inválido (8 dígitos, ≠ 00000000). Rascunho preservado.')
    );
    err.code = 'CLIENTE_MASTER_EXTRA_VALIDATION';
    err.status = 422;
    err.fields = ['cep_caixa_postal'];
    throw err;
  }
  return digits;
}

/**
 * @param {unknown} row
 * @param {string} key
 * @param {{ forbidden?: boolean, loadError?: boolean }} [flags]
 */
export function classifyClienteMasterExtra(row, key, flags = {}) {
  if (flags.forbidden) {
    return { status: 'forbidden', value: null, message: `${CLIENTE_MASTER_EXTRA_LABELS[key] || key} não autorizado` };
  }
  if (flags.loadError) {
    return { status: 'unavailable', value: null, message: `Falha ao carregar ${CLIENTE_MASTER_EXTRA_LABELS[key] || key}` };
  }
  if (row == null || typeof row !== 'object' || Array.isArray(row)) {
    return { status: 'unavailable', value: null, message: 'Carga indisponível' };
  }
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (row);
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return {
      status: 'absent',
      value: null,
      message: 'Ausente nesta carga (omit ≠ limpar; schema antigo ou pendente de importação)',
    };
  }
  if (record[key] === null) {
    return { status: 'unknown', value: null, message: 'null — não comando de limpeza' };
  }
  const text = String(record[key] ?? '').trim();
  if (!text) {
    return { status: 'empty', value: '', message: 'Vazio na origem' };
  }
  return {
    status: 'present',
    value: text,
    message: 'Recuperado do MASTER (escrita depende de storage revisado)',
  };
}

/**
 * @param {unknown} row
 * @param {{ forbidden?: boolean, loadError?: boolean }} [flags]
 */
export function classifyClienteMasterExtras(row, flags = {}) {
  /** @type {Record<string, ReturnType<typeof classifyClienteMasterExtra>>} */
  const fields = {};
  for (const key of CLIENTE_MASTER_EXTRA_KEYS) {
    fields[key] = classifyClienteMasterExtra(row, key, flags);
  }
  const present = CLIENTE_MASTER_EXTRA_KEYS.filter((k) => fields[k].status === 'present').length;
  const absent = CLIENTE_MASTER_EXTRA_KEYS.filter((k) => fields[k].status === 'absent').length;
  return {
    fields,
    present,
    absent,
    message: present
      ? `${present} extensão(ões) recuperada(s)`
      : (absent === CLIENTE_MASTER_EXTRA_KEYS.length
        ? 'Extensões MASTER ausentes nesta carga (schema antigo ou não importadas)'
        : 'Extensões MASTER sem valores confirmados'),
  };
}

/**
 * @param {unknown} error
 */
export function isClienteMasterStorageRequired(error) {
  const err = /** @type {{ code?: string, message?: string, body?: { error?: { code?: string } }, status?: number }} */ (error || {});
  const code = err.code || err.body?.error?.code || '';
  return code === CLIENTE_MASTER_STORAGE_REQUIRED
    || (err.status === 503 && /MASTER_STORAGE|master columns/i.test(String(err.message || '')));
}

/**
 * Patch omit-aware: sem hasOwn → omit; '' → omit; null → clear; valor → sanitize.
 * @param {Record<string, unknown>} data
 */
export function pickClienteMasterExtrasForWrite(data) {
  /** @type {Record<string, unknown>} */
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const key of CLIENTE_MASTER_EXTRA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const sanitized = key === 'cep_caixa_postal'
      ? sanitizeCepCaixaPostal(data[key])
      : sanitizeMasterExtraText(data[key], key === 'rg' ? 30 : 40);
    if (sanitized === undefined) continue;
    out[key] = sanitized;
  }
  return out;
}

/**
 * Aplica extras omit-aware no payload HTTP ('' default ≠ clear; null = limpeza explícita).
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>} data
 */
export function applyClienteMasterExtrasToHttpPayload(payload, data) {
  for (const key of CLIENTE_MASTER_EXTRA_KEYS) {
    delete payload[key];
  }
  const extras = pickClienteMasterExtrasForWrite(data);
  for (const [key, value] of Object.entries(extras)) {
    payload[key] = value;
  }
  return payload;
}
