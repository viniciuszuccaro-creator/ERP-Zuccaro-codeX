import type { DbClient } from '../db/client.js';
import type {
  Marca,
  MarcaCreateInput,
  MarcaListFilter,
  MarcaRepository,
  MarcaUpdateInput,
} from './marcaTypes.js';

function mapRow(row: Record<string, unknown>): Marca {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),
    nome_marca: String(row.nome_marca),
    descricao: row.descricao == null ? null : String(row.descricao),
    cnpj: row.cnpj == null ? null : String(row.cnpj),
    pais_origem: row.pais_origem == null ? null : String(row.pais_origem),
    site: row.site == null ? null : String(row.site),
    logo_url: row.logo_url == null ? null : String(row.logo_url),
    categoria: row.categoria == null ? null : String(row.categoria),
    fornecedor_id: row.fornecedor_id == null ? null : String(row.fornecedor_id),
    certificacoes: Array.isArray(row.certificacoes) ? row.certificacoes : [],
    ativo: Boolean(row.ativo),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export class PostgresMarcaRepository implements MarcaRepository {
  constructor(private readonly db: DbClient) {}

  async list(filter: MarcaListFilter): Promise<Marca[]> {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    const params: unknown[] = [filter.groupId];
    const where = ['group_id = $1'];

    if (filter.empresaId) {
      params.push(filter.empresaId);
      where.push(`empresa_id = $${params.length}`);
    }
    if (typeof filter.ativo === 'boolean') {
      params.push(filter.ativo);
      where.push(`ativo = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      where.push(`lower(nome_marca) LIKE $${params.length}`);
    }

    params.push(limit);
    const result = await this.db.query(
      `SELECT * FROM marcas
       WHERE ${where.join(' AND ')}
       ORDER BY nome_marca ASC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async getById(scope: { groupId: string; empresaId?: string | null }, id: string): Promise<Marca | null> {
    const params: unknown[] = [scope.groupId, id];
    let sql = 'SELECT * FROM marcas WHERE group_id = $1 AND id = $2';
    if (scope.empresaId) {
      params.push(scope.empresaId);
      sql += ` AND empresa_id = $3`;
    }
    const result = await this.db.query(sql, params);
    const row = result.rows[0];
    return row ? mapRow(row as Record<string, unknown>) : null;
  }

  async create(scope: { groupId: string; empresaId?: string | null }, data: MarcaCreateInput): Promise<Marca> {
    const empresaId = data.empresa_id ?? scope.empresaId ?? null;
    const result = await this.db.query(
      `INSERT INTO marcas (
        group_id, empresa_id, nome_marca, descricao, cnpj, pais_origem, site,
        logo_url, categoria, fornecedor_id, certificacoes, ativo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
      RETURNING *`,
      [
        scope.groupId,
        empresaId,
        data.nome_marca,
        data.descricao ?? null,
        data.cnpj ?? null,
        data.pais_origem ?? null,
        data.site ?? null,
        data.logo_url ?? null,
        data.categoria ?? null,
        data.fornecedor_id ?? null,
        JSON.stringify(data.certificacoes ?? []),
        data.ativo ?? true,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async update(
    scope: { groupId: string; empresaId?: string | null },
    id: string,
    data: MarcaUpdateInput,
  ): Promise<Marca | null> {
    const current = await this.getById(scope, id);
    if (!current) return null;

    const next = {
      nome_marca: data.nome_marca ?? current.nome_marca,
      descricao: data.descricao === undefined ? current.descricao : data.descricao,
      cnpj: data.cnpj === undefined ? current.cnpj : data.cnpj,
      pais_origem: data.pais_origem === undefined ? current.pais_origem : data.pais_origem,
      site: data.site === undefined ? current.site : data.site,
      logo_url: data.logo_url === undefined ? current.logo_url : data.logo_url,
      categoria: data.categoria === undefined ? current.categoria : data.categoria,
      fornecedor_id: data.fornecedor_id === undefined ? current.fornecedor_id : data.fornecedor_id,
      certificacoes: data.certificacoes === undefined ? current.certificacoes : data.certificacoes,
      ativo: data.ativo === undefined ? current.ativo : data.ativo,
      empresa_id: data.empresa_id === undefined ? current.empresa_id : data.empresa_id,
    };

    const params: unknown[] = [
      next.nome_marca,
      next.descricao,
      next.cnpj,
      next.pais_origem,
      next.site,
      next.logo_url,
      next.categoria,
      next.fornecedor_id,
      JSON.stringify(next.certificacoes ?? []),
      next.ativo,
      next.empresa_id,
      scope.groupId,
      id,
    ];

    let sql = `UPDATE marcas SET
      nome_marca = $1,
      descricao = $2,
      cnpj = $3,
      pais_origem = $4,
      site = $5,
      logo_url = $6,
      categoria = $7,
      fornecedor_id = $8,
      certificacoes = $9::jsonb,
      ativo = $10,
      empresa_id = $11
    WHERE group_id = $12 AND id = $13`;

    if (scope.empresaId) {
      params.push(scope.empresaId);
      sql += ` AND empresa_id = $14`;
    }
    sql += ' RETURNING *';

    const result = await this.db.query(sql, params);
    const row = result.rows[0];
    return row ? mapRow(row as Record<string, unknown>) : null;
  }

  async softDelete(scope: { groupId: string; empresaId?: string | null }, id: string): Promise<Marca | null> {
    return this.update(scope, id, { ativo: false });
  }
}
