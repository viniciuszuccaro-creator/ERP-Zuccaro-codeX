/**
 * Conversão Orçamento→Pedido: copia/verifica snapshots comerciais (não-retroatividade).
 * Pós-031: fail-closed se o Orçamento tiver id/campos de snapshot incompletos.
 * Legado pré-029 sem nenhum campo de snapshot de condição: resolve condição ao vivo (fail-closed).
 */
import type { CondicaoPagamento } from '../repositories/condicaoPagamentoTypes.js';
import {
  assertPersistedCondicaoSnapshot,
  buildCondicaoPagamentoDocumentoSnapshot,
  type CondicaoPagamentoDocumentoSnapshot,
  type CondicaoPagamentoParcelaSnapshot,
} from './comercialCondicaoSnapshot.js';
import {
  assertPersistedPromocaoSnapshot,
  type PromocaoDocumentoSnapshot,
} from './comercialPromocaoPolicy.js';
import {
  assertPersistedTabelaSnapshot,
  emptyTabelaPrecoDocumentoSnapshot,
  type TabelaPrecoDocumentoSnapshotNullable,
} from './comercialTabelaSnapshot.js';

export type OrcamentoConvertSnapshotSource = {
  condicao_pagamento_id: string;
  condicao_pagamento_codigo_snapshot?: string | null;
  condicao_pagamento_nome_snapshot?: string | null;
  condicao_pagamento_parcelas_snapshot?: CondicaoPagamentoParcelaSnapshot[] | null;
  tabela_preco_id?: string | null;
  tabela_preco_codigo_snapshot?: string | null;
  tabela_preco_nome_snapshot?: string | null;
  promocao_aplicada?: boolean | null;
  promocao_bps?: number | null;
  promocao_cupom?: string | null;
};

export type ConvertSnapshotsBundle = CondicaoPagamentoDocumentoSnapshot
  & TabelaPrecoDocumentoSnapshotNullable
  & PromocaoDocumentoSnapshot;

function hasAnyCondicaoSnapshotField(quote: OrcamentoConvertSnapshotSource): boolean {
  return Boolean(quote.condicao_pagamento_codigo_snapshot?.trim())
    || Boolean(quote.condicao_pagamento_nome_snapshot?.trim())
    || Array.isArray(quote.condicao_pagamento_parcelas_snapshot);
}

function hasAnyTabelaSnapshotField(quote: OrcamentoConvertSnapshotSource): boolean {
  return Boolean(quote.tabela_preco_codigo_snapshot?.trim())
    || Boolean(quote.tabela_preco_nome_snapshot?.trim());
}

/**
 * Resolve snapshots a gravar no Pedido a partir do Orçamento.
 * - Condição: copia se qualquer campo de snapshot existir; senão legado → build live.
 * - Tabela: se `tabela_preco_id` ou qualquer campo de snapshot → exige par codigo+nome (sem live).
 * - Promoção: sempre copia/valida o par aplicada/bps/cupom.
 */
export async function resolveOrcamentoConvertSnapshots(
  quote: OrcamentoConvertSnapshotSource,
  ports: {
    resolveLegacyCondicao: () => Promise<CondicaoPagamento | null | undefined>;
  },
): Promise<ConvertSnapshotsBundle> {
  const condicaoSnapshot = hasAnyCondicaoSnapshotField(quote)
    ? assertPersistedCondicaoSnapshot(quote, 'ORCAMENTO')
    : buildCondicaoPagamentoDocumentoSnapshot(
      await ports.resolveLegacyCondicao(),
      'PEDIDO',
    );

  const promocaoSnapshot = assertPersistedPromocaoSnapshot(quote);

  // Pós-031: tabela_preco_id sem codigo+nome → fail-closed (não reconsulta tabela atual).
  const tabelaSnapshot = (quote.tabela_preco_id || hasAnyTabelaSnapshotField(quote))
    ? assertPersistedTabelaSnapshot(quote, 'ORCAMENTO')
    : emptyTabelaPrecoDocumentoSnapshot();

  return {
    ...condicaoSnapshot,
    ...tabelaSnapshot,
    ...promocaoSnapshot,
  };
}

/**
 * UI/hint: Orçamento pós-snapshot incompleto (não bloqueia legado sem nenhum campo).
 * Retorna mensagem curta ou null se pronto/legado puro.
 */
export function orcamentoConvertSnapshotGapHint(quote: OrcamentoConvertSnapshotSource | null | undefined): string | null {
  if (!quote) return null;
  const hasCondicao = hasAnyCondicaoSnapshotField(quote);
  const hasTabela = hasAnyTabelaSnapshotField(quote);
  const tabelaId = typeof quote.tabela_preco_id === 'string' ? quote.tabela_preco_id.trim() : '';

  if (hasCondicao) {
    try {
      assertPersistedCondicaoSnapshot(quote, 'ORCAMENTO');
    } catch {
      return 'Snapshots de condição incompletos — edite e salve o orçamento antes de converter.';
    }
  }

  if (tabelaId || hasTabela) {
    try {
      assertPersistedTabelaSnapshot(quote, 'ORCAMENTO');
    } catch {
      return 'Snapshots de tabela de preço incompletos — edite e salve o orçamento antes de converter.';
    }
  }

  if (quote.promocao_aplicada === true) {
    try {
      assertPersistedPromocaoSnapshot(quote);
    } catch {
      return 'Snapshot de promoção inconsistente — edite e salve o orçamento antes de converter.';
    }
  }

  return null;
}
