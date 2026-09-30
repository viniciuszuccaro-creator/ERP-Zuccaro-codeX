import { resolveErpBackendMode } from '../api/runtimeBackend.js';

export const TECHNICAL_UPLOAD_MAX_BYTES = 10_000_000;
export const TECHNICAL_UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg';

const formats = {
  pdf: { mime: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d], label: 'PDF' },
  png: { mime: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], label: 'PNG' },
  jpg: { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff], label: 'JPG' },
  jpeg: { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff], label: 'JPG' },
};

export async function assertTechnicalUploadAllowed(file, mode = resolveErpBackendMode()) {
  if (mode !== 'local') throw new Error('Upload técnico indisponível até ativar o armazenamento canônico.');
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

export function assertConfirmedTechnicalUploadUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Upload sem confirmação do armazenamento.'); }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  let path;
  try { path = decodeURIComponent(url.pathname).toLowerCase(); } catch { throw new Error('Upload sem confirmação do armazenamento.'); }
  // Sem Storage/DAM canônico não aceitar IP literal, host interno ou assinatura embutida no path.
  const internalHost = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') || hostname.endsWith('.internal') ||
    hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const temporaryPath = /(?:^|\/)(?:signed|signature|token|sig|expires?|auth|private|temp(?:orary)?)(?:\/|$)/.test(path);
  if (url.protocol !== 'https:' || !hostname || url.username || url.password || url.search || url.hash || url.port ||
    internalHost || temporaryPath) {
    throw new Error('Upload sem confirmação do armazenamento.');
  }
  return url.toString();
}

/** Portal: valida o lote antes de iniciar uploads e só devolve URLs confirmadas. */
export async function uploadConfirmedTechnicalFiles(files, uploadFile, mode = resolveErpBackendMode()) {
  const batch = Array.from(files || []);
  await Promise.all(batch.map((file) => assertTechnicalUploadAllowed(file, mode)));
  const confirmed = [];
  for (const file of batch) {
    const { file_url } = await uploadFile(file);
    confirmed.push({ name: file.name, url: assertConfirmedTechnicalUploadUrl(file_url) });
  }
  return confirmed;
}
