/**
 * Normalização de busca com paridade ao frontend `normalizeMasterQuery`
 * (comercialMasterPicker): remove diacríticos + lower + trim.
 * Usado em listagens server-side (cliente/produto) para não descartar
 * "Aço" quando o termo é "aco".
 */

const ACCENT_FROM = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const ACCENT_TO = 'aaaaaeeeeiiiiooooouuuucn';

/** Termo de busca: NFD + strip combining marks (mesmo contrato do picker). */
export function foldSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Expressão SQL que dobra acentos em coluna/texto já trusted (nunca interpolar input).
 * Ex.: sqlFoldAccentExpr("coalesce(nome,'')") → translate(lower(...), ...)
 */
export function sqlFoldAccentExpr(columnSql: string): string {
  const expr = String(columnSql || '').trim();
  // Allowlist: identificador ou coalesce(col, '') — nunca interpolar input do cliente.
  if (!(/^[\w.]+$/.test(expr) || /^coalesce\([\w.]+,\s*''\)$/.test(expr))) {
    throw new Error('sqlFoldAccentExpr: expressão de coluna inválida');
  }
  return `translate(lower(${expr}), '${ACCENT_FROM}', '${ACCENT_TO}')`;
}
