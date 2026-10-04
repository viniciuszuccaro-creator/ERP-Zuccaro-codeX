import { resolveErpBackendMode } from '../api/runtimeBackend.js';

export const TECHNICAL_UPLOAD_MAX_BYTES = 10_000_000;
export const TECHNICAL_UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg';

const formats = {
  pdf: { mime: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d], label: 'PDF' },
  png: { mime: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], label: 'PNG' },
  jpg: { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff], label: 'JPG' },
  jpeg: { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff], label: 'JPG' },
};

function isForbiddenHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '0.0.0.0' || host === '::' || host === '::1' ||
      host.endsWith('.local') || host.endsWith('.internal') || host.includes('::ffff:')) return true;
  if (host.includes(':')) return true; // nenhum destino IPv6 é aprovado sem contrato de storage canônico
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function assertTechnicalUploadAllowed(file, mode = resolveErpBackendMode()) {
  if (mode === 'http' || mode === 'remote') throw new Error('Upload técnico indisponível até ativar o armazenamento canônico.');
  const name = file?.name;
  if (typeof name !== 'string' || !name || /[\\/\x00-\x1f\x7f]/.test(name)) {
    throw new Error('Nome de arquivo inválido.');
  }
  const extension = name.split('.').pop()?.toLowerCase();
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs'].includes(extension)) {
    throw new Error('CAD aguarda antivírus, verificação de MIME e política de download.');
  }
  const format = formats[extension];
  if (!format) throw new Error('Formato de arquivo não autorizado.');
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > TECHNICAL_UPLOAD_MAX_BYTES) {
    throw new Error('Arquivo vazio ou acima de 10 MB.');
  }
  if (file.type !== format.mime || typeof file.slice !== 'function') {
    throw new Error('Tipo do arquivo não corresponde à extensão.');
  }
  const bytes = new Uint8Array(await file.slice(0, format.signature.length).arrayBuffer());
  if (bytes.length !== format.signature.length || !format.signature.every((byte, index) => bytes[index] === byte)) {
    throw new Error('Assinatura do arquivo não corresponde ao formato.');
  }
  return format.label;
}

export function assertConfirmedTechnicalUploadUrl(value, allowedOrigins = []) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Upload sem confirmação do armazenamento.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash ||
    isForbiddenHost(url.hostname) || !Array.isArray(allowedOrigins) || !allowedOrigins.includes(url.origin) ||
    /(?:^|\/)(?:signed|signature|token|temporary|presigned)(?:\/|$)/i.test(url.pathname)) {
    throw new Error('Upload sem confirmação do armazenamento.');
  }
  return url.toString();
}

export function assertTechnicalAiProcessingAllowed() {
  throw new Error('Leitura técnica por IA indisponível até revisão humana e armazenamento canônico.');
}
