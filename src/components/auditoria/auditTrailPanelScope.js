/** KPI fail-closed: loading/erro/sem contexto nunca viram lista vazia “pronta”. */
export function resolveAuditTrailKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const canView = Boolean(input?.canView);
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

export function isAuditTrailScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function buildAuditTrailLogsQueryKey({
  groupId,
  empresaId,
  actorId,
  sessionKey,
  filtro,
  limit,
}) {
  return ['audit-logs', groupId || null, empresaId || null, actorId || null, sessionKey || null, filtro, limit];
}

export function buildAuditTrailUsersQueryKey({
  groupId,
  empresaId,
  actorId,
  sessionKey,
}) {
  return ['admin-users', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

export function normalizeAuditTrailEmpresaIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
}

/**
 * Filtro local adicional sobre User (defense-in-depth após filterInContext).
 * @param {object|null|undefined} u
 * @param {{
 *   contexto?: string|null,
 *   grupoAtivoId?: string|null,
 *   empresaAtivaId?: string|null,
 *   empresasDoGrupo?: Array<{id?: string}>,
 * }} [opts]
 */
export function usuarioNoEscopoAuditTrail(u, {
  contexto,
  grupoAtivoId,
  empresaAtivaId,
  empresasDoGrupo = [],
} = {}) {
  if (!u) return false;
  const vinculadas = normalizeAuditTrailEmpresaIds(u.empresas_vinculadas);
  const temMarcacaoEscopo = u.group_id || u.grupo_id || u.grupo_atual_id
    || u.empresa_id || u.empresa_atual_id || vinculadas.length > 0;
  if (!temMarcacaoEscopo) return true;
  if (contexto === 'grupo') {
    const empresasIds = (Array.isArray(empresasDoGrupo) ? empresasDoGrupo : [])
      .map((e) => (e && typeof e === 'object' ? e.id : null))
      .filter(Boolean);
    return u.group_id === grupoAtivoId
      || u.grupo_id === grupoAtivoId
      || u.grupo_atual_id === grupoAtivoId
      || vinculadas.some((id) => empresasIds.includes(id));
  }
  return u.empresa_id === empresaAtivaId
    || u.empresa_atual_id === empresaAtivaId
    || vinculadas.includes(empresaAtivaId);
}
