/**
 * Data de entrega do cliente no Pedido — fail-closed quando modalidade ENTREGA.
 * Reusa `data_entrega_solicitada` já no schema (mig 017); sem coluna nova.
 * RETIRADA: schema ainda exige datetime; este gate de calendário não aplica.
 */
import { AppError } from '../api/errors.js';

export const PEDIDO_DATA_ENTREGA_OBRIGATORIA = 'PEDIDO_DATA_ENTREGA_OBRIGATORIA';
export const PEDIDO_DATA_ENTREGA_INVALIDA = 'PEDIDO_DATA_ENTREGA_INVALIDA';
export const PEDIDO_DATA_ENTREGA_PASSADA = 'PEDIDO_DATA_ENTREGA_PASSADA';

/** YYYY-MM-DD a partir de date-only ou ISO datetime (UTC calendar day). */
export function toPedidoEntregaCalendarDay(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(422, PEDIDO_DATA_ENTREGA_INVALIDA, 'Pedido data_entrega_solicitada is required');
  }
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(422, PEDIDO_DATA_ENTREGA_INVALIDA, 'Pedido data_entrega_solicitada is invalid');
  }
  return parsed.toISOString().slice(0, 10);
}

export function todayPedidoEntregaCalendarDay(now: Date | number = Date.now()): string {
  const ms = typeof now === 'number' ? now : now.getTime();
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * True quando o dia civil da data solicitada é anterior a hoje (UTC YMD).
 * Hoje e futuro → false (allow today+).
 */
export function isPedidoDataEntregaPassada(
  dataEntregaSolicitada: unknown,
  now: Date | number = Date.now(),
): boolean {
  const day = toPedidoEntregaCalendarDay(dataEntregaSolicitada);
  return day < todayPedidoEntregaCalendarDay(now);
}

/**
 * ENTREGA: exige data válida e calendário >= hoje.
 * RETIRADA / outros: no-op (não inventa regra; schema Zod cobre presença).
 */
export function assertPedidoDataEntregaCliente(
  tipoOperacao: unknown,
  dataEntregaSolicitada: unknown,
  now: Date | number = Date.now(),
): string | null {
  const tipo = String(tipoOperacao ?? '').trim().toUpperCase();
  if (tipo !== 'ENTREGA') return null;

  if (typeof dataEntregaSolicitada !== 'string' || !dataEntregaSolicitada.trim()) {
    throw new AppError(
      422,
      PEDIDO_DATA_ENTREGA_OBRIGATORIA,
      'Pedido ENTREGA requires data_entrega_solicitada (cliente)',
    );
  }

  const day = toPedidoEntregaCalendarDay(dataEntregaSolicitada);
  if (day < todayPedidoEntregaCalendarDay(now)) {
    throw new AppError(
      422,
      PEDIDO_DATA_ENTREGA_PASSADA,
      'Pedido data_entrega_solicitada cannot be in the past',
      { data_entrega_solicitada: dataEntregaSolicitada, calendar_day: day },
    );
  }
  return day;
}
