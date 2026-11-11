/**
 * Contatos MASTER na Central360 — reutiliza partitionContatosByCanal (sem storage paralelo).
 * Classifica ausência / vazio / quarentena / não autorizado / falha de carga.
 */
import { partitionContatosByCanal } from '../../api/clienteHttpPayload.js';

/**
 * @param {unknown} row — GET Cliente hidratado (ou null)
 * @param {{ forbidden?: boolean, loadError?: boolean }} [flags]
 */
export function classifyCentral360Contatos(row, flags = {}) {
  if (flags.forbidden) {
    return { status: 'forbidden', validos: [], quarentena: [], message: 'Contatos não autorizados ao perfil' };
  }
  if (flags.loadError) {
    return { status: 'unavailable', validos: [], quarentena: [], message: 'Falha ao carregar contatos' };
  }
  if (row == null || typeof row !== 'object' || Array.isArray(row)) {
    return { status: 'unavailable', validos: [], quarentena: [], message: 'Contatos indisponíveis' };
  }
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (row);
  if (!Object.prototype.hasOwnProperty.call(record, 'contatos')) {
    // Ausente no payload ≠ [] confirmado — omit / ainda não importado / não hidratado.
    return {
      status: 'absent',
      validos: [],
      quarentena: [],
      message: 'Contatos ausentes nesta carga (omit ≠ limpar)',
    };
  }
  if (record.contatos === null) {
    return {
      status: 'unknown',
      validos: [],
      quarentena: [],
      message: 'Contatos desconhecidos (null — não comando de limpeza)',
    };
  }
  if (!Array.isArray(record.contatos)) {
    return {
      status: 'invalid',
      validos: [],
      quarentena: [],
      message: 'Formato de contatos inválido',
    };
  }
  if (record.contatos.length === 0) {
    return {
      status: 'empty',
      validos: [],
      quarentena: [],
      message: 'Nenhum contato cadastrado',
    };
  }
  const { validos, quarentena } = partitionContatosByCanal(record.contatos);
  return {
    status: 'ok',
    validos,
    quarentena,
    message: quarentena.length
      ? `${validos.length} válido(s) · ${quarentena.length} em quarentena`
      : `${validos.length} contato(s)`,
  };
}

/**
 * WhatsApp só com tipo canônico comprovado — nunca promover Celular.
 * @param {unknown} tipo
 */
export function isWhatsAppClassificado(tipo) {
  const t = String(tipo || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return t === 'whatsapp' || t === 'whats';
}

/**
 * Rótulo de canal sem confundir Celular com WhatsApp.
 * @param {unknown} tipo
 */
export function labelContatoCanal(tipo) {
  const t = String(tipo || '').trim().toLowerCase();
  if (isWhatsAppClassificado(tipo)) return 'WhatsApp';
  if (t === 'celular') return 'Celular';
  if (t === 'telefone' || t === 'fone') return 'Telefone';
  if (t === 'email' || t === 'e_mail') return 'E-mail';
  return String(tipo || 'Canal').trim() || 'Canal';
}

/**
 * Atributo estável para UI: whatsapp-classificado | celular | telefone | email | outro.
 * @param {unknown} tipo
 */
export function canalClassificacaoAttr(tipo) {
  if (isWhatsAppClassificado(tipo)) return 'whatsapp-classificado';
  const t = String(tipo || '').trim().toLowerCase();
  if (t === 'celular') return 'celular';
  if (t === 'telefone' || t === 'fone') return 'telefone';
  if (t === 'email' || t === 'e_mail') return 'email';
  return 'outro';
}
