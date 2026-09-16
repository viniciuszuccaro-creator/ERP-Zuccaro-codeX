import type { DbClient } from '../db/client.js';
import type { TenantScope } from '../audit/types.js';
import type { Empresa, EmpresaCreateInput, EmpresaRepository } from './empresaTypes.js';

function mapRow(row: Record<string, unknown>): Empresa {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    razao_social: String(row.razao_social),
    nome_fantasia: row.nome_fantasia == null ? null : String(row.nome_fantasia),
    cnpj: row.cnpj == null ? null : String(row.cnpj),
    status: String(row.status),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export class PostgresEmpresaRepository implements EmpresaRepository {
  constructor(private readonly db: DbClient) {}

  async list(scope: TenantScope): Promise<Empresa[]> {
    const result = await this.db.query(
      `SELECT * FROM empresas WHERE group_id = $1 ORDER BY razao_social ASC`,
      [scope.groupId],
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async getById(scope: TenantScope, id: string): Promise<Empresa | null> {
    const result = await this.db.query(
      `SELECT * FROM empresas WHERE group_id = $1 AND id = $2`,
      [scope.groupId, id],
    );
    const row = result.rows[0];
    return row ? mapRow(row as Record<string, unknown>) : null;
  }

  async create(scope: TenantScope, data: EmpresaCreateInput): Promise<Empresa> {
    const result = await this.db.query(
      `INSERT INTO empresas (group_id, razao_social, nome_fantasia, cnpj, status)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        scope.groupId,
        data.razao_social,
        data.nome_fantasia ?? null,
        data.cnpj ?? null,
        data.status ?? 'Ativa',
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }
}
