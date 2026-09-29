/**
 * Promoção comercial (Onda 2) sobre itens já precificados — sem cadastro paralelo.
 * Fail-closed: sem config explícita (`ativa === true`) a promoção não aplica.
 * Cupom opcional: allowlist vazia/ausente rejeita qualquer código.
 */
import { AppError } from '../api/errors.js';

const MICROS = 1_000_000n;

export type PromocaoItem = {
  quantidade: string;
  preco_unitario: string;
  desconto?: string | null;
};

export type ComercialPromocaoConfig = {
  /** Sem true explícito = promoção desligada (fail-closed). */
  ativa?: boolean;
  /** Teto da promoção em basis points do subtotal de linha (ex.: 500 = 5%). */
  maxBps?: number;
  /** Cupons sintéticos autorizados no Grupo/Empresa; vazio = nenhum cupom. */
  cuponsPermitidos?: string[];
};

export type ComercialPromocaoConfigPort = {
  getPromocaoConfig(scope: {
    groupId: string;
    empresaId: string;
  }): Promise<ComercialPromocaoConfig | null>;
};

function toMicros(value: string): bigint {
  const raw = String(value ?? '0').trim();
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid money amount');
  }
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * MICROS + BigInt(`${fraction}000000`.slice(0, 6));
}

function fmtMoney(micros: bigint): string {
  const whole = micros / MICROS;
  const frac = (micros % MICROS).toString().padStart(6, '0');
  return `${whole}.${frac}`;
}

function normalizeCupom(codigo: string | null | undefined): string {
  return String(codigo ?? '').trim().toUpperCase();
}

export function cupomPromocionalAutorizado(
  codigo: string | null | undefined,
  cuponsPermitidos: string[] | null | undefined,
): boolean {
  const cupom = normalizeCupom(codigo);
  if (!cupom) return false;
  const allow = (cuponsPermitidos ?? [])
    .map((c) => normalizeCupom(c))
    .filter(Boolean);
  if (allow.length === 0) return false;
  return allow.includes(cupom);
}

export type PromocaoDocumentoSnapshot = {
  promocao_aplicada: boolean;
  promocao_bps: number | null;
  promocao_cupom: string | null;
};

export type PromocaoPayloadRef = {
  bps: number;
  cupom?: string | null;
};

export function emptyPromocaoDocumentoSnapshot(): PromocaoDocumentoSnapshot {
  return { promocao_aplicada: false, promocao_bps: null, promocao_cupom: null };
}

/**
 * Valida config/cupom/bps fail-closed (sem mutar itens).
 * Reutilizado por simular-venda e persistência de refs em Orçamento/Pedido.
 */
export function assertPromocaoAutorizada(options: {
  promocaoBps: number;
  config: ComercialPromocaoConfig | null | undefined;
  cupom?: string | null;
}): { promocaoBps: number; cupom: string | null } {
  const cfg = options.config;
  if (!cfg || cfg.ativa !== true) {
    throw new AppError(422, 'PROMOCAO_INATIVA', 'Promoção comercial não está ativa neste contexto');
  }
  const maxBps = Number.isFinite(cfg.maxBps) ? Math.max(0, Math.trunc(cfg.maxBps!)) : 0;
  const requested = Number.isFinite(options.promocaoBps) ? Math.trunc(options.promocaoBps) : NaN;
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new AppError(422, 'PROMOCAO_INVALIDA', 'promocaoBps must be a positive integer');
  }
  if (requested > maxBps) {
    throw new AppError(422, 'PROMOCAO_ACIMA_DO_TETO', 'Promoção acima do teto autorizado', {
      promocao_bps: requested,
      max_bps: maxBps,
    });
  }
  let cupom: string | null = null;
  if (options.cupom != null && String(options.cupom).trim() !== '') {
    if (!cupomPromocionalAutorizado(options.cupom, cfg.cuponsPermitidos)) {
      throw new AppError(422, 'PROMOCAO_CUPOM_NEGADO', 'Cupom promocional não autorizado');
    }
    cupom = normalizeCupom(options.cupom).slice(0, 64);
  }
  return { promocaoBps: requested, cupom };
}

/**
 * Itens já trazem desconto final (ex.: UI após simular-venda).
 * Fail-closed: cada linha deve cobrir pelo menos o valor promocional daquele bps.
 */
export function assertDescontoCompativelComPromocao<T extends PromocaoItem>(
  items: T[],
  promocaoBps: number,
): void {
  const requested = Math.trunc(promocaoBps);
  for (const item of items) {
    const line = (toMicros(item.quantidade) * toMicros(item.preco_unitario)) / MICROS;
    const desconto = toMicros(item.desconto ?? '0');
    const promo = (line * BigInt(requested)) / 10000n;
    if (desconto < promo) {
      throw new AppError(
        422,
        'PROMOCAO_DESCONTO_INCONSISTENTE',
        'Line discount does not cover claimed promotional bps',
      );
    }
    if (desconto > line) {
      throw new AppError(422, 'PROMOCAO_DESCONTO_EXCEDE_LINHA', 'Promotional discount exceeds line subtotal');
    }
  }
}

/**
 * Snapshot de refs da promoção para Orçamento/Pedido.
 * Ausência de payload → snapshot vazio (sem promoção).
 * Payload presente → exige config ativa + cupom/bps + desconto de linha compatível.
 */
export function buildPromocaoDocumentoSnapshot(options: {
  promocao?: PromocaoPayloadRef | null;
  config: ComercialPromocaoConfig | null | undefined;
  items: PromocaoItem[];
}): PromocaoDocumentoSnapshot {
  if (!options.promocao) return emptyPromocaoDocumentoSnapshot();
  const authorized = assertPromocaoAutorizada({
    promocaoBps: options.promocao.bps,
    config: options.config,
    cupom: options.promocao.cupom,
  });
  assertDescontoCompativelComPromocao(options.items, authorized.promocaoBps);
  return {
    promocao_aplicada: true,
    promocao_bps: authorized.promocaoBps,
    promocao_cupom: authorized.cupom,
  };
}

/**
 * Copia snapshot já persistido (conversão Orçamento→Pedido).
 * Fail-closed se o par aplicada/bps estiver inconsistente.
 */
export function assertPersistedPromocaoSnapshot(
  snapshot: {
    promocao_aplicada?: boolean | null;
    promocao_bps?: number | null;
    promocao_cupom?: string | null;
  } | null | undefined,
): PromocaoDocumentoSnapshot {
  if (!snapshot || snapshot.promocao_aplicada !== true) {
    return emptyPromocaoDocumentoSnapshot();
  }
  const bps = snapshot.promocao_bps == null ? NaN : Number(snapshot.promocao_bps);
  if (!Number.isInteger(bps) || bps <= 0 || bps > 10000) {
    throw new AppError(422, 'PROMOCAO_SNAPSHOT_AUSENTE', 'Persisted promotional snapshot is invalid');
  }
  const cupomRaw = snapshot.promocao_cupom == null ? '' : String(snapshot.promocao_cupom).trim();
  return {
    promocao_aplicada: true,
    promocao_bps: bps,
    promocao_cupom: cupomRaw ? cupomRaw.slice(0, 64).toUpperCase() : null,
  };
}

/**
 * Aplica desconto promocional percentual (bps) em cada linha, somando ao desconto já informado.
 * Exige config ativa; cupom, se informado, deve estar na allowlist.
 */
export function aplicarDescontoPromocional<T extends PromocaoItem>(options: {
  items: T[];
  /** Basis points da promoção solicitada (100 = 1%). */
  promocaoBps: number;
  config: ComercialPromocaoConfig | null | undefined;
  cupom?: string | null;
}): { items: T[]; aplicada: boolean; promocaoBps: number } {
  const authorized = assertPromocaoAutorizada({
    promocaoBps: options.promocaoBps,
    config: options.config,
    cupom: options.cupom,
  });
  const requested = authorized.promocaoBps;

  const items = options.items.map((item) => {
    const line = (toMicros(item.quantidade) * toMicros(item.preco_unitario)) / MICROS;
    const existing = toMicros(item.desconto ?? '0');
    const promo = (line * BigInt(requested)) / 10000n;
    const next = existing + promo;
    if (next > line) {
      throw new AppError(422, 'PROMOCAO_DESCONTO_EXCEDE_LINHA', 'Promotional discount exceeds line subtotal');
    }
    return { ...item, desconto: fmtMoney(next) };
  });

  return { items, aplicada: true, promocaoBps: requested };
}
