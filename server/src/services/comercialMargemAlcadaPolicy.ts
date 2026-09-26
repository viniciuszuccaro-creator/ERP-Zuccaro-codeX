/**
 * Alçada de margem mínima Comercial 360 (Onda 2) — política pura.
 * Custo NÃO vive no Produto MASTER DATA; vem de porta opcional (CostPort).
 * Sem porta / sem custo para o item → não inventa (skip). Com custo → abaixo da mínima exige `aprovar`.
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

/** Porta mínima de custo unitário (estoque/compras/produção — fora do MASTER DATA). */
export type ComercialCostPort = {
  getUnitCost(input: {
    groupId: string;
    empresaId: string;
    produtoId: string;
    unidadeMedidaId: string;
  }): Promise<{ custo_unitario: string; margem_minima_bps?: number } | null>;
};

export type MargemAlcadaItem = {
  produto_id: string;
  unidade_id: string;
  quantidade: string;
  preco_unitario: string;
  desconto?: string | null;
};

/** Margem mínima padrão em bps sobre o líquido (0 = não vender abaixo do custo). */
export const MARGEM_MINIMA_BPS_DEFAULT = 0;

export type MargemLineResult = {
  produto_id: string;
  netMicros: bigint;
  costMicros: bigint;
  margemBps: number | null;
  abaixoDaMinima: boolean;
  minimaBps: number;
};

/**
 * Comparação inteira: (net - cost) * 10000 < net * minimaBps
 * (evita truncar frações de bp como no desconto).
 */
export function lineAbaixoDaMargemMinima(
  netMicros: bigint,
  costMicros: bigint,
  minimaBps: number,
): boolean {
  if (costMicros < 0n) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid unit cost');
  }
  const lim = Number.isFinite(minimaBps) ? Math.max(0, Math.trunc(minimaBps)) : 0;
  if (netMicros <= 0n) {
    // Líquido zerado/negativo com custo conhecido → abaixo da mínima.
    return costMicros > 0n || lim > 0;
  }
  return (netMicros - costMicros) * 10000n < netMicros * BigInt(lim);
}

export function computeMargemBps(netMicros: bigint, costMicros: bigint): number | null {
  if (netMicros <= 0n) return null;
  return Number(((netMicros - costMicros) * 10000n) / netMicros);
}

export async function evaluateMargemAlcada(options: {
  groupId: string;
  empresaId: string;
  items: MargemAlcadaItem[];
  costs: ComercialCostPort;
  defaultMinimaBps?: number;
}): Promise<{ evaluated: MargemLineResult[]; anyAbaixo: boolean }> {
  const defaultMin = options.defaultMinimaBps ?? MARGEM_MINIMA_BPS_DEFAULT;
  const evaluated: MargemLineResult[] = [];
  let anyAbaixo = false;

  for (const item of options.items) {
    const costRow = await options.costs.getUnitCost({
      groupId: options.groupId,
      empresaId: options.empresaId,
      produtoId: item.produto_id,
      unidadeMedidaId: item.unidade_id,
    });
    if (!costRow) continue; // sem custo → não inventa

    const qty = toMicros(item.quantidade);
    const price = toMicros(item.preco_unitario);
    const discount = toMicros(item.desconto ?? '0');
    const line = (qty * price) / MICROS;
    if (discount < 0n || discount > line) {
      throw new AppError(422, 'ORCAMENTO_DESCONTO_INVALIDO', 'Item discount exceeds line subtotal');
    }
    const net = line - discount;
    const unitCost = toMicros(costRow.custo_unitario);
    if (unitCost < 0n) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid unit cost');
    }
    const costMicros = (qty * unitCost) / MICROS;
    const minimaBps = costRow.margem_minima_bps ?? defaultMin;
    const abaixo = lineAbaixoDaMargemMinima(net, costMicros, minimaBps);
    if (abaixo) anyAbaixo = true;
    evaluated.push({
      produto_id: item.produto_id,
      netMicros: net,
      costMicros,
      margemBps: computeMargemBps(net, costMicros),
      abaixoDaMinima: abaixo,
      minimaBps: Number.isFinite(minimaBps) ? Math.max(0, Math.trunc(minimaBps)) : 0,
    });
  }

  return { evaluated, anyAbaixo };
}

export async function assertMargemDentroDaAlcadaOuAprovar(options: {
  groupId: string;
  empresaId: string;
  items: MargemAlcadaItem[];
  costs: ComercialCostPort | null | undefined;
  canAprovar: boolean;
  entityLabel?: string;
  defaultMinimaBps?: number;
}): Promise<void> {
  if (!options.costs) return; // porta ausente → skip (custo ainda não no MASTER DATA)
  const { anyAbaixo } = await evaluateMargemAlcada({
    groupId: options.groupId,
    empresaId: options.empresaId,
    items: options.items,
    costs: options.costs,
    defaultMinimaBps: options.defaultMinimaBps,
  });
  if (!anyAbaixo) return;
  if (options.canAprovar) return;
  throw new AppError(
    403,
    'MARGEM_ALCADA_DENIED',
    `${options.entityLabel || 'Documento'} com margem abaixo da mínima exige permissão de aprovar`,
  );
}
