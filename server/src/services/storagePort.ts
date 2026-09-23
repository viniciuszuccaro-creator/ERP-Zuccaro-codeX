export type StorageObjectContext = {
  groupId: string;
  empresaId?: string | null;
  actorId: string;
  entity: 'Produto';
  entityId: string;
};

export type StorageUploadRequest = StorageObjectContext & {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  version?: number;
};

export type StorageObjectMetadata = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  version: number;
};
export type MalwareScanResult = StorageObjectMetadata & StorageObjectContext & {
  verdict: 'CLEAN' | 'INFECTED' | 'ERROR';
  scanner: string;
  scannedAt: string;
};

/** A scanner result is usable only for the exact verified object and tenant. */
export interface MalwareScanPort {
  scan(request: StorageUploadRequest): Promise<MalwareScanResult>;
}

export function assertMalwareScanResult(request: StorageUploadRequest, result: unknown, startedAtMs: number): asserts result is MalwareScanResult & { verdict: 'CLEAN' | 'INFECTED' } {
  if (!result || typeof result !== 'object') throw new Error('MALWARE_SCAN_NOT_CLEAN');
  const scan = result as Partial<MalwareScanResult>;
  const now = Date.now();
  const scannedAtMs = typeof scan.scannedAt === 'string' ? Date.parse(scan.scannedAt) : NaN;
  const oldestAllowed = Math.max(startedAtMs, now - 5 * 60_000);
  if (!['CLEAN', 'INFECTED'].includes(scan.verdict ?? '') || !/^[a-zA-Z0-9._-]{1,80}$/.test(scan.scanner ?? '')
    || !Number.isFinite(startedAtMs) || !Number.isFinite(scannedAtMs)
    || scannedAtMs < oldestAllowed || scannedAtMs > now
    || scan.groupId !== request.groupId || scan.empresaId !== request.empresaId
    || scan.entity !== request.entity || scan.entityId !== request.entityId
    || scan.actorId !== request.actorId || scan.storageKey !== request.storageKey
    || scan.fileName !== request.fileName || scan.mimeType !== request.mimeType
    || scan.sizeBytes !== request.sizeBytes || scan.sha256?.toLowerCase() !== request.sha256.toLowerCase()
    || scan.version !== (request.version ?? 1)) {
    throw new Error('MALWARE_SCAN_NOT_CLEAN');
  }
}

export function assertCleanMalwareScan(request: StorageUploadRequest, result: unknown, startedAtMs: number): void {
  assertMalwareScanResult(request, result, startedAtMs);
  if (result.verdict !== 'CLEAN') throw new Error('MALWARE_SCAN_NOT_CLEAN');
}


/** Contrato DAM: URLs são curtas e metadados tenant-aware; binários nunca entram no banco. */
export interface StoragePort {
  createSignedUploadUrl(request: StorageUploadRequest): Promise<{
    url: string;
    expiresAt: string;
    requiredHeaders: Record<string, string>;
  }>;
  confirmUpload(request: StorageUploadRequest): Promise<StorageObjectMetadata>;
  createSignedDownloadUrl(context: StorageObjectContext, storageKey: string): Promise<{
    url: string;
    expiresAt: string;
  }>;
}

export class NotImplementedStorage implements StoragePort {
  async createSignedUploadUrl(): Promise<never> {
    throw new Error('STORAGE_ADAPTER_NOT_CONFIGURED');
  }

  async confirmUpload(): Promise<never> {
    throw new Error('STORAGE_ADAPTER_NOT_CONFIGURED');
  }

  async createSignedDownloadUrl(): Promise<never> {
    throw new Error('STORAGE_ADAPTER_NOT_CONFIGURED');
  }
}
