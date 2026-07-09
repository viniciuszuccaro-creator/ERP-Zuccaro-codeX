export const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
  .map((item) => (typeof item === "string" ? item : item?.empresa_id || item?.id))
  .filter(Boolean);

export const perfilNoEscopo = ({ perfil, contexto, grupoAtivoId, empresaAtivaId, empresasGrupoIds = [] }) => {
  if (!perfil) return false;

  const vinculadas = normalizeEmpresaIds(
    perfil.empresas_vinculadas || perfil.empresas || perfil.empresas_ids || perfil.empresas_grupo_ids
  );
  const perfilGroupId = perfil.group_id || perfil.grupo_id || perfil.groupId || perfil.grupoId;
  const perfilEmpresaId = perfil.empresa_id || perfil.empresaId || perfil.empresa_atual_id;
  const temMarcacaoEscopo = Boolean(perfilGroupId || perfilEmpresaId || vinculadas.length);

  if (!temMarcacaoEscopo) return false;
  if (contexto === "grupo") {
    return perfilGroupId === grupoAtivoId || vinculadas.some((id) => empresasGrupoIds.includes(id));
  }

  return perfilGroupId === grupoAtivoId || perfilEmpresaId === empresaAtivaId || vinculadas.includes(empresaAtivaId);
};

export const usuarioNoEscopo = ({ usuario, contexto, grupoAtivoId, empresaAtivaId, empresasGrupoIds = [] }) => {
  if (!usuario) return false;

  const vinculadas = normalizeEmpresaIds(usuario.empresas_vinculadas);
  const temMarcacaoEscopo = Boolean(
    usuario.group_id ||
    usuario.grupo_id ||
    usuario.grupo_atual_id ||
    usuario.empresa_id ||
    usuario.empresa_atual_id ||
    vinculadas.length
  );

  if (!temMarcacaoEscopo) return true;
  if (contexto === "grupo") {
    return usuario.group_id === grupoAtivoId ||
      usuario.grupo_id === grupoAtivoId ||
      usuario.grupo_atual_id === grupoAtivoId ||
      vinculadas.some((id) => empresasGrupoIds.includes(id));
  }

  return usuario.empresa_id === empresaAtivaId ||
    usuario.empresa_atual_id === empresaAtivaId ||
    vinculadas.includes(empresaAtivaId);
};

export const buildRbacContextData = ({ contexto, contextoValido, grupoAtivoId, empresaAtivaId, empresasGrupoIds = [] }) => ({
  contexto: contexto || "sem-contexto",
  contexto_valido: Boolean(contextoValido),
  group_id: grupoAtivoId || null,
  empresa_id: empresaAtivaId || null,
  empresas_grupo_ids: empresasGrupoIds,
  permissao_base: "Sistema.Controle de Acesso",
});

export const buildPerfilRbacPayload = ({ data = {}, contexto, contextoValido, grupoAtivoId, empresaAtivaId, empresasGrupoIds = [] }) => ({
  ...data,
  contexto_valido: Boolean(contextoValido),
  group_id: grupoAtivoId || null,
  grupo_id: grupoAtivoId || null,
  ...(empresaAtivaId ? { empresa_id: empresaAtivaId } : {}),
  ...(contexto === "grupo" ? { empresas_grupo_ids: empresasGrupoIds } : {}),
});
