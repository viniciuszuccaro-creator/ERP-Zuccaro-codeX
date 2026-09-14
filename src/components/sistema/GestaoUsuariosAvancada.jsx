import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { stampUsuarioPiloto } from "@/components/lib/pilotoOperacaoPolicy";
import {
  createInitialUserAccessForm,
  normalizeEmpresaIds,
  sanitizeCurrencyLimit,
  sanitizeList,
  sanitizePhone,
  sanitizeText,
} from "./gestao-usuarios/gestaoUsuarioPolicy";
import UserAccessFormSections from "./gestao-usuarios/UserAccessFormSections";

/**
 * @typedef {ReturnType<typeof createInitialUserAccessForm>} UserAccessFormData
 * @typedef {Record<string, unknown> & {
 *   id: string,
 *   email?: string,
 *   full_name?: string,
 *   name?: string,
 *   perfil_acesso_id?: string,
 *   perfil_acesso_nome?: string,
 *   nivel_acesso_contexto?: string,
 *   escopo_acesso?: string,
 *   acesso_grupo?: boolean,
 *   acesso_empresas?: boolean,
 *   empresas_vinculadas?: unknown[],
 *   restricoes_adicionais?: unknown,
 *   autenticacao_dois_fatores?: boolean,
 *   cargo?: string,
 *   departamento?: string,
 *   usuario_piloto?: boolean,
 *   papel_piloto?: string,
 *   propagacao_grupo_empresas?: boolean,
 *   origem_contexto?: string,
 * }} UserRecord
 * @typedef {Record<string, unknown> & { id: string, ativo?: boolean, nome_perfil?: string, nivel_perfil?: string }} ProfileRecord
 * @typedef {Record<string, unknown> & { id: string, nome_fantasia?: string, razao_social?: string, cidade?: string, estado?: string }} CompanyRecord
 * @typedef {{ usuario: UserRecord, perfis?: ProfileRecord[], empresas?: CompanyRecord[], canEdit?: boolean, onClose?: () => void, onSuccess?: () => void }} GestaoUsuariosProps
 * @typedef {{ escopoAcesso: string, empresasSelecionadas: string[], empresasPermitidas: Set<string>, acessoEmpresas: boolean }} ResolveEmpresasOptions
 * @typedef {{ antes: Record<string, unknown>, depois: Record<string, unknown> }} AuditChangeOptions
 * @typedef {{ acao: string, motivo: string, detalhes?: Record<string, unknown> }} AuditBlockOptions
 */

/** @param {GestaoUsuariosProps} props */
export default function GestaoUsuariosAvancada({ 
  usuario, 
  perfis = [], 
  empresas = [],
  canEdit = true,
  onClose,
  onSuccess 
}) {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, contexto, updateInContext, createInContext } = useContextoVisual();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "grupo" ? null : empresaAtual?.id || null;
  const contextoValido = contexto === "grupo" ? !!groupId : !!(groupId && empresaId);
  const controlesDesabilitados = !contextoValido || !canEdit;
  /** @param {ResolveEmpresasOptions} options */
  const resolveEmpresasVinculadas = ({ escopoAcesso, empresasSelecionadas, empresasPermitidas, acessoEmpresas }) => {
    if (!acessoEmpresas) return [];

    const empresasFiltradas = empresasSelecionadas.filter((id) => empresasPermitidas.has(id));
    if (empresasFiltradas.length) return empresasFiltradas;

    if (contexto === "grupo" && escopoAcesso === "grupo_empresa") {
      return [...empresasPermitidas];
    }

    if (contexto !== "grupo" && empresaAtual?.id && (escopoAcesso === "empresa" || escopoAcesso === "setores" || escopoAcesso === "grupo_empresa")) {
      return empresasPermitidas.has(empresaAtual.id) ? [empresaAtual.id] : [];
    }

    return [];
  };
  /** @param {Partial<UserRecord> & Record<string, unknown>} data */
  const auditSnapshot = (data = {}) => ({
    perfil_acesso_id: data.perfil_acesso_id || null,
    perfil_acesso_nome: data.perfil_acesso_nome || null,
    nivel_acesso_contexto: data.nivel_acesso_contexto || data.escopo_acesso || null,
    acesso_grupo: !!data.acesso_grupo,
    acesso_empresas: !!data.acesso_empresas,
    empresas_vinculadas: normalizeEmpresaIds(data.empresas_vinculadas),
    restricoes_adicionais: data.restricoes_adicionais || null,
    autenticacao_dois_fatores: !!data.autenticacao_dois_fatores,
    cargo: data.cargo || "",
    departamento: data.departamento || "",
    usuario_piloto: !!data.usuario_piloto,
    papel_piloto: data.papel_piloto || null,
    propagacao_grupo_empresas: !!data.propagacao_grupo_empresas,
    origem_contexto: data.origem_contexto || contexto || null
  });
  /** @param {AuditChangeOptions} options */
  const auditarAlteracaoUsuario = async ({ antes, depois }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.name || user?.email || "Usuario local",
        usuario_id: user?.id || user?.email || null,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        acao: "Alteracao de acesso de usuario",
        modulo: "Controle de Acesso",
        entidade: "User",
        entidade_id: usuario?.id || null,
        descricao: `Alteracao de RBAC e escopo do usuario ${usuario?.email || usuario?.full_name || usuario?.id}`,
        dados_anteriores: antes,
        dados_novos: depois,
        detalhes: {
          contexto,
          contexto_valido: contextoValido,
          groupId,
          empresaId,
          alvo_usuario_id: usuario?.id || null,
          alvo_usuario_email: usuario?.email || null
        },
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar alteracao avancada de usuario:", error);
    }
  };
  /** @param {AuditBlockOptions} options */
  const auditarBloqueioUsuario = async ({ acao, motivo, detalhes = {} }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.name || user?.email || "Usuario local",
        usuario_id: user?.id || user?.email || null,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        acao,
        modulo: "Controle de Acesso",
        entidade: "User",
        entidade_id: usuario?.id || null,
        tipo_auditoria: "seguranca",
        descricao: motivo,
        dados_novos: {
          contexto,
          contexto_valido: contextoValido,
          groupId,
          empresaId,
          canEdit,
          contextoValido,
          alvo_usuario_id: usuario?.id || null,
          alvo_usuario_email: usuario?.email || null,
          ...detalhes
        },
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar bloqueio de usuario:", error);
    }
  };
  const [formData, setFormData] = useState(() => createInitialUserAccessForm(usuario));

  const atualizarUsuarioMutation = useMutation({
    /** @param {ReturnType<typeof createInitialUserAccessForm>} data */
    mutationFn: async (data) => {
      if (!contextoValido) {
        throw new Error("Selecione um grupo ou uma empresa vinculada ao grupo antes de alterar acesso de usuario.");
      }
      if (!canEdit) {
        throw new Error("Sem permissao para alterar acesso de usuario.");
      }
      const perfilId = data.perfil_acesso_id === "sem-perfil" ? null : data.perfil_acesso_id;
      const perfilSelecionado = perfis.find(p => p.id === perfilId);
      const escopoAcesso = data.nivel_acesso_contexto || "empresa";
      const acessoGrupo = escopoAcesso === "grupo" || escopoAcesso === "grupo_empresa";
      const acessoEmpresas = escopoAcesso === "empresa" || escopoAcesso === "grupo_empresa" || escopoAcesso === "setores";
      const restricoesSanitizadas = {
        ...data.restricoes_adicionais,
        limite_aprovacao_valor: sanitizeCurrencyLimit(data.restricoes_adicionais?.limite_aprovacao_valor),
        departamentos_permitidos: sanitizeList(data.restricoes_adicionais?.departamentos_permitidos),
        centros_custo_permitidos: sanitizeList(data.restricoes_adicionais?.centros_custo_permitidos)
      };
      const empresasPermitidas = new Set(empresas.map((empresa) => empresa.id).filter(Boolean));
      const empresasSelecionadas = normalizeEmpresaIds(data.empresas_vinculadas);
      const empresasVinculadas = resolveEmpresasVinculadas({
        escopoAcesso,
        empresasSelecionadas,
        empresasPermitidas,
        acessoEmpresas
      });
      const empresasNomes = empresas
        .filter(e => empresasVinculadas.includes(e.id))
        .map(e => e.nome_fantasia || e.razao_social);

      const antes = auditSnapshot(usuario);
      const payload = {
        ...data,
        cargo: sanitizeText(data.cargo, 120),
        departamento: sanitizeText(data.departamento, 120),
        telefone: sanitizePhone(data.telefone),
        restricoes_adicionais: restricoesSanitizadas,
        nivel_acesso_contexto: escopoAcesso,
        escopo_acesso: escopoAcesso,
        acesso_grupo: acessoGrupo,
        acesso_empresas: acessoEmpresas,
        perfil_acesso_id: perfilId,
        perfil_acesso_nome: perfilSelecionado?.nome_perfil || null,
        empresas_vinculadas: acessoEmpresas ? empresasVinculadas : [],
        empresas_vinculadas_nomes: acessoEmpresas ? empresasNomes : [],
        propagacao_grupo_empresas: escopoAcesso === "grupo_empresa",
        origem_contexto: contexto,
        ...(groupId ? { group_id: groupId } : {}),
        ...(empresaId ? { empresa_id: empresaId } : {}),
        ...stampUsuarioPiloto({}, /** @type {{ piloto?: boolean }} */ ({ piloto: data.usuario_piloto === true, papel: data.papel_piloto })),
      };
      const result = await updateInContext('User', usuario.id, payload);
      await auditarAlteracaoUsuario({ antes, depois: auditSnapshot(payload) });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios-gestao'] });
      queryClient.invalidateQueries({ queryKey: ['perfil-acesso'] });
      toast.success("Usuário atualizado com sucesso!");
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    }
  });

  /** @param {string} empresaId */
  const toggleEmpresa = (empresaId) => {
    if (controlesDesabilitados) {
      toast.error("Sem permissao para alterar empresas vinculadas.");
      void auditarBloqueioUsuario({
        acao: "Bloqueio empresas vinculadas",
        motivo: "Tentativa de alterar empresas vinculadas sem contexto ou permissao.",
        detalhes: { empresa_tentada_id: empresaId, nivel_acesso_contexto: formData.nivel_acesso_contexto }
      });
      return;
    }
    if (formData.nivel_acesso_contexto === "grupo") {
      toast.error("Acesso somente grupo nao permite vincular empresas.");
      void auditarBloqueioUsuario({
        acao: "Bloqueio empresas em acesso somente grupo",
        motivo: "Tentativa de vincular empresa quando o usuario esta com acesso somente grupo.",
        detalhes: { empresa_tentada_id: empresaId, nivel_acesso_contexto: formData.nivel_acesso_contexto }
      });
      return;
    }
    setFormData(prev => {
      const empresas = prev.empresas_vinculadas || [];
      const index = empresas.indexOf(empresaId);
      
      if (index > -1) {
        return { ...prev, empresas_vinculadas: empresas.filter(e => e !== empresaId) };
      } else {
        return { ...prev, empresas_vinculadas: [...empresas, empresaId] };
      }
    });
  };

  /** @param {'departamentos_permitidos' | 'centros_custo_permitidos'} campo @param {unknown} valor */
  const setRestricaoLista = (campo, valor) => {
    const lista = String(valor || "")
      .split(",")
      .map((item) => sanitizeText(item, 60))
      .filter(Boolean)
      .slice(0, 50);
    setFormData({
      ...formData,
      restricoes_adicionais: {
        ...formData.restricoes_adicionais,
        [campo]: lista
      }
    });
  };

  /** @param {import('react').FormEvent<HTMLFormElement>} e */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      toast.error("Selecione um grupo ou uma empresa vinculada ao grupo antes de alterar acesso de usuario.");
      void auditarBloqueioUsuario({
        acao: "Bloqueio salvar usuario sem contexto",
        motivo: "Tentativa de salvar usuario RBAC sem grupo ou empresa vinculada ao grupo."
      });
      return;
    }
    if (!canEdit) {
      toast.error("Sem permissao para alterar acesso de usuario.");
      void auditarBloqueioUsuario({
        acao: "Bloqueio salvar usuario sem permissao",
        motivo: "Tentativa de salvar usuario RBAC sem permissao de edicao."
      });
      return;
    }
    atualizarUsuarioMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full h-full overflow-auto p-6">
      <UserAccessFormSections
        usuario={usuario}
        formData={formData}
        setFormData={setFormData}
        controlesDesabilitados={controlesDesabilitados}
        perfis={perfis}
        empresas={empresas}
        toggleEmpresa={toggleEmpresa}
        setRestricaoLista={setRestricaoLista}
        onClose={onClose}
        isPending={atualizarUsuarioMutation.isPending}
      />
    </form>
  );
}
