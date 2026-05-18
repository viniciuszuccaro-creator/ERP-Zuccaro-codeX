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
  Shield, Users, CheckCircle, XCircle, Plus, Edit, Search,
  Eye, Pencil, Trash2, AlertTriangle, RefreshCw,
  CheckSquare, LayoutDashboard, ShoppingCart, DollarSign,
  Package, Truck, Factory, UserCircle, FileText, BarChart3, Download,
  MessageCircle, Briefcase, Calendar, Info, Settings
} from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ESTRUTURA_SISTEMA = {
  dashboard: { nome: "Dashboard", icone: LayoutDashboard, cor: "blue", secoes: { principal: { nome: "Visão Geral", abas: ["kpis", "graficos", "alertas"] }, corporativo: { nome: "Dashboard Corporativo", abas: ["multiempresa", "consolidado"] } } },
  comercial: { nome: "Comercial e Vendas", icone: ShoppingCart, cor: "green", secoes: { clientes: { nome: "Clientes", abas: ["lista", "detalhes", "historico", "crm"] }, pedidos: { nome: "Pedidos", abas: ["lista", "novo", "aprovacao", "faturamento"] }, orcamentos: { nome: "Orçamentos", abas: ["lista", "novo", "conversao"] }, tabelas_preco: { nome: "Tabelas de Preço", abas: ["lista", "itens"] }, comissoes: { nome: "Comissões", abas: ["lista", "calculo", "pagamento"] }, notas_fiscais: { nome: "Notas Fiscais", abas: ["emissao", "lista", "cancelamento"] } } },
  financeiro: { nome: "Financeiro e Contábil", icone: DollarSign, cor: "emerald", secoes: { contas_receber: { nome: "Contas a Receber", abas: ["lista", "baixa", "cobranca", "boletos"] }, contas_pagar: { nome: "Contas a Pagar", abas: ["lista", "baixa", "aprovacao", "pagamento"] }, caixa: { nome: "Caixa Diário", abas: ["movimentos", "fechamento", "transferencias"] }, conciliacao: { nome: "Conciliação Bancária", abas: ["importar", "conciliar", "historico"] }, relatorios: { nome: "Relatórios Financeiros", abas: ["dre", "fluxo_caixa", "inadimplencia"] } } },
  estoque: { nome: "Estoque e Almoxarifado", icone: Package, cor: "purple", secoes: { produtos: { nome: "Produtos", abas: ["lista", "novo", "lotes", "validade"] }, movimentacoes: { nome: "Movimentações", abas: ["entrada", "saida", "transferencia", "ajuste"] }, inventario: { nome: "Inventário", abas: ["contagem", "acerto", "historico"] }, requisicoes: { nome: "Requisições", abas: ["lista", "aprovacao", "atendimento"] } } },
  compras: { nome: "Compras e Suprimentos", icone: Briefcase, cor: "orange", secoes: { fornecedores: { nome: "Fornecedores", abas: ["lista", "avaliacao", "historico"] }, solicitacoes: { nome: "Solicitações", abas: ["lista", "nova", "aprovacao"] }, cotacoes: { nome: "Cotações", abas: ["lista", "nova", "comparativo"] }, ordens_compra: { nome: "Ordens de Compra", abas: ["lista", "nova", "recebimento"] } } },
  expedicao: { nome: "Expedição e Logística", icone: Truck, cor: "cyan", secoes: { entregas: { nome: "Entregas", abas: ["lista", "separacao", "despacho", "rastreamento"] }, romaneios: { nome: "Romaneios", abas: ["lista", "novo", "impressao"] }, roteirizacao: { nome: "Roteirização", abas: ["mapa", "otimizacao", "motoristas"] }, transportadoras: { nome: "Transportadoras", abas: ["lista", "tabelas_frete"] } } },
  producao: { nome: "Produção e Manufatura", icone: Factory, cor: "indigo", secoes: { ordens_producao: { nome: "Ordens de Produção", abas: ["lista", "nova", "programacao", "kanban"] }, apontamentos: { nome: "Apontamentos", abas: ["producao", "paradas", "refugo"] }, qualidade: { nome: "Qualidade", abas: ["inspecao", "nao_conformidades", "acoes"] } } },
  rh: { nome: "Recursos Humanos", icone: UserCircle, cor: "pink", secoes: { colaboradores: { nome: "Colaboradores", abas: ["lista", "documentos", "historico"] }, ponto: { nome: "Ponto Eletrônico", abas: ["registros", "ajustes", "relatorios"] }, ferias: { nome: "Férias", abas: ["programacao", "solicitacoes", "aprovacao"] }, folha: { nome: "Folha de Pagamento", abas: ["calculo", "holerites", "encargos"] } } },
  fiscal: { nome: "Fiscal e Tributário", icone: FileText, cor: "red", secoes: { nfe: { nome: "NF-e", abas: ["emissao", "entrada", "manifestacao", "inutilizacao"] }, tabelas_fiscais: { nome: "Tabelas Fiscais", abas: ["cfop", "cst", "ncm", "aliquotas"] }, sped: { nome: "SPED", abas: ["fiscal", "contribuicoes", "contabil"] }, obrigacoes: { nome: "Obrigações Acessórias", abas: ["calendario", "guias", "declaracoes"] } } },
  cadastros: { nome: "Cadastros Gerais", icone: Users, cor: "slate", secoes: { pessoas: { nome: "Pessoas & Parceiros", abas: ["clientes", "fornecedores", "transportadoras", "colaboradores"] }, produtos: { nome: "Produtos & Serviços", abas: ["produtos", "servicos", "grupos", "marcas"] }, financeiro: { nome: "Financeiro", abas: ["bancos", "formas_pagamento", "centros_custo"] }, logistica: { nome: "Logística", abas: ["veiculos", "motoristas", "rotas"] }, organizacional: { nome: "Organizacional", abas: ["empresas", "departamentos", "cargos", "usuarios"] }, integracoes: { nome: "Integrações & IA", abas: ["apis", "webhooks", "chatbot", "jobs_ia"] } } },
  crm: { nome: "CRM - Relacionamento", icone: MessageCircle, cor: "violet", secoes: { oportunidades: { nome: "Oportunidades", abas: ["funil", "lista", "conversao"] }, interacoes: { nome: "Interações", abas: ["historico", "nova", "follow_up"] }, campanhas: { nome: "Campanhas", abas: ["lista", "nova", "resultados"] } } },
  agenda: { nome: "Agenda e Calendário", icone: Calendar, cor: "amber", secoes: { eventos: { nome: "Eventos", abas: ["calendario", "lista", "notificacoes"] }, tarefas: { nome: "Tarefas", abas: ["kanban", "lista", "atribuicao"] } } },
  relatorios: { nome: "Relatórios e Análises", icone: BarChart3, cor: "teal", secoes: { dashboards: { nome: "Dashboards", abas: ["executivo", "operacional", "financeiro"] }, relatorios: { nome: "Relatórios", abas: ["vendas", "estoque", "financeiro", "rh"] }, exportacao: { nome: "Exportação", abas: ["excel", "pdf", "api"] } } },
  sistema: { nome: "Configurações do Sistema", icone: Settings, cor: "gray", secoes: { configuracoes: { nome: "Configurações Gerais", abas: ["geral", "notificacoes", "backup"] }, integracoes: { nome: "Integrações", abas: ["nfe", "boletos", "whatsapp", "marketplaces"] }, acessos: { nome: "Controle de Acesso", abas: ["perfis", "usuarios", "grupos"] }, ia: { nome: "IA & Otimização", abas: ["modelos", "limites", "logs"] } } },
};

const ACOES = [
  { id: "visualizar", nome: "Visualizar", icone: Eye, cor: "slate" },
  { id: "criar", nome: "Criar", icone: Plus, cor: "blue" },
  { id: "editar", nome: "Editar", icone: Pencil, cor: "green" },
  { id: "excluir", nome: "Excluir", icone: Trash2, cor: "red" },
  { id: "aprovar", nome: "Aprovar", icone: CheckSquare, cor: "purple" },
  { id: "exportar", nome: "Exportar", icone: Download, cor: "cyan" },
];

const COR_CLASS = { blue: "text-blue-600", green: "text-green-600", emerald: "text-emerald-600", purple: "text-purple-600", orange: "text-orange-600", cyan: "text-cyan-600", indigo: "text-indigo-600", pink: "text-pink-600", slate: "text-slate-600", red: "text-red-600", violet: "text-violet-600", amber: "text-amber-600", teal: "text-teal-600", sky: "text-sky-600", gray: "text-gray-600" };

export default function CentralPerfisAcesso() {
  const [perfilAberto, setPerfilAberto] = useState(null);
  const [usuarioAberto, setUsuarioAberto] = useState(null);
  const [busca, setBusca] = useState("");
  const [modulosExpandidos, setModulosExpandidos] = useState([]);
  const [formPerfil, setFormPerfil] = useState({ nome_perfil: "", descricao: "", nivel_perfil: "Operacional", permissoes: {}, ativo: true });

  const queryClient = useQueryClient();
  const { contexto, empresaAtual, grupoAtual, empresasDoGrupo = [], filterInContext } = useContextoVisual();
  const { user, hasPermission, isAdmin } = usePermissions();
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = contexto === 'grupo' ? null : empresaAtual?.id;
  const scopeKey = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const contextoValido = scopeKey !== 'sem-contexto';
  const podeCriarPerfil = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'criar');
  const podeEditarPerfil = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'editar');
  const podeExcluirPerfil = isAdmin() || hasPermission('Sistema', ['Controle de Acesso'], 'excluir');
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);

  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis-acesso', scopeKey],
    queryFn: async () => {
      const scoped = contextoValido ? await filterInContext('PerfilAcesso', {}, '-updated_date', 500) : [];
      if (scoped.length) return scoped;
      return base44.entities.PerfilAcesso.list('-updated_date', 500);
    },
    enabled: true,
  });
  const usuarioNoEscopo = (u) => {
    if (!u) return false;
    const vinculadas = normalizeEmpresaIds(u.empresas_vinculadas);
    const temMarcacaoEscopo = u.group_id || u.grupo_id || u.grupo_atual_id || u.empresa_id || u.empresa_atual_id || vinculadas.length > 0;
    if (!temMarcacaoEscopo) return true;
    if (contexto === 'grupo') {
      const empresasIds = empresasDoGrupo.map((e) => e.id);
      return u.group_id === grupoAtivoId ||
        u.grupo_id === grupoAtivoId ||
        u.grupo_atual_id === grupoAtivoId ||
        vinculadas.some((id) => empresasIds.includes(id));
    }
    return u.empresa_id === empresaAtivaId ||
      u.empresa_atual_id === empresaAtivaId ||
      vinculadas.includes(empresaAtivaId);
  };

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios', scopeKey],
    queryFn: async () => {
      const rows = await base44.entities.User.list();
      return rows.filter(usuarioNoEscopo);
    },
    enabled: contextoValido,
  });

  const salvarPerfilMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de salvar o perfil.');
      }

      const perfilId = perfilAberto?.id;
      if (perfilId && !perfilAberto.novo) return base44.entities.PerfilAcesso.update(perfilId, data);
      return base44.entities.PerfilAcesso.create(data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso', scopeKey] });
      const foiCriacao = perfilAberto?.novo;
      toast.success(foiCriacao ? "Perfil criado com sucesso!" : "Perfil atualizado com sucesso!");
      try {
        base44.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Usuario',
          usuario_id: user?.id || null,
          empresa_id: empresaAtivaId || null,
          group_id: grupoAtivoId || null,
          acao: foiCriacao ? 'Criacao' : 'Edicao',
          modulo: 'Controle de Acesso',
          entidade: 'PerfilAcesso',
          registro_id: result?.id || perfilAberto?.id,
          descricao: (foiCriacao ? 'Criacao' : 'Atualizacao') + ` do perfil "${result?.nome_perfil || formPerfil.nome_perfil}"`,
          dados_novos: result || formPerfil,
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch {}
      setTimeout(() => { setPerfilAberto(null); resetForm(); }, 300);
    },
    onError: (error) => toast.error("Erro ao salvar: " + error.message),
  });

  const excluirPerfilMutation = useMutation({
    mutationFn: (id) => {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de excluir o perfil.');
      }
      return base44.entities.PerfilAcesso.delete(id);
    },
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso', scopeKey] });
      toast.success("Perfil excluido!");
      try {
        base44.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Usuario',
          usuario_id: user?.id || null,
          acao: 'Exclusao',
          modulo: 'Controle de Acesso',
          entidade: 'PerfilAcesso',
          registro_id: id,
          empresa_id: empresaAtivaId || null,
          group_id: grupoAtivoId || null,
          descricao: 'Perfil de acesso excluido',
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch {}
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });



  const resetForm = () => setFormPerfil({ nome_perfil: "", descricao: "", nivel_perfil: "Operacional", permissoes: {}, ativo: true });

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
    setFormPerfil({ nome_perfil: perfil.nome_perfil || "", descricao: perfil.descricao || "", nivel_perfil: perfil.nivel_perfil || "Operacional", permissoes: perfil.permissoes || {}, ativo: perfil.ativo !== false });
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
            Selecione um grupo ou empresa para criar, editar ou excluir perfis de acesso no escopo correto.
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
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!podeEditarPerfil} onClick={() => abrirEdicaoPerfil(perfil)} data-action="RBAC.Perfil.editar" data-permission="Sistema.Controle de Acesso.editar" data-sensitive="true">
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


