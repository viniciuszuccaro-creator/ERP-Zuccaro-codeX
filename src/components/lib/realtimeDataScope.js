export function isRealtimeScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function assertRealtimeContext(groupId, empresaId) {
  if (!groupId && !empresaId) {
    throw Object.assign(new Error('REALTIME_SCOPE_BLOCKED'), {
      code: 'REALTIME_SCOPE_BLOCKED',
    });
  }
}

export function filterActiveRealtimeEntregas(entregas) {
  const rows = Array.isArray(entregas) ? entregas : [];
  return rows.filter((e) => !['Entregue', 'Cancelado', 'Devolvido'].includes(e?.status));
}

export function pickRealtimeFirstRow(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
