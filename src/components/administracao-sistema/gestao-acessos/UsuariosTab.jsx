import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
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
import {
  resolveUsuariosTabKpiState,
  isUsuariosTabScopeCurrent,
  buildUsuariosTabUsersQueryKey,
  buildUsuariosTabPerfisQueryKey,
  buildUsuariosTabEmpresasQueryKey,
  usuarioNoEscopoUsuariosTab,
  registroNoEscopoUsuariosTab,
} from "./usuariosTabScope";

function readUsuariosTabActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token) };
}

/**
 * User/Perfil/Empresa via filterInContext; lista vazia ≠ ready em loading/erro.
 */
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
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "grupo" ? null : (empresaAtual?.id || null);
  const contextoValido = contexto === "grupo"
    ? Boolean(groupId)
    : Boolean(groupId && empresaId);
  const { actorId, sessionKey } = readUsuariosTabActorAndSession();
  const scopeExpected = { actorId, sessionKey };
  const escopoOpts = {
    contexto,
    grupoAtivoId: groupId,
    empresaAtivaId: empresaId,
    empresasDoGrupo,
  };
  const sanitizeEmail = (value) => String(value || "")
    .replace(/[<>"'`;\\]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  const dadosContextoConvite = (extras = {}) => ({
    contexto,
    group_id: groupId || null,
    empresa_id: empresaId,
    contexto_valido: contextoValido,
    empresas_grupo_ids: contexto === "grupo" ? empresasDoGrupo.map((empresa) => empresa.id).filter(Boolean) : [],
    ...extras
  });

  const auditarUsuario = async ({ acao, descricao, dadosNovos, sucesso = true }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId || null,
        acao,
        modulo: "Controle de Acesso",
        entidade: "User",
        descricao,
        dados_novos: dadosNovos || null,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar gestao de usuarios:", error);
    }
  };

  const usuariosQuery = useQuery({
    queryKey: buildUsuariosTabUsersQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('User', {}, 'full_name', 500);
      if (signal?.aborted) {
        const err = new Error('USUARIOS_TAB_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isUsuariosTabScopeCurrent(scopeExpected, readUsuariosTabActorAndSession())) {
        throw new Error('USUARIOS_TAB_STALE_SCOPE');
      }
      return (Array.isArray(rows) ? rows : []).filter((u) => usuarioNoEscopoUsuariosTab(u, escopoOpts));
    },
    enabled: contextoValido,
  });

  const perfisQuery = useQuery({
    queryKey: buildUsuariosTabPerfisQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const scoped = await filterInContext("PerfilAcesso", {}, "-updated_date", 500);
      if (signal?.aborted) {
        const err = new Error('USUARIOS_TAB_PERFIS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isUsuariosTabScopeCurrent(scopeExpected, readUsuariosTabActorAndSession())) {
        throw new Error('USUARIOS_TAB_STALE_SCOPE');
      }
      return (Array.isArray(scoped) ? scoped : []).filter((r) => registroNoEscopoUsuariosTab(r, escopoOpts));
    },
    enabled: contextoValido,
  });

  const empresasQuery = useQuery({
    queryKey: buildUsuariosTabEmpresasQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext("Empresa", {}, "nome_fantasia", 500);
      if (signal?.aborted) {
        const err = new Error('USUARIOS_TAB_EMPRESAS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isUsuariosTabScopeCurrent(scopeExpected, readUsuariosTabActorAndSession())) {
        throw new Error('USUARIOS_TAB_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const kpiState = resolveUsuariosTabKpiState({
    contextoValido,
    isLoading: usuariosQuery.isLoading,
    isError: usuariosQuery.isError,
    isFetching: usuariosQuery.isFetching,
    dataDefined: usuariosQuery.data !== undefined,
  });
  const usuarios = kpiState === 'ready' && Array.isArray(usuariosQuery.data) ? usuariosQuery.data : [];
  const perfis = Array.isArray(perfisQuery.data) ? perfisQuery.data : [];
  const empresas = Array.isArray(empresasQuery.data) ? empresasQuery.data : [];
  const listaIndisponivel = kpiState !== 'ready';

  const handleInvite = async () => {
    if (!podeConvidar) {
      toast.error("Sem permissao para convidar usuario.");
      await auditarUsuario({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de convidar usuario sem permissao.",
        dadosNovos: dadosContextoConvite({ motivo: "permissao_negada" }),
        sucesso: false
      });
      return;
    }
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de convidar usuario.");
      await auditarUsuario({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de convidar usuario sem grupo ou empresa.",
        dadosNovos: dadosContextoConvite({ motivo: "contexto_obrigatorio" }),
        sucesso: false
      });
      return;
    }

    const emailInformado = prompt("E-mail do novo usuario:");
    const email = sanitizeEmail(emailInformado);
    if (!email) return;
    if (!isValidEmail(email)) {
      toast.error("E-mail invalido para convite.");
      await auditarUsuario({
        acao: "Bloqueio email invalido",
        descricao: "Tentativa de convidar usuario com e-mail invalido.",
        dadosNovos: dadosContextoConvite({ motivo: "email_invalido" }),
        sucesso: false
      });
      return;
    }

    try {
      await base44.functions.invoke("adminInviteUser", {
        email,
        role: "user",
        group_id: groupId,
        empresa_id: empresaId,
      });
      toast.success("Convite enviado com sucesso.");
      qc.invalidateQueries({ queryKey: ["usuarios-gestao"] });
    } catch (e) {
      await auditarUsuario({
        acao: "Falha no convite",
        descricao: "Falha ao convidar usuario pelo fluxo protegido.",
        dadosNovos: dadosContextoConvite({ erro_tipo: e?.name || "Error" }),
        sucesso: false
      });
      toast.error("Nao foi possivel enviar o convite.");
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
          Selecione um grupo ou uma empresa vinculada ao grupo para carregar e alterar usuarios do escopo correto.
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

      {listaIndisponivel ? (
        <div className="text-sm text-slate-500 p-4">
          {kpiState === 'loading' ? 'Carregando...' : kpiState === 'error' ? 'Erro ao carregar usuarios.' : 'Contexto indisponivel.'}
        </div>
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
              onSuccess={() => { setSelectedUser(null); qc.invalidateQueries({ queryKey: ["usuarios-gestao"] }); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
