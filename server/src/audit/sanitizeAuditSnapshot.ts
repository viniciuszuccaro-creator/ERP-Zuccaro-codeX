/**
 * Snapshot de auditoria genérico para entidades empresariais.
 *
 * Copia TODOS os campos próprios do registro (before/after completo),
 * excluindo apenas chaves sensíveis por denylist.
 *
 * NÃO usar pick parcial de id/group_id/empresa_id/ativo — isso omitia
 * campos alteráveis (ex.: nome_completo) no ERP-RUNTIME-02.
 */

const SENSITIVE_KEY_RE = /password|passwd|secret|token|jwt|authorization|service[_-]?role|credential|api[_-]?key|private[_-]?key|ssh|cookie|session/i;

/**
 * @returns objeto plano com campos auditáveis; null se row inválida
 */
export function sanitizeAuditSnapshot(row: unknown): Record<string, unknown> | null {
  if (row == null || typeof row !== 'object' || Array.isArray(row)) {
    return null;
  }

  const source = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(source)) {
    if (SENSITIVE_KEY_RE.test(key)) continue;
    const value = source[key];
    if (typeof value === 'function' || typeof value === 'symbol') continue;
    out[key] = cloneAuditValue(value);
  }

  return out;
}

function cloneAuditValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneAuditValue(item));
  }
  if (typeof value === 'object') {
    return sanitizeAuditSnapshot(value);
  }
  return String(value);
}

export function isSensitiveAuditKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}
