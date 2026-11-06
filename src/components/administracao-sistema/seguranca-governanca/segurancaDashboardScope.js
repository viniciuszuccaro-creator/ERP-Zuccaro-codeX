/** KPI fail-closed: loading/erro/sem contexto nunca viram cobertura/total 0 “pronto”. */
export function resolveSegurancaDashboardKpiState(input) {
  const canView = Boolean(input?.canView);
  const contextoValido = Boolean(input?.contextoValido);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!canView) return 'idle';
  if (!contextoValido) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function isSegurancaDashboardScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function buildSegurancaDashboardQueryKey({ groupId, empresaId, actorId, sessionKey }) {
  return ['seguranca-dashboard-real', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

/**
 * @param {object|null|undefined} usuario
 * @param {{
 *   contexto?: string|null,
 *   grupoAtivoId?: string|null,
 *   empresaAtivaId?: string|null,
 *   empresasDoGrupo?: Array<{id?: string}>,
 * }} [opts]
 */
export function usuarioNoEscopoSegurancaDashboard(usuario, {
  contexto,
  grupoAtivoId,
  empresaAtivaId,
  empresasDoGrupo = [],
} = {}) {
  if (!usuario) return false;
  if (contexto === 'grupo') {
    const empresasIds = (Array.isArray(empresasDoGrupo) ? empresasDoGrupo : [])
      .map((empresa) => (empresa && typeof empresa === 'object' ? empresa.id : null))
      .filter(Boolean);
    const vinculadas = Array.isArray(usuario.empresas_vinculadas) ? usuario.empresas_vinculadas : [];
    return usuario.group_id === grupoAtivoId
      || usuario.grupo_id === grupoAtivoId
      || usuario.grupo_atual_id === grupoAtivoId
      || vinculadas.some((v) => empresasIds.includes(v?.empresa_id || v?.id || v));
  }
  return !empresaAtivaId
    || usuario.empresa_id === empresaAtivaId
    || usuario.empresa_atual_id === empresaAtivaId
    || (Array.isArray(usuario.empresas_vinculadas)
      && usuario.empresas_vinculadas.some((v) => (v?.empresa_id || v?.id || v) === empresaAtivaId));
}

export function buildSegurancaDashboardEstatisticas(usuarios, auditoriaAcessos) {
  const rows = Array.isArray(usuarios) ? usuarios : [];
  const audit = Array.isArray(auditoriaAcessos) ? auditoriaAcessos : [];
  const usuariosComPerfil = rows.filter((usuario) => usuario.perfil_acesso_id).length;
  return {
    cobertura: rows.length ? Math.round((usuariosComPerfil / rows.length) * 100) : 0,
    totalUsuarios: rows.length,
    conflitosTotal: audit.filter((item) =>
      String(item?.acao || item?.descricao || '').toLowerCase().includes('conflito'),
    ).length,
  };
}
