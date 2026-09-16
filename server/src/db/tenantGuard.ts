import type { DbClient } from '../db/client.js';
import { AppError } from '../api/errors.js';

export interface TenantGuard {
  assertEmpresaInGroup(groupId: string, empresaId?: string | null): Promise<void>;
}

export class PostgresTenantGuard implements TenantGuard {
  constructor(private readonly db: DbClient) {}

  async assertEmpresaInGroup(groupId: string, empresaId?: string | null): Promise<void> {
    if (!empresaId) return;
    const result = await this.db.query(
      'SELECT 1 AS ok FROM empresas WHERE id = $1 AND group_id = $2 LIMIT 1',
      [empresaId, groupId],
    );
    if (!result.rows[0]) {
      throw new AppError(
        409,
        'TENANT_MISMATCH',
        'empresa_id does not belong to the informed group_id',
      );
    }
  }
}

/** In-memory map empresaId -> groupId for harness tests. */
export class InMemoryTenantGuard implements TenantGuard {
  private readonly empresaToGroup = new Map<string, string>();

  link(empresaId: string, groupId: string) {
    this.empresaToGroup.set(empresaId, groupId);
  }

  async assertEmpresaInGroup(groupId: string, empresaId?: string | null): Promise<void> {
    if (!empresaId) return;
    const owner = this.empresaToGroup.get(empresaId);
    if (owner !== groupId) {
      throw new AppError(
        409,
        'TENANT_MISMATCH',
        'empresa_id does not belong to the informed group_id',
      );
    }
  }
}
