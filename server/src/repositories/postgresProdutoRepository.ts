import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { ListOptions, Scope } from '../services/tenantCrudService.js';
import type { Produto, ProdutoCreate, ProdutoUpdate } from './produtoTypes.js';
import type { ProdutoListFilter, ProdutoRepository } from './inMemoryProdutoRepository.js';

function ts(row: Record<string, unknown>) {
  return {
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObject(value: unknown): Record<string, number> {
  const numericEntries = (record: Record<string, unknown>) => Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => (
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0
    )),
  );
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return numericEntries(value as Record<string, unknown>);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? numericEntries(parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function mapProduto(row: Record<string, unknown>): Produto {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),
    codigo: row.codigo == null ? null : String(row.codigo),
    codigo_barras: row.codigo_barras == null ? null : String(row.codigo_barras),
    descricao: String(row.descricao),
    nome: row.nome == null ? null : String(row.nome),
    tipo_item: String(row.tipo_item ?? 'Revenda'),
    tipo_aco: row.tipo_aco == null ? null : String(row.tipo_aco),
    eh_bitola: Boolean(row.eh_bitola),
    peso_teorico_kg_m: Number(row.peso_teorico_kg_m ?? 0),
    bitola_diametro_mm: Number(row.bitola_diametro_mm ?? 0),
    comprimento_barra_padrao_m: Number(row.comprimento_barra_padrao_m ?? 12),
    unidade_medida_id: row.unidade_medida_id == null ? null : String(row.unidade_medida_id),
    unidade_medida: row.unidade_medida == null ? null : String(row.unidade_medida),
    unidade_principal: row.unidade_principal == null ? null : String(row.unidade_principal),
    unidades_secundarias: asArray(row.unidades_secundarias),
    fatores_conversao: asObject(row.fatores_conversao),
    grupo_produto_id: row.grupo_produto_id == null ? null : String(row.grupo_produto_id),
    grupo_legado: row.grupo_legado == null ? null : String(row.grupo_legado),
    marca_id: row.marca_id == null ? null : String(row.marca_id),
    setor_atividade_id: row.setor_atividade_id == null ? null : String(row.setor_atividade_id),
    peso_liquido_kg: Number(row.peso_liquido_kg ?? 0),
    peso_bruto_kg: Number(row.peso_bruto_kg ?? 0),
    altura_cm: Number(row.altura_cm ?? 0),
    largura_cm: Number(row.largura_cm ?? 0),
    comprimento_cm: Number(row.comprimento_cm ?? 0),
    volume_m3: Number(row.volume_m3 ?? 0),
    ncm: row.ncm == null ? null : String(row.ncm),
    cest: row.cest == null ? null : String(row.cest),
    origem_mercadoria: row.origem_mercadoria == null ? null : String(row.origem_mercadoria),
    status: String(row.status ?? 'Ativo'),
    foto_produto_url: row.foto_produto_url == null ? null : String(row.foto_produto_url),
    ativo: Boolean(row.ativo),
    ...ts(row),
  };
}

export class PostgresProdutoRepository implements ProdutoRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return this.db.withTransaction(fn);
  }

  constructor(private readonly db: DbClient) {}

  async list(filter: Scope & ListOptions): Promise<Produto[]> {
    const page = await this.listPage({ ...filter, offset: 0 });
    return page.rows;
  }

  async listPage(filter: ProdutoListFilter, executor?: DbQueryExecutor): Promise<{ rows: Produto[]; total: number }> {
    const query = executor ?? this.db;
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [filter.groupId];
    const where = ['group_id = $1'];
    if (filter.empresaId) {
      params.push(filter.empresaId);
      where.push(`empresa_id = $${params.length}`);
    }
    // Default operacional: ativo=true (fail-safe). Combinado com group_id (tenant).
    const ativoFilter = typeof filter.ativo === 'boolean' ? filter.ativo : true;
    params.push(ativoFilter);
    where.push(`ativo = $${params.length}`);
    if (filter.codigo) {
      params.push(filter.codigo.toLowerCase());
      where.push(`lower(codigo) = $${params.length}`);
    }
    if (filter.codigoBarras) {
      params.push(filter.codigoBarras.toLowerCase());
      where.push(`lower(codigo_barras) = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      where.push(
        `(lower(descricao) LIKE $${params.length} OR lower(coalesce(codigo,'')) LIKE $${params.length}`
        + ` OR lower(coalesce(nome,'')) LIKE $${params.length}`
        + ` OR lower(coalesce(codigo_barras,'')) LIKE $${params.length})`,
      );
    }
    const whereSql = where.join(' AND ');
    const countResult = await query.query(
      `SELECT count(*)::int AS total FROM produtos WHERE ${whereSql}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    params.push(limit, offset);
    const result = await query.query(
      `SELECT * FROM produtos WHERE ${whereSql} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: result.rows.map((row) => mapProduto(row as Record<string, unknown>)),
      total,
    };
  }


  async getById(scope: Scope, id: string, executor?: DbQueryExecutor): Promise<Produto | null> {
    const query = executor ?? this.db;
    const params: unknown[] = [scope.groupId, id];
    let sql = 'SELECT * FROM produtos WHERE group_id = $1 AND id = $2';
    if (scope.empresaId) {
      params.push(scope.empresaId);
      sql += ' AND empresa_id = $3';
    }
    const result = await query.query(sql, params);
    return result.rows[0] ? mapProduto(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(scope: Scope, data: ProdutoCreate, executor?: DbQueryExecutor): Promise<Produto> {
    const query = executor ?? this.db;
    const result = await query.query(
      `INSERT INTO produtos (
        group_id, empresa_id, codigo, codigo_barras, descricao, nome, tipo_item, tipo_aco, eh_bitola,
        peso_teorico_kg_m, bitola_diametro_mm, comprimento_barra_padrao_m,
        unidade_medida_id, unidade_medida, unidade_principal, unidades_secundarias, fatores_conversao,
        grupo_produto_id, grupo_legado, marca_id, setor_atividade_id,
        peso_liquido_kg, peso_bruto_kg, altura_cm, largura_cm, comprimento_cm, volume_m3,
        ncm, cest, origem_mercadoria, status, foto_produto_url, ativo
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
      ) RETURNING *`,
      [
        scope.groupId,
        data.empresa_id ?? scope.empresaId ?? null,
        data.codigo ?? null,
        data.codigo_barras ?? null,
        data.descricao,
        data.nome ?? data.descricao,
        data.tipo_item ?? 'Revenda',
        data.tipo_aco ?? null,
        data.eh_bitola ?? false,
        data.peso_teorico_kg_m ?? 0,
        data.bitola_diametro_mm ?? 0,
        data.comprimento_barra_padrao_m ?? 12,
        data.unidade_medida_id ?? null,
        data.unidade_medida ?? data.unidade_principal ?? null,
        data.unidade_principal ?? data.unidade_medida ?? null,
        JSON.stringify(data.unidades_secundarias ?? []),
        JSON.stringify(data.fatores_conversao ?? {}),
        data.grupo_produto_id ?? null,
        data.grupo_legado ?? null,
        data.marca_id ?? null,
        data.setor_atividade_id ?? null,
        data.peso_liquido_kg ?? 0,
        data.peso_bruto_kg ?? 0,
        data.altura_cm ?? 0,
        data.largura_cm ?? 0,
        data.comprimento_cm ?? 0,
        data.volume_m3 ?? 0,
        data.ncm ?? null,
        data.cest ?? null,
        data.origem_mercadoria ?? null,
        data.status ?? 'Ativo',
        data.foto_produto_url ?? null,
        data.ativo ?? true,
      ],
    );
    return mapProduto(result.rows[0] as Record<string, unknown>);
  }

  async update(scope: Scope, id: string, data: ProdutoUpdate, executor?: DbQueryExecutor): Promise<Produto | null> {
    const query = executor ?? this.db;
    const current = await this.getById(scope, id, query);
    if (!current) return null;
    const next = {
      ...current,
      ...data,
      empresa_id: data.empresa_id === undefined ? current.empresa_id : data.empresa_id,
      unidades_secundarias: data.unidades_secundarias === undefined
        ? current.unidades_secundarias
        : data.unidades_secundarias,
      fatores_conversao: data.fatores_conversao === undefined
        ? current.fatores_conversao
        : data.fatores_conversao,
    };
    const params: unknown[] = [
      next.codigo, next.codigo_barras, next.descricao, next.nome, next.tipo_item, next.tipo_aco, next.eh_bitola,
      next.peso_teorico_kg_m, next.bitola_diametro_mm, next.comprimento_barra_padrao_m,
      next.unidade_medida_id, next.unidade_medida, next.unidade_principal,
      JSON.stringify(next.unidades_secundarias), JSON.stringify(next.fatores_conversao),
      next.grupo_produto_id, next.grupo_legado, next.marca_id, next.setor_atividade_id,
      next.peso_liquido_kg, next.peso_bruto_kg, next.altura_cm, next.largura_cm, next.comprimento_cm, next.volume_m3,
      next.ncm, next.cest, next.origem_mercadoria, next.status, next.foto_produto_url, next.ativo, next.empresa_id,
      scope.groupId, id,
    ];
    let sql = `UPDATE produtos SET
      codigo=$1, codigo_barras=$2, descricao=$3, nome=$4, tipo_item=$5, tipo_aco=$6, eh_bitola=$7,
      peso_teorico_kg_m=$8, bitola_diametro_mm=$9, comprimento_barra_padrao_m=$10,
      unidade_medida_id=$11, unidade_medida=$12, unidade_principal=$13,
      unidades_secundarias=$14::jsonb, fatores_conversao=$15::jsonb,
      grupo_produto_id=$16, grupo_legado=$17, marca_id=$18, setor_atividade_id=$19,
      peso_liquido_kg=$20, peso_bruto_kg=$21, altura_cm=$22, largura_cm=$23, comprimento_cm=$24, volume_m3=$25,
      ncm=$26, cest=$27, origem_mercadoria=$28, status=$29, foto_produto_url=$30, ativo=$31, empresa_id=$32
      WHERE group_id=$33 AND id=$34`;
    if (scope.empresaId) {
      params.push(scope.empresaId);
      sql += ` AND empresa_id=$${params.length}`;
    }
    sql += ' RETURNING *';
    const result = await query.query(sql, params);
    return result.rows[0] ? mapProduto(result.rows[0] as Record<string, unknown>) : null;
  }

  softDelete(scope: Scope, id: string, executor?: DbQueryExecutor) {
    return this.update(scope, id, { ativo: false }, executor);
  }
}
