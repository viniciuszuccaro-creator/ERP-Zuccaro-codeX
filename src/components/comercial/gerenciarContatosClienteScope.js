/** Cache key: Grupo + Empresa + ator + sessão + clienteId (sem token). */
export function buildGerenciarContatosClienteQueryKey(input) {
  return [
    'cliente-contatos',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
    input?.clienteId || null,
  ];
}

export function isGerenciarContatosClienteScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}
