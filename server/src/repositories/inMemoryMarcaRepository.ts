import { randomUUID } from 'node:crypto';
import type {
  Marca,
  MarcaCreateInput,
  MarcaListFilter,
  MarcaRepository,
  MarcaUpdateInput,
} from './marcaTypes.js';

function nowIso() {
  return new Date().toISOString();
}

export class InMemoryMarcaRepository implements MarcaRepository {
  private readonly rows = new Map<string, Marca>();

  seed(rows: Marca[]) {
    for (const row of rows) this.rows.set(row.id, row);
  }

  async list(filter: MarcaListFilter): Promise<Marca[]> {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    return [...this.rows.values()]
      .filter((row) => row.group_id === filter.groupId)
      .filter((row) => (filter.empresaId ? row.empresa_id === filter.empresaId : true))
      .filter((row) => (typeof filter.ativo === 'boolean' ? row.ativo === filter.ativo : true))
      .filter((row) => (
        filter.search
          ? row.nome_marca.toLowerCase().includes(filter.search.toLowerCase())
          : true
      ))
      .sort((a, b) => a.nome_marca.localeCompare(b.nome_marca))
      .slice(0, limit);
  }

  async getById(scope: { groupId: string; empresaId?: string | null }, id: string): Promise<Marca | null> {
    const row = this.rows.get(id);
    if (!row || row.group_id !== scope.groupId) return null;
    if (scope.empresaId && row.empresa_id !== scope.empresaId) return null;
    return row;
  }

  async create(scope: { groupId: string; empresaId?: string | null }, data: MarcaCreateInput): Promise<Marca> {
    const ts = nowIso();
    const row: Marca = {
      id: randomUUID(),
      group_id: scope.groupId,
      empresa_id: data.empresa_id ?? scope.empresaId ?? null,
      nome_marca: data.nome_marca,
      descricao: data.descricao ?? null,
      cnpj: data.cnpj ?? null,
      pais_origem: data.pais_origem ?? null,
      site: data.site ?? null,
      logo_url: data.logo_url ?? null,
      categoria: data.categoria ?? null,
      fornecedor_id: data.fornecedor_id ?? null,
      certificacoes: data.certificacoes ?? [],
      ativo: data.ativo ?? true,
      created_at: ts,
      updated_at: ts,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async update(
    scope: { groupId: string; empresaId?: string | null },
    id: string,
    data: MarcaUpdateInput,
  ): Promise<Marca | null> {
    const current = await this.getById(scope, id);
    if (!current) return null;
    const next: Marca = {
      ...current,
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
      updated_at: nowIso(),
    };
    this.rows.set(id, next);
    return next;
  }

  async softDelete(scope: { groupId: string; empresaId?: string | null }, id: string): Promise<Marca | null> {
    return this.update(scope, id, { ativo: false });
  }
}
