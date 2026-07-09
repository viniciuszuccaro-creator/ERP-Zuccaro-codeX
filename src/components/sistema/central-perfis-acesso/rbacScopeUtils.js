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

export const buildPerfilAuditPayload = ({
  acao,
  descricao,
  dadosNovos = {},
  sucesso = true,
  user,
  contexto,
  contextoValido,
  grupoAtivoId,
  empresaAtivaId,
  empresasGrupoIds = [],
  timestamp = new Date().toISOString(),
}) => ({
  usuario: user?.full_name || user?.email || "Usuario",
  usuario_id: user?.id || null,
  group_id: grupoAtivoId || null,
  empresa_id: empresaAtivaId || null,
  acao,
  modulo: "Sistema",
  entidade: "PerfilAcesso",
  tipo_auditoria: "seguranca",
  descricao,
  dados_novos: {
    ...buildRbacContextData({ contexto, contextoValido, grupoAtivoId, empresaAtivaId, empresasGrupoIds }),
    ...(dadosNovos || {}),
  },
  sucesso,
  data_hora: timestamp,
});

export const buildPerfilSaveBlock = ({
  data = {},
  contexto,
  contextoValido,
  perfilId,
  criando,
  podeCriarPerfil,
  podeEditarPerfil,
}) => {
  if (!contextoValido) {
    return {
      acao: "Bloqueio sem contexto",
      descricao: "Tentativa de salvar perfil RBAC sem contexto multiempresa completo.",
      dadosNovos: { motivo: "contexto_obrigatorio", perfil: data?.nome_perfil || null },
      mensagem: contexto === "grupo"
        ? "Selecione um grupo antes de salvar o perfil."
        : "Selecione uma empresa vinculada a um grupo antes de salvar o perfil.",
    };
  }

  if ((criando && !podeCriarPerfil) || (!criando && !podeEditarPerfil)) {
    return {
      acao: "Bloqueio por permissao",
      descricao: "Tentativa de salvar perfil RBAC sem permissao granular.",
      dadosNovos: { motivo: "permissao_negada", perfil_id: perfilId || null, criando },
      mensagem: "Sem permissao para salvar perfil de acesso.",
    };
  }

  return null;
};

export const buildPerfilDeleteBlock = ({ contexto, contextoValido, podeExcluirPerfil, perfilId }) => {
  if (!contextoValido) {
    return {
      acao: "Bloqueio sem contexto",
      descricao: "Tentativa de excluir perfil RBAC sem contexto multiempresa completo.",
      dadosNovos: { motivo: "contexto_obrigatorio", perfil_id: perfilId },
      mensagem: contexto === "grupo"
        ? "Selecione um grupo antes de excluir o perfil."
        : "Selecione uma empresa vinculada a um grupo antes de excluir o perfil.",
    };
  }

  if (!podeExcluirPerfil) {
    return {
      acao: "Bloqueio por permissao",
      descricao: "Tentativa de excluir perfil RBAC sem permissao granular.",
      dadosNovos: { motivo: "permissao_negada", perfil_id: perfilId },
      mensagem: "Sem permissao para excluir perfil de acesso.",
    };
  }

  return null;
};
export const buildPerfilRbacPayload = ({ data = {}, contexto, contextoValido, grupoAtivoId, empresaAtivaId, empresasGrupoIds = [] }) => ({
  ...data,
  contexto_valido: Boolean(contextoValido),
  group_id: grupoAtivoId || null,
  grupo_id: grupoAtivoId || null,
  ...(empresaAtivaId ? { empresa_id: empresaAtivaId } : {}),
  ...(contexto === "grupo" ? { empresas_grupo_ids: empresasGrupoIds } : {}),
});
