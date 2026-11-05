/** Cache key: pedido + Grupo + Empresa + ator + sessão (sem token). */
export function buildPainelEntregasQueryKey(input) {
  return [
    'entregas-pedido',
    input?.pedidoId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isPainelEntregasScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}
