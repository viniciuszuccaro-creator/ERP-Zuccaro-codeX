import { randomUUID } from 'node:crypto';
import type { ListOptions, Scope, TenantEntityRepository } from '../services/tenantCrudService.js';
import type {
  GrupoProduto, GrupoProdutoCreate, GrupoProdutoUpdate,
  Produto, ProdutoCreate, ProdutoUpdate,
  SetorAtividade, SetorCreate, SetorUpdate,
  UnidadeCreate, UnidadeMedida, UnidadeUpdate,
} from './cadastroTypes.js';

function nowIso() { return new Date().toISOString(); }

class MemRepo<TRow extends { id: string; group_id: string; empresa_id: string | null; ativo: boolean }, TCreate extends { empresa_id?: string | null; ativo?: boolean }, TUpdate>
  implements TenantEntityRepository<TRow, TCreate, TUpdate> {
  private readonly rows = new Map<string, TRow>();
  constructor(
    private readonly build: (scope: Scope, data: TCreate, id: string, ts: string) => TRow,
    private readonly merge: (current: TRow, data: TUpdate) => TRow,
    private readonly searchText: (row: TRow) => string,
  ) {}
  seed(rows: TRow[]) { for (const row of rows) this.rows.set(row.id, row); }
  async list(filter: Scope & ListOptions): Promise<TRow[]> {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    return [...this.rows.values()]
      .filter((r) => r.group_id === filter.groupId)
      .filter((r) => (filter.empresaId ? r.empresa_id === filter.empresaId : true))
      .filter((r) => (typeof filter.ativo === 'boolean' ? r.ativo === filter.ativo : true))
      .filter((r) => (filter.search ? this.searchText(r).toLowerCase().includes(filter.search.toLowerCase()) : true))
      .slice(0, limit);
  }
  async getById(scope: Scope, id: string): Promise<TRow | null> {
    const row = this.rows.get(id);
    if (!row || row.group_id !== scope.groupId) return null;
    if (scope.empresaId && row.empresa_id !== scope.empresaId) return null;
    return row;
  }
  async create(scope: Scope, data: TCreate): Promise<TRow> {
    const ts = nowIso();
    const row = this.build(scope, data, randomUUID(), ts);
    this.rows.set(row.id, row);
    return row;
  }
  async update(scope: Scope, id: string, data: TUpdate): Promise<TRow | null> {
    const current = await this.getById(scope, id);
    if (!current) return null;
    const next = this.merge(current, data);
    this.rows.set(id, next);
    return next;
  }
  async softDelete(scope: Scope, id: string): Promise<TRow | null> {
    return this.update(scope, id, { ativo: false } as TUpdate);
  }
}

export function createInMemoryUnidadeRepo() {
  return new MemRepo<UnidadeMedida, UnidadeCreate, UnidadeUpdate>(
    (scope, data, id, ts) => ({
      id, group_id: scope.groupId, empresa_id: data.empresa_id ?? scope.empresaId ?? null,
      sigla: data.sigla, nome_completo: data.nome_completo, tipo_grandeza: data.tipo_grandeza ?? 'Unidade',
      unidade_base_conversao: data.unidade_base_conversao ?? null,
      fator_conversao_para_base: data.fator_conversao_para_base ?? 1,
      permite_conversao: data.permite_conversao ?? true, usa_em_estoque: data.usa_em_estoque ?? true,
      usa_em_compras: data.usa_em_compras ?? true, usa_em_vendas: data.usa_em_vendas ?? true,
      ativo: data.ativo ?? true, created_at: ts, updated_at: ts,
    }),
    (c, d) => ({ ...c, ...d, empresa_id: d.empresa_id === undefined ? c.empresa_id : d.empresa_id, updated_at: nowIso() }),
    (r) => `${r.sigla} ${r.nome_completo}`,
  );
}

export function createInMemoryGrupoProdutoRepo() {
  return new MemRepo<GrupoProduto, GrupoProdutoCreate, GrupoProdutoUpdate>(
    (scope, data, id, ts) => ({
      id, group_id: scope.groupId, empresa_id: data.empresa_id ?? scope.empresaId ?? null,
      nome_grupo: data.nome_grupo, codigo: data.codigo ?? null, natureza: data.natureza ?? 'Revenda',
      ncm_padrao: data.ncm_padrao ?? null, margem_sugerida: data.margem_sugerida ?? 0,
      icone: data.icone ?? null, cor: data.cor ?? null, observacoes: data.observacoes ?? null,
      ativo: data.ativo ?? true, created_at: ts, updated_at: ts,
    }),
    (c, d) => ({ ...c, ...d, empresa_id: d.empresa_id === undefined ? c.empresa_id : d.empresa_id, updated_at: nowIso() }),
    (r) => `${r.nome_grupo} ${r.codigo || ''}`,
  );
}

export function createInMemorySetorRepo() {
  return new MemRepo<SetorAtividade, SetorCreate, SetorUpdate>(
    (scope, data, id, ts) => ({
      id, group_id: scope.groupId, empresa_id: data.empresa_id ?? scope.empresaId ?? null,
      nome: data.nome, descricao: data.descricao ?? null, tipo_operacao: data.tipo_operacao ?? 'Revenda',
      icone: data.icone ?? null, cor: data.cor ?? null, ativo: data.ativo ?? true, created_at: ts, updated_at: ts,
    }),
    (c, d) => ({ ...c, ...d, empresa_id: d.empresa_id === undefined ? c.empresa_id : d.empresa_id, updated_at: nowIso() }),
    (r) => `${r.nome} ${r.descricao || ''}`,
  );
}

export function createInMemoryProdutoRepo() {
  return new MemRepo<Produto, ProdutoCreate, ProdutoUpdate>(
    (scope, data, id, ts) => ({
      id, group_id: scope.groupId, empresa_id: data.empresa_id ?? scope.empresaId ?? null,
      codigo: data.codigo ?? null, descricao: data.descricao, nome: data.nome ?? data.descricao,
      unidade_medida_id: data.unidade_medida_id ?? null, unidade_medida: data.unidade_medida ?? null,
      grupo_produto_id: data.grupo_produto_id ?? null, marca_id: data.marca_id ?? null,
      setor_atividade_id: data.setor_atividade_id ?? null, ncm: data.ncm ?? null,
      ativo: data.ativo ?? true, created_at: ts, updated_at: ts,
    }),
    (c, d) => ({ ...c, ...d, empresa_id: d.empresa_id === undefined ? c.empresa_id : d.empresa_id, updated_at: nowIso() }),
    (r) => `${r.descricao} ${r.codigo || ''} ${r.nome || ''}`,
  );
}
