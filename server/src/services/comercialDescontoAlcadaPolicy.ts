/**
 * Alçada de desconto Comercial 360 (Onda 2) — política pura sobre itens já precificados.
 * Sem módulo paralelo: Orçamento/Pedido existentes exigem `aprovar` acima da alçada livre.
 */
import { AppError } from '../api/errors.js';

const MICROS = 1_000_000n;

function toMicros(value: string): bigint {
  const raw = String(value ?? '0').trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid money amount');
  }
  const neg = raw.startsWith('-');
  const [intPart, fracPart = ''] = (neg ? raw.slice(1) : raw).split('.');
  const frac = `${fracPart}000000`.slice(0, 6);
  const micros = BigInt(intPart || '0') * MICROS + BigInt(frac || '0');
  return neg ? -micros : micros;
}

export type DescontoAlcadaItem = {
  quantidade: string;
  preco_unitario: string;
  desconto?: string | null;
};

/** Alçada livre em basis points do subtotal (0 = qualquer desconto exige aprovar). */
export const DESCONTO_ALCADA_LIVRE_BPS_DEFAULT = 0;

export function computeDescontoBps(items: DescontoAlcadaItem[]): {
  subtotalMicros: bigint;
  descontoMicros: bigint;
  descontoBps: number;
} {
  let subtotal = 0n;
  let desconto = 0n;
  for (const item of items) {
    const line = (toMicros(item.quantidade) * toMicros(item.preco_unitario)) / MICROS;
    const d = toMicros(item.desconto ?? '0');
    if (d < 0n || d > line) {
      throw new AppError(422, 'ORCAMENTO_DESCONTO_INVALIDO', 'Item discount exceeds line subtotal');
    }
    subtotal += line;
    desconto += d;
  }
  if (subtotal <= 0n) {
    return { subtotalMicros: subtotal, descontoMicros: desconto, descontoBps: 0 };
  }
  // bps = desconto * 10000 / subtotal
  const descontoBps = Number((desconto * 10000n) / subtotal);
  return { subtotalMicros: subtotal, descontoMicros: desconto, descontoBps };
}

export function descontoExcedeAlcadaLivre(
  items: DescontoAlcadaItem[],
  livreBps: number = DESCONTO_ALCADA_LIVRE_BPS_DEFAULT,
): boolean {
  const { subtotalMicros, descontoMicros } = computeDescontoBps(items);
  if (descontoMicros <= 0n) return false;
  if (subtotalMicros <= 0n) return true;
  const lim = Number.isFinite(livreBps) ? Math.max(0, Math.trunc(livreBps)) : 0;
  // Comparação inteira: evita truncar bps < 1 (ex.: 0.01 em 1000 → 0 bp truncado).
  return descontoMicros * 10000n > subtotalMicros * BigInt(lim);
}

export function assertDescontoDentroDaAlcadaOuAprovar(options: {
  items: DescontoAlcadaItem[];
  livreBps?: number;
  canAprovar: boolean;
  entityLabel?: string;
  /** Quando true (à vista + regra explícita), não exige aprovar. */
  liberadoPorAvista?: boolean;
}): void {
  // Valida desconto vs subtotal sempre (mesmo com isenção à vista) — evita 500 no calculate.
  computeDescontoBps(options.items);
  if (options.liberadoPorAvista === true) return;
  if (!descontoExcedeAlcadaLivre(options.items, options.livreBps)) return;
  if (options.canAprovar) return;
  throw new AppError(
    403,
    'DESCONTO_ALCADA_DENIED',
    `${options.entityLabel || 'Documento'} com desconto acima da alçada livre exige permissão de aprovar`,
  );
}
