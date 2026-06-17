import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import BadgeOrigemPedido from "./BadgeOrigemPedido";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { 
  Plus, 
  Edit2, 
  FileText, 
  Truck, 
  CheckCircle2, 
  Factory, 
  Eye, 
  Trash2,
  ShieldCheck,
  AlertCircle,
  Clock,
  XCircle,
  Printer,
  Download,
  MoreVertical
 } from "lucide-react";
import ERPDataTable from "@/components/ui/erp/DataTable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ImprimirPedido } from "@/components/lib/impressao";
import { useToast } from "@/components/ui/use-toast";

import SearchInput from "../ui/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWindow } from "@/components/lib/useWindow";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CentralAprovacoesManager from "./CentralAprovacoesManager";
import usePermissions from "@/components/lib/usePermissions";
import useEntityListSorted from "@/components/lib/useEntityListSorted";
import usePersistedSort from "@/components/lib/usePersistedSort";
import AutomacaoFluxoPedido from "./AutomacaoFluxoPedido";
import useBackendPagination from "@/components/lib/useBackendPagination";
import { ProtectedAction } from "@/components/ProtectedAction";

export default function PedidosTab({ pedidos, clientes, isLoading, empresas, onCreatePedido, onEditPedido, empresaId = null }) {
  const { canEdit, canCreate, canApprove, canDelete, hasPermission } = usePermissions();
  const { openWindow, closeWindow } = useWindow();
  const { empresaAtual, grupoAtual, updateInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaContextoId = empresaId || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaContextoId);
  const canViewPedido = hasPermission('Comercial', 'Pedido', 'visualizar') || hasPermission('Comercial', 'Pedidos', 'visualizar') || hasPermission('Comercial', null, 'visualizar');
  const { page, setPage, pageSize, setPageSize } = useBackendPagination('Pedido', 20);
  const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('Pedido', 'data_pedido', 'desc');

  // persistência de sort movida para usePersistedSort

  const { data: pedidosBackend = [] } = useEntityListSorted('Pedido', {}, { sortField, sortDirection, page, pageSize, limit: pageSize, campo: 'empresa_id', enabled: contextoValido && canViewPedido });
  const pedidosList = Array.isArray(pedidos) && pedidos.length ? pedidos : pedidosBackend;
  // V21.6: Multi-empresa
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Seleção em massa + exportação
  const [selectedPedidos, setSelectedPedidos] = useState([]);
  const togglePedido = (id) => setSelectedPedidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllPedidos = (checked, lista) => setSelectedPedidos(checked ? lista.map(p => p.id) : []);
  const exportarPedidosCSV = (lista) => {
    const headers = ['numero_pedido','cliente_nome','empresa_id','data_pedido','valor_total','status','status_aprovacao'];
    const csv = [
      headers.join(','),
      ...lista.map(p => headers.map(h => JSON.stringify(p[h] ?? '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Pedido.delete(id),
    onSuccess: async (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({ title: "✅ Pedido excluído!" });
      try { await base44.entities.AuditLog.create({ acao: 'Exclusão', modulo: 'Comercial', entidade: 'Pedido', registro_id: id, descricao: 'Pedido excluído', data_hora: new Date().toISOString() }); } catch(_) {}
    },
  });

  const filteredPedidos = pedidosList.filter(p => {
    const matchStatus = statusFilter === "todos" || p.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = 
      p.numero_pedido?.toLowerCase().includes(searchLower) ||
      p.cliente_nome?.toLowerCase().includes(searchLower) ||
      p.vendedor?.toLowerCase().includes(searchLower) ||
      p.tipo_pedido?.toLowerCase().includes(searchLower) ||
      p.origem_pedido?.toLowerCase().includes(searchLower) ||
      p.status?.toLowerCase().includes(searchLower) ||
      p.observacoes_publicas?.toLowerCase().includes(searchLower) ||
      p.observacoes_internas?.toLowerCase().includes(searchLower) ||
      p.indicador_nome?.toLowerCase().includes(searchLower) ||
      p.obra_destino_nome?.toLowerCase().includes(searchLower);
    const matchEmpresa = !empresaId || p.empresa_id === empresaId;
    return matchStatus && matchSearch && matchEmpresa;
  });

  // ETAPA 4: Estatísticas de aprovação
  const pedidosPendentesAprovacao = pedidosList.filter(p => p.status_aprovacao === "pendente");
  const pedidosAprovados = pedidosList.filter(p => p.status_aprovacao === "aprovado");
  const pedidosNegados = pedidosList.filter(p => p.status_aprovacao === "negado");

  // Seleção padronizada (todos os registros visíveis)
  const allSelected = React.useMemo(() => selectedPedidos.length === filteredPedidos.length && filteredPedidos.length > 0, [selectedPedidos, filteredPedidos]);
  const onToggleSelectAll = () => {
    if (!allSelected) setSelectedPedidos(filteredPedidos.map(p => p.id));
    else setSelectedPedidos([]);
  };

  const notifyWhatsAppPendentes = async (ids) => {
    const alvo = (Array.isArray(ids) && ids.length ? ids : pedidosPendentesAprovacao.map(p=>p.id)).slice(0,50);
    if (!alvo.length) { toast({ title: 'Sem pendentes selecionados' }); return; }
    try {
      await base44.functions.invoke('whatsappSend', { template: 'aprovacao_pendente', pedido_ids: alvo });
      toast({ title: '📲 WhatsApp enviado', description: `${alvo.length} pedido(s)` });
      try { await base44.entities.AuditLog.create({ acao: 'Notificação', modulo: 'Comercial', entidade: 'Pedido', descricao: `WhatsApp aprovação pendente (${alvo.length})`, data_hora: new Date().toISOString() }); } catch {}
    } catch { toast({ title: 'Falha ao notificar WhatsApp', variant: 'destructive' }); }
  };
  const notifyEmailPendentes = async (ids) => {
    const alvo = (Array.isArray(ids) && ids.length ? ids : pedidosPendentesAprovacao.map(p=>p.id)).slice(0,50);
    if (!alvo.length) { toast({ title: 'Sem pendentes selecionados' }); return; }
    try {
      await base44.functions.invoke('sendEmailProvider', { tipo: 'aprovacao_pendente', pedido_ids: alvo });
      toast({ title: '✉️ E-mails enviados', description: `${alvo.length} pedido(s)` });
      try { await base44.entities.AuditLog.create({ acao: 'Notificação', modulo: 'Comercial', entidade: 'Pedido', descricao: `Email aprovação pendente (${alvo.length})`, data_hora: new Date().toISOString() }); } catch {}
    } catch { toast({ title: 'Falha ao notificar por email', variant: 'destructive' }); }
  };

  const columns = React.useMemo(() => ([
    { key: 'numero_pedido', label: 'N° Pedido', render: (r) => <span className="font-semibold">{r.numero_pedido}</span> },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'data_pedido', label: 'Data', render: (r) => new Date(r.data_pedido).toLocaleDateString('pt-BR') },
    { key: 'origem_pedido', label: 'Origem', render: (r) => <BadgeOrigemPedido origemPedido={r.origem_pedido} showLock={true} /> },
    { key: 'valor_total', label: 'Valor', isNumeric: true, render: (r) => <span className="font-bold text-green-600">R$ {(r.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> },
    { key: 'status', label: 'Status', render: (r) => (
      <Badge className={
        r.status === 'Entregue' ? 'bg-green-600 text-white' :
        r.status === 'Em Trânsito' ? 'bg-purple-600 text-white' :
        r.status === 'Em Expedição' ? 'bg-orange-600 text-white' :
        r.status === 'Faturado' ? 'bg-blue-600 text-white' :
        r.status === 'Pronto para Faturar' ? 'bg-indigo-600 text-white' :
        r.status === 'Aprovado' ? 'bg-green-500 text-white' :
        r.status === 'Aguardando Aprovação' ? 'bg-yellow-500 text-white' :
        r.status === 'Cancelado' ? 'bg-red-600 text-white' :
        'bg-slate-500 text-white'
      }>
        {r.status}
      </Badge>
    ) },
    { key: 'aprovacao', label: 'Aprovação', render: (r) => (
      r.status_aprovacao === 'pendente' ? (
        <Badge className="bg-orange-100 text-orange-700"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>
      ) : r.status_aprovacao === 'aprovado' ? (
        <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</Badge>
      ) : r.status_aprovacao === 'negado' ? (
        <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Negado</Badge>
      ) : (
        <Badge variant="outline" className="text-xs">-</Badge>
      )
    ) },
    { key: 'actions', label: 'Ações Rápidas', render: (pedido) => (
      <div className="flex items-center gap-1">
        {pedido.status === 'Rascunho' && (
          <Button 
            variant="ghost" size="sm"
            data-permission="Comercial.Pedido.fechar"
            onClick={() => {
              const windowId = openWindow(
                AutomacaoFluxoPedido,
                { pedido, empresaId: pedido.empresa_id, windowMode: true,
                  onComplete: () => {
                    queryClient.invalidateQueries({ queryKey: ['pedidos'] });
                    queryClient.invalidateQueries({ queryKey: ['produtos'] });
                    queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
                    queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
                    queryClient.invalidateQueries({ queryKey: ['entregas'] });
                    toast({ title: '✅ Pedido fechado com sucesso!' });
                  }
                },
                { title: `🚀 Automação - Pedido ${pedido.numero_pedido}`, width: 1200, height: 700 }
              );
            }}
            className="h-8 px-2 bg-gradient-to-r from-green-600 to-blue-600 text-white hover:from-green-700 hover:to-blue-700 font-semibold shadow-lg"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            <span className="text-xs">🚀 Fechar Pedido</span>
          </Button>
        )}

        <Button
           variant="ghost"
           size="sm"
           data-permission="Comercial.Pedido.editar"
           data-sensitive
           disabled={pedido.status_aprovacao === 'pendente' && !(canApprove && canApprove('Comercial','Pedido'))}
           onClick={async () => {
             try { await base44.entities.AuditLog.create({ acao: 'Edição', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Abrir editor de pedido', data_hora: new Date().toISOString() }); } catch {}
             onEditPedido(pedido);
           }}
           title={pedido.status_aprovacao === 'pendente' ? 'Edição bloqueada até aprovação' : 'Editar Pedido'}
           className="h-8 px-2"
         >
          <Edit2 className="w-3 h-3 mr-1" />
          <span className="text-xs">Editar</span>
        </Button>

        {pedido.status === 'Aprovado' && (
          <>
            <Button 
               variant="ghost" size="sm"
               data-permission="Comercial.Pedido.marcarProntoFaturar"
               onClick={async () => {
                try {
                  await updateInContext('Pedido', pedido.id, { status: 'Pronto para Faturar' });
                  toast({ title: '✅ Pedido fechado para entrega!' });
                  queryClient.invalidateQueries({ queryKey: ['pedidos'] });
                  try { await base44.entities.AuditLog.create({ acao: 'Edição', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Status → Pronto para Faturar', data_hora: new Date().toISOString(), sucesso: true }); } catch {}
                } catch {
                  toast({ title: '❌ Erro ao fechar pedido', variant: 'destructive' });
                }
              }}
              className="h-8 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200"
            >
              <Truck className="w-4 h-4 mr-1" />
              <span className="text-xs">🚚 Fechar p/ Entrega</span>
            </Button>
            <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.gerarNFe" data-sensitive onClick={async () => { toast({ title: '🚀 Gerando NF-e...' }); try { await base44.entities.AuditLog.create({ acao: 'Emissão NF-e', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Acionada geração de NF-e', data_hora: new Date().toISOString() }); } catch {} }} title="Gerar NF-e" className="h-8 px-2 text-green-600">
              <FileText className="w-3 h-3 mr-1" />
              <span className="text-xs">NF-e</span>
            </Button>
          </>
        )}

        {pedido.status === 'Pronto para Faturar' && (
          <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.gerarNFe" data-sensitive onClick={async () => { toast({ title: '🚀 Gerando NF-e...' }); try { await base44.entities.AuditLog.create({ acao: 'Emissão NF-e', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Acionada geração de NF-e', data_hora: new Date().toISOString() }); } catch {} }} title="Gerar NF-e" className="h-8 px-2 text-green-600">
            <FileText className="w-3 h-3 mr-1" />
            <span className="text-xs">NF-e</span>
          </Button>
        )}

        {pedido.status === 'Faturado' && (
          <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.criarEntrega" data-sensitive onClick={async () => { toast({ title: '📦 Criando entrega...' }); try { await base44.entities.AuditLog.create({ acao: 'Criação Entrega', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Acionada criação de entrega', data_hora: new Date().toISOString() }); } catch {} }} title="Criar Entrega" className="h-8 px-2 text-blue-600">
            <Truck className="w-3 h-3 mr-1" />
            <span className="text-xs">Entrega</span>
          </Button>
        )}

        {(pedido.tipo_pedido === 'Produção Sob Medida' || pedido.itens_corte_dobra?.length > 0 || pedido.itens_armado_padrao?.length > 0) && pedido.status !== 'Cancelado' && (
          <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.gerarOP" data-sensitive onClick={async () => { toast({ title: '🏭 Criando OP...' }); try { await base44.entities.AuditLog.create({ acao: 'Gerar OP', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Acionada geração de OP', data_hora: new Date().toISOString() }); } catch {} }} title="Gerar Ordem de Produção" className="h-8 px-2 text-purple-600">
            <Factory className="w-3 h-3 mr-1" />
            <span className="text-xs">OP</span>
          </Button>
        )}

        <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.imprimir" onClick={async () => { const empresa = empresas?.find(e => e.id === pedido.empresa_id); try { await base44.entities.AuditLog.create({ acao: 'Impressão', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Imprimir pedido', data_hora: new Date().toISOString() }); } catch {} ImprimirPedido({ pedido, empresa }); }} title="Imprimir Pedido" className="h-8 px-2 text-slate-600">
          <Printer className="w-3 h-3 mr-1" />
          <span className="text-xs">Imprimir</span>
        </Button>

        <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.visualizar" onClick={async () => { try { await base44.entities.AuditLog.create({ acao: 'Visualização', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Abrir visualização do pedido', data_hora: new Date().toISOString() }); } catch {} onEditPedido(pedido); }} title="Visualizar" className="h-8 px-2">
          <Eye className="w-3 h-3 mr-1" />
          <span className="text-xs">Ver</span>
        </Button>

        {pedido.status_aprovacao === 'pendente' && (
          <Button variant="ghost" size="sm" onClick={() => openWindow(CentralAprovacoesManager, { windowMode: true, initialTab: 'descontos' }, { title: '🔐 Central de Aprovações', width: 1200, height: 700 })} title="Analisar Aprovação" className="h-8 px-2 text-orange-600 animate-pulse">
            <ShieldCheck className="w-3 h-3 mr-1" />
            <span className="text-xs">Analisar</span>
          </Button>
        )}

        <Button variant="ghost" size="sm" data-permission="Comercial.Pedido.excluir" data-sensitive onClick={async () => { if (confirm('Excluir pedido?')) { try { await base44.entities.AuditLog.create({ acao: 'Exclusão', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Exclusão solicitada via UI', data_hora: new Date().toISOString() }); } catch {} deleteMutation.mutate(pedido.id); } }} title="Excluir" className="h-8 px-2 text-red-600">
          <Trash2 className="w-3 h-3 mr-1" />
          <span className="text-xs">Excluir</span>
        </Button>
      </div>
    )}
  ]), [queryClient, toast, onEditPedido]);

  const menuItems = (pedido) => {
    const items = [];
    items.push({ key: 'ver', label: 'Visualizar', action: async () => { try { await base44.entities.AuditLog.create({ acao: 'Visualização', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Abrir visualização do pedido', data_hora: new Date().toISOString() }); } catch {} onEditPedido(pedido); } });
    items.push({ key: 'imprimir', label: 'Imprimir', action: async () => { const empresa = empresas?.find(e => e.id === pedido.empresa_id); try { await base44.entities.AuditLog.create({ acao: 'Impressão', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Imprimir pedido', data_hora: new Date().toISOString() }); } catch {} ImprimirPedido({ pedido, empresa }); } });
    if (pedido.status === 'Aprovado' || pedido.status === 'Pronto para Faturar') {
      items.push({ key: 'nfe', label: 'Gerar NF-e', action: async () => { toast({ title: '🚀 Gerando NF-e...' }); try { await base44.entities.AuditLog.create({ acao: 'Emissão NF-e', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Acionada geração de NF-e', data_hora: new Date().toISOString() }); } catch {} } });
    }
    if (pedido.status === 'Faturado') {
      items.push({ key: 'entrega', label: 'Criar Entrega', action: async () => { toast({ title: '📦 Criando entrega...' }); try { await base44.entities.AuditLog.create({ acao: 'Criação Entrega', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Acionada criação de entrega', data_hora: new Date().toISOString() }); } catch {} } });
    }
    if ((pedido.tipo_pedido === 'Produção Sob Medida' || pedido.itens_corte_dobra?.length > 0 || pedido.itens_armado_padrao?.length > 0) && pedido.status !== 'Cancelado') {
      items.push({ key: 'op', label: 'Gerar OP', action: async () => { toast({ title: '🏭 Criando OP...' }); try { await base44.entities.AuditLog.create({ acao: 'Gerar OP', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Acionada geração de OP', data_hora: new Date().toISOString() }); } catch {} } });
    }
    items.push({ key: 'excluir', label: 'Excluir', action: async () => { if (confirm('Excluir pedido?')) { try { await base44.entities.AuditLog.create({ acao: 'Exclusão', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido.id, descricao: 'Exclusão solicitada via UI', data_hora: new Date().toISOString() }); } catch {} deleteMutation.mutate(pedido.id); } } });
    if (pedido.status_aprovacao === 'pendente') {
      items.push({ key: 'aprovar', label: 'Analisar Aprovação', action: () => openWindow(CentralAprovacoesManager, { windowMode: true, initialTab: 'descontos' }, { title: '🔐 Central de Aprovações', width: 1200, height: 700 }) });
    }
    return items;
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      {/* ETAPA 4: ALERTA DE APROVAÇÕES PENDENTES */}
      {pedidosPendentesAprovacao.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-orange-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {pedidosPendentesAprovacao.length} pedido(s) aguardando aprovação
                </p>
                <p className="text-xs text-orange-700 mt-1">
                Pedidos com descontos ou outras pendências financeiras aguardam sua análise.
                </p>
                </div>
                <Button
                onClick={() => openWindow(CentralAprovacoesManager, { windowMode: true }, {
                title: '🔐 Central de Aprovações',
                width: 1200,
                height: 700
                })}
                className="bg-orange-600 hover:bg-orange-600/90"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Gerenciar Aprovações
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Bloco Resumido de Aprovação + Notificações */}
      {pedidosPendentesAprovacao.length > 0 && (
        <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-slate-700">
              Há <span className="font-semibold">{pedidosPendentesAprovacao.length}</span> pedido(s) aguardando aprovação.
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => openWindow(CentralAprovacoesManager, { windowMode: true }, { title: '🔐 Central de Aprovações', width: 1200, height: 700 })} className="bg-orange-600 hover:bg-orange-600/90">
                Central de Aprovações
              </Button>
              <Button variant="outline" onClick={() => notifyWhatsAppPendentes(selectedPedidos)}>
                Notificar WhatsApp
              </Button>
              <Button variant="outline" onClick={() => notifyEmailPendentes(selectedPedidos)}>
                Notificar Email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ESTATÍSTICAS DE APROVAÇÃO */}
      {(pedidosAprovados.length > 0 || pedidosNegados.length > 0 || pedidosPendentesAprovacao.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Pendentes Aprovação</p>
                <p className="text-2xl font-bold text-orange-900">{pedidosPendentesAprovacao.length}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-400" />
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Descontos Aprovados</p>
                <p className="text-2xl font-bold text-green-900">{pedidosAprovados.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-md border-white/40 shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Descontos Negados</p>
                <p className="text-2xl font-bold text-red-900">{pedidosNegados.length}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pedidos</h2>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={onCreatePedido} data-permission="Comercial.Pedido.criar">
          <Plus className="w-4 h-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <ResizablePanelGroup direction="vertical" className="w-full h-full">
        <ResizablePanel defaultSize={25} minSize={15}>
          <Card className="border-0 shadow-md rounded-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar por número, cliente, vendedor, tipo, origem, status..."
                  className="flex-1"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Aguardando Aprovação">Aguardando Aprovação</SelectItem>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Pronto para Faturar">Pronto para Faturar</SelectItem>
                    <SelectItem value="Faturado">Faturado</SelectItem>
                    <SelectItem value="Em Expedição">Em Expedição</SelectItem>
                    <SelectItem value="Entregue">Entregue</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={75} minSize={40}>
          <Card className="border-0 shadow-md rounded-sm h-full">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle>Lista de Pedidos ({filteredPedidos.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {selectedPedidos.length > 0 && (
            <Alert className="m-4 border-blue-300 bg-blue-50">
              <AlertDescription className="flex items-center justify-between">
                <div className="text-blue-900 font-semibold">{selectedPedidos.length} pedido(s) selecionado(s)</div>
                <div className="flex gap-2">
                  <ProtectedAction module="Comercial" section="Pedido" action="exportar" mode="disable">
                  <Button variant="outline" onClick={() => {
                    const lista = filteredPedidos.filter(p => selectedPedidos.includes(p.id));
                    const headers = ['numero_pedido','cliente_nome','empresa_id','data_pedido','valor_total','status','status_aprovacao'];
                    const csv = [headers.join(','), ...lista.map(p => headers.map(h => JSON.stringify(p[h] ?? '')).join(','))].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `pedidos_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
                    try { base44.entities.AuditLog.create({ acao: 'Exportação', modulo: 'Comercial', entidade: 'Pedido', descricao: `Exportados ${lista.length} pedidos`, data_hora: new Date().toISOString() }); } catch {}
                  }}>
                    <Download className="w-4 h-4 mr-2" /> Exportar CSV
                  </Button>
                  </ProtectedAction>
                  <Button variant="outline" onClick={() => notifyWhatsAppPendentes(selectedPedidos)}>WhatsApp</Button>
                  <Button variant="outline" onClick={() => notifyEmailPendentes(selectedPedidos)}>Email</Button>
                  <Button variant="ghost" onClick={() => setSelectedPedidos([])}>Limpar Seleção</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          <ERPDataTable
            columns={columns}
            data={filteredPedidos}
            entityName="Pedido"
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(sf, sd) => { setSortField(sf); setSortDirection(sd); }}
            selectedIds={selectedPedidos}
            allSelected={allSelected}
            onToggleSelectAll={onToggleSelectAll}
            onToggleItem={(id) => togglePedido(id)}
            permission="Comercial.Pedido.visualizar"
            rowContextMenuItems={menuItems}
            page={page}
            pageSize={pageSize}
            totalItems={page * pageSize + (pedidosBackend.length < pageSize ? 0 : 1)}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />

{/* paginação integrada ao ERPDataTable */}

          {filteredPedidos.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </ResizablePanel>
  </ResizablePanelGroup>
</div>
  );
}
