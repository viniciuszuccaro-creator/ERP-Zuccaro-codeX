/** Fail-closed: sem contexto / loading / erro → permissões false (exceto admin explícito). */
export function resolveControleAcessoLogisticaKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasUser = Boolean(input?.hasUser);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!hasUser) return 'idle';
  if (!contextoValido) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function isControleAcessoLogisticaScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function buildControleAcessoLogisticaQueryKey({
  groupId,
  empresaId,
  actorId,
  sessionKey,
  perfilId,
}) {
  return [
    'perfilAcesso',
    groupId || null,
    empresaId || null,
    actorId || null,
    sessionKey || null,
    perfilId || null,
  ];
}

/**
 * @param {object|null|undefined} perfil
 * @param {object|null|undefined} user
 * @param {'ready'|'loading'|'error'|'unavailable'|'idle'} kpiState
 */
export function buildPermissoesLogistica(perfil, user, kpiState) {
  const isAdmin = user?.role === 'admin';
  if (kpiState !== 'ready' && !isAdmin) {
    return {
      podeCriarRomaneio: false,
      podeConfirmarEntrega: false,
      podeRegistrarOcorrencia: false,
      podeRoteirizar: false,
      podeVisualizarRotas: false,
      isAdmin: false,
    };
  }
  const permissoes = perfil?.permissoes?.logistica || {};
  return {
    podeCriarRomaneio: Boolean(permissoes.criarRomaneio || isAdmin),
    podeConfirmarEntrega: Boolean(permissoes.confirmarEntrega || isAdmin),
    podeRegistrarOcorrencia: Boolean(permissoes.registrarOcorrencia || isAdmin),
    podeRoteirizar: Boolean(permissoes.roteirizar?.includes('editar') || isAdmin),
    // Fail-closed: visualizar exige ready ou admin (antes liberava true sempre).
    podeVisualizarRotas: Boolean(
      isAdmin
      || (kpiState === 'ready' && (
        permissoes.roteirizar?.includes('visualizar')
        || permissoes.roteirizar?.includes('editar')
        || permissoes.visualizarRotas
      )),
    ),
    isAdmin,
  };
}
