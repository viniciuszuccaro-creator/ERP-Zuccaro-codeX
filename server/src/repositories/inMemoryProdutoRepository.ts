import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import type { ListOptions, Scope, TenantEntityRepository } from '../services/tenantCrudService.js';
import { produtoMidiaCreateSchema, type Produto, type ProdutoCreate, type ProdutoEquivalente, type ProdutoEquivalenteCreate, type ProdutoEquivalenteUpdate, type ProdutoMidia, type ProdutoMidiaCreate, type ProdutoUpdate, type ProdutoVariante, type ProdutoVarianteCreate, type ProdutoVarianteUpdate } from './produtoTypes.js';

function nowIso() { return new Date().toISOString(); }

export type ProdutoListFilter = Scope & ListOptions & {
  offset?: number;
  codigo?: string;
  codigoBarras?: string;
};

export type ProdutoReadOptions = {
  forUpdate?: boolean;
};

export interface ProdutoRepository extends TenantEntityRepository<Produto, ProdutoCreate, ProdutoUpdate> {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  listPage(filter: ProdutoListFilter, executor?: DbQueryExecutor): Promise<{ rows: Produto[]; total: number }>;
  getById(
    scope: Scope,
    id: string,
    executor?: DbQueryExecutor,
    options?: ProdutoReadOptions,
  ): Promise<Produto | null>;
  create(scope: Scope, data: ProdutoCreate, executor?: DbQueryExecutor): Promise<Produto>;
  update(scope: Scope, id: string, data: ProdutoUpdate, executor?: DbQueryExecutor): Promise<Produto | null>;
  softDelete(scope: Scope, id: string, executor?: DbQueryExecutor): Promise<Produto | null>;
  changeWorkflowStatus(
    scope: Scope,
    id: string,
    status: Produto['workflow_status'],
    executor?: DbQueryExecutor,
  ): Promise<Produto | null>;
  appendPublicationEvent(
    scope: Scope,
    produto: Produto,
    requestId: string,
    executor?: DbQueryExecutor,
  ): Promise<void>;
  listVariants(scope: Scope, produtoId: string, executor?: DbQueryExecutor): Promise<ProdutoVariante[]>;
  listEquivalents(scope: Scope, produtoId: string, executor?: DbQueryExecutor): Promise<ProdutoEquivalente[]>;
  createVariant(scope: Scope, produtoId: string, data: ProdutoVarianteCreate, executor?: DbQueryExecutor): Promise<ProdutoVariante>;
  updateVariant(scope: Scope, produtoId: string, variantId: string, data: ProdutoVarianteUpdate, executor?: DbQueryExecutor): Promise<ProdutoVariante | null>;
  deactivateVariant(scope: Scope, produtoId: string, variantId: string, executor?: DbQueryExecutor): Promise<ProdutoVariante | null>;
  createEquivalent(scope: Scope, produtoId: string, data: ProdutoEquivalenteCreate, executor?: DbQueryExecutor): Promise<ProdutoEquivalente>;
  updateEquivalent(scope: Scope, produtoId: string, equivalentId: string, data: ProdutoEquivalenteUpdate, executor?: DbQueryExecutor): Promise<ProdutoEquivalente | null>;
  deactivateEquivalent(scope: Scope, produtoId: string, equivalentId: string, executor?: DbQueryExecutor): Promise<ProdutoEquivalente | null>;
  listMidias(scope: Scope, produtoId: string, executor?: DbQueryExecutor): Promise<ProdutoMidia[]>;
  createMidia(scope: Scope, produtoId: string, data: ProdutoMidiaCreate, executor?: DbQueryExecutor): Promise<ProdutoMidia | null>;
  deactivateMidia(scope: Scope, produtoId: string, midiaId: string, executor?: DbQueryExecutor): Promise<ProdutoMidia | null>;
}

function buildProduto(scope: Scope, data: ProdutoCreate, id: string, ts: string): Produto {
  return {
    id,
    group_id: scope.groupId,
    empresa_id: data.empresa_id ?? scope.empresaId ?? null,
    codigo: data.codigo ?? null,
    codigo_barras: data.codigo_barras ?? null,
    descricao: data.descricao,
    nome: data.nome ?? data.descricao,
    tipo_item: data.tipo_item ?? 'Revenda',
    tipo_aco: data.tipo_aco ?? null,
    eh_bitola: data.eh_bitola ?? false,
    peso_teorico_kg_m: data.peso_teorico_kg_m ?? 0,
    bitola_diametro_mm: data.bitola_diametro_mm ?? 0,
    comprimento_barra_padrao_m: data.comprimento_barra_padrao_m ?? 12,
    unidade_medida_id: data.unidade_medida_id ?? null,
    unidade_medida: data.unidade_medida ?? data.unidade_principal ?? null,
    unidade_principal: data.unidade_principal ?? data.unidade_medida ?? null,
    unidades_secundarias: data.unidades_secundarias ?? [],
    fatores_conversao: data.fatores_conversao ?? {},
    grupo_produto_id: data.grupo_produto_id ?? null,
    grupo_legado: data.grupo_legado ?? null,
    marca_id: data.marca_id ?? null,
    setor_atividade_id: data.setor_atividade_id ?? null,
    peso_liquido_kg: data.peso_liquido_kg ?? 0,
    peso_bruto_kg: data.peso_bruto_kg ?? 0,
    altura_cm: data.altura_cm ?? 0,
    largura_cm: data.largura_cm ?? 0,
    comprimento_cm: data.comprimento_cm ?? 0,
    volume_m3: data.volume_m3 ?? 0,
    ncm: data.ncm ?? null,
    cest: data.cest ?? null,
    origem_mercadoria: data.origem_mercadoria ?? null,
    status: data.status ?? 'Ativo',
    foto_produto_url: data.foto_produto_url ?? null,
    ativo: data.ativo ?? true,
    descricao_tecnica: data.descricao_tecnica ?? null,
    descricao_comercial: data.descricao_comercial ?? null,
    titulo_seo: data.titulo_seo ?? null,
    descricao_seo: data.descricao_seo ?? null,
    embalagem_tipo: data.embalagem_tipo ?? null,
    multiplo_venda: data.multiplo_venda ?? 1,
    quantidade_minima_venda: data.quantidade_minima_venda ?? 0,
    permite_fracionamento: data.permite_fracionamento ?? false,
    workflow_status: 'RASCUNHO',
    created_at: ts,
    updated_at: ts,
  };
}

export class InMemoryProdutoRepository implements ProdutoRepository {
  private readonly rows = new Map<string, Produto>();
  private readonly variants = new Map<string, ProdutoVariante>();
  private readonly equivalents = new Map<string, ProdutoEquivalente>();
  private readonly midias = new Map<string, ProdutoMidia>();

  private readonly publicationEvents: Array<{ groupId: string; empresaId: string | null; produtoId: string; requestId: string }> = [];
  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const snapshot = structuredClone([...this.rows.entries()]);
    const eventsSnapshot = structuredClone(this.publicationEvents);
    const variantsSnapshot = structuredClone([...this.variants.entries()]);
    const equivalentsSnapshot = structuredClone([...this.equivalents.entries()]);
    const midiasSnapshot = structuredClone([...this.midias.entries()]);
    try {
      return await fn();
    } catch (error) {
      this.rows.clear();
      for (const [id, row] of snapshot) this.rows.set(id, row);
      this.publicationEvents.length = 0;
      this.variants.clear();
      for (const [id, row] of variantsSnapshot) this.variants.set(id, row);
      this.equivalents.clear();
      for (const [id, row] of equivalentsSnapshot) this.equivalents.set(id, row);
      this.midias.clear();
      for (const [id, row] of midiasSnapshot) this.midias.set(id, row);
      this.publicationEvents.push(...eventsSnapshot);
      throw error;
    }
  }

  seed(rows: Produto[]) {
    for (const row of rows) this.rows.set(row.id, row);
  }

  private matches(filter: ProdutoListFilter, r: Produto): boolean {
    if (r.group_id !== filter.groupId) return false;
    if (filter.empresaId && r.empresa_id !== filter.empresaId) return false;
    // Default operacional: ativo=true (paridade com Postgres). Combinado com group_id.
    const ativoFilter = typeof filter.ativo === 'boolean' ? filter.ativo : true;
    if (r.ativo !== ativoFilter) return false;
    if (filter.codigo && String(r.codigo || '').toLowerCase() !== filter.codigo.toLowerCase()) return false;
    if (filter.codigoBarras && String(r.codigo_barras || '').toLowerCase() !== filter.codigoBarras.toLowerCase()) {
      return false;
    }
    if (filter.search) {
      const hay = `${r.descricao} ${r.codigo || ''} ${r.nome || ''} ${r.codigo_barras || ''}`.toLowerCase();
      if (!hay.includes(filter.search.toLowerCase())) return false;
    }
    return true;
  }

  async list(filter: Scope & ListOptions): Promise<Produto[]> {
    const page = await this.listPage({ ...filter, offset: 0 });
    return page.rows;
  }

  async listPage(filter: ProdutoListFilter, _executor?: DbQueryExecutor): Promise<{ rows: Produto[]; total: number }> {
    const all = [...this.rows.values()].filter((r) => this.matches(filter, r));
    const total = all.length;
    const offset = Math.max(filter.offset ?? 0, 0);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    return { rows: all.slice(offset, offset + limit), total };
  }

  async getById(
    scope: Scope,
    id: string,
    _executor?: DbQueryExecutor,
    _options?: ProdutoReadOptions,
  ): Promise<Produto | null> {
    const row = this.rows.get(id);
    if (!row || row.group_id !== scope.groupId) return null;
    if (scope.empresaId && row.empresa_id !== scope.empresaId) return null;
    return row;
  }

  async create(scope: Scope, data: ProdutoCreate, _executor?: DbQueryExecutor): Promise<Produto> {
    const ts = nowIso();
    const row = buildProduto(scope, data, randomUUID(), ts);
    // conflict: codigo no mesmo grupo
    if (row.codigo) {
      const dup = [...this.rows.values()].find(
        (r) => r.group_id === scope.groupId && r.codigo && r.codigo.toLowerCase() === row.codigo!.toLowerCase(),
      );
      if (dup) throw new Error('unique constraint produtos codigo');
    }
    this.rows.set(row.id, row);
    return row;
  }

  async update(scope: Scope, id: string, data: ProdutoUpdate, _executor?: DbQueryExecutor): Promise<Produto | null> {
    const current = await this.getById(scope, id, _executor);
    if (!current) return null;
    const next: Produto = {
      ...current,
      ...data,
      empresa_id: data.empresa_id === undefined ? current.empresa_id : data.empresa_id,
      unidades_secundarias: data.unidades_secundarias === undefined
        ? current.unidades_secundarias
        : data.unidades_secundarias,
      fatores_conversao: data.fatores_conversao === undefined
        ? current.fatores_conversao
        : data.fatores_conversao,
      updated_at: nowIso(),
    };
    if (next.codigo) {
      const dup = [...this.rows.values()].find(
        (r) => r.id !== id && r.group_id === scope.groupId
          && r.codigo && r.codigo.toLowerCase() === next.codigo!.toLowerCase(),
      );
      if (dup) throw new Error('unique constraint produtos codigo');
    }
    this.rows.set(id, next);
    return next;
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
    const current = await this.getById(scope, id, executor);
    if (!current) return null;
    const next = { ...current, workflow_status: status, updated_at: nowIso() };
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async appendPublicationEvent(
    scope: Scope,
    produto: Produto,
    requestId: string,
    _executor?: DbQueryExecutor,
  ): Promise<void> {
    if (produto.group_id !== scope.groupId || (scope.empresaId && produto.empresa_id !== scope.empresaId)) {
      throw new Error('TENANT_FK_MISMATCH');
    }
    this.publicationEvents.push({ groupId: scope.groupId, empresaId: produto.empresa_id, produtoId: produto.id, requestId });
  }
  async listVariants(scope: Scope, produtoId: string): Promise<ProdutoVariante[]> {
    return structuredClone([...this.variants.values()].filter((row) => row.ativo && row.group_id === scope.groupId
      && row.produto_id === produtoId && (!scope.empresaId || row.empresa_id === scope.empresaId))
      .sort((a, b) => a.sku.localeCompare(b.sku) || a.id.localeCompare(b.id)));
  }

  async createVariant(scope: Scope, produtoId: string, data: ProdutoVarianteCreate): Promise<ProdutoVariante> {
    if ([...this.variants.values()].some((row) => row.group_id === scope.groupId && row.sku.toLowerCase() === data.sku.toLowerCase())) {
      throw new Error('unique constraint produto_variantes sku');
    }
    const row: ProdutoVariante = { id: randomUUID(), group_id: scope.groupId, empresa_id: scope.empresaId ?? null,
      produto_id: produtoId, sku: data.sku, nome: data.nome ?? null, atributos: data.atributos, ativo: true };
    this.variants.set(row.id, structuredClone(row));
    return structuredClone(row);
  }

  async updateVariant(scope: Scope, produtoId: string, variantId: string, data: ProdutoVarianteUpdate): Promise<ProdutoVariante | null> {
    const current = this.variants.get(variantId);
    if (!current || !current.ativo || current.group_id !== scope.groupId || current.produto_id !== produtoId
      || (scope.empresaId && current.empresa_id !== scope.empresaId)) return null;
    if (data.sku && [...this.variants.values()].some((row) => row.id !== variantId
      && row.group_id === scope.groupId && row.sku.toLowerCase() === data.sku!.toLowerCase())) {
      throw new Error('unique constraint produto_variantes sku');
    }
    const next = { ...current, ...data };
    this.variants.set(variantId, structuredClone(next));
    return structuredClone(next);
  }

  async deactivateVariant(scope: Scope, produtoId: string, variantId: string): Promise<ProdutoVariante | null> {
    const current = await this.updateVariant(scope, produtoId, variantId, { });
    if (!current || !current.ativo) return null;
    const next = { ...current, ativo: false };
    this.variants.set(variantId, next);
    return structuredClone(next);

  }
  async listEquivalents(scope: Scope, produtoId: string): Promise<ProdutoEquivalente[]> {
    return structuredClone([...this.equivalents.values()].filter((row) => row.ativo && row.group_id === scope.groupId
      && row.produto_id === produtoId && (!scope.empresaId || row.empresa_id === scope.empresaId))
      .sort((a, b) => a.tipo.localeCompare(b.tipo)
        || a.produto_equivalente_id.localeCompare(b.produto_equivalente_id) || a.id.localeCompare(b.id)));
  }

  async createEquivalent(scope: Scope, produtoId: string, data: ProdutoEquivalenteCreate): Promise<ProdutoEquivalente> {
    if ([...this.equivalents.values()].some((row) => row.group_id === scope.groupId
      && row.produto_id === produtoId && row.produto_equivalente_id === data.produto_equivalente_id
      && row.tipo === data.tipo)) throw new Error('unique constraint produto_equivalentes');

    if (produtoId === data.produto_equivalente_id) throw new Error('check constraint produto equivalente self');
    const row: ProdutoEquivalente = { id: randomUUID(), group_id: scope.groupId, empresa_id: scope.empresaId ?? null,
      produto_id: produtoId, produto_equivalente_id: data.produto_equivalente_id, tipo: data.tipo,
      direcional: data.direcional, aprovado: data.aprovado, ativo: true };
    this.equivalents.set(row.id, structuredClone(row));
    return structuredClone(row);
  }

  async updateEquivalent(scope: Scope, produtoId: string, equivalentId: string, data: ProdutoEquivalenteUpdate): Promise<ProdutoEquivalente | null> {
    const current = this.equivalents.get(equivalentId);
    if (!current || !current.ativo || current.group_id !== scope.groupId || current.produto_id !== produtoId
      || (scope.empresaId && current.empresa_id !== scope.empresaId)) return null;
    if ([...this.equivalents.values()].some((row) => row.id !== equivalentId
      && row.group_id === scope.groupId && row.produto_id === produtoId
      && row.produto_equivalente_id === current.produto_equivalente_id && row.tipo === (data.tipo ?? current.tipo))) {
      throw new Error('unique constraint produto_equivalentes');
    }
    const next = { ...current, ...data };
    this.equivalents.set(equivalentId, structuredClone(next));
    return structuredClone(next);
  }

  async deactivateEquivalent(scope: Scope, produtoId: string, equivalentId: string): Promise<ProdutoEquivalente | null> {
    const current = this.equivalents.get(equivalentId);
    if (!current || !current.ativo || current.group_id !== scope.groupId || current.produto_id !== produtoId
      || (scope.empresaId && current.empresa_id !== scope.empresaId)) return null;
    const next = { ...current, ativo: false };
    this.equivalents.set(equivalentId, next);
    return structuredClone(next);
  }

  async listMidias(scope: Scope, produtoId: string): Promise<ProdutoMidia[]> {
    return structuredClone([...this.midias.values()].filter((row) => row.ativo && row.group_id === scope.groupId
      && row.produto_id === produtoId && (!scope.empresaId || row.empresa_id === scope.empresaId))
      .sort((a, b) => a.versao - b.versao || a.id.localeCompare(b.id)));
  }

  async createMidia(scope: Scope, produtoId: string, data: ProdutoMidiaCreate): Promise<ProdutoMidia | null> {
    const produto = await this.getById(scope, produtoId);
    if (!produto || !produto.ativo || !scope.empresaId || produto.empresa_id !== scope.empresaId) return null;
    const parsed = produtoMidiaCreateSchema.parse(data);
    const prefix = `groups/${scope.groupId}/companies/${scope.empresaId}/products/${produtoId}/`;
    if (!parsed.storage_key.startsWith(prefix)) throw new Error('TENANT_FK_MISMATCH');
    if ([...this.midias.values()].some((row) => row.group_id === scope.groupId
      && row.storage_key === parsed.storage_key)) {
      throw new Error('unique constraint produto_midias storage_key');
    }
    const row: ProdutoMidia = {
      id: randomUUID(), group_id: scope.groupId, empresa_id: scope.empresaId, produto_id: produtoId,
      ...parsed, status: 'QUARENTENA', principal: false, ativo: true,
    };
    this.midias.set(row.id, structuredClone(row));
    return structuredClone(row);
  }

  async deactivateMidia(scope: Scope, produtoId: string, midiaId: string): Promise<ProdutoMidia | null> {
    const current = this.midias.get(midiaId);
    if (!current || !current.ativo || current.group_id !== scope.groupId || current.produto_id !== produtoId
      || !scope.empresaId || current.empresa_id !== scope.empresaId) return null;
    const next: ProdutoMidia = { ...current, ativo: false, status: 'INATIVO', principal: false };
    this.midias.set(midiaId, structuredClone(next));
    return structuredClone(next);
  }


  listPublicationEvents() {
    return structuredClone(this.publicationEvents);
  }
}

export function createInMemoryProdutoRepo() {
  return new InMemoryProdutoRepository();
}
