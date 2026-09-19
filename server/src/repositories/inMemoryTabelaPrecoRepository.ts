import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import type {
  TabelaPreco,
  TabelaPrecoCreate,
  TabelaPrecoEmpresa,
  TabelaPrecoItem,
  TabelaPrecoItemCreate,
  TabelaPrecoItemUpdate,
  TabelaPrecoUpdate,
} from './tabelaPrecoTypes.js';

export type TabelaPrecoScope = { groupId: string; empresaId?: string | null };

export type TabelaPrecoListFilter = TabelaPrecoScope & {
  ativo?: boolean;
  vigenteEm?: string;
  ehPadrao?: boolean;
  search?: string;
  orderBy?: 'nome' | 'codigo' | 'created_at';
  orderDir?: 'asc' | 'desc';
  limit: number;
  offset: number;
};

export type TabelaPrecoItemListFilter = {
  groupId: string;
  tabelaPrecoId: string;
  ativo?: boolean;
  search?: string;
  limit: number;
  offset: number;
};

export type ResolvedPrice = {
  tabela_preco_id: string;
  tabela_preco_codigo: string;
  tabela_preco_nome: string;
  origem_resolucao: 'cliente_empresa' | 'padrao_empresa';
  item_id: string;
  produto_id: string;
  unidade_medida_id: string;
  preco: string;
  moeda: 'BRL';
} | null;

export interface TabelaPrecoRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  listPage(filter: TabelaPrecoListFilter, executor?: DbQueryExecutor): Promise<{ rows: TabelaPreco[]; total: number }>;
  get(scope: TabelaPrecoScope, tabelaId: string, executor?: DbQueryExecutor): Promise<TabelaPreco | null>;
  create(
    scope: { groupId: string; empresaId: string },
    data: TabelaPrecoCreate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco>;
  update(
    scope: TabelaPrecoScope,
    tabelaId: string,
    data: TabelaPrecoUpdate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco | null>;
  softDelete(
    scope: TabelaPrecoScope,
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco | null>;
  restore(
    scope: TabelaPrecoScope,
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco | null>;
  lock(scope: TabelaPrecoScope, tabelaId: string, executor?: DbQueryExecutor): Promise<void>;
  linkEmpresa(
    scope: TabelaPrecoScope,
    tabelaId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco>;
  unlinkEmpresa(
    scope: TabelaPrecoScope,
    tabelaId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco | null>;
  restoreEmpresa(
    scope: TabelaPrecoScope,
    tabelaId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco>;
  setPadrao(
    scope: { groupId: string; empresaId: string },
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco>;
  unsetPadrao(
    scope: { groupId: string; empresaId: string },
    tabelaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPreco>;
  listItens(filter: TabelaPrecoItemListFilter, executor?: DbQueryExecutor): Promise<{ rows: TabelaPrecoItem[]; total: number }>;
  getItem(scope: TabelaPrecoScope, tabelaId: string, itemId: string, executor?: DbQueryExecutor): Promise<TabelaPrecoItem | null>;
  createItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    data: TabelaPrecoItemCreate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPrecoItem>;
  updateItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    itemId: string,
    data: TabelaPrecoItemUpdate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPrecoItem | null>;
  softDeleteItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    itemId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPrecoItem | null>;
  restoreItem(
    scope: TabelaPrecoScope,
    tabelaId: string,
    itemId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<TabelaPrecoItem | null>;
  countActiveClienteEmpresaRefs(groupId: string, tabelaId: string, executor?: DbQueryExecutor): Promise<number>;
  hasActivePadrao(groupId: string, tabelaId: string, executor?: DbQueryExecutor): Promise<boolean>;
  isAuthorizedForEmpresa(
    groupId: string,
    tabelaId: string,
    empresaId: string,
    executor?: DbQueryExecutor,
  ): Promise<boolean>;
  resolvePrice(input: {
    groupId: string;
    empresaId: string;
    clienteEmpresaTabelaId?: string | null;
    produtoId: string;
    unidadeMedidaId: string;
    businessDate: string;
  }, executor?: DbQueryExecutor): Promise<ResolvedPrice>;
  getProdutoUnidadeContext(
    groupId: string,
    produtoId: string,
    unidadeMedidaId: string,
    executor?: DbQueryExecutor,
  ): Promise<{
    produtoAtivo: boolean;
    unidadeAtivo: boolean;
    unidadeSigla: string;
    unidadePrincipalId: string | null;
    unidadesSecundarias: string[];
  } | null>;
}

function nowIso() {
  return new Date().toISOString();
}

function stamp(
  actorId: string | null | undefined,
  existing?: { created_by: string | null; created_at: string },
) {
  const ts = nowIso();
  return {
    created_by: existing?.created_by ?? actorId ?? null,
    updated_by: actorId ?? null,
    created_at: existing?.created_at ?? ts,
    updated_at: ts,
  };
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export class InMemoryTabelaPrecoRepository implements TabelaPrecoRepository {
  private tabelas = new Map<string, TabelaPreco>();
  private itens = new Map<string, TabelaPrecoItem>();
  private sequences = new Map<string, number>();
  private produtos = new Map<string, {
    id: string;
    group_id: string;
    ativo: boolean;
    unidade_medida_id: string | null;
    unidades_secundarias: string[];
  }>();
  private unidades = new Map<string, {
    id: string;
    group_id: string;
    sigla: string;
    ativo: boolean;
  }>();
  private clienteEmpresaRefs = new Map<string, number>();

  hydrateProduto(row: {
    id: string;
    group_id: string;
    ativo?: boolean;
    unidade_medida_id?: string | null;
    unidades_secundarias?: string[];
  }) {
    this.produtos.set(row.id, {
      id: row.id,
      group_id: row.group_id,
      ativo: row.ativo !== false,
      unidade_medida_id: row.unidade_medida_id ?? null,
      unidades_secundarias: row.unidades_secundarias ?? [],
    });
  }

  hydrateUnidade(row: { id: string; group_id: string; sigla: string; ativo?: boolean }) {
    this.unidades.set(row.id, {
      id: row.id,
      group_id: row.group_id,
      sigla: row.sigla,
      ativo: row.ativo !== false,
    });
  }

  setClienteEmpresaRefCount(groupId: string, tabelaId: string, count: number) {
    this.clienteEmpresaRefs.set(`${groupId}:${tabelaId}`, count);
  }

  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return fn(undefined);
  }

  private nextCodigo(groupId: string) {
    const current = this.sequences.get(groupId) ?? 1;
    this.sequences.set(groupId, current + 1);
    return String(current).padStart(6, '0');
  }

  private clone(tabela: TabelaPreco): TabelaPreco {
    return {
      ...tabela,
      empresas: tabela.empresas.map((row) => ({ ...row })),
    };
  }

  private require(scope: TabelaPrecoScope, tabelaId: string): TabelaPreco | null {
    const row = this.tabelas.get(tabelaId);
    if (!row || row.group_id !== scope.groupId) return null;
    if (scope.empresaId) {
      const authorized = row.empresas.some((e) => e.empresa_id === scope.empresaId && e.ativo);
      if (!authorized && row.empresa_id !== scope.empresaId) return null;
      if (!authorized) return null;
    }
    return this.clone(row);
  }

  async listPage(filter: TabelaPrecoListFilter) {
    let rows = [...this.tabelas.values()].filter((row) => row.group_id === filter.groupId);
    if (typeof filter.ativo === 'boolean') rows = rows.filter((row) => row.ativo === filter.ativo);
    if (filter.empresaId) {
      rows = rows.filter((row) => row.empresas.some((e) => e.empresa_id === filter.empresaId && e.ativo));
    }
    if (typeof filter.ehPadrao === 'boolean' && filter.empresaId) {
      rows = rows.filter((row) => row.empresas.some(
        (e) => e.empresa_id === filter.empresaId && e.ativo && e.eh_padrao === filter.ehPadrao,
      ));
    }
    if (filter.vigenteEm) {
      rows = rows.filter((row) => {
        if (filter.vigenteEm! < row.vigencia_inicio) return false;
        if (row.vigencia_fim && filter.vigenteEm! > row.vigencia_fim) return false;
        return true;
      });
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((row) => row.nome.toLowerCase().includes(q) || row.codigo.includes(q));
    }
    const orderCol = filter.orderBy ?? 'created_at';
    const dir = filter.orderDir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const av = String(a[orderCol] ?? '');
      const bv = String(b[orderCol] ?? '');
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
    const total = rows.length;
    return {
      rows: rows.slice(filter.offset, filter.offset + filter.limit).map((row) => this.clone(row)),
      total,
    };
  }

  async get(scope: TabelaPrecoScope, tabelaId: string) {
    return this.require(scope, tabelaId);
  }

  async create(scope: { groupId: string; empresaId: string }, data: TabelaPrecoCreate, actorId: string | null | undefined) {
    const meta = stamp(actorId);
    const id = randomUUID();
    const empresaLink: TabelaPrecoEmpresa = {
      id: randomUUID(),
      group_id: scope.groupId,
      tabela_preco_id: id,
      empresa_id: scope.empresaId,
      eh_padrao: false,
      ativo: true,
      ...meta,
    };
    const tabela: TabelaPreco = {
      id,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      codigo: this.nextCodigo(scope.groupId),
      nome: data.nome,
      descricao: data.descricao ?? null,
      moeda: 'BRL',
      vigencia_inicio: dateOnly(data.vigencia_inicio),
      vigencia_fim: data.vigencia_fim ? dateOnly(data.vigencia_fim) : null,
      ativo: true,
      codigo_tabela_legado: data.codigo_tabela_legado ?? null,
      origem: data.origem ?? 'ERP',
      legacy_id: data.legacy_id ?? null,
      legacy_code: data.legacy_code ?? null,
      source_system: data.source_system ?? null,
      migration_batch: data.migration_batch ?? null,
      imported_at: data.imported_at ?? null,
      ...meta,
      empresas: [empresaLink],
    };
    const conflict = [...this.tabelas.values()].some((row) => (
      row.ativo
      && row.group_id === scope.groupId
      && row.empresa_id === scope.empresaId
      && row.nome.toLowerCase().trim() === data.nome.toLowerCase().trim()
    ));
    if (conflict) {
      const err = new Error('duplicate key value violates unique constraint "uq_tabelas_preco_origem_nome_ativo"');
      throw err;
    }
    this.tabelas.set(id, tabela);
    return this.clone(tabela);
  }

  async update(scope: TabelaPrecoScope, tabelaId: string, data: TabelaPrecoUpdate, actorId: string | null | undefined) {
    const current = this.tabelas.get(tabelaId);
    if (!current || current.group_id !== scope.groupId) return null;
    const nextNome = data.nome ?? current.nome;
    if (data.nome) {
      const conflict = [...this.tabelas.values()].some((row) => (
        row.id !== tabelaId
        && row.ativo
        && row.group_id === current.group_id
        && row.empresa_id === current.empresa_id
        && row.nome.toLowerCase().trim() === nextNome.toLowerCase().trim()
      ));
      if (conflict) throw new Error('duplicate key value violates unique constraint "uq_tabelas_preco_origem_nome_ativo"');
    }
    const updated: TabelaPreco = {
      ...current,
      nome: nextNome,
      descricao: data.descricao === undefined ? current.descricao : data.descricao,
      vigencia_inicio: data.vigencia_inicio ? dateOnly(data.vigencia_inicio) : current.vigencia_inicio,
      vigencia_fim: data.vigencia_fim === undefined
        ? current.vigencia_fim
        : (data.vigencia_fim ? dateOnly(data.vigencia_fim) : null),
      moeda: data.moeda ?? current.moeda,
      codigo_tabela_legado: data.codigo_tabela_legado === undefined
        ? current.codigo_tabela_legado
        : data.codigo_tabela_legado,
      ...stamp(actorId, current),
      empresas: current.empresas,
    };
    this.tabelas.set(tabelaId, updated);
    return this.clone(updated);
  }

  async softDelete(scope: TabelaPrecoScope, tabelaId: string, actorId: string | null | undefined) {
    const current = this.tabelas.get(tabelaId);
    if (!current || current.group_id !== scope.groupId || !current.ativo) return null;
    const updated = { ...current, ativo: false, ...stamp(actorId, current), empresas: current.empresas };
    this.tabelas.set(tabelaId, updated);
    return this.clone(updated);
  }

  async restore(scope: TabelaPrecoScope, tabelaId: string, actorId: string | null | undefined) {
    const current = this.tabelas.get(tabelaId);
    if (!current || current.group_id !== scope.groupId || current.ativo) return null;
    const conflict = [...this.tabelas.values()].some((row) => (
      row.id !== tabelaId
      && row.ativo
      && row.group_id === current.group_id
      && row.empresa_id === current.empresa_id
      && row.nome.toLowerCase().trim() === current.nome.toLowerCase().trim()
    ));
    if (conflict) throw new Error('duplicate key value violates unique constraint "uq_tabelas_preco_origem_nome_ativo"');
    const updated = { ...current, ativo: true, ...stamp(actorId, current), empresas: current.empresas };
    this.tabelas.set(tabelaId, updated);
    return this.clone(updated);
  }

  async lock() {
    // no-op in memory
  }

  async linkEmpresa(scope: TabelaPrecoScope, tabelaId: string, empresaId: string, actorId: string | null | undefined) {
    const current = this.tabelas.get(tabelaId);
    if (!current || current.group_id !== scope.groupId) throw new Error('TABELA_PRECO_NOT_FOUND');
    const existing = current.empresas.find((row) => row.empresa_id === empresaId);
    if (existing) {
      existing.ativo = true;
      Object.assign(existing, stamp(actorId, existing));
    } else {
      current.empresas.push({
        id: randomUUID(),
        group_id: current.group_id,
        tabela_preco_id: tabelaId,
        empresa_id: empresaId,
        eh_padrao: false,
        ativo: true,
        ...stamp(actorId),
      });
    }
    current.updated_at = nowIso();
    current.updated_by = actorId ?? null;
    return this.clone(current);
  }

  async unlinkEmpresa(scope: TabelaPrecoScope, tabelaId: string, empresaId: string, actorId: string | null | undefined) {
    const current = this.tabelas.get(tabelaId);
    if (!current || current.group_id !== scope.groupId) return null;
    const link = current.empresas.find((row) => row.empresa_id === empresaId);
    if (!link) return null;
    if (empresaId === current.empresa_id) {
      throw new Error('TABELA_PRECO_OWNER_REQUIRED');
    }
    link.ativo = false;
    link.eh_padrao = false;
    Object.assign(link, stamp(actorId, link));
    return this.clone(current);
  }

  async restoreEmpresa(scope: TabelaPrecoScope, tabelaId: string, empresaId: string, actorId: string | null | undefined) {
    return this.linkEmpresa(scope, tabelaId, empresaId, actorId);
  }

  async setPadrao(scope: { groupId: string; empresaId: string }, tabelaId: string, actorId: string | null | undefined) {
    const current = this.tabelas.get(tabelaId);
    if (!current || current.group_id !== scope.groupId || !current.ativo) throw new Error('TABELA_PRECO_NOT_FOUND');
    const link = current.empresas.find((row) => row.empresa_id === scope.empresaId && row.ativo);
    if (!link) throw new Error('TABELA_PRECO_NOT_AUTHORIZED');
    for (const tabela of this.tabelas.values()) {
      if (tabela.group_id !== scope.groupId) continue;
      for (const empresa of tabela.empresas) {
        if (empresa.empresa_id === scope.empresaId && empresa.eh_padrao) {
          empresa.eh_padrao = false;
          Object.assign(empresa, stamp(actorId, empresa));
        }
      }
    }
    link.eh_padrao = true;
    Object.assign(link, stamp(actorId, link));
    return this.clone(current);
  }

  async unsetPadrao(scope: { groupId: string; empresaId: string }, tabelaId: string, actorId: string | null | undefined) {
    const current = this.tabelas.get(tabelaId);
    if (!current || current.group_id !== scope.groupId) throw new Error('TABELA_PRECO_NOT_FOUND');
    const link = current.empresas.find((row) => row.empresa_id === scope.empresaId);
    if (!link) throw new Error('TABELA_PRECO_NOT_AUTHORIZED');
    link.eh_padrao = false;
    Object.assign(link, stamp(actorId, link));
    return this.clone(current);
  }

  async listItens(filter: TabelaPrecoItemListFilter) {
    let rows = [...this.itens.values()].filter((row) => (
      row.group_id === filter.groupId && row.tabela_preco_id === filter.tabelaPrecoId
    ));
    if (typeof filter.ativo === 'boolean') rows = rows.filter((row) => row.ativo === filter.ativo);
    const total = rows.length;
    return { rows: rows.slice(filter.offset, filter.offset + filter.limit), total };
  }

  async getItem(scope: TabelaPrecoScope, tabelaId: string, itemId: string) {
    const item = this.itens.get(itemId);
    if (!item || item.group_id !== scope.groupId || item.tabela_preco_id !== tabelaId) return null;
    return { ...item };
  }

  async createItem(scope: TabelaPrecoScope, tabelaId: string, data: TabelaPrecoItemCreate, actorId: string | null | undefined) {
    const tabela = this.tabelas.get(tabelaId);
    if (!tabela || tabela.group_id !== scope.groupId) throw new Error('TABELA_PRECO_NOT_FOUND');
    const keyConflict = [...this.itens.values()].some((row) => (
      row.tabela_preco_id === tabelaId
      && row.produto_id === data.produto_id
      && row.unidade_medida_id === data.unidade_medida_id
    ));
    if (keyConflict) throw new Error('duplicate key value violates unique constraint');
    const item: TabelaPrecoItem = {
      id: randomUUID(),
      group_id: scope.groupId,
      tabela_preco_id: tabelaId,
      produto_id: data.produto_id,
      unidade_medida_id: data.unidade_medida_id,
      preco: data.preco,
      ativo: true,
      ...stamp(actorId),
    };
    this.itens.set(item.id, item);
    return { ...item };
  }

  async updateItem(scope: TabelaPrecoScope, tabelaId: string, itemId: string, data: TabelaPrecoItemUpdate, actorId: string | null | undefined) {
    const item = this.itens.get(itemId);
    if (!item || item.group_id !== scope.groupId || item.tabela_preco_id !== tabelaId) return null;
    const updated = { ...item, preco: data.preco, ...stamp(actorId, item) };
    this.itens.set(itemId, updated);
    return { ...updated };
  }

  async softDeleteItem(scope: TabelaPrecoScope, tabelaId: string, itemId: string, actorId: string | null | undefined) {
    const item = this.itens.get(itemId);
    if (!item || item.group_id !== scope.groupId || item.tabela_preco_id !== tabelaId || !item.ativo) return null;
    const updated = { ...item, ativo: false, ...stamp(actorId, item) };
    this.itens.set(itemId, updated);
    return { ...updated };
  }

  async restoreItem(scope: TabelaPrecoScope, tabelaId: string, itemId: string, actorId: string | null | undefined) {
    const item = this.itens.get(itemId);
    if (!item || item.group_id !== scope.groupId || item.tabela_preco_id !== tabelaId || item.ativo) return null;
    const updated = { ...item, ativo: true, ...stamp(actorId, item) };
    this.itens.set(itemId, updated);
    return { ...updated };
  }

  async countActiveClienteEmpresaRefs(groupId: string, tabelaId: string) {
    return this.clienteEmpresaRefs.get(`${groupId}:${tabelaId}`) ?? 0;
  }

  async hasActivePadrao(groupId: string, tabelaId: string) {
    const tabela = this.tabelas.get(tabelaId);
    if (!tabela || tabela.group_id !== groupId) return false;
    return tabela.empresas.some((row) => row.ativo && row.eh_padrao);
  }

  async isAuthorizedForEmpresa(groupId: string, tabelaId: string, empresaId: string) {
    const tabela = this.tabelas.get(tabelaId);
    if (!tabela || tabela.group_id !== groupId || !tabela.ativo) return false;
    return tabela.empresas.some((row) => row.empresa_id === empresaId && row.ativo);
  }

  async resolvePrice(input: {
    groupId: string;
    empresaId: string;
    clienteEmpresaTabelaId?: string | null;
    produtoId: string;
    unidadeMedidaId: string;
    businessDate: string;
  }) {
    const pick = async (tabelaId: string, origem: 'cliente_empresa' | 'padrao_empresa'): Promise<ResolvedPrice> => {
      const tabela = this.tabelas.get(tabelaId);
      if (!tabela || !tabela.ativo || tabela.group_id !== input.groupId) return null;
      if (!tabela.empresas.some((e) => e.empresa_id === input.empresaId && e.ativo)) return null;
      if (input.businessDate < tabela.vigencia_inicio) return null;
      if (tabela.vigencia_fim && input.businessDate > tabela.vigencia_fim) return null;
      const item = [...this.itens.values()].find((row) => (
        row.tabela_preco_id === tabelaId
        && row.produto_id === input.produtoId
        && row.unidade_medida_id === input.unidadeMedidaId
        && row.ativo
      ));
      if (!item) return null;
      return {
        tabela_preco_id: tabela.id,
        tabela_preco_codigo: tabela.codigo,
        tabela_preco_nome: tabela.nome,
        origem_resolucao: origem,
        item_id: item.id,
        produto_id: item.produto_id,
        unidade_medida_id: item.unidade_medida_id,
        preco: item.preco,
        moeda: 'BRL',
      };
    };

    if (input.clienteEmpresaTabelaId) {
      const specific = await pick(input.clienteEmpresaTabelaId, 'cliente_empresa');
      if (specific) return specific;
    }
    const padrao = [...this.tabelas.values()].find((tabela) => (
      tabela.group_id === input.groupId
      && tabela.empresas.some((e) => e.empresa_id === input.empresaId && e.ativo && e.eh_padrao)
    ));
    if (padrao) return pick(padrao.id, 'padrao_empresa');
    return null;
  }

  async getProdutoUnidadeContext(groupId: string, produtoId: string, unidadeMedidaId: string) {
    const produto = this.produtos.get(produtoId);
    const unidade = this.unidades.get(unidadeMedidaId);
    if (!produto || !unidade) return null;
    if (produto.group_id !== groupId || unidade.group_id !== groupId) return null;
    return {
      produtoAtivo: produto.ativo,
      unidadeAtivo: unidade.ativo,
      unidadeSigla: unidade.sigla,
      unidadePrincipalId: produto.unidade_medida_id,
      unidadesSecundarias: produto.unidades_secundarias,
    };
  }
}
