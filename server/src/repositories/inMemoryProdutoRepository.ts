import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import type { ListOptions, Scope, TenantEntityRepository } from '../services/tenantCrudService.js';
import type { Produto, ProdutoCreate, ProdutoUpdate } from './produtoTypes.js';

function nowIso() { return new Date().toISOString(); }

export type ProdutoListFilter = Scope & ListOptions & {
  offset?: number;
  codigo?: string;
  codigoBarras?: string;
};

export interface ProdutoRepository extends TenantEntityRepository<Produto, ProdutoCreate, ProdutoUpdate> {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  listPage(filter: ProdutoListFilter, executor?: DbQueryExecutor): Promise<{ rows: Produto[]; total: number }>;
  getById(scope: Scope, id: string, executor?: DbQueryExecutor): Promise<Produto | null>;
  create(scope: Scope, data: ProdutoCreate, executor?: DbQueryExecutor): Promise<Produto>;
  update(scope: Scope, id: string, data: ProdutoUpdate, executor?: DbQueryExecutor): Promise<Produto | null>;
  softDelete(scope: Scope, id: string, executor?: DbQueryExecutor): Promise<Produto | null>;
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
    created_at: ts,
    updated_at: ts,
  };
}

export class InMemoryProdutoRepository implements ProdutoRepository {
  private readonly rows = new Map<string, Produto>();

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const snapshot = structuredClone([...this.rows.entries()]);
    try {
      return await fn();
    } catch (error) {
      this.rows.clear();
      for (const [id, row] of snapshot) this.rows.set(id, row);
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

  async getById(scope: Scope, id: string, _executor?: DbQueryExecutor): Promise<Produto | null> {
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
    const current = await this.getById(scope, id);
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
}

export function createInMemoryProdutoRepo() {
  return new InMemoryProdutoRepository();
}
