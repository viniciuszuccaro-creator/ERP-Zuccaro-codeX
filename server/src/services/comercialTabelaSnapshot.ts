/**
 * Snapshot de TabelaPreco (codigo+nome) para Orçamento/Pedido (não-retroatividade).
 * Servidor é autoridade: payload do cliente não envia snapshot.
 */
import { AppError } from '../api/errors.js';

export type TabelaPrecoDocumentoSnapshot = {
  tabela_preco_codigo_snapshot: string;
  tabela_preco_nome_snapshot: string;
};

export type TabelaPrecoDocumentoSnapshotNullable = {
  tabela_preco_codigo_snapshot: string | null;
  tabela_preco_nome_snapshot: string | null;
};

const EMPTY_TABELA_SNAPSHOT: TabelaPrecoDocumentoSnapshotNullable = {
  tabela_preco_codigo_snapshot: null,
  tabela_preco_nome_snapshot: null,
};

/**
 * Resolve snapshot a partir da tabela ativa no tenant.
 * Fail-closed: sem codigo/nome → 422.
 */
export function buildTabelaPrecoDocumentoSnapshot(
  tabela: { id?: string; codigo?: string | null; nome?: string | null; ativo?: boolean } | null | undefined,
  entityLabel: 'ORCAMENTO' | 'PEDIDO',
): TabelaPrecoDocumentoSnapshot {
  if (!tabela || tabela.ativo === false) {
    throw new AppError(422, `${entityLabel}_TABELA_INVALIDA`, 'TabelaPreco unavailable in tenant scope');
  }
  const codigo = typeof tabela.codigo === 'string' ? tabela.codigo.trim() : '';
  const nome = typeof tabela.nome === 'string' ? tabela.nome.trim() : '';
  if (!codigo || !nome) {
    throw new AppError(422, `${entityLabel}_TABELA_SNAPSHOT_INVALIDO`, 'TabelaPreco missing codigo/nome for snapshot');
  }
  return {
    tabela_preco_codigo_snapshot: codigo.slice(0, 64),
    tabela_preco_nome_snapshot: nome.slice(0, 160),
  };
}

/**
 * Revalida snapshot já persistido (conversão Orçamento→Pedido / reload).
 * Fail-closed se incompleto.
 */
export function assertPersistedTabelaSnapshot(
  snapshot: {
    tabela_preco_codigo_snapshot?: string | null;
    tabela_preco_nome_snapshot?: string | null;
  } | null | undefined,
  entityLabel: 'ORCAMENTO' | 'PEDIDO',
): TabelaPrecoDocumentoSnapshot {
  const codigo = snapshot?.tabela_preco_codigo_snapshot?.trim() ?? '';
  const nome = snapshot?.tabela_preco_nome_snapshot?.trim() ?? '';
  if (!codigo || !nome) {
    throw new AppError(422, `${entityLabel}_TABELA_SNAPSHOT_AUSENTE`, 'Persisted price-table snapshot is missing');
  }
  return {
    tabela_preco_codigo_snapshot: codigo.slice(0, 64),
    tabela_preco_nome_snapshot: nome.slice(0, 160),
  };
}

/** Snapshot vazio quando não há tabela_preco_id (pair all-null). */
export function emptyTabelaPrecoDocumentoSnapshot(): TabelaPrecoDocumentoSnapshotNullable {
  return { ...EMPTY_TABELA_SNAPSHOT };
}

/**
 * Monta snapshot a partir do retorno de resolveSalePrice (codigo/nome já resolvidos).
 * Fail-closed se id presente sem codigo/nome.
 */
export function buildTabelaSnapshotFromResolvedPrice(
  resolved: {
    tabela_preco_id?: string | null;
    tabela_preco_codigo?: string | null;
    tabela_preco_nome?: string | null;
  } | null | undefined,
  entityLabel: 'ORCAMENTO' | 'PEDIDO',
): TabelaPrecoDocumentoSnapshot | TabelaPrecoDocumentoSnapshotNullable {
  const id = resolved?.tabela_preco_id?.trim() || '';
  if (!id) return emptyTabelaPrecoDocumentoSnapshot();
  return buildTabelaPrecoDocumentoSnapshot({
    id,
    codigo: resolved?.tabela_preco_codigo,
    nome: resolved?.tabela_preco_nome,
    ativo: true,
  }, entityLabel);
}
