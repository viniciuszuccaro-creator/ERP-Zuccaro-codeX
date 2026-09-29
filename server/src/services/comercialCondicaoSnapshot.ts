/**
 * Snapshot de CondicaoPagamento para Orçamento/Pedido (não-retroatividade).
 * Servidor é autoridade: payload do cliente não envia snapshot.
 */
import { AppError } from '../api/errors.js';
import type { CondicaoPagamento, CondicaoPagamentoParcela } from '../repositories/condicaoPagamentoTypes.js';

export type CondicaoPagamentoParcelaSnapshot = {
  ordem: number;
  dias: number;
  percentual: string;
};

export type CondicaoPagamentoDocumentoSnapshot = {
  condicao_pagamento_codigo_snapshot: string;
  condicao_pagamento_nome_snapshot: string;
  condicao_pagamento_parcelas_snapshot: CondicaoPagamentoParcelaSnapshot[];
};

function normalizePercentual(value: string | number): string {
  const raw = String(value).trim();
  const [whole, fraction = ''] = raw.split('.');
  return `${whole}.${(fraction + '000000').slice(0, 6)}`;
}

function activeParcelas(parcelas: CondicaoPagamentoParcela[] | undefined): CondicaoPagamentoParcelaSnapshot[] {
  if (!Array.isArray(parcelas)) return [];
  return parcelas
    .filter((row) => row && row.ativo !== false)
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((row) => ({
      ordem: Number(row.ordem),
      dias: Number(row.dias),
      percentual: normalizePercentual(row.percentual),
    }));
}

function assertParcelasValidas(parcelas: CondicaoPagamentoParcelaSnapshot[], entityLabel: string): void {
  if (parcelas.length < 1) {
    throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_INVALIDO`, 'CondicaoPagamento has no active parcels to snapshot');
  }
  const ordens = new Set<number>();
  let micros = 0n;
  for (const parcela of parcelas) {
    if (!Number.isInteger(parcela.ordem) || parcela.ordem < 1 || parcela.ordem > 999) {
      throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_INVALIDO`, 'Invalid parcel ordem in condition snapshot');
    }
    if (ordens.has(parcela.ordem)) {
      throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_INVALIDO`, 'Duplicate parcel ordem in condition snapshot');
    }
    ordens.add(parcela.ordem);
    if (!Number.isInteger(parcela.dias) || parcela.dias < 0 || parcela.dias > 36500) {
      throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_INVALIDO`, 'Invalid parcel dias in condition snapshot');
    }
    if (!/^\d+\.\d{6}$/.test(parcela.percentual)) {
      throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_INVALIDO`, 'Invalid parcel percentual in condition snapshot');
    }
    const [whole, fraction = ''] = parcela.percentual.split('.');
    micros += BigInt(whole) * 1000000n + BigInt(fraction.slice(0, 6));
  }
  if (micros !== 100000000n) {
    throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_INVALIDO`, 'Condition snapshot parcels must sum to 100.000000');
  }
}

/**
 * Resolve snapshot a partir da condição ativa no tenant.
 * Fail-closed: sem nome/código/parcelas válidas → 422.
 */
export function buildCondicaoPagamentoDocumentoSnapshot(
  condicao: CondicaoPagamento | null | undefined,
  entityLabel: 'ORCAMENTO' | 'PEDIDO',
): CondicaoPagamentoDocumentoSnapshot {
  if (!condicao || !condicao.ativo) {
    throw new AppError(422, `${entityLabel}_CONDICAO_INVALIDA`, 'CondicaoPagamento unavailable in tenant scope');
  }
  const codigo = typeof condicao.codigo === 'string' ? condicao.codigo.trim() : '';
  const nome = typeof condicao.nome === 'string' ? condicao.nome.trim() : '';
  if (!codigo || !nome) {
    throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_INVALIDO`, 'CondicaoPagamento missing codigo/nome for snapshot');
  }
  const parcelas = activeParcelas(condicao.parcelas);
  assertParcelasValidas(parcelas, entityLabel);
  return {
    condicao_pagamento_codigo_snapshot: codigo.slice(0, 64),
    condicao_pagamento_nome_snapshot: nome.slice(0, 160),
    condicao_pagamento_parcelas_snapshot: parcelas,
  };
}

/**
 * Revalida snapshot já persistido (conversão Orçamento→Pedido / reload).
 * Fail-closed se incompleto ou parcelas inválidas.
 */
export function assertPersistedCondicaoSnapshot(
  snapshot: {
    condicao_pagamento_codigo_snapshot?: string | null;
    condicao_pagamento_nome_snapshot?: string | null;
    condicao_pagamento_parcelas_snapshot?: CondicaoPagamentoParcelaSnapshot[] | null;
  } | null | undefined,
  entityLabel: 'ORCAMENTO' | 'PEDIDO',
): CondicaoPagamentoDocumentoSnapshot {
  const codigo = snapshot?.condicao_pagamento_codigo_snapshot?.trim() ?? '';
  const nome = snapshot?.condicao_pagamento_nome_snapshot?.trim() ?? '';
  const parcelas = Array.isArray(snapshot?.condicao_pagamento_parcelas_snapshot)
    ? snapshot!.condicao_pagamento_parcelas_snapshot!.map((row) => ({
      ordem: Number(row.ordem),
      dias: Number(row.dias),
      percentual: normalizePercentual(row.percentual),
    }))
    : [];
  if (!codigo || !nome) {
    throw new AppError(422, `${entityLabel}_CONDICAO_SNAPSHOT_AUSENTE`, 'Persisted condition snapshot is missing');
  }
  assertParcelasValidas(parcelas, entityLabel);
  return {
    condicao_pagamento_codigo_snapshot: codigo.slice(0, 64),
    condicao_pagamento_nome_snapshot: nome.slice(0, 160),
    condicao_pagamento_parcelas_snapshot: parcelas,
  };
}

export function mapParcelasSnapshotFromJson(raw: unknown): CondicaoPagamentoParcelaSnapshot[] | null {
  if (raw == null) return null;
  const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(rows)) return null;
  return rows.map((row) => ({
    ordem: Number((row as CondicaoPagamentoParcelaSnapshot).ordem),
    dias: Number((row as CondicaoPagamentoParcelaSnapshot).dias),
    percentual: normalizePercentual((row as CondicaoPagamentoParcelaSnapshot).percentual),
  }));
}
