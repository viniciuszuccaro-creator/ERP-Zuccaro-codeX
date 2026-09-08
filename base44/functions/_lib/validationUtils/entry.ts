export function ensureEventType(event, expectedType) {
  return event?.type === expectedType;
}

export function resolveEntityIdFromPayload(payload, keys = []) {
  if (!payload || typeof payload !== 'object') return null;
  for (const k of keys) {
    const v = payload?.[k];
    if (typeof v === 'string' && v) return v;
  }
  const data = payload?.data;
  const event = payload?.event;
  return data?.id || event?.entity_id || null;
}

export function isApprovedStatus(data, field = 'status', approved = 'Aprovado') {
  if (!data || typeof data !== 'object') return false;
  const s = data?.[field];
  if (!s) return false;
  return String(s).trim().toLowerCase() === String(approved).trim().toLowerCase();
}