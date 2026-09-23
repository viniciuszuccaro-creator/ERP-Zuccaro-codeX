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
