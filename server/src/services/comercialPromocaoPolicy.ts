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
  if (options.cupom != null && String(options.cupom).trim() !== '') {
    if (!cupomPromocionalAutorizado(options.cupom, cfg.cuponsPermitidos)) {
      throw new AppError(422, 'PROMOCAO_CUPOM_NEGADO', 'Cupom promocional não autorizado');
    }
  }

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
