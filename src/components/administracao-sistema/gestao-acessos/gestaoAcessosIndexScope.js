/** KPI fail-closed: loading/erro/sem contexto nunca viram total 0 “pronto”. */
export function resolveGestaoAcessosKpiState(input) {
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

export function isGestaoAcessosScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function buildGestaoAcessosPerfisQueryKey({ groupId, empresaId, actorId, sessionKey }) {
  return ['perfis-acesso', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

export function buildGestaoAcessosUsersQueryKey({ groupId, empresaId, actorId, sessionKey }) {
  return ['usuarios', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

export function buildGestaoAcessosEmpresasQueryKey({ groupId, empresaId, actorId, sessionKey }) {
  return ['empresas-ga', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

/**
 * @param {unknown} values
 * @returns {string[]}
 */
export function normalizeGestaoAcessosEmpresaIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
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
export function registroNoEscopoGestaoAcessos(registro, {
  contexto,
  grupoAtivoId,
  empresaAtivaId,
  empresasDoGrupo = [],
} = {}) {
  if (!registro) return false;
  const empresasVinculadas = normalizeGestaoAcessosEmpresaIds(
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

/**
 * @param {object|null|undefined} u
 * @param {{
 *   contexto?: string|null,
 *   grupoAtivoId?: string|null,
 *   empresaAtivaId?: string|null,
 *   empresasDoGrupo?: Array<{id?: string}>,
 * }} [opts]
 * @returns {{ inclui: boolean, semMarcador: boolean }}
 */
export function usuarioNoEscopoGestaoAcessos(u, {
  contexto,
  grupoAtivoId,
  empresaAtivaId,
  empresasDoGrupo = [],
} = {}) {
  if (!u) return { inclui: false, semMarcador: false };
  const empresasVinculadas = normalizeGestaoAcessosEmpresaIds(u.empresas_vinculadas);
  const temMarcadorEscopo = Boolean(
    u.group_id || u.grupo_id || u.grupo_atual_id || u.empresa_id || u.empresa_atual_id || empresasVinculadas.length,
  );
  if (!temMarcadorEscopo) return { inclui: true, semMarcador: true };
  if (contexto === 'grupo') {
    const empresasIds = (Array.isArray(empresasDoGrupo) ? empresasDoGrupo : [])
      .map((e) => (e && typeof e === 'object' ? e.id : null))
      .filter(Boolean);
    const inclui = u.group_id === grupoAtivoId
      || u.grupo_id === grupoAtivoId
      || u.grupo_atual_id === grupoAtivoId
      || empresasVinculadas.some((id) => empresasIds.includes(id));
    return { inclui, semMarcador: false };
  }
  const inclui = u.empresa_id === empresaAtivaId
    || u.empresa_atual_id === empresaAtivaId
    || empresasVinculadas.includes(empresaAtivaId);
  return { inclui, semMarcador: false };
}

export function countUsuariosSemPerfilGestaoAcessos(usuarios) {
  const rows = Array.isArray(usuarios) ? usuarios : [];
  return rows.filter((u) => !u.perfil_acesso_id && u.role !== 'admin').length;
}

export function countPerfisAtivosGestaoAcessos(perfis) {
  const rows = Array.isArray(perfis) ? perfis : [];
  return rows.filter((p) => p.ativo !== false).length;
}
