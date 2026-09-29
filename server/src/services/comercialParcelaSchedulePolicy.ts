/**
 * Agenda de parcelas a partir da condição canônica (Onda 2).
 * Proporções exatas em micros; resíduo monetário fica na última parcela ativa.
 * Não materializa Conta a Receber — só simula vencimentos/valores do documento.
 */
import { AppError } from '../api/errors.js';

const MICROS = 1_000_000n;

export type ParcelaScheduleInput = {
  ordem: number;
  dias: number;
  percentual: string;
  ativo?: boolean;
};

export type ParcelaScheduleItem = {
  ordem: number;
  dias: number;
  percentual: string;
  valor: string;
  vencimento: string;
};

function toMicros(value: string): bigint {
  const raw = String(value ?? '0').trim();
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid money/percent amount');
  }
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * MICROS + BigInt(`${fraction}000000`.slice(0, 6));
}

function fmtMoney(micros: bigint): string {
  const neg = micros < 0n;
  const abs = neg ? -micros : micros;
  const whole = abs / MICROS;
  const frac = (abs % MICROS).toString().padStart(6, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

function addDaysUtc(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid base date for parcela schedule');
  }
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/**
 * Parcelas ativas ordenadas; soma de percentuais deve ser 100.000000 (já validado no cadastro).
 * Valor = floor(total * pct / 100) em micros; última parcela absorve o resíduo.
 */
export function buildParcelaSchedule(options: {
  total: string;
  parcelas: ParcelaScheduleInput[] | null | undefined;
  baseDate: string;
}): ParcelaScheduleItem[] {
  const totalMicros = toMicros(options.total);
  if (totalMicros < 0n) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Total must be >= 0');
  }
  const ativas = (options.parcelas ?? [])
    .filter((p) => p?.ativo !== false)
    .slice()
    .sort((a, b) => a.ordem - b.ordem);
  if (ativas.length === 0) {
    throw new AppError(422, 'CONDICAO_PAGAMENTO_SEM_PARCELAS', 'Active condition requires at least one parcela');
  }

  let allocated = 0n;
  const rows: ParcelaScheduleItem[] = [];
  for (let i = 0; i < ativas.length; i += 1) {
    const parcela = ativas[i]!;
    const pctMicros = toMicros(String(parcela.percentual));
    if (pctMicros <= 0n) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Parcela percentual must be > 0');
    }
    const isLast = i === ativas.length - 1;
    const valorMicros = isLast
      ? totalMicros - allocated
      : (totalMicros * pctMicros) / (100n * MICROS);
    if (!isLast) allocated += valorMicros;
    rows.push({
      ordem: parcela.ordem,
      dias: parcela.dias,
      percentual: String(parcela.percentual),
      valor: fmtMoney(valorMicros),
      vencimento: addDaysUtc(options.baseDate, parcela.dias),
    });
  }

  const sumValores = rows.reduce((acc, row) => acc + toMicros(row.valor), 0n);
  if (sumValores !== totalMicros) {
    throw new AppError(500, 'PARCELA_SCHEDULE_INCONSISTENTE', 'Parcela schedule does not sum to total');
  }
  return rows;
}
