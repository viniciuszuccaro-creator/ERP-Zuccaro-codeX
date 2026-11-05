export function isLiveMapScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function canLiveMapFetchDestino({ entregaId, contextoValido, canView }) {
  return Boolean(entregaId) && Boolean(contextoValido) && Boolean(canView);
}

export function pickLiveMapDestinoFromEntrega(entrega) {
  if (!entrega) return null;
  const lat = entrega?.endereco_entrega_completo?.latitude;
  const lng = entrega?.endereco_entrega_completo?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng, cliente: entrega.cliente_nome };
}
