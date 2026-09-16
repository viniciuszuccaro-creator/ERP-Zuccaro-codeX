import type { DbClient } from '../db/client.js';
import type { ListOptions, Scope, TenantEntityRepository } from '../services/tenantCrudService.js';
import type {
  GrupoProduto, GrupoProdutoCreate, GrupoProdutoUpdate,
  SetorAtividade, SetorCreate, SetorUpdate,
  UnidadeCreate, UnidadeMedida, UnidadeUpdate,
} from './cadastroTypes.js';

function ts(row: Record<string, unknown>) {
  return {
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

async function listSimple<T>(
  db: DbClient, table: string, filter: Scope & ListOptions, searchExpr: string,
  mapRow: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  const params: unknown[] = [filter.groupId];
  const where = ['group_id = $1'];
  if (filter.empresaId) { params.push(filter.empresaId); where.push(`empresa_id = $${params.length}`); }
  if (typeof filter.ativo === 'boolean') { params.push(filter.ativo); where.push(`ativo = $${params.length}`); }
  if (filter.search) { params.push(`%${filter.search.toLowerCase()}%`); where.push(`${searchExpr} LIKE $${params.length}`); }
  params.push(limit);
  const result = await db.query(
    `SELECT * FROM ${table} WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

async function getSimple<T>(
  db: DbClient, table: string, scope: Scope, id: string, mapRow: (row: Record<string, unknown>) => T,
): Promise<T | null> {
  const params: unknown[] = [scope.groupId, id];
  let sql = `SELECT * FROM ${table} WHERE group_id = $1 AND id = $2`;
  if (scope.empresaId) { params.push(scope.empresaId); sql += ' AND empresa_id = $3'; }
  const result = await db.query(sql, params);
  return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
}

function mapUnidade(row: Record<string, unknown>): UnidadeMedida {
  return {
    id: String(row.id), group_id: String(row.group_id),
    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),
    sigla: String(row.sigla), nome_completo: String(row.nome_completo),
    tipo_grandeza: String(row.tipo_grandeza),
    unidade_base_conversao: row.unidade_base_conversao == null ? null : String(row.unidade_base_conversao),
    fator_conversao_para_base: Number(row.fator_conversao_para_base ?? 1),
    permite_conversao: Boolean(row.permite_conversao), usa_em_estoque: Boolean(row.usa_em_estoque),
    usa_em_compras: Boolean(row.usa_em_compras), usa_em_vendas: Boolean(row.usa_em_vendas),
    ativo: Boolean(row.ativo), ...ts(row),
  };
}

function mapGrupo(row: Record<string, unknown>): GrupoProduto {
  return {
    id: String(row.id), group_id: String(row.group_id),
    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),
    nome_grupo: String(row.nome_grupo), codigo: row.codigo == null ? null : String(row.codigo),
    natureza: String(row.natureza), ncm_padrao: row.ncm_padrao == null ? null : String(row.ncm_padrao),
    margem_sugerida: Number(row.margem_sugerida ?? 0),
    icone: row.icone == null ? null : String(row.icone), cor: row.cor == null ? null : String(row.cor),
    observacoes: row.observacoes == null ? null : String(row.observacoes),
    ativo: Boolean(row.ativo), ...ts(row),
  };
}

function mapSetor(row: Record<string, unknown>): SetorAtividade {
  return {
    id: String(row.id), group_id: String(row.group_id),
    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),
    nome: String(row.nome), descricao: row.descricao == null ? null : String(row.descricao),
    tipo_operacao: String(row.tipo_operacao),
    icone: row.icone == null ? null : String(row.icone), cor: row.cor == null ? null : String(row.cor),
    ativo: Boolean(row.ativo), ...ts(row),
  };
}

// Produto: ver postgresProdutoRepository.ts (ERP-RUNTIME-03)

export class PostgresUnidadeRepository implements TenantEntityRepository<UnidadeMedida, UnidadeCreate, UnidadeUpdate> {
  constructor(private readonly db: DbClient) {}
  list(f: Scope & ListOptions) { return listSimple(this.db, 'unidades_medida', f, "lower(sigla || ' ' || nome_completo)", mapUnidade); }
  getById(s: Scope, id: string) { return getSimple(this.db, 'unidades_medida', s, id, mapUnidade); }
  async create(scope: Scope, data: UnidadeCreate) {
    const result = await this.db.query(
      `INSERT INTO unidades_medida (
        group_id, empresa_id, sigla, nome_completo, tipo_grandeza, unidade_base_conversao,
        fator_conversao_para_base, permite_conversao, usa_em_estoque, usa_em_compras, usa_em_vendas, ativo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [scope.groupId, data.empresa_id ?? scope.empresaId ?? null, data.sigla.toUpperCase(), data.nome_completo,
       data.tipo_grandeza ?? 'Unidade', data.unidade_base_conversao ?? null, data.fator_conversao_para_base ?? 1,
       data.permite_conversao ?? true, data.usa_em_estoque ?? true, data.usa_em_compras ?? true,
       data.usa_em_vendas ?? true, data.ativo ?? true],
    );
    return mapUnidade(result.rows[0] as Record<string, unknown>);
  }
  async update(scope: Scope, id: string, data: UnidadeUpdate) {
    const current = await this.getById(scope, id);
    if (!current) return null;
    const next = { ...current, ...data, empresa_id: data.empresa_id === undefined ? current.empresa_id : data.empresa_id };
    const params: unknown[] = [next.sigla.toUpperCase(), next.nome_completo, next.tipo_grandeza, next.unidade_base_conversao,
      next.fator_conversao_para_base, next.permite_conversao, next.usa_em_estoque, next.usa_em_compras,
      next.usa_em_vendas, next.ativo, next.empresa_id, scope.groupId, id];
    let sql = `UPDATE unidades_medida SET sigla=$1, nome_completo=$2, tipo_grandeza=$3, unidade_base_conversao=$4,
      fator_conversao_para_base=$5, permite_conversao=$6, usa_em_estoque=$7, usa_em_compras=$8, usa_em_vendas=$9,
      ativo=$10, empresa_id=$11 WHERE group_id=$12 AND id=$13`;
    if (scope.empresaId) { params.push(scope.empresaId); sql += ' AND empresa_id=$14'; }
    sql += ' RETURNING *';
    const result = await this.db.query(sql, params);
    return result.rows[0] ? mapUnidade(result.rows[0] as Record<string, unknown>) : null;
  }
  softDelete(scope: Scope, id: string) { return this.update(scope, id, { ativo: false }); }
}

export class PostgresGrupoProdutoRepository implements TenantEntityRepository<GrupoProduto, GrupoProdutoCreate, GrupoProdutoUpdate> {
  constructor(private readonly db: DbClient) {}
  list(f: Scope & ListOptions) { return listSimple(this.db, 'grupos_produto', f, "lower(nome_grupo || ' ' || coalesce(codigo,''))", mapGrupo); }
  getById(s: Scope, id: string) { return getSimple(this.db, 'grupos_produto', s, id, mapGrupo); }
  async create(scope: Scope, data: GrupoProdutoCreate) {
    const result = await this.db.query(
      `INSERT INTO grupos_produto (
        group_id, empresa_id, nome_grupo, codigo, natureza, ncm_padrao, margem_sugerida, icone, cor, observacoes, ativo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [scope.groupId, data.empresa_id ?? scope.empresaId ?? null, data.nome_grupo, data.codigo ?? null,
       data.natureza ?? 'Revenda', data.ncm_padrao ?? null, data.margem_sugerida ?? 0,
       data.icone ?? null, data.cor ?? null, data.observacoes ?? null, data.ativo ?? true],
    );
    return mapGrupo(result.rows[0] as Record<string, unknown>);
  }
  async update(scope: Scope, id: string, data: GrupoProdutoUpdate) {
    const current = await this.getById(scope, id);
    if (!current) return null;
    const next = { ...current, ...data, empresa_id: data.empresa_id === undefined ? current.empresa_id : data.empresa_id };
    const params: unknown[] = [next.nome_grupo, next.codigo, next.natureza, next.ncm_padrao, next.margem_sugerida,
      next.icone, next.cor, next.observacoes, next.ativo, next.empresa_id, scope.groupId, id];
    let sql = `UPDATE grupos_produto SET nome_grupo=$1, codigo=$2, natureza=$3, ncm_padrao=$4, margem_sugerida=$5,
      icone=$6, cor=$7, observacoes=$8, ativo=$9, empresa_id=$10 WHERE group_id=$11 AND id=$12`;
    if (scope.empresaId) { params.push(scope.empresaId); sql += ' AND empresa_id=$13'; }
    sql += ' RETURNING *';
    const result = await this.db.query(sql, params);
    return result.rows[0] ? mapGrupo(result.rows[0] as Record<string, unknown>) : null;
  }
  softDelete(scope: Scope, id: string) { return this.update(scope, id, { ativo: false }); }
}

export class PostgresSetorRepository implements TenantEntityRepository<SetorAtividade, SetorCreate, SetorUpdate> {
  constructor(private readonly db: DbClient) {}
  list(f: Scope & ListOptions) { return listSimple(this.db, 'setores_atividade', f, "lower(nome || ' ' || coalesce(descricao,''))", mapSetor); }
  getById(s: Scope, id: string) { return getSimple(this.db, 'setores_atividade', s, id, mapSetor); }
  async create(scope: Scope, data: SetorCreate) {
    const result = await this.db.query(
      `INSERT INTO setores_atividade (group_id, empresa_id, nome, descricao, tipo_operacao, icone, cor, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [scope.groupId, data.empresa_id ?? scope.empresaId ?? null, data.nome, data.descricao ?? null,
       data.tipo_operacao ?? 'Revenda', data.icone ?? null, data.cor ?? null, data.ativo ?? true],
    );
    return mapSetor(result.rows[0] as Record<string, unknown>);
  }
  async update(scope: Scope, id: string, data: SetorUpdate) {
    const current = await this.getById(scope, id);
    if (!current) return null;
    const next = { ...current, ...data, empresa_id: data.empresa_id === undefined ? current.empresa_id : data.empresa_id };
    const params: unknown[] = [next.nome, next.descricao, next.tipo_operacao, next.icone, next.cor, next.ativo, next.empresa_id, scope.groupId, id];
    let sql = `UPDATE setores_atividade SET nome=$1, descricao=$2, tipo_operacao=$3, icone=$4, cor=$5, ativo=$6, empresa_id=$7
      WHERE group_id=$8 AND id=$9`;
    if (scope.empresaId) { params.push(scope.empresaId); sql += ' AND empresa_id=$10'; }
    sql += ' RETURNING *';
    const result = await this.db.query(sql, params);
    return result.rows[0] ? mapSetor(result.rows[0] as Record<string, unknown>) : null;
  }
  softDelete(scope: Scope, id: string) { return this.update(scope, id, { ativo: false }); }
}
