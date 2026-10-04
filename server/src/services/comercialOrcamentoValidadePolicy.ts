/**
 * Validade do Orçamento — fail-closed em create/update/convert.
 * Sem migration: usa `validade_em` já persistido (datetime ISO).
 */
import { AppError } from '../api/errors.js';

export const ORCAMENTO_VALIDADE_EXPIRADA = 'ORCAMENTO_VALIDADE_EXPIRADA';
export const ORCAMENTO_VALIDADE_INVALIDA = 'ORCAMENTO_VALIDADE_INVALIDA';

/**
 * Interpreta `validade_em` como instante absoluto (ISO datetime).
 * Fail-closed: string vazia/ inválida / NaN → 422.
 */
export function parseOrcamentoValidadeEm(validadeEm: unknown): Date {
  if (typeof validadeEm !== 'string' || !validadeEm.trim()) {
    throw new AppError(422, ORCAMENTO_VALIDADE_INVALIDA, 'Orcamento validade_em is required');
  }
  const parsed = new Date(validadeEm);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(422, ORCAMENTO_VALIDADE_INVALIDA, 'Orcamento validade_em is invalid');
  }
  return parsed;
}

/**
 * True quando o instante de validade já passou (strict: validade_em < now).
 * Igualdade no mesmo milissegundo ainda é válida.
 */
export function isOrcamentoValidadeExpirada(
  validadeEm: unknown,
  now: Date | number = Date.now(),
): boolean {
  const validade = parseOrcamentoValidadeEm(validadeEm);
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return validade.getTime() < nowMs;
}

/**
 * Bloqueia create/update/convert quando validade_em já expirou.
 * Opcional `now` para testes determinísticos.
 */
export function assertOrcamentoValidadeVigente(
  validadeEm: unknown,
  now: Date | number = Date.now(),
): Date {
  const validade = parseOrcamentoValidadeEm(validadeEm);
  const nowMs = typeof now === 'number' ? now : now.getTime();
  if (validade.getTime() < nowMs) {
    throw new AppError(
      422,
      ORCAMENTO_VALIDADE_EXPIRADA,
      'Orcamento validade_em has expired',
      { validade_em: validade.toISOString() },
    );
  }
  return validade;
}
