import { sanitizeAuditSnapshot } from './sanitizeAuditSnapshot.js';
import { maskDocumento } from '../db/documentoValidators.js';

export function sanitizeClienteAudit(row: unknown): Record<string, unknown> | null {
  const snap = sanitizeAuditSnapshot(row);
  if (!snap) return null;
  if (snap.documento != null) snap.documento = maskDocumento(snap.documento);
  if (snap.documento_normalizado != null) snap.documento_normalizado = maskDocumento(snap.documento_normalizado);
  return snap;
}
