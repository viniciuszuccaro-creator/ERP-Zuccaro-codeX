export function isSeletorEnderecoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function assertSeletorEnderecoContext(groupId, empresaId) {
  if (!groupId && !empresaId) {
    const err = Object.assign(
      new Error('SELETOR_ENDERECO_SCOPE_BLOCKED'),
      { code: 'SELETOR_ENDERECO_SCOPE_BLOCKED' },
    );
    throw err;
  }
}

export function assertSeletorEnderecoClienteId(cliente) {
  const id = cliente?.id;
  if (!id) {
    const err = Object.assign(
      new Error('SELETOR_ENDERECO_CLIENTE_REQUIRED'),
      { code: 'SELETOR_ENDERECO_CLIENTE_REQUIRED' },
    );
    throw err;
  }
  return id;
}

export function buildSeletorEnderecoLocais(cliente, novoEndereco) {
  const atuais = Array.isArray(cliente?.locais_entrega) ? cliente.locais_entrega : [];
  return [...atuais, { ...novoEndereco }];
}
