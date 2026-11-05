/** Cache key: Grupo + Empresa + ator + sessão (sem token). */
export function buildBadgeOrigemQueryKey(input) {
  return [
    'parametros-origem-pedido-badge',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isBadgeOrigemScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}
