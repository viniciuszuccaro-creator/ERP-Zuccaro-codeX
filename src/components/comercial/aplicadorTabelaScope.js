/** Cache key: Grupo + Empresa + ator + sessão (sem token). */
export function buildAplicadorTabelaQueryKey(input) {
  return [
    'tabelas-preco-aplicador',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isAplicadorTabelaScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}
