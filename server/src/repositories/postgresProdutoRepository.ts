import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { ListOptions, Scope } from '../services/tenantCrudService.js';
import { produtoMidiaCreateSchema } from './produtoTypes.js';
import type { Produto, ProdutoCreate, ProdutoEquivalente, ProdutoEquivalenteCreate, ProdutoEquivalenteUpdate, ProdutoMidia, ProdutoMidiaCreate, ProdutoMidiaUploadAttempt, ProdutoUpdate, ProdutoVariante, ProdutoVarianteCreate, ProdutoVarianteUpdate } from './produtoTypes.js';
import type { ProdutoListFilter, ProdutoReadOptions, ProdutoRepository } from './inMemoryProdutoRepository.js';

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
    descricao_tecnica: row.descricao_tecnica == null ? null : String(row.descricao_tecnica),
    descricao_comercial: row.descricao_comercial == null ? null : String(row.descricao_comercial),
    titulo_seo: row.titulo_seo == null ? null : String(row.titulo_seo),
    descricao_seo: row.descricao_seo == null ? null : String(row.descricao_seo),
    embalagem_tipo: row.embalagem_tipo == null ? null : String(row.embalagem_tipo),
    multiplo_venda: Number(row.multiplo_venda ?? 1),
    quantidade_minima_venda: Number(row.quantidade_minima_venda ?? 0),
    permite_fracionamento: Boolean(row.permite_fracionamento),
    workflow_status: String(row.workflow_status ?? 'RASCUNHO') as Produto['workflow_status'],
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


  async getById(
    scope: Scope,
    id: string,
    executor?: DbQueryExecutor,
    options?: ProdutoReadOptions,
  ): Promise<Produto | null> {
    const query = executor ?? this.db;
    const params: unknown[] = [scope.groupId, id];
    let sql = 'SELECT * FROM produtos WHERE group_id = $1 AND id = $2';
    if (scope.empresaId) {
      params.push(scope.empresaId);
      sql += ' AND empresa_id = $3';
    }
    if (options?.forUpdate) {
      if (!executor) throw new Error('PRODUTO_FOR_UPDATE_REQUIRES_TRANSACTION');
      sql += ' FOR UPDATE';
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
        ncm, cest, origem_mercadoria, status, foto_produto_url, ativo,
        descricao_tecnica, descricao_comercial, titulo_seo, descricao_seo,
        embalagem_tipo, multiplo_venda, quantidade_minima_venda, permite_fracionamento
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
        $34,$35,$36,$37,$38,$39,$40,$41
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
        data.descricao_tecnica ?? null,
        data.descricao_comercial ?? null,
        data.titulo_seo ?? null,
        data.descricao_seo ?? null,
        data.embalagem_tipo ?? null,
        data.multiplo_venda ?? 1,
        data.quantidade_minima_venda ?? 0,
        data.permite_fracionamento ?? false,
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
      next.descricao_tecnica, next.descricao_comercial, next.titulo_seo, next.descricao_seo,
      next.embalagem_tipo, next.multiplo_venda, next.quantidade_minima_venda, next.permite_fracionamento,
      scope.groupId, id,
    ];
    let sql = `UPDATE produtos SET
      codigo=$1, codigo_barras=$2, descricao=$3, nome=$4, tipo_item=$5, tipo_aco=$6, eh_bitola=$7,
      peso_teorico_kg_m=$8, bitola_diametro_mm=$9, comprimento_barra_padrao_m=$10,
      unidade_medida_id=$11, unidade_medida=$12, unidade_principal=$13,
      unidades_secundarias=$14::jsonb, fatores_conversao=$15::jsonb,
      grupo_produto_id=$16, grupo_legado=$17, marca_id=$18, setor_atividade_id=$19,
      peso_liquido_kg=$20, peso_bruto_kg=$21, altura_cm=$22, largura_cm=$23, comprimento_cm=$24, volume_m3=$25,
      ncm=$26, cest=$27, origem_mercadoria=$28, status=$29, foto_produto_url=$30, ativo=$31, empresa_id=$32,
      descricao_tecnica=$33, descricao_comercial=$34, titulo_seo=$35, descricao_seo=$36,
      embalagem_tipo=$37, multiplo_venda=$38, quantidade_minima_venda=$39, permite_fracionamento=$40
      WHERE group_id=$41 AND id=$42`;
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

  async changeWorkflowStatus(
    scope: Scope,
    id: string,
    status: Produto['workflow_status'],
    executor?: DbQueryExecutor,
  ): Promise<Produto | null> {
    const query = executor ?? this.db;
    const params: unknown[] = [status, scope.groupId, id];
    let sql = `UPDATE produtos
      SET workflow_status=$1, updated_at=timezone('utc', now())
      WHERE group_id=$2 AND id=$3`;
    if (scope.empresaId) {
      params.push(scope.empresaId);
      sql += ` AND empresa_id=$${params.length}`;
    }
    sql += ' RETURNING *';
    const result = await query.query(sql, params);
    return result.rows[0] ? mapProduto(result.rows[0] as Record<string, unknown>) : null;
  }

  async appendPublicationEvent(
    scope: Scope,
    produto: Produto,
    requestId: string,
    executor?: DbQueryExecutor,
  ): Promise<void> {
    const query = executor ?? this.db;
    const payload = {
      produtoId: produto.id,
      codigo: produto.codigo,
      workflowStatus: produto.workflow_status,
      schemaVersion: 1,
    };
    await query.query(
      `INSERT INTO integration_events (
        group_id, empresa_id, source, event_type, idempotency_key, payload, status,
        schema_version, aggregate_type, aggregate_id, correlation_id, payload_checksum
      ) VALUES (
        $1,$2,'ERP','produto.publicado',$3,$4::jsonb,'pending',1,'Produto',$5,$6,
        encode(digest(convert_to($4, 'UTF8'), 'sha256'), 'hex')
      ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [
        scope.groupId,
        produto.empresa_id ?? scope.empresaId ?? null,
        `produto-publicado:${scope.groupId}:${produto.id}:${requestId}`,
        JSON.stringify(payload),
        produto.id,
        requestId,
      ],
    );
  }
  async listVariants(scope: Scope, produtoId: string, executor?: DbQueryExecutor): Promise<ProdutoVariante[]> {
    const q = executor ?? this.db; const params: unknown[] = [scope.groupId, produtoId];
    let sql = 'SELECT id,group_id,empresa_id,produto_id,sku,nome,atributos,ativo FROM produto_variantes WHERE group_id=$1 AND produto_id=$2 AND ativo=true';
    if (scope.empresaId) { params.push(scope.empresaId); sql += ` AND empresa_id=$${params.length}`; }
    sql += ' ORDER BY sku ASC,id ASC';
    return (await q.query(sql, params)).rows as ProdutoVariante[];
  }

  async listEquivalents(scope: Scope, produtoId: string, executor?: DbQueryExecutor): Promise<ProdutoEquivalente[]> {
    const q = executor ?? this.db; const params: unknown[] = [scope.groupId, produtoId];
    let sql = 'SELECT id,group_id,empresa_id,produto_id,produto_equivalente_id,tipo,direcional,aprovado,ativo FROM produto_equivalentes WHERE group_id=$1 AND produto_id=$2 AND ativo=true';
    if (scope.empresaId) { params.push(scope.empresaId); sql += ` AND empresa_id=$${params.length}`; }
    sql += ' ORDER BY tipo ASC,produto_equivalente_id ASC,id ASC';
    return (await q.query(sql, params)).rows as ProdutoEquivalente[];
  }


  async createVariant(scope: Scope, produtoId: string, data: ProdutoVarianteCreate, executor: DbQueryExecutor): Promise<ProdutoVariante> {
    const result = await executor.query(
      `INSERT INTO produto_variantes (group_id,empresa_id,produto_id,sku,nome,atributos)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,group_id,empresa_id,produto_id,sku,nome,atributos,ativo`,
      [scope.groupId, scope.empresaId ?? null, produtoId, data.sku, data.nome ?? null, JSON.stringify(data.atributos)],
    );
    return result.rows[0] as ProdutoVariante;
  }

  async updateVariant(scope: Scope, produtoId: string, variantId: string, data: ProdutoVarianteUpdate, executor: DbQueryExecutor): Promise<ProdutoVariante | null> {
    const current = await executor.query<ProdutoVariante>(
      `SELECT id,group_id,empresa_id,produto_id,sku,nome,atributos,ativo FROM produto_variantes
       WHERE id=$1 AND group_id=$2 AND produto_id=$3 AND ($4::uuid IS NULL OR empresa_id=$4) AND ativo=true FOR UPDATE`,
      [variantId, scope.groupId, produtoId, scope.empresaId ?? null],
    );
    if (!current.rows[0]) return null;
    const next = { ...current.rows[0], ...data };
    const result = await executor.query(
      `UPDATE produto_variantes SET sku=$1,nome=$2,atributos=$3::jsonb,updated_at=timezone('utc',now())
       WHERE id=$4 AND group_id=$5 AND produto_id=$6 AND empresa_id IS NOT DISTINCT FROM $7::uuid AND ativo=true RETURNING id,group_id,empresa_id,produto_id,sku,nome,atributos,ativo`,
      [next.sku, next.nome, JSON.stringify(next.atributos), variantId, scope.groupId, produtoId, scope.empresaId ?? null],
    );
    return (result.rows[0] as ProdutoVariante | undefined) ?? null;
  }

  async deactivateVariant(scope: Scope, produtoId: string, variantId: string, executor: DbQueryExecutor): Promise<ProdutoVariante | null> {
    const params: unknown[] = [variantId, scope.groupId, produtoId];
    let sql = `UPDATE produto_variantes SET ativo=false,updated_at=timezone('utc',now()) WHERE id=$1 AND group_id=$2 AND produto_id=$3 AND ativo=true`;
    if (scope.empresaId) { params.push(scope.empresaId); sql += ` AND empresa_id=$${params.length}`; }
    sql += ' RETURNING id,group_id,empresa_id,produto_id,sku,nome,atributos,ativo';
    const result = await executor.query(sql, params);
    return (result.rows[0] as ProdutoVariante | undefined) ?? null;
  }

  async createEquivalent(scope: Scope, produtoId: string, data: ProdutoEquivalenteCreate, executor: DbQueryExecutor): Promise<ProdutoEquivalente> {
    const result = await executor.query(
      `INSERT INTO produto_equivalentes (group_id,empresa_id,produto_id,produto_equivalente_id,tipo,direcional,aprovado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,group_id,empresa_id,produto_id,produto_equivalente_id,tipo,direcional,aprovado,ativo`,
      [scope.groupId, scope.empresaId ?? null, produtoId, data.produto_equivalente_id, data.tipo, data.direcional, data.aprovado],
    );
    return result.rows[0] as ProdutoEquivalente;
  }

  async updateEquivalent(scope: Scope, produtoId: string, equivalentId: string, data: ProdutoEquivalenteUpdate, executor: DbQueryExecutor): Promise<ProdutoEquivalente | null> {
    const current = await executor.query<ProdutoEquivalente>(
      `SELECT id,group_id,empresa_id,produto_id,produto_equivalente_id,tipo,direcional,aprovado,ativo FROM produto_equivalentes
       WHERE id=$1 AND group_id=$2 AND produto_id=$3 AND ($4::uuid IS NULL OR empresa_id=$4) AND ativo=true FOR UPDATE`,
      [equivalentId, scope.groupId, produtoId, scope.empresaId ?? null],
    );
    if (!current.rows[0]) return null;
    const next = { ...current.rows[0], ...data };
    const result = await executor.query(
      `UPDATE produto_equivalentes SET tipo=$1,direcional=$2,aprovado=$3,updated_at=timezone('utc',now())
       WHERE id=$4 AND group_id=$5 AND produto_id=$6 AND empresa_id IS NOT DISTINCT FROM $7::uuid AND ativo=true RETURNING id,group_id,empresa_id,produto_id,produto_equivalente_id,tipo,direcional,aprovado,ativo`,
      [next.tipo, next.direcional, next.aprovado, equivalentId, scope.groupId, produtoId, scope.empresaId ?? null],
    );
    return (result.rows[0] as ProdutoEquivalente | undefined) ?? null;
  }

  async deactivateEquivalent(scope: Scope, produtoId: string, equivalentId: string, executor: DbQueryExecutor): Promise<ProdutoEquivalente | null> {
    const result = await executor.query(`UPDATE produto_equivalentes SET ativo=false,updated_at=timezone('utc',now())
      WHERE id=$1 AND group_id=$2 AND produto_id=$3 AND ($4::uuid IS NULL OR empresa_id=$4) AND ativo=true
      RETURNING id,group_id,empresa_id,produto_id,produto_equivalente_id,tipo,direcional,aprovado,ativo`,
      [equivalentId, scope.groupId, produtoId, scope.empresaId ?? null]);
    return (result.rows[0] as ProdutoEquivalente | undefined) ?? null;
  }

  async listMidias(scope: Scope, produtoId: string, executor?: DbQueryExecutor): Promise<ProdutoMidia[]> {
    const params: unknown[] = [scope.groupId, produtoId];
    let sql = `SELECT id,group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,
      tamanho_bytes,sha256,versao,status,principal,ativo FROM produto_midias
      WHERE group_id=$1 AND produto_id=$2 AND ativo=true AND status<>'PENDENTE_UPLOAD'`;
    if (scope.empresaId) { params.push(scope.empresaId); sql += ` AND empresa_id=$${params.length}`; }
    sql += ' ORDER BY versao ASC,id ASC';
    const result = await (executor ?? this.db).query(sql, params);
    return result.rows.map((row) => ({ ...row, tamanho_bytes: Number(row.tamanho_bytes) }) as ProdutoMidia);
  }

  async createMidia(scope: Scope, produtoId: string, data: ProdutoMidiaCreate, executor?: DbQueryExecutor): Promise<ProdutoMidia | null> {
    if (!scope.empresaId) return null;
    if (!executor) throw new Error('MEDIA_TRANSACTION_REQUIRED');
    const parsed = produtoMidiaCreateSchema.parse(data);
    const prefix = `groups/${scope.groupId}/companies/${scope.empresaId}/products/${produtoId}/`;
    if (!parsed.storage_key.startsWith(prefix)) throw new Error('TENANT_FK_MISMATCH');
    const result = await executor.query(
      `INSERT INTO produto_midias (group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,
        mime_type,tamanho_bytes,sha256,versao)
       SELECT $1,$2,p.id,$4,$5,$6,$7,$8,$9,$10 FROM produtos p
       WHERE p.id=$3 AND p.group_id=$1 AND p.empresa_id IS NOT DISTINCT FROM $2::uuid AND p.ativo=true
       RETURNING id,group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,
         tamanho_bytes,sha256,versao,status,principal,ativo`,
      [scope.groupId, scope.empresaId, produtoId, parsed.storage_key, parsed.categoria,
        parsed.nome_arquivo, parsed.mime_type, parsed.tamanho_bytes, parsed.sha256, parsed.versao],
    );
    return result.rows[0] ? { ...result.rows[0], tamanho_bytes: Number(result.rows[0].tamanho_bytes) } as ProdutoMidia : null;
  }
  async reserveMidia(scope: Scope, produtoId: string, data: ProdutoMidiaCreate, attempt: ProdutoMidiaUploadAttempt, executor?: DbQueryExecutor): Promise<ProdutoMidia | null> {
    if (!scope.empresaId) return null;
    if (!executor) throw new Error('MEDIA_TRANSACTION_REQUIRED');
    const parsed = produtoMidiaCreateSchema.parse(data);
    const prefix = `groups/${scope.groupId}/companies/${scope.empresaId}/products/${produtoId}/`;
    if (!parsed.storage_key.startsWith(prefix)) throw new Error('TENANT_FK_MISMATCH');
    if (!attempt.id || !attempt.actorId || !attempt.requestId || !Number.isFinite(Date.parse(attempt.expiresAt))
      || Date.parse(attempt.expiresAt) <= Date.now()) throw new Error('MEDIA_ATTEMPT_INVALID');
    const result = await executor.query(
      `INSERT INTO produto_midias (group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,
        mime_type,tamanho_bytes,sha256,versao,status,upload_attempt_id,upload_actor_id,upload_request_id,upload_expires_at)
       SELECT $1,$2,p.id,$4,$5,$6,$7,$8,$9,$10,'PENDENTE_UPLOAD',$11,$12,$13,$14
       FROM produtos p WHERE p.id=$3 AND p.group_id=$1 AND p.empresa_id IS NOT DISTINCT FROM $2::uuid AND p.ativo=true
       RETURNING id,group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,
         tamanho_bytes,sha256,versao,status,principal,ativo,upload_attempt_id,upload_actor_id,upload_request_id,upload_expires_at`,
      [scope.groupId, scope.empresaId, produtoId, parsed.storage_key, parsed.categoria,
        parsed.nome_arquivo, parsed.mime_type, parsed.tamanho_bytes, parsed.sha256, parsed.versao,
        attempt.id, attempt.actorId, attempt.requestId, attempt.expiresAt],
    );
    return result.rows[0] ? { ...result.rows[0], tamanho_bytes: Number(result.rows[0].tamanho_bytes) } as ProdutoMidia : null;
  }

  async getReservedMidia(scope: Scope, produtoId: string, midiaId: string, attemptId: string, actorId: string, executor?: DbQueryExecutor): Promise<ProdutoMidia | null> {
    if (!scope.empresaId) return null;
    if (!executor) throw new Error('MEDIA_TRANSACTION_REQUIRED');
    const result = await executor.query(
      `SELECT id,group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,
         tamanho_bytes,sha256,versao,status,principal,ativo,upload_attempt_id,upload_actor_id,upload_request_id,upload_expires_at
       FROM produto_midias WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND produto_id=$4
         AND upload_attempt_id=$5 AND upload_actor_id=$6 AND status='PENDENTE_UPLOAD' AND ativo=true FOR UPDATE`,
      [midiaId, scope.groupId, scope.empresaId, produtoId, attemptId, actorId],
    );
    return result.rows[0] ? { ...result.rows[0], tamanho_bytes: Number(result.rows[0].tamanho_bytes) } as ProdutoMidia : null;
  }

  async confirmReservedMidia(scope: Scope, produtoId: string, midiaId: string, attemptId: string, actorId: string, executor?: DbQueryExecutor): Promise<ProdutoMidia | null> {
    if (!scope.empresaId) return null;
    if (!executor) throw new Error('MEDIA_TRANSACTION_REQUIRED');
    const result = await executor.query(
      `UPDATE produto_midias SET status='QUARENTENA',updated_at=timezone('utc',now())
       WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND produto_id=$4
         AND upload_attempt_id=$5 AND upload_actor_id=$6 AND status='PENDENTE_UPLOAD'
         AND ativo=true AND upload_expires_at>now()
       RETURNING id,group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,
         tamanho_bytes,sha256,versao,status,principal,ativo,upload_attempt_id,upload_actor_id,upload_request_id,upload_expires_at`,
      [midiaId, scope.groupId, scope.empresaId, produtoId, attemptId, actorId],
    );
    return result.rows[0] ? { ...result.rows[0], tamanho_bytes: Number(result.rows[0].tamanho_bytes) } as ProdutoMidia : null;
  }


  async deactivateMidia(scope: Scope, produtoId: string, midiaId: string, executor?: DbQueryExecutor): Promise<ProdutoMidia | null> {
    if (!scope.empresaId) return null;
    if (!executor) throw new Error('MEDIA_TRANSACTION_REQUIRED');
    const result = await executor.query(
      `UPDATE produto_midias SET ativo=false,status='INATIVO',principal=false,updated_at=timezone('utc',now())
       WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND produto_id=$4 AND ativo=true
       RETURNING id,group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,
         tamanho_bytes,sha256,versao,status,principal,ativo`,
      [midiaId, scope.groupId, scope.empresaId, produtoId],
    );
    return result.rows[0] ? { ...result.rows[0], tamanho_bytes: Number(result.rows[0].tamanho_bytes) } as ProdutoMidia : null;
  }
}
