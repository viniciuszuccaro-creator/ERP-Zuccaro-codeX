/**
 * Validação CPF/CNPJ (espelho da política localCadastroMasterPolicy — sem duplicar lib externa).
 */

export function normalizeDocumento(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function allSameDigits(document: string): boolean {
  return /^(\d)\1+$/.test(document);
}

export function isValidCpf(value: unknown): boolean {
  const document = normalizeDocumento(value);
  if (document.length !== 11 || allSameDigits(document)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(document[i]) * (10 - i);
  let dig = (sum * 10) % 11;
  if (dig === 10) dig = 0;
  if (dig !== Number(document[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(document[i]) * (11 - i);
  dig = (sum * 10) % 11;
  if (dig === 10) dig = 0;
  return dig === Number(document[10]);
}

export function isValidCnpj(value: unknown): boolean {
  const document = normalizeDocumento(value);
  if (document.length !== 14 || allSameDigits(document)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(base[i]) * w, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(document, w1);
  const d2 = calc(document.slice(0, 12) + String(d1), w2);
  return d1 === Number(document[12]) && d2 === Number(document[13]);
}

/** Mascara documento para auditoria/logs. */
export function maskDocumento(value: unknown): string | null {
  const d = normalizeDocumento(value);
  if (!d) return null;
  if (d.length === 11) return `***.***.***-${d.slice(-2)}`;
  if (d.length === 14) return `**.***.***/****-${d.slice(-2)}`;
  return '***';
}
