import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import {
  UserPlus,
  Building2,
  Shield,
  Key,
  CheckCircle,
  Ban,
  Fingerprint,
  Mail,
  Phone,
  Briefcase,
  Settings,
  Eye
} from "lucide-react";

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
  const contextoValido = contexto === "grupo" ? !!groupId : !!empresaId;
  const controlesDesabilitados = !contextoValido || !canEdit;
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === "string" ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
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
    propagacao_grupo_empresas: !!data.propagacao_grupo_empresas,
    origem_contexto: data.origem_contexto || contexto || null
  });
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
  const [formData, setFormData] = useState({
    perfil_acesso_id: usuario?.perfil_acesso_id || "sem-perfil",
    nivel_acesso_contexto: usuario?.nivel_acesso_contexto || usuario?.escopo_acesso || "empresa",
    empresas_vinculadas: normalizeEmpresaIds(usuario?.empresas_vinculadas),
    restricoes_adicionais: usuario?.restricoes_adicionais || {
      pode_ver_apenas_proprios_registros: false,
      limite_aprovacao_valor: 0,
      departamentos_permitidos: [],
      centros_custo_permitidos: []
    },
    autenticacao_dois_fatores: usuario?.autenticacao_dois_fatores || false,
    telefone: usuario?.telefone || "",
    cargo: usuario?.cargo || "",
    departamento: usuario?.departamento || ""
  });

  const atualizarUsuarioMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) {
        throw new Error("Selecione um grupo ou empresa antes de alterar acesso de usuario.");
      }
      if (!canEdit) {
        throw new Error("Sem permissao para alterar acesso de usuario.");
      }
      const perfilId = data.perfil_acesso_id === "sem-perfil" ? null : data.perfil_acesso_id;
      const perfilSelecionado = perfis.find(p => p.id === perfilId);
      const escopoAcesso = data.nivel_acesso_contexto || "empresa";
      const acessoGrupo = escopoAcesso === "grupo" || escopoAcesso === "grupo_empresa";
      const acessoEmpresas = escopoAcesso === "empresa" || escopoAcesso === "grupo_empresa" || escopoAcesso === "setores";
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
        ...(empresaId ? { empresa_id: empresaId } : {})
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

  const toggleEmpresa = (empresaId) => {
    if (controlesDesabilitados) {
      toast.error("Sem permissao para alterar empresas vinculadas.");
      return;
    }
    if (formData.nivel_acesso_contexto === "grupo") {
      toast.error("Acesso somente grupo nao permite vincular empresas.");
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

  const setRestricaoLista = (campo, valor) => {
    const lista = String(valor || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setFormData({
      ...formData,
      restricoes_adicionais: {
        ...formData.restricoes_adicionais,
        [campo]: lista
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de alterar acesso de usuario.");
      return;
    }
    if (!canEdit) {
      toast.error("Sem permissao para alterar acesso de usuario.");
      return;
    }
    atualizarUsuarioMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full h-full overflow-auto p-6">
      {/* Dados do Usuário */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            Informações do Usuário
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="font-semibold text-lg">{usuario?.full_name}</p>
            <p className="text-sm text-slate-500">{usuario?.email}</p>
            <Badge className={usuario?.role === 'admin' ? 'bg-purple-600 mt-2' : 'bg-slate-600 mt-2'}>
              {usuario?.role}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Cargo</Label>
              <Input
                value={formData.cargo}
                disabled={controlesDesabilitados}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: Vendedor"
                className="mt-1"
                data-permission="Sistema.Controle de Acesso.editar"
                data-action="RBAC.Usuario.cargo"
              />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input
                value={formData.departamento}
                disabled={controlesDesabilitados}
                onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                placeholder="Ex: Comercial"
                className="mt-1"
                data-permission="Sistema.Controle de Acesso.editar"
                data-action="RBAC.Usuario.departamento"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.telefone}
                disabled={controlesDesabilitados}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="mt-1"
                data-permission="Sistema.Controle de Acesso.editar"
                data-action="RBAC.Usuario.telefone"
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch
                checked={formData.autenticacao_dois_fatores}
                disabled={controlesDesabilitados}
                onCheckedChange={(v) => setFormData({ ...formData, autenticacao_dois_fatores: v })}
                data-permission="Sistema.Controle de Acesso.editar"
                data-action="RBAC.Usuario.2fa"
                data-sensitive="true"
              />
              <Label className="cursor-pointer flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-green-600" />
                Autenticação 2FA
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Perfil de Acesso */}
      <Card>
        <CardHeader className="bg-blue-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            Perfil de Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Label>Perfil de Acesso *</Label>
          <Select
            value={formData.perfil_acesso_id}
            disabled={controlesDesabilitados}
            onValueChange={(v) => setFormData({ ...formData, perfil_acesso_id: v })}
          >
            <SelectTrigger className="mt-1" data-permission="Sistema.Controle de Acesso.editar" data-action="RBAC.Usuario.perfil" data-sensitive="true">
              <SelectValue placeholder="Selecionar perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sem-perfil">Sem perfil</SelectItem>
              {perfis.filter(p => p.ativo !== false).map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span>{p.nome_perfil}</span>
                    <Badge variant="outline" className="text-xs">
                      {p.nivel_perfil}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Escopo de Liberacao */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-600" />
            Escopo de Liberacao
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label>Tipo de acesso</Label>
            <Select
              value={formData.nivel_acesso_contexto}
              disabled={controlesDesabilitados}
              onValueChange={(v) => setFormData({ ...formData, nivel_acesso_contexto: v })}
            >
              <SelectTrigger className="mt-1" data-permission="Sistema.Controle de Acesso.editar" data-action="RBAC.Usuario.escopoAcesso" data-context-required="group-or-company" data-sensitive="true">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grupo">Somente Grupo</SelectItem>
                <SelectItem value="empresa">Somente Empresas</SelectItem>
                <SelectItem value="grupo_empresa">Grupo e Empresas</SelectItem>
                <SelectItem value="setores">Empresas e Setores</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Esta liberacao grava o escopo no usuario e limita empresas/setores ao grupo ou empresa atual.
          </div>
        </CardContent>
      </Card>

      {/* Empresas Vinculadas */}
      <Card>
        <CardHeader className="bg-green-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-green-600" />
            Empresas Vinculadas ({formData.empresas_vinculadas?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {empresas.map(empresa => {
              const vinculado = formData.empresas_vinculadas?.includes(empresa.id);
              
              return (
                <label
                  key={empresa.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    vinculado ? 'bg-green-50 border-green-300' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    checked={vinculado}
                    disabled={controlesDesabilitados || formData.nivel_acesso_contexto === "grupo"}
                    onCheckedChange={() => toggleEmpresa(empresa.id)}
                    data-permission="Sistema.Controle de Acesso.editar"
                    data-action={`RBAC.Usuario.empresa.${empresa.id}`}
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{empresa.nome_fantasia || empresa.razao_social}</p>
                    {empresa.cidade && (
                      <p className="text-xs text-slate-500">{empresa.cidade}/{empresa.estado}</p>
                    )}
                  </div>
                  {vinculado && <CheckCircle className="w-5 h-5 text-green-600" />}
                </label>
              );
            })}
          </div>
          {formData.nivel_acesso_contexto === "grupo" && (
            <p className="text-xs text-slate-500 mt-3">Acesso definido como somente grupo; vinculos de empresas ficam desativados.</p>
          )}
        </CardContent>
      </Card>

      {/* Restrições Adicionais */}
      <Card>
        <CardHeader className="bg-purple-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-600" />
            Restrições Adicionais
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              Visualizar apenas próprios registros
            </Label>
            <Switch
              checked={formData.restricoes_adicionais?.pode_ver_apenas_proprios_registros}
              disabled={controlesDesabilitados}
              onCheckedChange={(v) => setFormData({
                ...formData,
                restricoes_adicionais: {
                  ...formData.restricoes_adicionais,
                  pode_ver_apenas_proprios_registros: v
                }
              })}
              data-permission="Sistema.Controle de Acesso.editar"
              data-action="RBAC.Usuario.restricao.proprios"
              data-sensitive="true"
            />
          </div>

          <div>
            <Label>Limite de Aprovação (R$)</Label>
            <Input
              type="number"
              value={formData.restricoes_adicionais?.limite_aprovacao_valor || 0}
              disabled={controlesDesabilitados}
              onChange={(e) => setFormData({
                ...formData,
                restricoes_adicionais: {
                  ...formData.restricoes_adicionais,
                  limite_aprovacao_valor: parseFloat(e.target.value) || 0
                }
              })}
              className="mt-1"
              placeholder="0.00"
              data-permission="Sistema.Controle de Acesso.editar"
              data-action="RBAC.Usuario.limiteAprovacao"
              data-sensitive="true"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Setores permitidos</Label>
              <Input
                value={(formData.restricoes_adicionais?.departamentos_permitidos || []).join(", ")}
                disabled={controlesDesabilitados}
                onChange={(e) => setRestricaoLista("departamentos_permitidos", e.target.value)}
                className="mt-1"
                placeholder="Comercial, Financeiro, Producao"
                data-permission="Sistema.Controle de Acesso.editar"
                data-action="RBAC.Usuario.setoresPermitidos"
                data-context-required="group-or-company"
                data-sensitive="true"
              />
            </div>
            <div>
              <Label>Centros de custo permitidos</Label>
              <Input
                value={(formData.restricoes_adicionais?.centros_custo_permitidos || []).join(", ")}
                disabled={controlesDesabilitados}
                onChange={(e) => setRestricaoLista("centros_custo_permitidos", e.target.value)}
                className="mt-1"
                placeholder="ADM, OBRA-01, COMERCIAL"
                data-permission="Sistema.Controle de Acesso.editar"
                data-action="RBAC.Usuario.centrosCustoPermitidos"
                data-context-required="group-or-company"
                data-sensitive="true"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-3 sticky bottom-0 bg-white pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} data-action="RBAC.Usuario.cancelar">
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={atualizarUsuarioMutation.isPending || controlesDesabilitados}
          className="bg-blue-600 hover:bg-blue-700"
          data-action="RBAC.Usuario.salvar"
          data-permission="Sistema.Controle de Acesso.editar"
          data-sensitive="true"
        >
          {atualizarUsuarioMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </form>
  );
}
