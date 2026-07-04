import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, UserCog, Mail, Shield, Building2 } from "lucide-react";
import GestaoUsuariosAvancada from "@/components/sistema/GestaoUsuariosAvancada";
import usePermissions from "@/components/lib/usePermissions";
import { toast } from "sonner";

export default function UsuariosTab() {
  const { contexto, filterInContext, createInContext, empresaAtual, grupoAtual, empresasDoGrupo = [] } = useContextoVisual();
  const { user } = useUser();
  const { hasPermission, isAdmin } = usePermissions();
  const podeConvidar = isAdmin() || hasPermission("Sistema", "Controle de Acesso", "criar");
  const podeEditarUsuarios = isAdmin() || hasPermission("Sistema", "Controle de Acesso", "editar");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState("todos");
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem("group_atual_id"); } catch { return null; }
  })();
  const scopeKey = (contexto === "grupo" ? grupoAtivoId : empresaAtual?.id) || "sem-contexto";
  const contextoValido = scopeKey !== "sem-contexto";
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === "string" ? item : item?.empresa_id || item?.id))
    .filter(Boolean);
  const registroNoEscopo = (registro) => {
    const empresasVinculadas = normalizeEmpresaIds(registro.empresas_vinculadas || registro.empresas || registro.empresas_ids);
    const registroGroupId = registro.group_id || registro.grupo_id || registro.groupId || registro.grupoId;
    const registroEmpresaId = registro.empresa_id || registro.empresaId || registro.empresa_atual_id;
    const temMarcadorEscopo = Boolean(registroGroupId || registroEmpresaId || empresasVinculadas.length);

    if (!temMarcadorEscopo) return false;
    if (contexto === "grupo") {
      const empresasIds = empresasDoGrupo.map((e) => e.id);
      return registroGroupId === grupoAtivoId || empresasVinculadas.some((id) => empresasIds.includes(id));
    }
    return registroGroupId === grupoAtivoId
      || registroEmpresaId === empresaAtual?.id
      || empresasVinculadas.includes(empresaAtual?.id);
  };

  const auditarUsuario = async ({ acao, descricao, dadosNovos }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: contexto === "grupo" ? null : empresaAtual?.id || null,
        group_id: grupoAtivoId || null,
        acao,
        modulo: "Controle de Acesso",
        entidade: "User",
        descricao,
        dados_novos: dadosNovos || null,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar gestao de usuarios:", error);
    }
  };

  const usuarioNoEscopo = (u) => {
    const empresasVinculadas = normalizeEmpresaIds(u.empresas_vinculadas);
    const temMarcadorEscopo = Boolean(
      u.group_id || u.grupo_id || u.grupo_atual_id || u.empresa_id || u.empresa_atual_id || empresasVinculadas.length
    );
    if (!temMarcadorEscopo) return true;
    if (contexto === "grupo") {
      const empresasIds = empresasDoGrupo.map((e) => e.id);
      return u.group_id === grupoAtivoId
        || u.grupo_id === grupoAtivoId
        || u.grupo_atual_id === grupoAtivoId
        || empresasVinculadas.some((id) => empresasIds.includes(id));
    }
    return u.empresa_id === empresaAtual?.id
      || u.empresa_atual_id === empresaAtual?.id
      || empresasVinculadas.includes(empresaAtual?.id);
  };

  const { data: usuarios = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["usuarios-gestao", scopeKey],
    queryFn: async () => {
      const rows = await base44.entities.User.list();
      return rows.filter(usuarioNoEscopo);
    },
    enabled: contextoValido,
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ["perfis-acesso-tab", scopeKey],
    queryFn: async () => {
      const scoped = contextoValido ? await filterInContext("PerfilAcesso", {}, "-updated_date", 500) : [];
      if (scoped.length) return scoped;
      const rows = await base44.entities.PerfilAcesso.list("-updated_date", 500);
      return rows.filter(registroNoEscopo);
    },
    enabled: true,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-gestao", scopeKey],
    queryFn: () => filterInContext("Empresa", {}, "nome_fantasia", 500),
    enabled: contextoValido,
  });

  const handleInvite = async () => {
    if (!podeConvidar) {
      toast.error("Sem permissao para convidar usuario.");
      await auditarUsuario({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de convidar usuario sem permissao.",
        dadosNovos: { contexto, group_id: grupoAtivoId || null, empresa_id: empresaAtual?.id || null }
      });
      return;
    }
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de convidar usuario.");
      await auditarUsuario({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de convidar usuario sem grupo ou empresa.",
        dadosNovos: { contexto }
      });
      return;
    }

    const email = prompt("E-mail do novo usuario:");
    if (!email) return;

    try {
      await base44.users.inviteUser(email, "user");
      await auditarUsuario({
        acao: "Convite",
        descricao: `Convite enviado para usuario ${email}`,
        dadosNovos: { email, role: "user", contexto, empresa_id: empresaAtual?.id || null, group_id: grupoAtivoId || null }
      });
      toast.success(`Convite enviado para ${email}`);
      qc.invalidateQueries({ queryKey: ["usuarios-gestao", scopeKey] });
    } catch (e) {
      toast.error("Erro ao convidar: " + e.message);
    }
  };

  const filtered = usuarios.filter((u) => {
    const text = `${u.full_name || ""} ${u.email || ""}`.toLowerCase();
    const matchSearch = !search || text.includes(search.toLowerCase());
    const matchRole = roleFilter === "todos" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleColor = (role) => role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600";

  return (
    <div className="w-full h-full min-h-0 space-y-4">
      {!contextoValido && (
        <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Selecione um grupo ou empresa para carregar e alterar usuarios do escopo correto.
        </div>
      )}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative min-w-[180px] flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <Input className="pl-8" placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} data-action="RBAC.Usuario.buscar" data-permission="Sistema.Controle de Acesso.visualizar" data-context-required="group-or-company" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32" data-action="RBAC.Usuario.filtroRole" data-permission="Sistema.Controle de Acesso.visualizar" data-context-required="group-or-company"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {podeConvidar && (
          <Button onClick={handleInvite} disabled={!contextoValido || !podeConvidar} className="bg-blue-600 hover:bg-blue-700" data-action="RBAC.Usuario.convidar" data-permission="Sistema.Controle de Acesso.criar" data-context-required="group-or-company" data-sensitive="true">
            <UserCog className="w-4 h-4 mr-2" />Convidar Usuario
          </Button>
        )}
      </div>

      {loadingUsers ? (
        <div className="text-sm text-slate-500 p-4">Carregando...</div>
      ) : (
        <div className="grid gap-2 min-h-0">
          {filtered.length === 0 && (
            <div className="text-sm text-slate-400 p-6 text-center">Nenhum usuario encontrado.</div>
          )}
          {filtered.map((u) => (
            <Card key={u.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {u.full_name?.[0] || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{u.full_name || "-"}</p>
                    <Badge className={roleColor(u.role) + " text-xs"}>{u.role}</Badge>
                    {u.perfil_acesso_nome && (
                      <Badge variant="outline" className="text-xs"><Shield className="w-3 h-3 mr-1" />{u.perfil_acesso_nome}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Mail className="w-3 h-3" />{u.email}
                    {u.empresas_vinculadas?.length > 0 && (
                      <span className="ml-2 flex items-center gap-1"><Building2 className="w-3 h-3" />{u.empresas_vinculadas.length} empresa(s)</span>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={!contextoValido || !podeEditarUsuarios} onClick={() => setSelectedUser(u)} data-action="RBAC.Usuario.configurar" data-permission="Sistema.Controle de Acesso.editar" data-context-required="group-or-company" data-sensitive="true">
                  Configurar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Configurar Usuario - {selectedUser.full_name}</DialogTitle>
            </DialogHeader>
            <GestaoUsuariosAvancada
              usuario={selectedUser}
              perfis={perfis}
              empresas={empresas}
              canEdit={podeEditarUsuarios}
              onClose={() => setSelectedUser(null)}
              onSuccess={() => { setSelectedUser(null); qc.invalidateQueries({ queryKey: ["usuarios-gestao", scopeKey] }); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
