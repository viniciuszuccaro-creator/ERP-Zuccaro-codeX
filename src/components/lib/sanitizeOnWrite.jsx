// Global sanitization utility for form payloads (XSS-safe best-effort)
export function sanitizeOnWrite(input) {
  const cleanString = (s) => {
    let out = String(s);
    out = out.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
    out = out.replace(/on[a-z]+\s*=\s*"[^"]*"/gi, '');
    out = out.replace(/on[a-z]+\s*=\s*'[^']*'/gi, '');
    out = out.replace(/javascript:\s*/gi, '');
    return out.trim();
  };
  const walk = (val) => {
    if (typeof val === 'string') return cleanString(val);
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === 'object') {
      const o = {};
      for (const [k, v] of Object.entries(val)) o[k] = walk(v);
      return o;
    }
    return val;
  };
  return walk(input);
}

export const SENSITIVE_AUDIT_KEY = /(token|senha|password|secret|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|cookie|certificado|private|webhook[_-]?url|linha_digitavel|cvv|cvc|pix_copia)/i;

export function sanitizeAuditText(value, max = 300) {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, max);
}

export function sanitizeAuditPayload(value, keyName = '', depth = 0) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (depth > 6) return { truncado: true };
  if (SENSITIVE_AUDIT_KEY.test(String(keyName || ''))) return { protegido: true };
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAuditPayload(item, keyName, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, 80).map(([key, item]) => [
        sanitizeAuditText(key, 80),
        sanitizeAuditPayload(item, key, depth + 1),
      ]),
    );
  }
  if (typeof value === 'string') return sanitizeAuditText(value, 500);
  return value;
}