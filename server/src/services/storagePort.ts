/**
 * Future storage adapter surface (PDF/XML/fotos). Not implemented in RUNTIME-01.
 */
export interface StoragePort {
  createSignedUploadUrl(path: string): Promise<{ url: string; token?: string }>;
  createSignedDownloadUrl(path: string): Promise<{ url: string }>;
}

export class NotImplementedStorage implements StoragePort {
  async createSignedUploadUrl(): Promise<{ url: string; token?: string }> {
    throw new Error('Storage not implemented in ERP-RUNTIME-01');
  }

  async createSignedDownloadUrl(): Promise<{ url: string }> {
    throw new Error('Storage not implemented in ERP-RUNTIME-01');
  }
}
