import { AppError } from '../api/errors.js';
import { condicaoPagamentoParcelaSchema, condicaoPagamentoParcelasSchema } from '../repositories/condicaoPagamentoTypes.js';

const PERCENTUAL_TOTAL = 100_000_000n;
const MS_POR_DIA = 86_400_000;

function invalid(code: string): never {
  throw new AppError(422, code, 'Nao foi possivel projetar as parcelas do faturamento.');
}

function percentualEmMicros(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

function formatCents(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export function quantizarTotalPedidoParaFaturamento(total: string): string {
  const match = /^(\d{1,14})(?:\.(\d{1,6}))?$/.exec(total);
  if (!match) invalid('FATURAMENTO_TOTAL_PEDIDO_INVALIDO');
  const fraction = (match[2] ?? '').padEnd(6, '0');
  const micros = BigInt(match[1]) * 1_000_000n + BigInt(fraction);
  const cents = (micros + 5_000n) / 10_000n;
  if (cents <= 0n || cents >= 10_000_000_000_000_000n) invalid('FATURAMENTO_TOTAL_PEDIDO_INVALIDO');
  return formatCents(cents);
}

export function projetarParcelasFaturamento(total: string, dataEmissao: string, parcelas: unknown) {
  const centsMatch = /^(\d{1,14})(?:\.(\d{1,2})0{0,4})?$/.exec(total);
  if (!centsMatch) invalid('FATURAMENTO_TOTAL_NAO_EXPRESSO_EM_CENTAVOS');
  const cents = BigInt(centsMatch[1]) * 100n + BigInt((centsMatch[2] ?? '').padEnd(2, '0'));
  if (!Array.isArray(parcelas) || parcelas.length < 1 || parcelas.length > 120
      || !parcelas.every(parcela => condicaoPagamentoParcelaSchema.safeParse(parcela).success)) {
    invalid('FATURAMENTO_PARCELAS_INVALIDAS');
  }
  const parsed = condicaoPagamentoParcelasSchema.safeParse(parcelas);
  if (!parsed.success) invalid('FATURAMENTO_PARCELAS_INVALIDAS');
  const emitted = Date.parse(`${dataEmissao}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEmissao) || !Number.isFinite(emitted)
      || new Date(emitted).toISOString().slice(0, 10) !== dataEmissao) {
    invalid('FATURAMENTO_DATA_INVALIDA');
  }
  const shares = parsed.data.map(parcela => {
    const scaled = cents * percentualEmMicros(parcela.percentual);
    return { ...parcela, cents: scaled / PERCENTUAL_TOTAL, remainder: scaled % PERCENTUAL_TOTAL };
  });
  let remaining = cents - shares.reduce((sum, parcela) => sum + parcela.cents, 0n);
  // Largest fractional remainder receives each cent; installment order breaks ties.
  shares.sort((a, b) => a.remainder === b.remainder ? a.ordem - b.ordem : a.remainder > b.remainder ? -1 : 1);
  for (const share of shares) {
    if (remaining === 0n) break;
    share.cents += 1n;
    remaining -= 1n;
  }
  return shares.sort((a, b) => a.ordem - b.ordem).map(share => {
    if (share.cents <= 0n) invalid('FATURAMENTO_PARCELA_SEM_VALOR');
    const vencimento = new Date(emitted + share.dias * MS_POR_DIA).toISOString();
    if (!/^\d{4}-/.test(vencimento)) invalid('FATURAMENTO_DATA_INVALIDA');
    return {
      ordem: share.ordem,
      vencimento: vencimento.slice(0, 10),
      valor: formatCents(share.cents),
    };
  });
}
