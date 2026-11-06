/** KPI fail-closed: loading/erro/sem contexto nunca viram lista vazia “pronta”. */
export function resolveUsuariosTabKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function isUsuariosTabScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function buildUsuariosTabUsersQueryKey({ groupId, empresaId, actorId, sessionKey }) {
  return ['usuarios-gestao', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

export function buildUsuariosTabPerfisQueryKey({ groupId, empresaId, actorId, sessionKey }) {
  return ['perfis-acesso-tab', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

export function buildUsuariosTabEmpresasQueryKey({ groupId, empresaId, actorId, sessionKey }) {
  return ['empresas-gestao', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

/**
 * @param {unknown} values
 * @returns {string[]}
 */
export function normalizeUsuariosTabEmpresaIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
}

/**
 * @param {object|null|undefined} u
 * @param {{
 *   contexto?: string|null,
 *   grupoAtivoId?: string|null,
 *   empresaAtivaId?: string|null,
 *   empresasDoGrupo?: Array<{id?: string}>,
 * }} [opts]
 */
export function usuarioNoEscopoUsuariosTab(u, {
  contexto,
  grupoAtivoId,
  empresaAtivaId,
  empresasDoGrupo = [],
} = {}) {
  if (!u) return false;
  const empresasVinculadas = normalizeUsuariosTabEmpresaIds(u.empresas_vinculadas);
  const temMarcadorEscopo = Boolean(
    u.group_id || u.grupo_id || u.grupo_atual_id || u.empresa_id || u.empresa_atual_id || empresasVinculadas.length,
  );
  if (!temMarcadorEscopo) return true;
  if (contexto === 'grupo') {
    const empresasIds = (Array.isArray(empresasDoGrupo) ? empresasDoGrupo : [])
      .map((e) => (e && typeof e === 'object' ? e.id : null))
      .filter(Boolean);
    return u.group_id === grupoAtivoId
      || u.grupo_id === grupoAtivoId
      || u.grupo_atual_id === grupoAtivoId
      || empresasVinculadas.some((id) => empresasIds.includes(id));
  }
  return u.empresa_id === empresaAtivaId
    || u.empresa_atual_id === empresaAtivaId
    || empresasVinculadas.includes(empresaAtivaId);
}

/**
 * @param {object|null|undefined} registro
 * @param {{
 *   contexto?: string|null,
 *   grupoAtivoId?: string|null,
 *   empresaAtivaId?: string|null,
 *   empresasDoGrupo?: Array<{id?: string}>,
 * }} [opts]
 */
export function registroNoEscopoUsuariosTab(registro, {
  contexto,
  grupoAtivoId,
  empresaAtivaId,
  empresasDoGrupo = [],
} = {}) {
  if (!registro) return false;
  const empresasVinculadas = normalizeUsuariosTabEmpresaIds(
    registro.empresas_vinculadas || registro.empresas || registro.empresas_ids,
  );
  const registroGroupId = registro.group_id || registro.grupo_id || registro.groupId || registro.grupoId;
  const registroEmpresaId = registro.empresa_id || registro.empresaId || registro.empresa_atual_id;
  const temMarcadorEscopo = Boolean(registroGroupId || registroEmpresaId || empresasVinculadas.length);
  if (!temMarcadorEscopo) return false;
  if (contexto === 'grupo') {
    const empresasIds = (Array.isArray(empresasDoGrupo) ? empresasDoGrupo : [])
      .map((e) => (e && typeof e === 'object' ? e.id : null))
      .filter(Boolean);
    return registroGroupId === grupoAtivoId || empresasVinculadas.some((id) => empresasIds.includes(id));
  }
  return registroGroupId === grupoAtivoId
    || registroEmpresaId === empresaAtivaId
    || empresasVinculadas.includes(empresaAtivaId);
}
