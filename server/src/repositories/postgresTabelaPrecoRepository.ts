import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type {
  TabelaPrecoItemListFilter,
  TabelaPrecoListFilter,
  TabelaPrecoRepository,
  TabelaPrecoScope,
  ResolvedPrice,
} from './inMemoryTabelaPrecoRepository.js';
import type {
  TabelaPreco,
  TabelaPrecoCreate,
  TabelaPrecoEmpresa,
  TabelaPrecoItem,
  TabelaPrecoItemCreate,
  TabelaPrecoItemUpdate,
  TabelaPrecoUpdate,
} from './tabelaPrecoTypes.js';

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseJson<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') return JSON.parse(value) as T[];
  return [];
}

function mapEmpresa(row: Record<string, unknown>): TabelaPrecoEmpresa {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    tabela_preco_id: String(row.tabela_preco_id),
    empresa_id: String(row.empresa_id),
    eh_padrao: Boolean(row.eh_padrao),
    ativo: Boolean(row.ativo),
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: iso(row.created_at) ?? '',
    updated_at: iso(row.updated_at) ?? '',
  };
}

function mapItem(row: Record<string, unknown>): TabelaPrecoItem {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    tabela_preco_id: String(row.tabela_preco_id),
    produto_id: String(row.produto_id),
    unidade_medida_id: String(row.unidade_medida_id),
    preco: String(row.preco),
    ativo: Boolean(row.ativo),
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: iso(row.created_at) ?? '',
    updated_at: iso(row.updated_at) ?? '',
  };
}

function mapTabela(row: Record<string, unknown>): TabelaPreco {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    empresa_id: String(row.empresa_id),
    codigo: String(row.codigo),
    nome: String(row.nome),
    descricao: row.descricao == null ? null : String(row.descricao),
    moeda: 'BRL',
    vigencia_inicio: dateOnly(row.vigencia_inicio),
    vigencia_fim: row.vigencia_fim == null ? null : dateOnly(row.vigencia_fim),
    ativo: Boolean(row.ativo),
    codigo_tabela_legado: row.codigo_tabela_legado == null ? null : String(row.codigo_tabela_legado),
    origem: String(row.origem ?? 'ERP'),
    legacy_id: row.legacy_id == null ? null : String(row.legacy_id),
    legacy_code: row.legacy_code == null ? null : String(row.legacy_code),
    source_system: row.source_system == null ? null : String(row.source_system),
    migration_batch: row.migration_batch == null ? null : String(row.migration_batch),
    imported_at: iso(row.imported_at),
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: iso(row.created_at) ?? '',
    updated_at: iso(row.updated_at) ?? '',
    empresas: parseJson<Record<string, unknown>>(row.empresas).map(mapEmpresa),
  };
}

const TABELA_SELECT = `
  SELECT t.*,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', e.id, 'group_id', e.group_id, 'tabela_preco_id', e.tabela_preco_id,
        'empresa_id', e.empresa_id, 'eh_padrao', e.eh_padrao, 'ativo', e.ativo,
        'created_by', e.created_by, 'updated_by', e.updated_by,
        'created_at', e.created_at, 'updated_at', e.updated_at
      ) ORDER BY e.created_at)
      FROM tabela_preco_empresas e WHERE e.tabela_preco_id = t.id
    ), '[]'::json) AS empresas
  FROM tabelas_preco t
`;

export class PostgresTabelaPrecoRepository implements TabelaPrecoRepository {
  constructor(private readonly db: DbClient) {}

  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return this.db.withTransaction(fn);
  }

  private exec(executor?: DbQueryExecutor) {
    return executor ?? this.db;
  }

  async listPage(filter: TabelaPrecoListFilter, executor?: DbQueryExecutor) {
    const params: unknown[] = [filter.groupId];
    const where = ['t.group_id=$1'];
    params.push(typeof filter.ativo === 'boolean' ? filter.ativo : true);
    where.push(`t.ativo=$${params.length}`);
    if (filter.empresaId) {
      params.push(filter.empresaId);
      where.push(`EXISTS (
        SELECT 1 FROM tabela_preco_empresas te
        WHERE te.tabela_preco_id=t.id AND te.empresa_id=$${params.length} AND te.ativo=true
      )`);
    }
    if (typeof filter.ehPadrao === 'boolean' && filter.empresaId) {
      params.push(filter.ehPadrao);
      where.push(`EXISTS (
        SELECT 1 FROM tabela_preco_empresas te2
        WHERE te2.tabela_preco_id=t.id AND te2.empresa_id=$2 AND te2.ativo=true
          AND te2.eh_padrao=$${params.length}
      )`);
    }
    if (filter.vigenteEm) {
      params.push(filter.vigenteEm);
      where.push(`t.vigencia_inicio <= $${params.length}::date`);
      where.push(`(t.vigencia_fim IS NULL OR t.vigencia_fim >= $${params.length}::date)`);
    }
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      where.push(`(lower(t.nome) LIKE $${params.length} OR t.codigo LIKE $${params.length})`);
    }
    const orderCol = filter.orderBy === 'nome'
      ? 't.nome'
      : filter.orderBy === 'codigo' ? 't.codigo' : 't.created_at';
    const orderDir = filter.orderDir === 'desc' ? 'DESC' : 'ASC';
    const count = await this.exec(executor).query<{ total: number }>(
      `SELECT count(*)::int AS total FROM tabelas_preco t WHERE ${where.join(' AND ')}`,
      params,
    );
    params.push(filter.limit, filter.offset);
    const page = await this.exec(executor).query(
      `${TABELA_SELECT} WHERE ${where.join(' AND ')}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: page.rows.map((row) => mapTabela(row as Record<string, unknown>)),
      total: count.rows[0]?.total ?? 0,
    };
  }

  async get(scope: TabelaPrecoScope, tabelaId: string, executor?: DbQueryExecutor) {
    const params: unknown[] = [scope.groupId, tabelaId];
    let empresaSql = '';
    if (scope.empresaId) {
      params.push(scope.empresaId);
      empresaSql = ` AND EXISTS (
        SELECT 1 FROM tabela_preco_empresas te
        WHERE te.tabela_preco_id=t.id AND te.empresa_id=$3 AND te.ativo=true
      )`;
    }
    const result = await this.exec(executor).query(
      `${TABELA_SELECT} WHERE t.group_id=$1 AND t.id=$2${empresaSql}`,
      params,
    );
    return result.rows[0] ? mapTabela(result.rows[0] as Record<string, unknown>) : null;
  }

  async lock(scope: TabelaPrecoScope, tabelaId: string, executor?: DbQueryExecutor) {
    await this.exec(executor).query(
      'SELECT id FROM tabelas_preco WHERE group_id=$1 AND id=$2 FOR UPDATE',
      [scope.groupId, tabelaId],
    );
  }

  async create(
    scope: { groupId: string; empresaId: string },
    data: TabelaPrecoCreate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const db = this.exec(executor);
    const codigo = await db.query<{ codigo: string }>(
      'SELECT reserve_entity_codigo($1, $2, 6) AS codigo',
      [scope.groupId, 'TabelaPreco'],
    );
    const inserted = await db.query(
      `INSERT INTO tabelas_preco (
         group_id, empresa_id, codigo, nome, descricao, moeda,
         vigencia_inicio, vigencia_fim, codigo_tabela_legado, origem,
         legacy_id, legacy_code, source_system, migration_batch, imported_at,
         created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,'BRL',$6,$7,$8,COALESCE($9,'ERP'),
         $10,$11,$12,$13,$14,$15,$15
       ) RETURNING id`,
      [
        scope.groupId,
        scope.empresaId,
        codigo.rows[0]?.codigo,
        data.nome,
        data.descricao ?? null,
        data.vigencia_inicio,
        data.vigencia_fim ?? null,
        data.codigo_tabela_legado ?? null,
        data.origem ?? null,
        data.legacy_id ?? null,
        data.legacy_code ?? null,
        data.source_system ?? null,
        data.migration_batch ?? null,
        data.imported_at ?? null,
        actorId ?? null,
      ],
    );
    const tabelaId = String(inserted.rows[0].id);
    await db.query(
      `INSERT INTO tabela_preco_empresas (
         group_id, tabela_preco_id, empresa_id, eh_padrao, ativo, created_by, updated_by
       ) VALUES ($1,$2,$3,false,true,$4,$4)`,
      [scope.groupId, tabelaId, scope.empresaId, actorId ?? null],
    );
    const created = await this.get({ groupId: scope.groupId }, tabelaId, executor);
    if (!created) throw new Error('TABELA_PRECO_CREATE_FAILED');
    return created;
  }

  async update(
    scope: TabelaPrecoScope,
    tabelaId: string,
    data: TabelaPrecoUpdate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE tabelas_preco SET
         nome = COALESCE($3, nome),
         descricao = CASE WHEN $4::boolean THEN $5 ELSE descricao END,
         vigencia_inicio = COALESCE($6::date, vigencia_inicio),
         vigencia_fim = CASE
           WHEN $7::boolean THEN $8::date
           ELSE vigencia_fim
         END,
         moeda = COALESCE($9, moeda),
         codigo_tabela_legado = CASE WHEN $10::boolean THEN $11 ELSE codigo_tabela_legado END,
         updated_by = $12
       WHERE group_id=$1 AND id=$2 AND ativo=true
       RETURNING id`,
      [
        scope.groupId,
        tabelaId,
        data.nome ?? null,
        data.descricao !== undefined,
        data.descricao ?? null,
        data.vigencia_inicio ?? null,
        data.vigencia_fim !== undefined,
        data.vigencia_fim ?? null,
        data.moeda ?? null,
        data.codigo_tabela_legado !== undefined,
        data.codigo_tabela_legado ?? null,
        actorId ?? null,
      ],
    );
    if (!result.rows[0]) return null;
    return this.get(scope, tabelaId, executor);
  }

  async softDelete(
    scope: TabelaPrecoScope,
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE tabelas_preco
       SET ativo=false, updated_by=$3
       WHERE group_id=$1 AND id=$2 AND ativo=true
       RETURNING id`,
      [scope.groupId, tabelaId, actorId ?? null],
    );
    if (!result.rows[0]) return null;
    return this.get({ groupId: scope.groupId }, tabelaId, executor);
  }

  async restore(
    scope: TabelaPrecoScope,
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE tabelas_preco
       SET ativo=true, updated_by=$3
       WHERE group_id=$1 AND id=$2 AND ativo=false
       RETURNING id`,
      [scope.groupId, tabelaId, actorId ?? null],
    );
    if (!result.rows[0]) return null;
    return this.get({ groupId: scope.groupId }, tabelaId, executor);
  }

  async linkEmpresa(
    scope: TabelaPrecoScope,
    tabelaId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    await this.exec(executor).query(
      `INSERT INTO tabela_preco_empresas (
         group_id, tabela_preco_id, empresa_id, eh_padrao, ativo, created_by, updated_by
       ) VALUES ($1,$2,$3,false,true,$4,$4)
       ON CONFLICT (tabela_preco_id, empresa_id) DO UPDATE
         SET ativo=true, updated_by=EXCLUDED.updated_by, updated_at=timezone('utc', now())`,
      [scope.groupId, tabelaId, empresaId, actorId ?? null],
    );
    const row = await this.get({ groupId: scope.groupId }, tabelaId, executor);
    if (!row) throw new Error('TABELA_PRECO_NOT_FOUND');
    return row;
  }

  async unlinkEmpresa(
    scope: TabelaPrecoScope,
    tabelaId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const owner = await this.exec(executor).query<{ empresa_id: string }>(
      'SELECT empresa_id FROM tabelas_preco WHERE group_id=$1 AND id=$2',
      [scope.groupId, tabelaId],
    );
    if (!owner.rows[0]) return null;
    if (owner.rows[0].empresa_id === empresaId) {
      const err = new Error('TABELA_PRECO_OWNER_REQUIRED');
      (err as Error & { code?: string }).code = 'TABELA_PRECO_OWNER_REQUIRED';
      throw err;
    }
    const result = await this.exec(executor).query(
      `UPDATE tabela_preco_empresas
       SET ativo=false, eh_padrao=false, updated_by=$4
       WHERE group_id=$1 AND tabela_preco_id=$2 AND empresa_id=$3 AND ativo=true
       RETURNING id`,
      [scope.groupId, tabelaId, empresaId, actorId ?? null],
    );
    if (!result.rows[0]) return null;
    return this.get({ groupId: scope.groupId }, tabelaId, executor);
  }

  async restoreEmpresa(
    scope: TabelaPrecoScope,
    tabelaId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    return this.linkEmpresa(scope, tabelaId, empresaId, actorId, executor);
  }

  async setPadrao(
    scope: { groupId: string; empresaId: string },
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const db = this.exec(executor);
    await db.query(
      `SELECT id FROM tabela_preco_empresas
       WHERE group_id=$1 AND empresa_id=$2 AND ativo=true
       FOR UPDATE`,
      [scope.groupId, scope.empresaId],
    );
    const link = await db.query(
      `SELECT id FROM tabela_preco_empresas
       WHERE group_id=$1 AND tabela_preco_id=$2 AND empresa_id=$3 AND ativo=true`,
      [scope.groupId, tabelaId, scope.empresaId],
    );
    if (!link.rows[0]) {
      const err = new Error('TABELA_PRECO_NOT_AUTHORIZED');
      (err as Error & { code?: string }).code = 'TABELA_PRECO_NOT_AUTHORIZED';
      throw err;
    }
    const tabela = await db.query(
      'SELECT id FROM tabelas_preco WHERE group_id=$1 AND id=$2 AND ativo=true',
      [scope.groupId, tabelaId],
    );
    if (!tabela.rows[0]) {
      const err = new Error('TABELA_PRECO_NOT_FOUND');
      (err as Error & { code?: string }).code = 'TABELA_PRECO_NOT_FOUND';
      throw err;
    }
    await db.query(
      `UPDATE tabela_preco_empresas
       SET eh_padrao=false, updated_by=$3
       WHERE group_id=$1 AND empresa_id=$2 AND eh_padrao=true AND ativo=true`,
      [scope.groupId, scope.empresaId, actorId ?? null],
    );
    await db.query(
      `UPDATE tabela_preco_empresas
       SET eh_padrao=true, updated_by=$4
       WHERE group_id=$1 AND tabela_preco_id=$2 AND empresa_id=$3 AND ativo=true`,
      [scope.groupId, tabelaId, scope.empresaId, actorId ?? null],
    );
    const row = await this.get({ groupId: scope.groupId }, tabelaId, executor);
    if (!row) throw new Error('TABELA_PRECO_NOT_FOUND');
    return row;
  }

  async unsetPadrao(
    scope: { groupId: string; empresaId: string },
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    await this.exec(executor).query(
      `UPDATE tabela_preco_empresas
       SET eh_padrao=false, updated_by=$4
       WHERE group_id=$1 AND tabela_preco_id=$2 AND empresa_id=$3 AND ativo=true`,
      [scope.groupId, tabelaId, scope.empresaId, actorId ?? null],
    );
    const row = await this.get({ groupId: scope.groupId }, tabelaId, executor);
    if (!row) throw new Error('TABELA_PRECO_NOT_FOUND');
    return row;
  }

  async listItens(filter: TabelaPrecoItemListFilter, executor?: DbQueryExecutor) {
    const params: unknown[] = [filter.groupId, filter.tabelaPrecoId];
    const where = ['group_id=$1', 'tabela_preco_id=$2'];
    if (typeof filter.ativo === 'boolean') {
      params.push(filter.ativo);
      where.push(`ativo=$${params.length}`);
    }
    const count = await this.exec(executor).query<{ total: number }>(
      `SELECT count(*)::int AS total FROM tabela_preco_itens WHERE ${where.join(' AND ')}`,
      params,
    );
    params.push(filter.limit, filter.offset);
    const page = await this.exec(executor).query(
      `SELECT * FROM tabela_preco_itens
       WHERE ${where.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: page.rows.map((row) => mapItem(row as Record<string, unknown>)),
      total: count.rows[0]?.total ?? 0,
    };
  }

  async getItem(scope: TabelaPrecoScope, tabelaId: string, itemId: string, executor?: DbQueryExecutor) {
    const result = await this.exec(executor).query(
      `SELECT * FROM tabela_preco_itens
       WHERE group_id=$1 AND tabela_preco_id=$2 AND id=$3`,
      [scope.groupId, tabelaId, itemId],
    );
    return result.rows[0] ? mapItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async createItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    data: TabelaPrecoItemCreate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `INSERT INTO tabela_preco_itens (
         group_id, tabela_preco_id, produto_id, unidade_medida_id, preco, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5::numeric,$6,$6)
       RETURNING *`,
      [scope.groupId, tabelaId, data.produto_id, data.unidade_medida_id, data.preco, actorId ?? null],
    );
    return mapItem(result.rows[0] as Record<string, unknown>);
  }

  async updateItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    itemId: string,
    data: TabelaPrecoItemUpdate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE tabela_preco_itens
       SET preco=$4::numeric, updated_by=$5
       WHERE group_id=$1 AND tabela_preco_id=$2 AND id=$3 AND ativo=true
       RETURNING *`,
      [scope.groupId, tabelaId, itemId, data.preco, actorId ?? null],
    );
    return result.rows[0] ? mapItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async softDeleteItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    itemId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE tabela_preco_itens
       SET ativo=false, updated_by=$4
       WHERE group_id=$1 AND tabela_preco_id=$2 AND id=$3 AND ativo=true
       RETURNING *`,
      [scope.groupId, tabelaId, itemId, actorId ?? null],
    );
    return result.rows[0] ? mapItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async restoreItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    itemId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE tabela_preco_itens
       SET ativo=true, updated_by=$4
       WHERE group_id=$1 AND tabela_preco_id=$2 AND id=$3 AND ativo=false
       RETURNING *`,
      [scope.groupId, tabelaId, itemId, actorId ?? null],
    );
    return result.rows[0] ? mapItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async countActiveClienteEmpresaRefs(groupId: string, tabelaId: string, executor?: DbQueryExecutor) {
    const result = await this.exec(executor).query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM cliente_empresas
       WHERE group_id=$1 AND tabela_preco_id=$2 AND ativo=true`,
      [groupId, tabelaId],
    );
    return result.rows[0]?.total ?? 0;
  }

  async hasActivePadrao(groupId: string, tabelaId: string, executor?: DbQueryExecutor) {
    const result = await this.exec(executor).query(
      `SELECT 1 FROM tabela_preco_empresas
       WHERE group_id=$1 AND tabela_preco_id=$2 AND ativo=true AND eh_padrao=true
       LIMIT 1`,
      [groupId, tabelaId],
    );
    return Boolean(result.rows[0]);
  }

  async isAuthorizedForEmpresa(
    groupId: string,
    tabelaId: string,
    empresaId: string,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `SELECT 1
       FROM tabelas_preco t
       JOIN tabela_preco_empresas te ON te.tabela_preco_id=t.id AND te.group_id=t.group_id
       WHERE t.group_id=$1 AND t.id=$2 AND t.ativo=true
         AND te.empresa_id=$3 AND te.ativo=true
       LIMIT 1`,
      [groupId, tabelaId, empresaId],
    );
    return Boolean(result.rows[0]);
  }

  async resolvePrice(input: {
    groupId: string;
    empresaId: string;
    clienteEmpresaTabelaId?: string | null;
    produtoId: string;
    unidadeMedidaId: string;
    businessDate: string;
  }, executor?: DbQueryExecutor): Promise<ResolvedPrice> {
    const db = this.exec(executor);
    const pick = async (tabelaId: string, origem: 'cliente_empresa' | 'padrao_empresa') => {
      const result = await db.query(
        `SELECT t.id, t.codigo, t.nome, i.id AS item_id, i.produto_id, i.unidade_medida_id, i.preco::text AS preco
         FROM tabelas_preco t
         JOIN tabela_preco_empresas te
           ON te.tabela_preco_id=t.id AND te.group_id=t.group_id
          AND te.empresa_id=$2 AND te.ativo=true
         JOIN tabela_preco_itens i
           ON i.tabela_preco_id=t.id AND i.group_id=t.group_id
          AND i.produto_id=$3 AND i.unidade_medida_id=$4 AND i.ativo=true
         WHERE t.group_id=$1 AND t.id=$5 AND t.ativo=true
           AND t.vigencia_inicio <= $6::date
           AND (t.vigencia_fim IS NULL OR t.vigencia_fim >= $6::date)
         LIMIT 1`,
        [
          input.groupId,
          input.empresaId,
          input.produtoId,
          input.unidadeMedidaId,
          tabelaId,
          input.businessDate,
        ],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        tabela_preco_id: String(row.id),
        tabela_preco_codigo: String(row.codigo),
        tabela_preco_nome: String(row.nome),
        origem_resolucao: origem,
        item_id: String(row.item_id),
        produto_id: String(row.produto_id),
        unidade_medida_id: String(row.unidade_medida_id),
        preco: String(row.preco),
        moeda: 'BRL' as const,
      };
    };

    if (input.clienteEmpresaTabelaId) {
      const specific = await pick(input.clienteEmpresaTabelaId, 'cliente_empresa');
      if (specific) return specific;
    }

    const padrao = await db.query<{ tabela_preco_id: string }>(
      `SELECT te.tabela_preco_id
       FROM tabela_preco_empresas te
       JOIN tabelas_preco t ON t.id=te.tabela_preco_id AND t.group_id=te.group_id
       WHERE te.group_id=$1 AND te.empresa_id=$2 AND te.ativo=true AND te.eh_padrao=true
         AND t.ativo=true
       LIMIT 1`,
      [input.groupId, input.empresaId],
    );
    if (padrao.rows[0]) {
      return pick(String(padrao.rows[0].tabela_preco_id), 'padrao_empresa');
    }
    return null;
  }

  async getProdutoUnidadeContext(
    groupId: string,
    produtoId: string,
    unidadeMedidaId: string,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `SELECT p.ativo AS produto_ativo,
              p.unidade_medida_id,
              p.unidades_secundarias,
              u.ativo AS unidade_ativo,
              u.sigla
       FROM produtos p
       JOIN unidades_medida u ON u.id=$3
       WHERE p.id=$2 AND p.group_id=$1 AND u.group_id=$1`,
      [groupId, produtoId, unidadeMedidaId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    let secundarias: string[] = [];
    const raw = row.unidades_secundarias;
    if (Array.isArray(raw)) secundarias = raw.map(String);
    else if (typeof raw === 'string') {
      try { secundarias = (JSON.parse(raw) as unknown[]).map(String); } catch { secundarias = []; }
    }
    return {
      produtoAtivo: Boolean(row.produto_ativo),
      unidadeAtivo: Boolean(row.unidade_ativo),
      unidadeSigla: String(row.sigla),
      unidadePrincipalId: row.unidade_medida_id == null ? null : String(row.unidade_medida_id),
      unidadesSecundarias: secundarias,
    };
  }
}
