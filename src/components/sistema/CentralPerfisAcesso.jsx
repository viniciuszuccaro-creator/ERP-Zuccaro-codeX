import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Shield, CheckCircle, XCircle, Plus, Edit, Search,
  Trash2, AlertTriangle, RefreshCw, CheckSquare, Info
} from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { ACOES, COR_CLASS, ESTRUTURA_SISTEMA } from "@/components/sistema/central-perfis-acesso/rbacPerfilConfig";
import { buildPerfilRbacPayload, buildRbacContextData, normalizeEmpresaIds, perfilNoEscopo, usuarioNoEscopo } from "@/components/sistema/central-perfis-acesso/rbacScopeUtils";

export default function CentralPerfisAcesso() {
  const [perfilAberto, setPerfilAberto] = useState(null);
  const [usuarioAberto, setUsuarioAberto] = useState(null);
  const [busca, setBusca] = useState("");
  const [modulosExpandidos, setModulosExpandidos] = useState([]);
  const [formPerfil, setFormPerfil] = useState({
    nome_perfil: "",
    descricao: "",
    nivel_perfil: "Operacional",
    escopo_acesso: "grupo_empresa",
    setores_permitidos: [],
    permissoes: {},
    ativo: true
  });

  const queryClient = useQueryClient();
  const { contexto, empresaAtual, grupoAtual, empresasDoGrupo = [], filterInContext, createInContext, updateInContext, deleteInContext } = useContextoVisual();
  const { hasPermission, isAdmin, user } = usePermissions();
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = contexto === 'grupo' ? null : empresaAtual?.id;
  const empresasGrupoIds = normalizeEmpresaIds(empresasDoGrupo);
  const scopeKey = contexto === 'grupo' ? (grupoAtivoId || 'sem-contexto') : (empresaAtivaId || grupoAtivoId || 'sem-contexto');
  const contextoValido = contexto === 'grupo' ? Boolean(grupoAtivoId) : Boolean(grupoAtivoId && empresaAtivaId);
  const podeCriarPerfil = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'criar');
  const podeEditarPerfil = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'editar');
  const podeExcluirPerfil = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'excluir');


  const auditarPerfil = async ({ acao, descricao, dadosNovos = {}, sucesso = true }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        group_id: grupoAtivoId || null,
        empresa_id: empresaAtivaId || null,
        acao,
        modulo: 'Sistema',
        entidade: 'PerfilAcesso',
        tipo_auditoria: 'seguranca',
        descricao,
        dados_novos: {
          ...buildRbacContextData({ contexto, contextoValido, grupoAtivoId, empresaAtivaId, empresasGrupoIds }),
          ...(dadosNovos || {}),
        },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[RBAC] Falha ao auditar perfil de acesso:', error);
    }
  };

  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis-acesso', scopeKey],
    queryFn: async () => {
      const scoped = contextoValido ? await filterInContext('PerfilAcesso', {}, '-updated_date', 500) : [];
      if (scoped.length) return scoped;
      const rows = await base44.entities.PerfilAcesso.list('-updated_date', 500);
      const filtrados = rows.filter((perfil) => perfilNoEscopo({
        perfil,
        contexto,
        grupoAtivoId,
        empresaAtivaId,
        empresasGrupoIds,
      }));
      void auditarPerfil({
        acao: 'Fallback consulta perfis RBAC',
        descricao: 'Consulta de perfis usou fallback direto com filtro de escopo no cliente.',
        dadosNovos: {
          total_bruto: rows.length,
          total_no_escopo: filtrados.length,
          motivo: 'filterInContext_sem_resultado',
        },
        sucesso: true,
      });
      return filtrados;
    },
    enabled: contextoValido,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios', scopeKey],
    queryFn: async () => {
      const rows = await base44.entities.User.list();
      return rows.filter((usuario) => usuarioNoEscopo({
        usuario,
        contexto,
        grupoAtivoId,
        empresaAtivaId,
        empresasGrupoIds,
      }));
    },
    enabled: contextoValido,
  });

  const salvarPerfilMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) {
        await auditarPerfil({
          acao: 'Bloqueio sem contexto',
          descricao: 'Tentativa de salvar perfil RBAC sem contexto multiempresa completo.',
          dadosNovos: { motivo: 'contexto_obrigatorio', perfil: data?.nome_perfil || null },
          sucesso: false,
        });
        throw new Error(contexto === 'grupo' ? 'Selecione um grupo antes de salvar o perfil.' : 'Selecione uma empresa vinculada a um grupo antes de salvar o perfil.');
      }

      const perfilId = perfilAberto?.id;
      const criando = !perfilId || perfilAberto?.novo;
      if ((criando && !podeCriarPerfil) || (!criando && !podeEditarPerfil)) {
        await auditarPerfil({
          acao: 'Bloqueio por permissao',
          descricao: 'Tentativa de salvar perfil RBAC sem permissao granular.',
          dadosNovos: { motivo: 'permissao_negada', perfil_id: perfilId || null, criando },
          sucesso: false,
        });
        throw new Error('Sem permissao para salvar perfil de acesso.');
      }

      const payload = buildPerfilRbacPayload({ data, contexto, contextoValido, grupoAtivoId, empresaAtivaId, empresasGrupoIds });

      const resultado = criando
        ? await createInContext('PerfilAcesso', payload)
        : await updateInContext('PerfilAcesso', perfilId, payload);

      await auditarPerfil({
        acao: criando ? 'Criacao' : 'Edicao',
        descricao: criando ? 'Perfil RBAC criado com escopo multiempresa.' : 'Perfil RBAC atualizado com escopo multiempresa.',
        dadosNovos: {
          perfil_id: resultado?.id || perfilId || null,
          nome_perfil: payload.nome_perfil,
          escopo_acesso: payload.escopo_acesso,
          permissoes_total: contarPermissoesTotal(),
        },
        sucesso: true,
      });

      return resultado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso', scopeKey] });
      const foiCriacao = perfilAberto?.novo;
      toast.success(foiCriacao ? "Perfil criado com sucesso!" : "Perfil atualizado com sucesso!");
      setTimeout(() => { setPerfilAberto(null); resetForm(); }, 300);
    },
    onError: (error) => toast.error("Erro ao salvar: " + error.message),
  });

  const excluirPerfilMutation = useMutation({
    mutationFn: async (id) => {
      if (!contextoValido) {
        await auditarPerfil({
          acao: 'Bloqueio sem contexto',
          descricao: 'Tentativa de excluir perfil RBAC sem contexto multiempresa completo.',
          dadosNovos: { motivo: 'contexto_obrigatorio', perfil_id: id },
          sucesso: false,
        });
        throw new Error(contexto === 'grupo' ? 'Selecione um grupo antes de excluir o perfil.' : 'Selecione uma empresa vinculada a um grupo antes de excluir o perfil.');
      }
      if (!podeExcluirPerfil) {
        await auditarPerfil({
          acao: 'Bloqueio por permissao',
          descricao: 'Tentativa de excluir perfil RBAC sem permissao granular.',
          dadosNovos: { motivo: 'permissao_negada', perfil_id: id },
          sucesso: false,
        });
        throw new Error('Sem permissao para excluir perfil de acesso.');
      }
      const perfil = perfis.find((item) => item.id === id);
      const resultado = await deleteInContext('PerfilAcesso', id);
      await auditarPerfil({
        acao: 'Exclusao',
        descricao: 'Perfil RBAC excluido apos validacao de escopo e permissao.',
        dadosNovos: {
          perfil_id: id,
          nome_perfil: perfil?.nome_perfil || perfil?.nome || null,
        },
        sucesso: true,
      });
      return resultado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso', scopeKey] });
      toast.success("Perfil excluido!");
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });



  const resetForm = () => setFormPerfil({
    nome_perfil: "",
    descricao: "",
    nivel_perfil: "Operacional",
    escopo_acesso: "grupo_empresa",
    setores_permitidos: [],
    permissoes: {},
    ativo: true
  });

  const setSetoresPerfil = (valor) => {
    const setores = String(valor || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setFormPerfil({ ...formPerfil, setores_permitidos: setores });
  };

  const togglePermissao = (modulo, secao, acao) => {
    if (!canManageOpenProfile) { toast.error('Sem permissao para alterar permissoes deste perfil.'); return; }
    setFormPerfil(prev => {
      const novasPerms = { ...prev.permissoes };
      if (!novasPerms[modulo]) novasPerms[modulo] = {};
      if (!novasPerms[modulo][secao]) novasPerms[modulo][secao] = [];
      const idx = novasPerms[modulo][secao].indexOf(acao);
      novasPerms[modulo][secao] = idx > -1 ? novasPerms[modulo][secao].filter(a => a !== acao) : [...novasPerms[modulo][secao], acao];
      return { ...prev, permissoes: novasPerms };
    });
  };

  const selecionarTudoSecao = (modulo, secao) => {
    if (!canManageOpenProfile) { toast.error('Sem permissao para alterar permissoes deste perfil.'); return; }
    setFormPerfil(prev => {
      const novasPerms = { ...prev.permissoes };
      if (!novasPerms[modulo]) novasPerms[modulo] = {};
      const todasAcoes = ACOES.map(a => a.id);
      const temTodas = todasAcoes.every(a => novasPerms[modulo][secao]?.includes(a));
      novasPerms[modulo][secao] = temTodas ? [] : [...todasAcoes];
      return { ...prev, permissoes: novasPerms };
    });
  };

  const selecionarTudoModulo = (modulo) => {
    if (!canManageOpenProfile) { toast.error('Sem permissao para alterar permissoes deste perfil.'); return; }
    setFormPerfil(prev => {
      const novasPerms = { ...prev.permissoes };
      const todasAcoes = ACOES.map(a => a.id);
      const secoes = Object.keys(ESTRUTURA_SISTEMA[modulo].secoes);
      const tudoMarcado = secoes.every(s => todasAcoes.every(a => novasPerms[modulo]?.[s]?.includes(a)));
      novasPerms[modulo] = {};
      secoes.forEach(s => { novasPerms[modulo][s] = tudoMarcado ? [] : [...todasAcoes]; });
      return { ...prev, permissoes: novasPerms };
    });
  };

  const selecionarTudoGlobal = () => {
    if (!canManageOpenProfile) { toast.error('Sem permissao para alterar permissoes deste perfil.'); return; }
    setFormPerfil(prev => {
      const todasAcoes = ACOES.map(a => a.id);
      const algumVazio = Object.keys(ESTRUTURA_SISTEMA).some(m => Object.keys(ESTRUTURA_SISTEMA[m].secoes).some(s => !prev.permissoes?.[m]?.[s] || prev.permissoes[m][s].length < todasAcoes.length));
      const novasPerms = {};
      Object.keys(ESTRUTURA_SISTEMA).forEach(m => { novasPerms[m] = {}; Object.keys(ESTRUTURA_SISTEMA[m].secoes).forEach(s => { novasPerms[m][s] = algumVazio ? [...todasAcoes] : []; }); });
      return { ...prev, permissoes: novasPerms };
    });
  };

  const temPermissao = (modulo, secao, acao) => formPerfil.permissoes?.[modulo]?.[secao]?.includes(acao) || false;
  const contarPermissoesModulo = (modulo) => Object.values(formPerfil.permissoes?.[modulo] || {}).reduce((t, s) => t + (s?.length || 0), 0);
  const contarPermissoesTotal = () => Object.values(formPerfil.permissoes || {}).reduce((t, m) => t + Object.values(m || {}).reduce((s, sec) => s + (sec?.length || 0), 0), 0);

  const abrirEdicaoPerfil = (perfil) => {
    setPerfilAberto(perfil);
    setFormPerfil({
      nome_perfil: perfil.nome_perfil || "",
      descricao: perfil.descricao || "",
      nivel_perfil: perfil.nivel_perfil || "Operacional",
      escopo_acesso: perfil.escopo_acesso || perfil.nivel_acesso_contexto || "grupo_empresa",
      setores_permitidos: perfil.setores_permitidos || perfil.departamentos_permitidos || [],
      permissoes: perfil.permissoes || {},
      ativo: perfil.ativo !== false
    });
  };

  const stats = useMemo(() => {
    const totalUsuarios = usuarios.length;
    const usuariosComPerfil = usuarios.filter(u => u.perfil_acesso_id).length;
    const usuariosSemPerfil = totalUsuarios - usuariosComPerfil;
    const cobertura = totalUsuarios > 0 ? Math.round((usuariosComPerfil / totalUsuarios) * 100) : 0;
    return { totalPerfis: perfis.length, perfisAtivos: perfis.filter(p => p.ativo !== false).length, totalUsuarios, usuariosComPerfil, usuariosSemPerfil, cobertura };
  }, [perfis, usuarios]);

  const perfisFiltrados = perfis.filter(p => !busca || p.nome_perfil?.toLowerCase().includes(busca.toLowerCase()));
  const canManageOpenProfile = perfilAberto?.novo ? podeCriarPerfil : podeEditarPerfil;

  return (
    <div className="w-full h-full min-h-0 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-slate-900">Perfis de Acesso RBAC</h3>
            <p className="text-slate-500 text-xs">Defina permissões granulares por módulo, seção e ação</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge className="bg-blue-100 text-blue-700 px-3 py-1">{stats.totalPerfis} Perfis</Badge>
          <Badge className={`px-3 py-1 ${stats.cobertura >= 80 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{stats.cobertura}% Cobertura</Badge>
        </div>
      </div>

      {!contextoValido && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800">
            {contexto === 'grupo'
              ? 'Selecione um grupo para criar, editar ou excluir perfis de acesso no escopo correto.'
              : 'Selecione uma empresa vinculada a um grupo para criar, editar ou excluir perfis de acesso no escopo correto.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input placeholder="Buscar perfis..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" data-action="RBAC.Perfil.buscar" data-permission="Sistema.Controle de Acesso.visualizar" />
      </div>

      <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => { resetForm(); setPerfilAberto({ novo: true }); }} disabled={!contextoValido || !podeCriarPerfil} className="bg-blue-600 hover:bg-blue-700" data-action="RBAC.Perfil.novo" data-permission="Sistema.Controle de Acesso.criar" data-sensitive="true">
              <Plus className="w-4 h-4 mr-2" />Novo Perfil
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {perfisFiltrados.map(perfil => {
              const qtd = Object.values(perfil.permissoes || {}).reduce((s, m) => s + Object.values(m || {}).reduce((ss, sec) => ss + (sec?.length || 0), 0), 0);
              return (
                <Card key={perfil.id} className="hover:shadow-md transition-all">
                  <CardHeader className="bg-slate-50 border-b pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">{perfil.nome_perfil}</p>
                          <div className="flex gap-1 flex-wrap mt-1">
                            <Badge variant="outline" className="text-xs">{perfil.nivel_perfil}</Badge>
                            {qtd > 0 && <Badge className="bg-blue-100 text-blue-700 text-xs">{qtd} permissões</Badge>}
                          </div>
                        </div>
                      </div>
                      {perfil.ativo !== false ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3">
                    {perfil.descricao && <p className="text-xs text-slate-600 mb-2">{perfil.descricao}</p>}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge className="bg-purple-100 text-purple-700 text-xs">{usuarios.filter(u => u.perfil_acesso_id === perfil.id).length} usuários</Badge>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!contextoValido || !podeEditarPerfil} onClick={() => abrirEdicaoPerfil(perfil)} data-action="RBAC.Perfil.editar" data-permission="Sistema.Controle de Acesso.editar" data-context-required="group-or-company" data-sensitive="true">
                          <Edit className="w-3 h-3 mr-1" />Editar
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2" disabled={excluirPerfilMutation.isPending || !contextoValido || !podeExcluirPerfil} data-action="RBAC.Perfil.excluir" data-permission="Sistema.Controle de Acesso.excluir" data-sensitive="true" onClick={() => {
                          const using = usuarios.filter(u => u.perfil_acesso_id === perfil.id);
                          if (using.length > 0) { toast.error(`❌ ${using.length} usuário(s) usando este perfil`); return; }
                          if (confirm(`Regra-Mae: confirma exclusao do perfil "${perfil.nome_perfil || perfil.nome}"? Esta acao sensivel sera auditada e nao pode remover funcionalidades do sistema.`)) excluirPerfilMutation.mutate(perfil.id);
                        }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {perfisFiltrados.length === 0 && <div className="text-center py-8 text-slate-500"><Shield className="w-12 h-12 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum perfil encontrado</p></div>}
      </div>

      {/* MODAL: CRIAR/EDITAR PERFIL */}
      {perfilAberto && (
        <div className="fixed inset-2 sm:inset-4 z-[9999999] bg-white shadow-2xl flex flex-col rounded-xl border overflow-hidden">
          <div className="bg-blue-50 border-b p-4 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold">{perfilAberto.novo ? 'Novo Perfil' : `Editar: ${perfilAberto.nome_perfil}`}</h3>
              {contarPermissoesTotal() > 0 && <Badge className="bg-blue-600 text-white">{contarPermissoesTotal()} perm.</Badge>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPerfilAberto(null)} data-action="RBAC.Perfil.fechar">✕</Button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!formPerfil.nome_perfil) { toast.error("Nome é obrigatório"); return; }
              salvarPerfilMutation.mutate({
                ...formPerfil,
                nivel_acesso_contexto: formPerfil.escopo_acesso,
                acesso_grupo: formPerfil.escopo_acesso === "grupo" || formPerfil.escopo_acesso === "grupo_empresa",
                acesso_empresas: ["empresa", "grupo_empresa", "setores"].includes(formPerfil.escopo_acesso),
                departamentos_permitidos: formPerfil.setores_permitidos || [],
                group_id: grupoAtivoId || null,
                grupo_id: grupoAtivoId || null,
                ...(empresaAtivaId ? { empresa_id: empresaAtivaId } : {}),
              });
            }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">Nome *</Label><Input value={formPerfil.nome_perfil} onChange={(e) => setFormPerfil({ ...formPerfil, nome_perfil: e.target.value })} placeholder="Ex: Vendedor" className="mt-1" required disabled={!canManageOpenProfile} data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} /></div>
                <div><Label className="text-xs">Nível</Label>
                  <Select value={formPerfil.nivel_perfil} onValueChange={(v) => setFormPerfil({ ...formPerfil, nivel_perfil: v })}>
                    <SelectTrigger className="mt-1" disabled={!canManageOpenProfile} data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Administrador","Gerencial","Operacional","Consulta","Personalizado"].map(n => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Status</Label>
                  <div className="flex items-center gap-2 mt-2"><Switch checked={formPerfil.ativo} disabled={!canManageOpenProfile} data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-action="RBAC.Perfil.status" onCheckedChange={(v) => setFormPerfil({ ...formPerfil, ativo: v })} /><span className="text-sm">{formPerfil.ativo ? 'Ativo' : 'Inativo'}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Escopo de liberacao</Label>
                  <Select value={formPerfil.escopo_acesso} onValueChange={(v) => setFormPerfil({ ...formPerfil, escopo_acesso: v })}>
                    <SelectTrigger className="mt-1" disabled={!canManageOpenProfile} data-action="RBAC.Perfil.escopoAcesso" data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-context-required="group-or-company" data-sensitive="true"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grupo">Somente Grupo</SelectItem>
                      <SelectItem value="empresa">Somente Empresas</SelectItem>
                      <SelectItem value="grupo_empresa">Grupo e Empresas</SelectItem>
                      <SelectItem value="setores">Empresas e Setores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Setores permitidos</Label><Input value={(formPerfil.setores_permitidos || []).join(", ")} onChange={(e) => setSetoresPerfil(e.target.value)} placeholder="Comercial, Financeiro, Producao" className="mt-1" disabled={!canManageOpenProfile} data-action="RBAC.Perfil.setoresPermitidos" data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-context-required="group-or-company" data-sensitive="true" /></div>
              </div>
              <div><Label className="text-xs">Descrição</Label><Textarea value={formPerfil.descricao} onChange={(e) => setFormPerfil({ ...formPerfil, descricao: e.target.value })} placeholder="Responsabilidades do perfil" className="mt-1" rows={2} disabled={!canManageOpenProfile} data-action="RBAC.Perfil.descricao" data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} /></div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-bold">Permissões Granulares</Label>
                  <Button type="button" variant="outline" size="sm" disabled={!canManageOpenProfile} onClick={selecionarTudoGlobal} data-action="RBAC.Permissoes.tudoNada" data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-sensitive="true"><CheckSquare className="w-3 h-3 mr-1" />Tudo/Nada</Button>
                </div>
                <Alert className="mb-3 border-blue-200 bg-blue-50 py-2"><Info className="w-3 h-3 text-blue-600" /><AlertDescription className="text-xs text-blue-800">{contarPermissoesTotal()} permissões selecionadas</AlertDescription></Alert>
                <div className="border rounded-lg bg-slate-50 max-h-[50vh] overflow-auto">
                  <Accordion type="multiple" value={modulosExpandidos} onValueChange={setModulosExpandidos}>
                    {Object.entries(ESTRUTURA_SISTEMA).map(([modId, mod]) => {
                      const Icone = mod.icone;
                      const qtd = contarPermissoesModulo(modId);
                      return (
                        <AccordionItem key={modId} value={modId} className="border-b">
                          <AccordionTrigger className="px-3 py-2 hover:bg-white/50">
                            <div className="flex items-center gap-2 flex-1">
                              <Icone className={`w-4 h-4 ${COR_CLASS[mod.cor] || 'text-gray-600'}`} />
                              <span className="text-sm font-medium">{mod.nome}</span>
                              {qtd > 0 && <Badge className="bg-blue-100 text-blue-700 text-xs">{qtd}</Badge>}
                              <Button type="button" variant="ghost" size="sm" className="ml-auto h-5 px-2 text-xs" disabled={!canManageOpenProfile} data-action={`RBAC.Permissoes.modulo.${modId}`} data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-sensitive="true" onClick={(e) => { e.stopPropagation(); selecionarTudoModulo(modId); }}><CheckSquare className="w-3 h-3 mr-1" />Tudo</Button>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <div className="space-y-2">
                              {Object.entries(mod.secoes).map(([secId, sec]) => {
                                const qtdSec = formPerfil.permissoes?.[modId]?.[secId]?.length || 0;
                                return (
                                  <Card key={secId} className="border bg-white">
                                    <CardHeader className="bg-slate-50 border-b py-2 px-3">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-xs font-semibold">{sec.nome}</p>
                                          {sec.abas?.length > 0 && <p className="text-xs text-slate-400">{sec.abas.join(", ")}</p>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {qtdSec > 0 && <Badge className="bg-green-100 text-green-700 text-xs">{qtdSec}</Badge>}
                                          <Button type="button" size="sm" variant="ghost" className="h-5 px-2 text-xs" disabled={!canManageOpenProfile} data-action={`RBAC.Permissoes.secao.${modId}.${secId}`} data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-sensitive="true" onClick={() => selecionarTudoSecao(modId, secId)}><CheckSquare className="w-3 h-3" /></Button>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="p-2">
                                      <div className="flex flex-wrap gap-1">
                                        {ACOES.map(acao => {
                                          const marcado = temPermissao(modId, secId, acao.id);
                                          const IconeAcao = acao.icone;
                                          return (
                                            <label key={acao.id} className={`flex items-center gap-1 cursor-pointer px-2 py-1 rounded border text-xs transition-all ${marcado ? 'bg-blue-100 border-blue-300 text-blue-700 font-semibold' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                              <Checkbox checked={marcado} disabled={!canManageOpenProfile} data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-action={`RBAC.Permissao.${modId}.${secId}.${acao.id}`} data-sensitive="true" onCheckedChange={() => togglePermissao(modId, secId, acao.id)} />
                                              <IconeAcao className="w-3 h-3" />
                                              {acao.nome}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <Badge className="bg-slate-100 text-slate-700 text-xs">{contarPermissoesTotal()} perm. • {Object.keys(formPerfil.permissoes).length} módulos</Badge>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setPerfilAberto(null)} data-action="RBAC.Perfil.cancelar">Cancelar</Button>
                  <Button type="submit" disabled={salvarPerfilMutation.isPending || !formPerfil.nome_perfil || !contextoValido || !(perfilAberto?.novo ? podeCriarPerfil : podeEditarPerfil)} className="bg-blue-600 hover:bg-blue-700" data-action="RBAC.Perfil.salvar" data-permission={perfilAberto?.novo ? "Sistema.Controle de Acesso.criar" : "Sistema.Controle de Acesso.editar"} data-sensitive="true">
                    {salvarPerfilMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" />Salvando...</> : <><CheckCircle className="w-4 h-4 mr-1" />Salvar</>}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
