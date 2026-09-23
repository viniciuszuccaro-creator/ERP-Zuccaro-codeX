import { createHash } from 'node:crypto';
import type { StorageObjectContext, StorageObjectMetadata, StoragePort, StorageUploadRequest } from './storagePort.js';

export type SupabaseStorageOptions = {
  internalUrl: string;
  publicUrl: string;
  serviceRoleKey: string;
  privateBucket: string;
  maxBytes: number;
  fetchImpl?: typeof fetch;
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(`^groups/(${UUID})/companies/(${UUID})/products/(${UUID})/([a-z-]+)/(${UUID})-([a-z0-9][a-z0-9._-]*)$`, 'i');
const MIME_BY_CATEGORY: Record<string, Record<string, string>> = {
  images: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' },
  videos: { mp4: 'video/mp4' },
  catalogs: { pdf: 'application/pdf' },
  manuals: { pdf: 'application/pdf' },
  certificates: { pdf: 'application/pdf' },
  documents: { pdf: 'application/pdf' },
};

function assertContext(context: StorageObjectContext, storageKey: string): RegExpExecArray {
  const match = KEY.exec(storageKey);
  if (!match || !context.actorId || !context.empresaId ||
      match[1].toLowerCase() !== context.groupId.toLowerCase() ||
      match[2].toLowerCase() !== context.empresaId.toLowerCase() ||
      match[3].toLowerCase() !== context.entityId.toLowerCase() ||
      !MIME_BY_CATEGORY[match[4].toLowerCase()] ||
      context.entity !== 'Produto') {
    throw new Error('STORAGE_SCOPE_INVALID');
  }
  return match;
}

function assertUpload(request: StorageUploadRequest, maxBytes: number): void {
  const match = assertContext(request, request.storageKey);
  const extension = request.fileName.split('.').at(-1)?.toLowerCase();
  if (!extension || !/^[a-z0-9][a-z0-9._-]*$/i.test(request.fileName) ||
      !match[6].toLowerCase().endsWith(`.${extension}`) ||
      MIME_BY_CATEGORY[match[4].toLowerCase()]?.[extension] !== request.mimeType ||
      !Number.isSafeInteger(request.sizeBytes) || request.sizeBytes < 1 || request.sizeBytes > maxBytes ||
      !/^[a-f0-9]{64}$/i.test(request.sha256)) {
    throw new Error('STORAGE_UPLOAD_INVALID');
  }
}

function matchesSignature(mimeType: string, firstBytes: Buffer): boolean {
  switch (mimeType) {
    case 'image/png':
      return firstBytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    case 'image/jpeg':
      return firstBytes.length >= 3 && firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff;
    case 'image/webp':
      return firstBytes.toString('ascii', 0, 4) === 'RIFF' && firstBytes.toString('ascii', 8, 12) === 'WEBP';
    case 'application/pdf':
      return firstBytes.toString('ascii', 0, 5) === '%PDF-';
    case 'video/mp4':
      return firstBytes.toString('ascii', 4, 8) === 'ftyp';
    default:
      return false;
  }
}

function baseUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('STORAGE_URL_INVALID');
  }
  return new URL(`${url.toString().replace(/\/$/, '')}/storage/v1/`);
}

/** Backend-only adapter. Authorization/RBAC and metadata persistence stay with ProdutoService. */
export class SupabaseStorageAdapter implements StoragePort {
  private readonly internalBase: URL;
  private readonly publicBase: URL;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseStorageOptions) {
    this.internalBase = baseUrl(options.internalUrl);
    this.publicBase = baseUrl(options.publicUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!options.serviceRoleKey || !/^[a-z0-9_-]+$/i.test(options.privateBucket) ||
        !Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1) {
      throw new Error('STORAGE_CONFIG_INVALID');
    }
  }

  private path(storageKey: string): string {
    return `${encodeURIComponent(this.options.privateBucket)}/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
  }

  private async post(path: string, body: object): Promise<{ url?: string; signedURL?: string }> {
    const response = await this.fetchImpl(new URL(path, this.internalBase), {
      method: 'POST',
      redirect: 'error',
      headers: {
        apikey: this.options.serviceRoleKey,
        Authorization: `Bearer ${this.options.serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('STORAGE_REQUEST_FAILED');
    return response.json() as Promise<{ url?: string; signedURL?: string }>;
  }

  private signedUrl(relative: string | undefined, prefix: string, storageKey: string): string {
    const expectedPath = `${prefix}${this.path(storageKey)}`;
    const parsed = relative ? new URL(relative.replace(/^\//, ''), this.publicBase) : null;
    if (!relative || !parsed || parsed.origin !== this.publicBase.origin || parsed.username || parsed.password ||
        parsed.hash || parsed.pathname !== `/storage/v1${expectedPath}` || !parsed.searchParams.get('token')) {
      throw new Error('STORAGE_SIGN_RESPONSE_INVALID');
    }
    return parsed.toString();
  }

  async createSignedUploadUrl(request: StorageUploadRequest) {
    assertUpload(request, this.options.maxBytes);
    const data = await this.post(`object/upload/sign/${this.path(request.storageKey)}`, {});
    return {
      url: this.signedUrl(data.url, '/object/upload/sign/', request.storageKey),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      requiredHeaders: { 'content-type': request.mimeType },
    };
  }

  async confirmUpload(request: StorageUploadRequest): Promise<StorageObjectMetadata> {
    assertUpload(request, this.options.maxBytes);
    const response = await this.fetchImpl(new URL(`object/authenticated/${this.path(request.storageKey)}`, this.internalBase), {
      redirect: 'error',
      headers: { apikey: this.options.serviceRoleKey, Authorization: `Bearer ${this.options.serviceRoleKey}` },
    });
    if (!response.ok || !response.body) throw new Error('STORAGE_OBJECT_NOT_FOUND');
    const actualMime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (actualMime !== request.mimeType) {
      await response.body.cancel();
      throw new Error('STORAGE_MIME_MISMATCH');
    }
    const reader = response.body.getReader();
    const hash = createHash('sha256');
    let size = 0;
    let firstBytes = Buffer.alloc(0);
    let doneReading = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { doneReading = true; break; }
        size += value.byteLength;
        if (size > this.options.maxBytes || size > request.sizeBytes) throw new Error('STORAGE_SIZE_MISMATCH');
        if (firstBytes.length < 16) firstBytes = Buffer.concat([firstBytes, value.subarray(0, 16 - firstBytes.length)]);
        hash.update(value);
      }
    } finally {
      if (!doneReading) await reader.cancel();
      reader.releaseLock();
    }
    if (size !== request.sizeBytes || hash.digest('hex').toLowerCase() !== request.sha256.toLowerCase()) {
      throw new Error('STORAGE_CHECKSUM_MISMATCH');
    }
    if (!matchesSignature(request.mimeType, firstBytes)) throw new Error('STORAGE_CONTENT_MISMATCH');
    return {
      storageKey: request.storageKey, fileName: request.fileName, mimeType: request.mimeType,
      sizeBytes: size, sha256: request.sha256.toLowerCase(), version: request.version ?? 1,
    };
  }

  async createSignedDownloadUrl(context: StorageObjectContext, storageKey: string) {
    assertContext(context, storageKey);
    const data = await this.post(`object/sign/${this.path(storageKey)}`, { expiresIn: 60 });
    return {
      url: this.signedUrl(data.signedURL, '/object/sign/', storageKey),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }
}
